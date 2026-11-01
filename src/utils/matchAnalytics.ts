import type { InningsScorecard, Match } from '../types';

/**
 * Live centre numbers, all worked out from the match's own data: the score, the scorecard, the
 * fall of wickets, the over-by-over tally and the score updates recorded while it was played.
 * Nothing is estimated except where labelled as a projection (the current run rate carried on).
 */

/** Overs per innings in the T10. */
export const MAX_OVERS = 10;
export const MAX_BALLS = MAX_OVERS * 6;

export const ballsOf = (overs?: string | number | null) => {
  const [o, b] = String(overs ?? '').split('.');
  const n = Number(o || 0) * 6 + Number(b || 0);
  return Number.isFinite(n) ? n : 0;
};
export const oversOf = (balls: number) => `${Math.floor(balls / 6)}${balls % 6 ? `.${balls % 6}` : ''}`;
const rate = (runs: number, balls: number) => (balls > 0 ? Math.round((runs / balls) * 6 * 100) / 100 : 0);
const parseScore = (s?: string) => {
  const m = String(s || '').match(/^(\d+)(?:\/(\d+))?/);
  return m ? { runs: Number(m[1]), wickets: Number(m[2] || 0) } : null;
};

export interface WormPoint { balls: number; runs: number; wickets: number }
export interface OverBar { over: number; runs: number; wickets: number }
export interface Partnership { wicket: number; runs: number; fromBalls: number | null; toBalls: number | null; outPlayer?: string; current?: boolean }
export interface Phase { label: string; from: number; to: number; runs: number; wickets: number; rr: number; complete: boolean }

export interface InningsView {
  n: 1 | 2;
  teamId: string;
  runs: number;
  wickets: number;
  balls: number;
  overs: string;
  crr: number;
  card?: InningsScorecard;
  worm: WormPoint[];
  /** Where the run chart comes from: the over tally, live score updates, or the fall of wickets. */
  wormSource: 'overs' | 'updates' | 'wickets' | null;
  manhattan: OverBar[];
  phases: Phase[];
  partnerships: Partnership[];
  fours: number;
  sixes: number;
  boundaryRuns: number;
  extras: number;
  /** Not out batters who have faced a ball (the pair at the crease while live). */
  atCrease: { name: string; runs: number; balls: number; fours: number; sixes: number; sr: number }[];
  topBatters: { name: string; runs: number; balls: number; sr: number; notOut: boolean }[];
  bowlers: { name: string; overs: string; balls: number; runs: number; wickets: number; economy: number; dots?: number }[];
  ended: boolean;
}

export interface MatchAnalysis {
  innings: InningsView[];
  /** The innings being batted now (live matches). */
  current: InningsView | null;
  chase: { target: number; need: number; ballsLeft: number; rrr: number; wicketsLeft: number } | null;
  /** First innings only, while live: the current run rate carried to 10 overs, and a little faster. */
  projection: { atCrr: number; plus1: number; plus2: number } | null;
  /** Head to head after the same number of balls (second innings). */
  sameStage: { balls: number; first: number; firstWickets: number; second: number; secondWickets: number } | null;
}

function worm(m: Match, n: 1 | 2, runs: number, wickets: number, balls: number, card?: InningsScorecard): { points: WormPoint[]; source: InningsView['wormSource'] } {
  const tally = (m.scorecard?.overs || []).filter(o => o.innings === n).sort((a, b) => a.over - b.over);
  if (tally.length) {
    let r = 0;
    let w = 0;
    const pts: WormPoint[] = [{ balls: 0, runs: 0, wickets: 0 }];
    for (const o of tally) {
      r += o.runs;
      w += o.wickets;
      pts.push({ balls: Math.min(o.over * 6, balls || o.over * 6), runs: r, wickets: w });
    }
    if (balls > pts[pts.length - 1].balls && runs >= r) pts.push({ balls, runs, wickets });
    return { points: pts, source: 'overs' };
  }
  const ups = (m.progress || []).filter(p => p.innings === n).map(p => ({ balls: ballsOf(p.overs), runs: p.runs, wickets: p.wickets }));
  if (ups.length >= 2) {
    const pts = [{ balls: 0, runs: 0, wickets: 0 }, ...ups].sort((a, b) => a.balls - b.balls);
    if (balls > pts[pts.length - 1].balls) pts.push({ balls, runs, wickets });
    return { points: pts, source: 'updates' };
  }
  const fow = (card?.fallOfWickets || []).filter(f => f.over);
  if (fow.length) {
    const pts = [{ balls: 0, runs: 0, wickets: 0 }, ...fow.map(f => ({ balls: ballsOf(f.over), runs: f.score, wickets: f.wicket }))].sort((a, b) => a.balls - b.balls);
    if (balls > pts[pts.length - 1].balls) pts.push({ balls, runs, wickets });
    return { points: pts, source: 'wickets' };
  }
  return { points: [], source: null };
}

