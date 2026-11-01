import type { NextFunction, Request, Response } from 'express';
import type { AppStore, Contest, Match, Player, TeamPick } from './db';
import { db } from './db';
import { getAuthUser } from './auth';
import { awardPoints } from './points';
import { DREAM_XI, computePlayerPoints } from './fantasy';
import { matchLocked, matchOpen } from './matchWindow';
import { fanClubGamesTeam } from './routes/fanclub';
import { settleContest } from './predictions';
import { dispatchNotification } from './notify';

/**
 * Team games: games about one franchise's own match (the fan club team, Admin → Settings; the
 * Arabian Aces by default). Every fan can play them; fans who checked in at a fan club play only these.
 *
 *  Pick 5            five of the team's players for the match, one captain (double points). Scored
 *                    from the scorecard with the Pick XI scoring.
 *  Team predictions  the team's total, sixes, fours, the wickets its bowlers take and its score after
 *                    5 overs, settled from the scorecard. Each match gets one set when its games open
 *                    (midnight in Abu Dhabi the day before), locking at the first ball.
 */

export const PICK_SIZE = 5;
export const teamContestId = (m: Pick<Match, 'id'>) => `team-${m.id}`;
export const gamesTeamId = (store: AppStore) => store.settings.fanClubTeamId || 'aces';

const RUNS = ['Under 100', '100–119', '120–139', '140 or more'];
const SIXES = ['0–4', '5–8', '9–12', '13 or more'];
const FOURS = ['0–5', '6–9', '10–13', '14 or more'];
const WICKETS = ['0–3', '4–5', '6–7', '8 or more'];
const AFTER5 = ['Under 45', '45–59', '60–74', '75 or more'];
/** A question the scorecard could not answer: nobody scores it. */
export const VOID = 'No result (void)';

export function teamPredictionContest(store: AppStore, m: Match, teamId: string, now = new Date().toISOString()): Contest {
  const team = store.teams.find(t => t.id === teamId);
  const name = team?.name || teamId;
  const short = team?.short || name;
  const opp = store.teams.find(t => t.id === (m.teamA === teamId ? m.teamB : m.teamA))?.name || 'their opponents';
  return {
    id: teamContestId(m),
    type: 'predictor',
    auto: true,
    teamId,
    title: `${name} vs ${opp}: ${short} predictions`,
    description: `Match ${m.matchNo}. Five questions about the ${name}, settled from the official scorecard. Locks at the first ball.`,
    matchId: m.id,
    locksAt: m.startsAt,
    status: 'open',
    prize: '',
    questions: [
      { id: 'runs', prompt: `${short} total score?`, options: RUNS, points: 20 },
      { id: 'after5', prompt: `${short} score after 5 overs?`, options: AFTER5, points: 15 },
      { id: 'sixes', prompt: `How many sixes do the ${short} hit?`, options: SIXES, points: 15 },
      { id: 'fours', prompt: `How many fours do the ${short} hit?`, options: FOURS, points: 15 },
      { id: 'wickets', prompt: `How many wickets do the ${short} bowlers take?`, options: WICKETS, points: 15 },
    ],
    createdAt: now,
  };
}

/** Creates the team's prediction set for each of its open matches. Returns how many were added. */
export function ensureTeamGames(store: AppStore, now = Date.now()): number {
  const teamId = gamesTeamId(store);
  if (!store.teams.some(t => t.id === teamId)) return 0;
  const have = new Set(store.contests.map(c => c.id));
  let added = 0;
  for (const m of store.matches) {
    if (m.teamA !== teamId && m.teamB !== teamId) continue;
    if (!matchOpen(m, now) || have.has(teamContestId(m))) continue;
    store.contests.push(teamPredictionContest(store, m, teamId, new Date(now).toISOString()));
    added++;
  }
  return added;
}

const band = (n: number, edges: number[], labels: string[]) => labels[edges.filter(e => n >= e).length];

