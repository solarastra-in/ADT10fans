import { db, Match, InningsScorecard, AppStore } from '../db';
import { normName, computePlayerPoints } from '../fantasy';
import { afterMatchCompleted } from '../reminders';
import { ScrapedMatchSummary, ScrapedScorecard, ScrapedTeamSquad } from './types';
import { scrapeCricbuzzLiveMatches, scrapeCricbuzzScorecard, scrapeCricbuzzSquads } from './cricbuzzScraper';
import { scrapeCricinfoLiveMatches, scrapeCricinfoScorecard } from './cricinfoScraper';

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs: number) {
  // Bounded: scorecards are cached per match id.
  if (cache.size > 200) for (const k of [...cache.keys()].slice(0, 50)) cache.delete(k);
  cache.set(key, { data, cachedAt: Date.now(), ttlMs });
}

export class ScraperService {
  /**
   * Fetches live matches across Cricbuzz and Cricinfo with automatic failover and caching.
   */
  private liveInFlight: Promise<{ matches: ScrapedMatchSummary[]; sources: string[] }> | null = null;

  /** Live matches. Visitors arriving together share one fetch, so a busy minute is one scrape, not hundreds. */
  async getLiveMatches(): Promise<{ matches: ScrapedMatchSummary[]; sources: string[] }> {
    const cached = getCached<ScrapedMatchSummary[]>('scraper:live:all');
    if (cached) return { matches: cached, sources: ['cache'] };
    if (!this.liveInFlight) {
      this.liveInFlight = this.fetchLiveMatches().finally(() => {
        this.liveInFlight = null;
      });
    }
    return this.liveInFlight;
  }

  private async fetchLiveMatches(): Promise<{ matches: ScrapedMatchSummary[]; sources: string[] }> {
    const cacheKey = 'scraper:live:all';

    const sources: string[] = [];
    const results: ScrapedMatchSummary[] = [];

    // Parallel query with graceful error handling
    const [cricbuzzRes, cricinfoRes] = await Promise.allSettled([
      scrapeCricbuzzLiveMatches(),
      scrapeCricinfoLiveMatches(),
    ]);

    if (cricbuzzRes.status === 'fulfilled' && cricbuzzRes.value.length) {
      sources.push('cricbuzz');
      results.push(...cricbuzzRes.value);
    }
    if (cricinfoRes.status === 'fulfilled' && cricinfoRes.value.length) {
      sources.push('cricinfo');
      // Append non-duplicate matches
      for (const m of cricinfoRes.value) {
        if (!results.some(r => r.id === m.id || (r.teamA.name === m.teamA.name && r.teamB.name === m.teamB.name))) {
          results.push(m);
        }
      }
    }

    setCached(cacheKey, results, 15_000); // 15s cache
    return { matches: results, sources };
  }

  /**
   * Scrapes match scorecard and live status from Cricbuzz or Cricinfo with automatic failover.
   */
  async getMatchScorecard(provider: 'cricbuzz' | 'cricinfo', matchId: string, slugOrSeries = ''): Promise<{ summary: ScrapedMatchSummary; scorecard: ScrapedScorecard }> {
    const cacheKey = `scraper:scorecard:${provider}:${matchId}`;
    const cached = getCached<{ summary: ScrapedMatchSummary; scorecard: ScrapedScorecard }>(cacheKey);
    if (cached) return cached;

    let res: { summary: ScrapedMatchSummary; scorecard: ScrapedScorecard } | null = null;

    if (provider === 'cricbuzz') {
      try {
        res = await scrapeCricbuzzScorecard(matchId, slugOrSeries);
      } catch (err: any) {
        console.warn(`[Scraper] Cricbuzz failed for match ${matchId}: ${err.message}, trying Cricinfo failover`);
        res = await scrapeCricinfoScorecard(matchId);
      }
    } else {
      try {
        res = await scrapeCricinfoScorecard(matchId, slugOrSeries);
      } catch (err: any) {
        console.warn(`[Scraper] Cricinfo failed for match ${matchId}: ${err.message}, trying Cricbuzz failover`);
        res = await scrapeCricbuzzScorecard(matchId, slugOrSeries);
      }
    }

    const ttl = res.summary.status === 'completed' ? 300_000 : 15_000;
    setCached(cacheKey, res, ttl);
    return res;
  }