function manhattan(m: Match, n: 1 | 2): OverBar[] {
  const bbb = (m.scorecard?.ballByBall || m.ballByBall || []).filter(b => b.innings === n);
  if (bbb.length) {
    const map = new Map<number, OverBar>();
    for (const b of bbb) {
      const over = Number(b.over) + 1;
      const row = map.get(over) || { over, runs: 0, wickets: 0 };
      row.runs += Number(b.runs) || 0;
      if (b.isWicket) row.wickets++;
      map.set(over, row);
    }
    return [...map.values()].sort((a, b) => a.over - b.over);
  }
  return (m.scorecard?.overs || []).filter(o => o.innings === n).sort((a, b) => a.over - b.over).map(o => ({ over: o.over, runs: o.runs, wickets: o.wickets }));
}

/** T10 phases: powerplay overs 1–3, middle 4–7, death 8–10. */
function phases(bars: OverBar[]): Phase[] {
  if (!bars.length) return [];
  const defs: [string, number, number][] = [['Powerplay', 1, 3], ['Middle', 4, 7], ['Death', 8, 10]];
  return defs
    .map(([label, from, to]) => {
      const rows = bars.filter(b => b.over >= from && b.over <= to);
      const runs = rows.reduce((s, b) => s + b.runs, 0);
      return { label, from, to, runs, wickets: rows.reduce((s, b) => s + b.wickets, 0), rr: rate(runs, rows.length * 6), complete: rows.length === to - from + 1, n: rows.length };
    })
    .filter(p => p.n > 0)
    .map(({ n: _n, ...p }) => p);
}

function partnerships(card: InningsScorecard | undefined, runs: number, balls: number, wickets: number, live: boolean): Partnership[] {
  const fow = [...(card?.fallOfWickets || [])].sort((a, b) => a.wicket - b.wicket);
  if (!fow.length) return [];
  const out: Partnership[] = [];
  let prevRuns = 0;
  let prevBalls: number | null = 0;
  for (const f of fow) {
    const at = f.over ? ballsOf(f.over) : null;
    out.push({ wicket: f.wicket, runs: Math.max(0, f.score - prevRuns), fromBalls: prevBalls, toBalls: at, outPlayer: f.player });
    prevRuns = f.score;
    prevBalls = at;
  }
  if (wickets < 10 && (live || runs > prevRuns)) out.push({ wicket: fow.length + 1, runs: Math.max(0, runs - prevRuns), fromBalls: prevBalls, toBalls: balls, current: live });
  return out;
}