/** Runs off the bat and extras after the given number of overs, from ball-by-ball data; null if missing. */
function runsAfterOvers(m: Match, innings: 1 | 2, overs: number): number | null {
  const balls = (m.scorecard?.ballByBall || []).filter(b => b.innings === innings);
  if (!balls.length) return null;
  const done = balls.filter(b => b.over < overs);
  // Need the whole of those overs (or the innings ended before them).
  if (!balls.some(b => b.over >= overs - 1)) return null;
  return done.reduce((s, b) => s + (Number(b.runs) || 0), 0);
}

/** The answers the scorecard gives, or null when it cannot settle the set yet. */
export function teamAnswers(m: Match, teamId: string): Record<string, string> | null {
  if (m.status !== 'completed') return null;
  const inns = [m.scorecard?.innings1, m.scorecard?.innings2];
  const batIdx = inns.findIndex(i => i?.teamId === teamId);
  const bowlIdx = inns.findIndex(i => i && i.teamId && i.teamId !== teamId);
  if (batIdx < 0 || !inns[batIdx]?.batting?.length) return null;
  const bat = inns[batIdx]!;
  const sixes = bat.batting.reduce((s, r) => s + (Number(r.sixes) || 0), 0);
  const fours = bat.batting.reduce((s, r) => s + (Number(r.fours) || 0), 0);
  const after5 = runsAfterOvers(m, (batIdx + 1) as 1 | 2, 5);
  const bowl = bowlIdx >= 0 ? inns[bowlIdx] : null;
  return {
    runs: band(Number(bat.totalRuns) || 0, [100, 120, 140], RUNS),
    after5: after5 === null ? VOID : band(after5, [45, 60, 75], AFTER5),
    sixes: band(sixes, [5, 9, 13], SIXES),
    fours: band(fours, [6, 10, 14], FOURS),
    wickets: bowl ? band(Number(bowl.wickets) || 0, [4, 6, 8], WICKETS) : VOID,
  };
}

// ---------- Pick 5 ----------

export function pickPool(store: AppStore, m: Match, teamId = gamesTeamId(store)): Player[] {
  if (m.teamA !== teamId && m.teamB !== teamId) return [];
  const team = store.teams.find(t => t.id === teamId);
  const xi = m.playingXI?.[teamId];
  const squad = team?.squad || [];
  // Once the team is announced, only its playing XI can be picked.
  return xi?.length ? squad.filter(p => xi.includes(p.id)) : squad;
}

export function validatePick(pool: Player[], playerIds: unknown, captainId: unknown): string | { playerIds: string[]; captainId: string } {
  const ids = Array.isArray(playerIds) ? Array.from(new Set(playerIds.map(String))) : [];
  if (ids.length !== PICK_SIZE) return `Pick exactly ${PICK_SIZE} players`;
  if (ids.some(id => !pool.some(p => p.id === id))) return 'Pick players from this team’s squad';
  const cap = String(captainId || '');
  if (!ids.includes(cap)) return 'Choose your captain from your five';
  return { playerIds: ids, captainId: cap };
}

/** Scores every Pick 5 for a completed match. Safe to run again after a scorecard correction. */
export function scoreTeamPicks(store: AppStore, matchId: string) {
  const m = store.matches.find(x => x.id === matchId);
  if (!m) return { scored: 0 };
  const pp = computePlayerPoints(store, m);
  const picks = store.teamPicks.filter(p => p.matchId === matchId);
  for (const pk of picks) {
    const breakdown = pk.playerIds.map(id => {
      const row = pp.get(id);
      const pl = store.teams.flatMap(t => t.squad).find(x => x.id === id);
      const multiplier = id === pk.captainId ? DREAM_XI.captainMultiplier : 1;
      const base = row?.points || 0;
      return { playerId: id, name: pl?.name || row?.name || id, base, multiplier, total: Math.round(base * multiplier * 10) / 10, detail: row?.detail.join(', ') || 'did not score' };
    });
    const total = Math.round(breakdown.reduce((s, b) => s + b.total, 0) * 10) / 10;
    const previous = pk.scoredAt ? Math.round((pk.points || 0) / DREAM_XI.fanPointsDivisor) : 0;
    const now = Math.round(total / DREAM_XI.fanPointsDivisor);
    const u = store.users.find(x => x.id === pk.userId);
    if (u && now !== previous) awardPoints(store, u, now - previous, 'aces-pick5', `Match ${m.matchNo} · ${total} Pick 5 points${previous ? ` (scorecard corrected, was ${previous})` : ''}`, matchId);
    pk.points = total;
    pk.breakdown = breakdown;
    pk.scoredAt = new Date().toISOString();
  }
  return { scored: picks.length };
}

