import { ScrapedMatchSummary, ScrapedScorecard, ScrapedInnings, ScrapedBatsman, ScrapedBowler, ScrapedTeamSquad, ScrapedPlayer } from './types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
};

async function fetchHtml(url: string, timeoutMs = 12000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Cricbuzz responded with HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts Schema.org SportsEvent JSON-LD block from HTML.
 * Schema.org LD+JSON is immune to HTML/CSS class or layout changes.
 */
function extractLdJsonSportsEvent(html: string): any | null {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1]);
      if (data['@type'] === 'SportsEvent' || (Array.isArray(data['@type']) && data['@type'].includes('SportsEvent'))) {
        return data;
      }
    } catch {
      /* ignore invalid json blocks */
    }
  }
  return null;
}

export async function scrapeCricbuzzLiveMatches(): Promise<ScrapedMatchSummary[]> {
  const url = 'https://www.cricbuzz.com/cricket-match/live-scores';
  const html = await fetchHtml(url);
  const matches: ScrapedMatchSummary[] = [];
  const seenIds = new Set<string>();

  // Extract all match blocks by link: /live-cricket-scores/<id>/<slug>
  const linkRegex = /href="(?:https:\/\/www\.cricbuzz\.com)?\/live-cricket-scores\/(\d+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;

  while ((lm = linkRegex.exec(html))) {
    const id = lm[1];
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const slug = lm[2];
    const matchUrl = `https://www.cricbuzz.com/live-cricket-scores/${id}/${slug}`;
    const rawTitle = lm[3].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // Determine status from slug or context
    let status: ScrapedMatchSummary['status'] = 'upcoming';
    if (slug.includes('live') || html.includes(`cb-text-live`)) status = 'live';

    // Parse team names from slug e.g. "pak-vs-sl-5th-match" or "inda-vs-nza-1st-unofficial-test"
    const vsParts = slug.split('-vs-');
    const teamAName = vsParts[0] ? vsParts[0].toUpperCase().replace(/-/g, ' ') : 'Team A';
    let teamBName = 'Team B';
    if (vsParts[1]) {
      const afterVs = vsParts[1].split('-');
      teamBName = afterVs[0].toUpperCase();
    }

    matches.push({
      id,
      provider: 'cricbuzz',
      title: rawTitle || slug.replace(/-/g, ' '),
      teamA: { name: teamAName },
      teamB: { name: teamBName },
      status,
      url: matchUrl,
    });
  }

  return matches;
}

