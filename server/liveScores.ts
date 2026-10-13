import { AppStore, db, InningsScorecard, Match } from './db';
import { fetchText } from './feeds';
import { normName } from './fantasy';

/**
 * Optional automatic live scores from CricketData.org (https://cricketdata.org).
 * Set CRICKET_API_KEY, then link a fixture to its CricketData match id in Admin → Matches
 * (the "Find" button lists candidates). Linked matches update by themselves while live, and
 * the result, scorecard and Dream XI points follow when they finish.
 * Every match still shows where its score came from (manual or CricketData).
 */
const API = () => (process.env.CRICKETDATA_API_BASE || 'https://api.cricapi.com/v1').replace(/\/$/, '');
export const liveScoresConfigured = () => Boolean(process.env.CRICKET_API_KEY);

async function call(path: string, params: Record<string, string>) {
  const key = process.env.CRICKET_API_KEY;
  if (!key) throw new Error('CRICKET_API_KEY is not set');
  const qs = new URLSearchParams({ apikey: key, ...params }).toString();
  const json = JSON.parse(await fetchText(`${API()}/${path}?${qs}`, 10000, { Accept: 'application/json' }));
  if (json.status && json.status !== 'success') throw new Error(`CricketData: ${json.reason || json.status}`);
  return json.data;
}

function teamIdFor(store: AppStore, match: Match, name: string): string | null {
  const n = normName(name.replace(/\s+inning.*$/i, ''));
  for (const id of [match.teamA, match.teamB]) {
    const t = store.teams.find(x => x.id === id);
    if (!t) continue;
    const tn = normName(t.name);
    if (tn === n || n.includes(tn) || tn.includes(n) || normName(t.short) === n) return id;
  }
  return null;
}

/** Applies CricketData match_info to a match. Returns true when the match just finished. */
export function applyMatchInfo(store: AppStore, match: Match, info: any): boolean {
  const wasCompleted = match.status === 'completed';
  const scores: any[] = Array.isArray(info?.score) ? info.score : [];
  const byTeam: Record<string, any> = {};
  scores.forEach((s, i) => {
    const id = teamIdFor(store, match, String(s.inning || '')) || (i === 0 ? null : null);
    if (id) byTeam[id] = s;
  });
  const fmt = (s: any) => (s ? `${s.r}/${s.w}` : undefined);
  if (byTeam[match.teamA]) {
    match.scoreA = fmt(byTeam[match.teamA]);
    match.oversA = String(byTeam[match.teamA].o ?? '');
  }
  if (byTeam[match.teamB]) {
    match.scoreB = fmt(byTeam[match.teamB]);
    match.oversB = String(byTeam[match.teamB].o ?? '');
  }
  if (scores.length) {
    const firstId = teamIdFor(store, match, String(scores[0].inning || ''));
    if (firstId) match.firstInnings = firstId === match.teamA ? 1 : 2;
  }
  if (info?.tossWinner) {
    const tw = store.teams.find(t => t.id === teamIdFor(store, match, String(info.tossWinner)));
    match.toss = `${tw?.name || info.tossWinner} won the toss and chose to ${String(info.tossChoice || '').toLowerCase() || 'play'}`;
  }
  if (info?.matchEnded) {
    match.status = 'completed';
    if (info.matchWinner) {
      const w = teamIdFor(store, match, String(info.matchWinner));
      if (w) match.winner = w;
    }
    if (info.status) match.result = String(info.status).slice(0, 200);
  } else if (info?.matchStarted) {
    match.status = 'live';
    if (info.status) match.lastCommentary = String(info.status).slice(0, 300);
  }
  match.scoreSource = 'cricketdata';
  match.liveSyncedAt = new Date().toISOString();
  match.updatedAt = match.liveSyncedAt;
  return !wasCompleted && match.status === 'completed';
}