/** After a match ends: scores Pick 5 and settles the team predictions, then tells the fans who played. */
export async function settleTeamGames(matchId: string) {
  const r = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    if (!m || m.status !== 'completed') return null;
    const teamId = gamesTeamId(store);
    const hasCard = Boolean(m.scorecard?.innings1?.batting?.length || m.scorecard?.innings2?.batting?.length);
    const picks = hasCard ? scoreTeamPicks(store, matchId) : { scored: 0 };
    const c = store.contests.find(x => x.id === teamContestId(m));
    let settled: ReturnType<typeof settleContest> | null = null;
    if (c && c.status !== 'settled') {
      const answers = teamAnswers(m, c.teamId || teamId);
      if (answers) {
        for (const q of c.questions) q.answer = answers[q.id];
        settled = settleContest(store, c);
      }
    }
    const pickUsers = store.teamPicks.filter(p => p.matchId === matchId && p.scoredAt).map(p => ({ id: p.userId, pts: Math.round((p.points || 0) / DREAM_XI.fanPointsDivisor) }));
    return { picks, settled, contestTitle: c?.title, contestId: c?.id, pickUsers, matchNo: m.matchNo };
  });
  if (!r) return { settled: false };
  if (r.settled?.entrants.length) {
    await dispatchNotification({
      title: `🎯 Results: ${r.contestTitle}`, body: 'Answers are in.', category: 'announcement', targetAudience: 'users',
      userIds: r.settled.entrants, perUser: r.settled.perUser, data: { contestId: r.contestId, url: '/play/team' }, createdBy: 'Team games',
    }).catch(() => undefined);
  }
  if (r.pickUsers.length) {
    await dispatchNotification({
      title: `⭐ Pick 5 scored: Match ${r.matchNo}`, body: 'Your Pick 5 has been scored.', category: 'fantasy', targetAudience: 'users',
      userIds: r.pickUsers.map(p => p.id), perUser: Object.fromEntries(r.pickUsers.map(p => [p.id, { body: `You earned ${p.pts} point${p.pts === 1 ? '' : 's'}.` }])),
      data: { url: '/play/team' }, createdBy: 'Team games',
    }).catch(() => undefined);
  }
  return { settled: Boolean(r.settled), picksScored: r.picks.scored };
}

// ---------- Fan club fans play only the team games ----------

/** Game paths that fan club fans may not use (their games are the team games). */
const OTHER_GAMES = [/^\/fantasy(\/|$)/, /^\/fantasy-leagues(\/|$)/, /^\/games\//, /^\/duels(\/|$)/];

export function teamGamesOnly(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const user = getAuthUser(req);
  if (!user) return next();
  const store = db.get();
  const teamId = fanClubGamesTeam(store, user);
  if (!teamId) return next();
  const team = store.teams.find(t => t.id === teamId);
  const msg = `As a fan club member you play the ${team?.name || 'team'} games: Pick 5 and the ${team?.short || 'team'} predictions.`;
  if (OTHER_GAMES.some(re => re.test(req.path))) return res.status(403).json({ error: msg, code: 'team_games_only' });
  const enter = req.path.match(/^\/contests\/([^/]+)\/enter$/);
  if (enter) {
    const c = store.contests.find(x => x.id === enter[1]);
    if (c && c.teamId !== teamId) return res.status(403).json({ error: msg, code: 'team_games_only' });
  }
  next();
}

export const pickLocked = (m: Match) => matchLocked(m);

export function myPick(store: AppStore, userId: string, matchId: string): TeamPick | null {
  return store.teamPicks.find(p => p.userId === userId && p.matchId === matchId) || null;
}