export async function scrapeCricbuzzScorecard(matchId: string, slugHint = ''): Promise<{ summary: ScrapedMatchSummary; scorecard: ScrapedScorecard }> {
  const slug = slugHint || 'match';
  const url = `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}/${slug}`;
  const html = await fetchHtml(url);

  // 1. Extract layout-immune metadata from LD+JSON
  const sportsEvent = extractLdJsonSportsEvent(html);
  const competitors = Array.isArray(sportsEvent?.competitor) ? sportsEvent.competitor : [];
  const teamAName = competitors[0]?.name || 'Team 1';
  const teamBName = competitors[1]?.name || 'Team 2';
  const venue = sportsEvent?.location?.name || sportsEvent?.location?.address?.addressLocality || '';
  const startsAt = sportsEvent?.startDate || '';

  let status: ScrapedMatchSummary['status'] = 'upcoming';
  const eventStatus = sportsEvent?.eventStatus || '';
  if (eventStatus.includes('EventPostponed') || eventStatus.includes('EventCancelled')) {
    status = 'abandoned';
  }

  // 2. Extract Result / Status text (layout-tolerant regex)
  let resultText = '';
  const statusMatch = html.match(/(?:cb-text-complete|cb-text-live|cb-text-preview)[^>]*>([^<]+)<\/div>/i)
    || html.match(/<div class="[^"]*text-cbTxtSec[^"]*">([^<]+(?:won by|won|tied|drawn|no result|abandoned)[^<]*)<\/div>/i);
  if (statusMatch) {
    resultText = statusMatch[1].trim();
    if (/won|won by|tied|drawn|no result/i.test(resultText)) {
      status = 'completed';
    } else if (/needs \d+ runs|trail by|lead by|day \d+|opt to/i.test(resultText)) {
      status = 'live';
    }
  }

  // 3. Extract Toss
  let toss = '';
  const tossMatch = html.match(/(?:Toss|TOSS)[\s:]*<span[^>]*>([^<]+)<\/span>/i)
    || html.match(/<div>(?:Toss:?\s*)([^<]+(?:opt to|elected to|won the toss)[^<]*)<\/div>/i)
    || html.match(/([A-Za-z\s]+ won the toss and (?:opted|elected) to [a-z]+)/i);
  if (tossMatch) toss = tossMatch[1].trim();

  // 4. Parse Innings & Scorecard tables
  // Innings headings: e.g. "Pakistan 245-8 (50.0)" or "Team Inning"
  const innings: ScrapedInnings[] = [];

  // Match innings blocks by searching for batsman rows:
  // Layout-resilient pattern: href="/profiles/<id>/<slug>" title="View Profile Of <name>"
  const batRowRegex = /href="(?:https:\/\/www\.cricbuzz\.com)?\/profiles\/(\d+)\/([a-z0-9-]+)"\s+title="View Profile Of ([^"]+)"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<div[^>]*>([^<]*)<\/div>\s*<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>([\d\.]+)<\/div>/gi;

  const batsmenByInning: ScrapedBatsman[][] = [[], []];
  let bm: RegExpExecArray | null;
  let currentInningIdx = 0;

  // Split innings by header keywords if multiple innings exist
  const inningsSplit = html.split(/scorecard-innings-heading|Innings<\/span>/i);

  if (inningsSplit.length > 1) {
    for (let i = 1; i < inningsSplit.length && i <= 2; i++) {
      const part = inningsSplit[i];
      const partBatsmen: ScrapedBatsman[] = [];
      const partBowlers: ScrapedBowler[] = [];

      let m: RegExpExecArray | null;
      while ((m = batRowRegex.exec(part))) {
        const dismissal = m[4].trim() || 'not out';
        partBatsmen.push({
          playerId: m[1],
          name: m[3].trim(),
          profileUrl: `https://www.cricbuzz.com/profiles/${m[1]}/${m[2]}`,
          dismissal,
          runs: Number(m[5]) || 0,
          balls: Number(m[6]) || 0,
          fours: Number(m[7]) || 0,
          sixes: Number(m[8]) || 0,
          strikeRate: Number(m[9]) || 0,
          isNotOut: /not out/i.test(dismissal) || dismissal === '',
        });
      }

      // Bowler regex: Bowler profile followed by O, M, R, W, Eco
      const bowlRowRegex = /href="(?:https:\/\/www\.cricbuzz\.com)?\/profiles\/(\d+)\/([a-z0-9-]+)"\s+title="View Profile Of ([^"]+)"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<div[^>]*>([\d\.]+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>(\d+)<\/div>\s*<div[^>]*>([\d\.]+)<\/div>/gi;
      let bwm: RegExpExecArray | null;
      while ((bwm = bowlRowRegex.exec(part))) {
        partBowlers.push({
          playerId: bwm[1],
          name: bwm[3].trim(),
          profileUrl: `https://www.cricbuzz.com/profiles/${bwm[1]}/${bwm[2]}`,
          overs: bwm[4],
          maidens: Number(bwm[5]) || 0,
          runs: Number(bwm[6]) || 0,
          wickets: Number(bwm[7]) || 0,
          economy: Number(bwm[8]) || 0,
        });
      }

      // Inning total extraction
      const totalMatch = part.match(/(?:Total|TOTAL)[\s\S]*?<div[^>]*>(\d+)(?:\/(\d+))?<\/div>[\s\S]*?<span[^>]*>\(([\d\.]+)\s*Overs?\)/i)
        || part.match(/(\d+)(?:\/(\d+))?\s*\(([\d\.]+)\s*(?:ov|overs?)\)/i);

      const totalRuns = totalMatch ? Number(totalMatch[1]) : partBatsmen.reduce((acc, b) => acc + b.runs, 0);
      const wickets = totalMatch && totalMatch[2] ? Number(totalMatch[2]) : partBatsmen.filter(b => !b.isNotOut).length;
      const overs = totalMatch ? totalMatch[3] : (partBowlers[0]?.overs || '0.0');

      innings.push({
        inningNo: i,
        teamName: i === 1 ? teamAName : teamBName,
        totalRuns,
        wickets,
        overs,
        batting: partBatsmen,
        bowling: partBowlers,
      });
    }
  }

  // Format team scores
  const inn1 = innings[0];
  const inn2 = innings[1];

  const summary: ScrapedMatchSummary = {
    id: matchId,
    provider: 'cricbuzz',
    title: `${teamAName} vs ${teamBName}`,
    teamA: {
      name: teamAName,
      score: inn1 ? `${inn1.totalRuns}/${inn1.wickets}` : undefined,
      overs: inn1 ? inn1.overs : undefined,
      runs: inn1?.totalRuns,
      wickets: inn1?.wickets,
    },
    teamB: {
      name: teamBName,
      score: inn2 ? `${inn2.totalRuns}/${inn2.wickets}` : undefined,
      overs: inn2 ? inn2.overs : undefined,
      runs: inn2?.totalRuns,
      wickets: inn2?.wickets,
    },
    status: inn2 && inn2.totalRuns > 0 ? (resultText ? 'completed' : 'live') : (inn1 ? 'live' : status),
    result: resultText || undefined,
    toss: toss || undefined,
    venue: venue || undefined,
    startsAt: startsAt || undefined,
    url,
  };

  const scorecard: ScrapedScorecard = {
    matchId,
    provider: 'cricbuzz',
    title: summary.title,
    innings,
  };

  return { summary, scorecard };
}