  /**
   * Helper to map a provider team name to one of the 6 franchise team IDs.
   */
  mapTeamId(store: AppStore, name: string): string | null {
    const n = normName(name.replace(/\s+inning.*$/i, '').trim());
    for (const t of store.teams) {
      const tn = normName(t.name);
      const sn = normName(t.short);
      if (tn === n || n.includes(tn) || tn.includes(n) || sn === n) return t.id;
    }
    return null;
  }

  /**
   * Synchronizes an Abu Dhabi T10 match in the store using scraped data.
   * Updates scores, scorecard, Pick XI fantasy points, and triggers result alerts when completed.
   */
  async syncMatchFromScraper(
    matchId: string,
    provider: 'cricbuzz' | 'cricinfo',
    externalId: string,
    slugHint = ''
  ): Promise<{ success: boolean; match: Match; message: string }> {
    const store = db.get();
    const match = store.matches.find(m => m.id === matchId);
    if (!match) throw new Error(`Match ${matchId} not found in database`);

    const { summary, scorecard } = await this.getMatchScorecard(provider, externalId, slugHint);
    const wasCompleted = match.status === 'completed';

    // Apply scores
    if (summary.teamA.score) match.scoreA = summary.teamA.score;
    if (summary.teamA.overs) match.oversA = String(summary.teamA.overs);
    if (summary.teamB.score) match.scoreB = summary.teamB.score;
    if (summary.teamB.overs) match.oversB = String(summary.teamB.overs);

    if (summary.toss) match.toss = summary.toss;
    if (summary.result) match.result = summary.result;
    if (summary.status) match.status = summary.status;
    if (summary.lastCommentary) match.lastCommentary = summary.lastCommentary;

    // Apply structured scorecard if available
    if (scorecard.innings.length > 0) {
      const mappedInnings: InningsScorecard[] = scorecard.innings.map(inn => {
        const teamId = this.mapTeamId(store, inn.teamName) || (inn.inningNo === 1 ? match.teamA : match.teamB);
        return {
          teamId,
          teamName: inn.teamName,
          totalRuns: inn.totalRuns,
          wickets: inn.wickets,
          overs: inn.overs,
          batting: inn.batting.map(b => ({
            batsman: b.name,
            dismissal: b.dismissal,
            runs: b.runs,
            balls: b.balls,
            fours: b.fours,
            sixes: b.sixes,
            strikeRate: b.strikeRate,
            isNotOut: b.isNotOut,
          })),
          bowling: inn.bowling.map(bw => ({
            bowler: bw.name,
            overs: bw.overs,
            maidens: bw.maidens,
            runs: bw.runs,
            wickets: bw.wickets,
            economy: bw.economy,
          })),
        };
      });

      match.scorecard = {
        innings1: mappedInnings[0],
        innings2: mappedInnings[1],
      };

      if (mappedInnings[0]) match.firstInnings = mappedInnings[0].teamId === match.teamA ? 1 : 2;
    }

    // Determine winner if completed
    if (match.status === 'completed' && match.result) {
      const winnerId = this.mapTeamId(store, match.result);
      if (winnerId) match.winner = winnerId;
    }

    match.scoreSource = 'scraper';
    match.externalId = externalId;
    match.liveSyncedAt = new Date().toISOString();
    match.updatedAt = match.liveSyncedAt;

    db.save();

    // Trigger Pick XI scoring and completed match callbacks
    if (!wasCompleted && match.status === 'completed') {
      afterMatchCompleted(match.id);
    }

    return {
      success: true,
      match,
      message: `Match ${match.matchNo} successfully synced from ${provider.toUpperCase()} (Status: ${match.status}, ${match.scoreA || '0/0'} vs ${match.scoreB || '0/0'})`,
    };
  }

  /**
   * Scrapes series squads from Cricbuzz.
   */
  async getSeriesSquads(seriesId = '13307', seriesSlug = 'abu-dhabi-t10-league-2026'): Promise<ScrapedTeamSquad[]> {
    const store = db.get();
    const teamNames = store.teams.map(t => t.name);
    return scrapeCricbuzzSquads(seriesId, seriesSlug, teamNames);
  }
}

export const scraperService = new ScraperService();
