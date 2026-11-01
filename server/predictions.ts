import type { AppStore, Contest, Match, User } from './db';
import { db } from './db';
import { awardPoints } from './points';
import { dispatchNotification } from './notify';
import { matchOpen } from './matchWindow';

/**
 * Match predictions for every match, created by the site and settled from the real scorecard, so
 * fans can predict all of a day's matches without anyone setting them up.
 *
 * Each match gets one prediction set when its games open (midnight in Abu Dhabi on the day before
 * the match day; see matchWindow.ts). It locks at the first ball. Every question is one the
 * scorecard answers, so the set settles by itself when the result comes in. An abandoned match, or
 * one finished without a full scorecard, waits for an admin (Admin → Predictions), who can settle it
 * by hand or delete it.
 */

export const autoContestId = (m: Match) => `auto-${m.id}`;

const SIXES = ['0–9', '10–14', '15–19', '20 or more'];
const TOTAL = ['Under 110', '110–129', '130–149', '150 or more'];

export function matchPredictionContest(store: AppStore, m: Match, now = new Date().toISOString()): Contest {
  const a = store.teams.find(t => t.id === m.teamA)?.name || m.teamA;
  const b = store.teams.find(t => t.id === m.teamB)?.name || m.teamB;
  return {
    id: autoContestId(m),
    type: 'predictor',
    auto: true,
    title: `${a} vs ${b}: match predictions`,
    description: `Match ${m.matchNo}. Five questions, settled from the official scorecard. Locks at the first ball.`,
    matchId: m.id,
    locksAt: m.startsAt,
    status: 'open',
    prize: '',
    questions: [
      { id: 'winner', prompt: 'Who wins?', options: [a, b], points: 20 },
      { id: 'top-total', prompt: 'Highest team total in the match?', options: TOTAL, points: 15 },
      { id: 'sixes', prompt: 'How many sixes in the match (both teams)?', options: SIXES, points: 15 },
      { id: 'more-sixes', prompt: 'Which team hits more sixes?', options: [a, b, 'Same number'], points: 10 },
      { id: 'fifty', prompt: 'Does anyone score 50 or more?', options: ['Yes', 'No'], points: 10 },
    ],
    createdAt: now,
  };
}

/** Creates the prediction set for each match whose games are open, and keeps lock times in step. Returns how many changed. */
export function ensureMatchPredictions(store: AppStore, now = Date.now()): number {
  const have = new Set(store.contests.map(c => c.id));
  let added = 0;
  // A rescheduled match moves its lock time; a set for a match that was deleted before it settled goes.
  for (const c of store.contests) {
    if (!c.auto || c.status !== 'open') continue;
    const m = store.matches.find(x => x.id === c.matchId);
    if (m && c.locksAt !== m.startsAt) {
      c.locksAt = m.startsAt;
      added++;
    }
  }
  const orphaned = store.contests.filter(c => c.auto && c.status === 'open' && !store.matches.some(m => m.id === c.matchId) && !store.contestEntries.some(e => e.contestId === c.id));
  if (orphaned.length) {
    store.contests = store.contests.filter(c => !orphaned.includes(c));
    added += orphaned.length;
  }
  for (const m of store.matches) {
    if (!matchOpen(m, now) || have.has(autoContestId(m))) continue;
    if (!store.teams.some(t => t.id === m.teamA) || !store.teams.some(t => t.id === m.teamB)) continue;
    store.contests.push(matchPredictionContest(store, m, new Date(now).toISOString()));
    added++;
  }
  return added;
}

const band = (n: number, edges: number[], labels: string[]) => labels[edges.filter(e => n >= e).length];

/** The answers the scorecard gives, or null when it can't settle the questions yet. */
export function answersFromScorecard(store: AppStore, m: Match, c: Contest): Record<string, string> | null {
  if (m.status !== 'completed' || !m.winner) return null;
  const inns = [m.scorecard?.innings1, m.scorecard?.innings2].filter(Boolean);
  if (inns.length < 2 || inns.some(i => !i!.batting?.length || !i!.teamId)) return null;
  const nameOf = (id: string) => c.questions[0].options[[m.teamA, m.teamB].indexOf(id)];
  const sixesBy = (teamId: string) => inns.filter(i => i!.teamId === teamId).reduce((s, i) => s + i!.batting.reduce((x, r) => x + (Number(r.sixes) || 0), 0), 0);
  const sa = sixesBy(m.teamA);
  const sb = sixesBy(m.teamB);
  const top = Math.max(...inns.map(i => Number(i!.totalRuns) || 0));
  const fifty = inns.some(i => i!.batting.some(r => (Number(r.runs) || 0) >= 50));
  return {
    winner: nameOf(m.winner),
    'top-total': band(top, [110, 130, 150], TOTAL),
    sixes: band(sa + sb, [10, 15, 20], SIXES),
    'more-sixes': sa === sb ? 'Same number' : nameOf(sa > sb ? m.teamA : m.teamB),
    fifty: fifty ? 'Yes' : 'No',
  };
}

export interface SettleResult {
  winners: number;
  total: number;
  entrants: string[];
  perUser: Record<string, { body: string }>;
}

/** Marks a contest settled and gives each entrant their points. The questions must have answers. */
export function settleContest(store: AppStore, contest: Contest): SettleResult {
  contest.status = 'settled';
  let winners = 0;
  let total = 0;
  const perUser: SettleResult['perUser'] = {};
  const entrants = store.contestEntries.filter(x => x.contestId === contest.id);
  for (const e of entrants) {
    if (contest.instant) continue;
    const pts = contest.questions.reduce((s, q) => s + (e.answers[q.id] === q.answer ? q.points : 0), 0);
    e.pointsAwarded = pts;
    const u = store.users.find((x: User) => x.id === e.userId);
    if (u && pts > 0) {
      awardPoints(store, u, pts, 'prediction', contest.title, contest.id);
      winners++;
      total += pts;
    }
    perUser[e.userId] = { body: pts > 0 ? `You scored ${pts} point${pts === 1 ? '' : 's'}.` : 'No points this time. Try the next one!' };
  }
  return { winners, total, entrants: entrants.map(e => e.userId), perUser };
}

/** After a match ends: settles its automatic prediction set from the scorecard and tells entrants. */
export async function settleMatchPredictions(matchId: string) {
  const r = await db.mutate(store => {
    const m = store.matches.find(x => x.id === matchId);
    const c = m && store.contests.find(x => x.id === autoContestId(m));
    if (!m || !c || c.status === 'settled') return null;
    const answers = answersFromScorecard(store, m, c);
    if (!answers) return null;
    for (const q of c.questions) q.answer = answers[q.id];
    return { contest: { id: c.id, title: c.title }, ...settleContest(store, c) };
  });
  if (r?.entrants.length) {
    await dispatchNotification({
      title: `🎯 Results: ${r.contest.title}`,
      body: 'Answers are in.',
      category: 'announcement',
      targetAudience: 'users',
      userIds: r.entrants,
      perUser: r.perUser,
      data: { contestId: r.contest.id, url: '/contests' },
      createdBy: 'Predictions',
    });
  }
  return r ? { settled: true, winners: r.winners, total: r.total } : { settled: false };
}
