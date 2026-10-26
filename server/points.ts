import crypto from 'crypto';
import type { AppStore, PointsEntry, PointsSource, User } from './db';

/**
 * Every change to a fan's points goes through here, so each one is written to the points ledger:
 * what changed, by how much, why, and (for admin changes) who made it.
 *
 * A fan has two running totals:
 *  - points:      season points, everything earned. The leaderboards rank this. It only goes down
 *                 when an award is reversed (a scorecard correction, a removed forum post, or an
 *                 admin adjustment).
 *  - pointsSpent: points spent on prizes. Cancelling a claim returns them.
 * Spendable balance = points - pointsSpent, never below zero.
 */

/** Oldest entries are dropped beyond this, so the store stays small. Redemptions are kept separately. */
export const MAX_LEDGER = 150_000;

export const SOURCE_LABEL: Record<PointsSource, string> = {
  checkin: 'Daily check-in',
  guess: 'Guess the Player',
  superover: 'Super Over',
  'dream-xi': 'Pick XI',
  prediction: 'Match prediction',
  quiz: 'Quiz',
  'forum-thread': 'Forum thread',
  'forum-reply': 'Forum reply',
  'forum-removed': 'Forum post removed',
  badge: 'Badge reward',
  referral: 'Invite reward',
  prize: 'Prize claim',
  'prize-refund': 'Prize claim cancelled',
  admin: 'Adjustment by the organisers',
  connections: 'Squad Connections',
  grid: 'Cricket Grid',
  statwars: 'Stat Wars',
  duel: 'Stat Wars duel',
  'fan-post': 'Fan wall post',
  'fan-of-day': 'Fan of the Day',
};

export const balanceOf = (u: Pick<User, 'points' | 'pointsSpent'>) => Math.max(0, (u.points || 0) - (u.pointsSpent || 0));

function record(store: AppStore, entry: Omit<PointsEntry, 'id' | 'at'>) {
  const full: PointsEntry = { id: 'pl-' + crypto.randomBytes(6).toString('hex'), at: new Date().toISOString(), ...entry };
  if (!Array.isArray(store.pointsLedger)) store.pointsLedger = [];
  store.pointsLedger.push(full);
  // Trimmed in batches: removing entries rewrites the shards they are in, so not on every award.
  if (store.pointsLedger.length > MAX_LEDGER + 5_000) store.pointsLedger.splice(0, store.pointsLedger.length - MAX_LEDGER);
  return full;
}

/** Adds (or, with a negative delta, takes back) season points. Returns the change actually applied. */
export function awardPoints(store: AppStore, user: User, delta: number, source: PointsSource, note?: string, ref?: string, by?: string): number {
  const d = Math.round(delta);
  if (!d) return 0;
  const before = user.points || 0;
  user.points = Math.max(0, before + d);
  const applied = user.points - before;
  if (applied) record(store, { userId: user.id, delta: applied, bucket: 'earned', source, note, ref, by });
  return applied;
}

/** Spends points on a prize claim. The caller checks the balance first. */
export function spendPoints(store: AppStore, user: User, cost: number, note: string, ref: string) {
  user.pointsSpent = (user.pointsSpent || 0) + cost;
  record(store, { userId: user.id, delta: -cost, bucket: 'spent', source: 'prize', note, ref });
}

/** Returns points from a cancelled claim. */
export function refundPoints(store: AppStore, user: User, cost: number, note: string, ref: string, by?: string) {
  const before = user.pointsSpent || 0;
  user.pointsSpent = Math.max(0, before - cost);
  const returned = before - user.pointsSpent;
  if (returned) record(store, { userId: user.id, delta: returned, bucket: 'spent', source: 'prize-refund', note, ref, by });
}

/** Points a fan earned from the given sources on one Dubai calendar day (removed posts still count). */
export function earnedOnDay(store: AppStore, userId: string, sources: PointsSource[], day: string) {
  const set = new Set(sources);
  let sum = 0;
  for (let i = (store.pointsLedger || []).length - 1; i >= 0; i--) {
    const e = store.pointsLedger[i];
    const d = new Date(e.at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
    if (d < day) break; // the ledger is in time order
    if (e.userId === userId && d === day && set.has(e.source) && e.delta > 0) sum += e.delta;
  }
  return sum;
}

export function ledgerFor(store: AppStore, userId: string, limit = 200) {
  const out: (PointsEntry & { label: string })[] = [];
  const list = store.pointsLedger || [];
  for (let i = list.length - 1; i >= 0 && out.length < limit; i--) {
    const e = list[i];
    if (e.userId === userId) out.push({ ...e, label: SOURCE_LABEL[e.source] || e.source });
  }
  return out;
}

/** Totals by source for one fan, from the ledger. */
export function summaryFor(store: AppStore, userId: string) {
  const bySource: Record<string, number> = {};
  for (const e of store.pointsLedger || []) if (e.userId === userId) bySource[e.source] = (bySource[e.source] || 0) + e.delta;
  return bySource;
}