export function analyse(m: Match): MatchAnalysis {
  const live = m.status === 'live';
  const cards = [m.scorecard?.innings1, m.scorecard?.innings2];
  const firstTeam = cards[0]?.teamId || (m.firstInnings === 2 ? m.teamB : m.teamA);
  const order: [1 | 2, string][] = [[1, firstTeam], [2, firstTeam === m.teamA ? m.teamB : m.teamA]];
  const innings: InningsView[] = [];
  for (const [n, teamId] of order) {
    const card = cards.find(c => c?.teamId === teamId) || (cards[n - 1] && !cards[n - 1]!.teamId ? cards[n - 1] : undefined);
    const score = parseScore(teamId === m.teamA ? m.scoreA : m.scoreB);
    const runs = score?.runs ?? card?.totalRuns ?? 0;
    const wickets = score?.wickets ?? card?.wickets ?? 0;
    const overs = String((teamId === m.teamA ? m.oversA : m.oversB) || card?.overs || '');
    const balls = ballsOf(overs);
    if (!score && !card && !(m.scorecard?.overs || []).some(o => o.innings === n)) continue;
    const bat = card?.batting || [];
    const fours = bat.reduce((s, b) => s + (b.fours || 0), 0);
    const sixes = bat.reduce((s, b) => s + (b.sixes || 0), 0);
    const w = worm(m, n, runs, wickets, balls, card);
    const bars = manhattan(m, n);
    // The first innings is over once the second has started.
    const secondStarted = n === 1 && (Boolean(parseScore(order[1][1] === m.teamA ? m.scoreA : m.scoreB)) || Boolean(cards[1]?.batting?.length));
    const ended = wickets >= 10 || balls >= MAX_BALLS || m.status === 'completed' || secondStarted;
    innings.push({
      n,
      teamId,
      runs,
      wickets,
      balls,
      overs: overs || oversOf(balls),
      crr: rate(runs, balls),
      card,
      worm: w.points,
      wormSource: w.source,
      manhattan: bars,
      phases: phases(bars),
      partnerships: partnerships(card, runs, balls, wickets, live && !ended),
      fours,
      sixes,
      boundaryRuns: fours * 4 + sixes * 6,
      extras: card?.extras?.total ?? 0,
      atCrease: bat.filter(b => b.isNotOut && b.balls > 0).map(b => ({ name: b.batsman, runs: b.runs, balls: b.balls, fours: b.fours, sixes: b.sixes, sr: b.strikeRate || (b.balls ? Math.round((b.runs / b.balls) * 1000) / 10 : 0) })),
      topBatters: [...bat].filter(b => b.balls > 0 || b.runs > 0).sort((a, b) => b.runs - a.runs || a.balls - b.balls).slice(0, 6).map(b => ({ name: b.batsman, runs: b.runs, balls: b.balls, sr: b.strikeRate || (b.balls ? Math.round((b.runs / b.balls) * 1000) / 10 : 0), notOut: Boolean(b.isNotOut) })),
      bowlers: (card?.bowling || []).map(b => ({ name: b.bowler, overs: String(b.overs), balls: ballsOf(b.overs), runs: b.runs, wickets: b.wickets, economy: b.economy || rate(b.runs, ballsOf(b.overs)), dots: b.dots })).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy),
      ended,
    });
  }
  const [i1, i2] = [innings.find(i => i.n === 1), innings.find(i => i.n === 2)];
  const current = live ? (i2 && (i2.balls > 0 || i1?.ended) ? i2 : i1 || null) : null;
  let chase: MatchAnalysis['chase'] = null;
  if (i1 && i2 && (i1.ended || i2.balls > 0)) {
    const target = i1.runs + 1;
    const ballsLeft = Math.max(0, MAX_BALLS - i2.balls);
    const need = Math.max(0, target - i2.runs);
    chase = { target, need, ballsLeft, rrr: ballsLeft ? rate(need, ballsLeft) : 0, wicketsLeft: Math.max(0, 10 - i2.wickets) };
  }
  let projection: MatchAnalysis['projection'] = null;
  if (live && current?.n === 1 && current.balls >= 6 && current.balls < MAX_BALLS && current.wickets < 10) {
    const left = (MAX_BALLS - current.balls) / 6;
    projection = { atCrr: Math.round(current.runs + current.crr * left), plus1: Math.round(current.runs + (current.crr + 1) * left), plus2: Math.round(current.runs + (current.crr + 2) * left) };
  }
  let sameStage: MatchAnalysis['sameStage'] = null;
  if (i1 && i2 && i2.balls > 0 && i1.worm.length > 1) {
    const at = (pts: WormPoint[], b: number) => {
      const before = [...pts].filter(p => p.balls <= b).pop();
      return before && pts.some(p => p.balls >= b) ? before : null;
    };
    const p = at(i1.worm, i2.balls);
    if (p && p.balls === i2.balls) sameStage = { balls: i2.balls, first: p.runs, firstWickets: p.wickets, second: i2.runs, secondWickets: i2.wickets };
  }
  return { innings, current, chase, projection, sameStage };
}

/** A round axis maximum above the largest value. */
export function niceMax(v: number, step = 10) {
  return Math.max(step, Math.ceil((v * 1.08) / step) * step);
}
