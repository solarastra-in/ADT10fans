import type { Match } from './db';

/**
 * When fans can play the games for a match (Pick XI and match predictions).
 *
 * A match opens at midnight in Abu Dhabi on the day before its match day, so fans have a full day
 * to get ready and can play every match of a day (two or three on most days) side by side. It
 * locks at the first ball.
 */
export const MATCH_TIME_ZONE = 'Asia/Dubai'; // Abu Dhabi: UTC+4 all year, no daylight saving
const OFFSET = '+04:00';

/** Calendar day of an instant in Abu Dhabi (YYYY-MM-DD). */
export const abuDhabiDay = (d: Date | string | number = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: MATCH_TIME_ZONE });

/** Midnight in Abu Dhabi on the day before the match day, as an ISO instant. */
export function matchOpensAt(m: Pick<Match, 'startsAt'>): string {
  const midnight = Date.parse(`${abuDhabiDay(m.startsAt)}T00:00:00${OFFSET}`);
  return new Date(midnight - 86_400_000).toISOString();
}

/** True once the first ball is due, or the match is no longer upcoming. */
export function matchLocked(m: Pick<Match, 'startsAt' | 'status'>, now = Date.now()) {
  return m.status !== 'upcoming' || +new Date(m.startsAt) <= now;
}

/** True while fans can make and change their picks for the match. */
export function matchOpen(m: Pick<Match, 'startsAt' | 'status'>, now = Date.now()) {
  return !matchLocked(m, now) && now >= Date.parse(matchOpensAt(m));
}