export function applyScorecard(store: AppStore, match: Match, data: any): boolean {
  const cards: any[] = Array.isArray(data?.scorecard) ? data.scorecard : [];
  if (!cards.length) return false;
  const innings: InningsScorecard[] = cards.slice(0, 2).map(c => {
    const teamId = teamIdFor(store, match, String(c.inning || '')) || '';
    const scoreRow = (Array.isArray(data.score) ? data.score : []).find((s: any) => s.inning === c.inning);
    return {
      teamId,
      teamName: String(c.inning || '').replace(/\s+inning.*$/i, ''),
      totalRuns: Number(scoreRow?.r) || 0,
      wickets: Number(scoreRow?.w) || 0,
      overs: String(scoreRow?.o ?? ''),
      batting: (c.batting || []).map((b: any) => ({
        batsman: String(b.batsman?.name || b.batsman || ''),
        dismissal: String(b['dismissal-text'] || b.dismissal || ''),
        runs: Number(b.r) || 0,
        balls: Number(b.b) || 0,
        fours: Number(b['4s']) || 0,
        sixes: Number(b['6s']) || 0,
        strikeRate: Number(b.sr) || 0,
        isNotOut: /not out/i.test(String(b['dismissal-text'] || '')),
      })),
      bowling: (c.bowling || []).map((b: any) => ({
        bowler: String(b.bowler?.name || b.bowler || ''),
        overs: b.o ?? 0,
        maidens: Number(b.m) || 0,
        runs: Number(b.r) || 0,
        wickets: Number(b.w) || 0,
        economy: Number(b.eco) || 0,
      })),
    };
  });
  match.scorecard = { innings1: innings[0], innings2: innings[1] };
  const all = innings.flatMap(i => i.batting);
  const top = [...all].sort((a, b) => b.runs - a.runs)[0];
  if (top) match.topScorer = `${top.batsman} ${top.runs}${top.isNotOut ? '*' : ''} (${top.balls})`;
  const bowl = innings.flatMap(i => i.bowling).sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
  if (bowl && bowl.wickets) match.topWicketTaker = `${bowl.bowler} ${bowl.wickets}/${bowl.runs}`;
  match.totalSixes = all.reduce((s, b) => s + (b.sixes || 0), 0);
  return true;
}

export interface LiveSyncResult {
  matchId: string;
  status: Match['status'];
  justCompleted: boolean;
  scorecard: boolean;
  scorecardNote?: string;
}

/** Fetches CricketData and applies it to the store. Network first, then a short store update. */
export async function syncLiveMatch(matchId: string): Promise<LiveSyncResult> {
  const m0 = db.get().matches.find(m => m.id === matchId);
  if (!m0) throw new Error('Match not found');
  if (!m0.externalId) throw new Error('Link this match to a CricketData match id first');
  const info = await call('match_info', { id: m0.externalId });
  let card: any = null;
  let scorecardNote: string | undefined;
  if (info?.matchStarted) {
    try {
      card = await call('match_scorecard', { id: m0.externalId });
    } catch (e: any) {
      scorecardNote = `Scorecard not available yet (${e?.message || e})`;
    }
  }
  return db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    if (!m) throw new Error('Match not found');
    const justCompleted = applyMatchInfo(store, m, info);
    const scorecard = card ? applyScorecard(store, m, card) : false;
    return { matchId, status: m.status, justCompleted, scorecard, scorecardNote };
  });
}

/** Matches worth polling now: linked, and live or starting within the next 30 minutes. */
export function matchesToPoll(store: AppStore, now = Date.now()) {
  return store.matches.filter(m => m.externalId && (m.status === 'live' || (m.status === 'upcoming' && +new Date(m.startsAt) - now < 30 * 60_000)));
}

export async function syncLiveScores(onCompleted?: (matchId: string) => Promise<unknown>) {
  if (!liveScoresConfigured()) return { checked: 0, updated: 0, completed: 0, errors: [] as string[], skipped: 'CRICKET_API_KEY not set' };
  const targets = matchesToPoll(db.get());
  const errors: string[] = [];
  let completed = 0;
  let updated = 0;
  for (const m of targets) {
    try {
      const r = await syncLiveMatch(m.id);
      updated++;
      if (r.justCompleted) {
        completed++;
        if (onCompleted) await onCompleted(m.id);
      }
    } catch (e: any) {
      errors.push(`#${m.matchNo}: ${e?.message || e}`);
    }
  }
  return { checked: targets.length, updated, completed, errors };
}

/** CricketData matches that look like this league's fixtures, to link in the admin console. */
export async function findCandidateMatches(): Promise<{ id: string; name: string; date: string; status: string }[]> {
  const store = db.get();
  const names = store.teams.map(t => normName(t.name));
  const data = await call('currentMatches', { offset: '0' });
  const list: any[] = Array.isArray(data) ? data : [];
  return list
    .filter(m => {
      const n = normName(String(m.name || ''));
      return /t10/.test(n) || names.some(t => n.includes(t));
    })
    .map(m => ({ id: String(m.id), name: String(m.name || ''), date: String(m.dateTimeGMT || m.date || ''), status: String(m.status || '') }));
}
