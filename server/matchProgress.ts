import type { Match, OverTally } from './db';

/**
 * Score snapshots while a match is played, for the live centre's run charts. Each time the score
 * changes (live sync, an admin update, a scorecard save) the score and overs of each innings are
 * kept, so the run progression comes from real updates, never from guesses.
 */

const parseScore = (s?: string) => {
  const m = String(s || '').match(/^(\d+)(?:\/(\d+))?/);
  return m ? { runs: Number(m[1]), wickets: Number(m[2] || 0) } : null;
};

/** Overs as a number of balls ("7.2" = 44). */
export const ballsOf = (overs?: string | number) => {
  const [o, b] = String(overs ?? '').split('.');
  const n = Number(o) * 6 + Number(b || 0);
  return Number.isFinite(n) ? n : 0;
};

/** Which team batted first: from the scorecard, else the match's first innings, else unknown. */
export function firstBatting(m: Match): string | null {
  const t1 = m.scorecard?.innings1?.teamId;
  if (t1) return t1;
  if (m.firstInnings === 1) return m.teamA;
  if (m.firstInnings === 2) return m.teamB;
  return null;
}

export function recordProgress(m: Match, at = new Date().toISOString()) {
  let first = firstBatting(m);
  // Only one side has a score yet: that side is batting first.
  if (!first) {
    const a = parseScore(m.scoreA);
    const b = parseScore(m.scoreB);
    if (a && !b) first = m.teamA;
    else if (b && !a) first = m.teamB;
    if (first) m.firstInnings = first === m.teamA ? 1 : 2;
  }
  if (!first) return;
  const second = first === m.teamA ? m.teamB : m.teamA;
  const sides: [1 | 2, string][] = [[1, first], [2, second]];
  m.progress ||= [];
  for (const [innings, teamId] of sides) {
    const s = parseScore(teamId === m.teamA ? m.scoreA : m.scoreB);
    const overs = String((teamId === m.teamA ? m.oversA : m.oversB) ?? '').trim();
    if (!s || !overs) continue;
    const last = [...m.progress].reverse().find(p => p.innings === innings);
    if (last && last.overs === overs && last.runs === s.runs && last.wickets === s.wickets) continue;
    // A correction to an earlier point replaces the later points of that innings.
    if (last && ballsOf(overs) < ballsOf(last.overs)) m.progress = m.progress.filter(p => p.innings !== innings || ballsOf(p.overs) < ballsOf(overs));
    m.progress.push({ innings, overs, runs: s.runs, wickets: s.wickets, at });
  }
  if (m.progress.length > 300) m.progress = m.progress.slice(-300);
}

/** Over-by-over tally from admin entry, cleaned up: one row per innings and over (1–20). */
export function sanitizeOvers(raw: unknown): OverTally[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seen = new Map<string, OverTally>();
  for (const r of raw.slice(0, 60) as any[]) {
    const innings = Number(r?.innings) === 2 ? 2 : Number(r?.innings) === 1 ? 1 : 0;
    const over = Math.round(Number(r?.over));
    const runs = Math.round(Number(r?.runs));
    if (!innings || !(over >= 1 && over <= 20) || !(runs >= 0 && runs <= 60) || r?.runs === '' || r?.runs === null) continue;
    const wickets = Math.max(0, Math.min(6, Math.round(Number(r?.wickets) || 0)));
    seen.set(`${innings}:${over}`, { innings, over, runs, wickets });
  }
  const out = [...seen.values()].sort((a, b) => a.innings - b.innings || a.over - b.over);
  return out.length ? out : undefined;
}