export async function scrapeCricbuzzSquads(seriesId: string, seriesSlug: string, teamNames: string[]): Promise<ScrapedTeamSquad[]> {
  const url = `https://www.cricbuzz.com/cricket-series/${seriesId}/${seriesSlug}/squads`;
  const html = await fetchHtml(url);
  const lower = html.toLowerCase();

  const positions = teamNames
    .map(name => {
      const n = name.toLowerCase();
      let at = lower.indexOf(`${n} squad`);
      if (at < 0) at = lower.indexOf(`>${n}<`);
      if (at < 0) at = lower.indexOf(n);
      return { name, at };
    })
    .filter(p => p.at >= 0)
    .sort((a, b) => a.at - b.at);

  const teams: ScrapedTeamSquad[] = [];

  positions.forEach((p, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].at : html.length;
    const section = html.slice(p.at, end);
    const seen = new Set<string>();
    const players: ScrapedPlayer[] = [];

    const re = /href="(?:https:\/\/www\.cricbuzz\.com)?\/profiles\/(\d+)\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;

    while ((m = re.exec(section))) {
      const id = m[1];
      if (seen.has(id)) continue;
      seen.add(id);

      const inner = m[3].replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
      const name = inner[0] || m[2].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
      const roleStr = inner.find(s => /bat|bowl|keeper|wk|allrounder/i.test(s)) || '';

      let role: ScrapedPlayer['role'] = 'batter';
      if (/wk|keeper/i.test(roleStr)) role = 'wicketkeeper';
      else if (/allrounder|all-rounder|all rounder/i.test(roleStr)) role = 'allrounder';
      else if (/bowl/i.test(roleStr)) role = 'bowler';

      const img = m[0].match(/src="(https:\/\/static\.cricbuzz\.com\/a\/img\/v1\/[^"]+)"/);

      players.push({
        name: name.replace(/\s*\((c|wk|c & wk)\)\s*$/i, ''),
        role,
        cricbuzzId: id,
        profileUrl: `https://www.cricbuzz.com/profiles/${id}/${m[2]}`,
        photoUrl: img?.[1],
      });
    }

    if (players.length) teams.push({ name: p.name, players });
  });

  return teams;
}
