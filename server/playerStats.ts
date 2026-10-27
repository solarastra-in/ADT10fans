import type { AppStore, Match, Player } from './db';
import { resolvePlayer } from './fantasy';

/**
 * A player's statistics for this season, worked out from the scorecards of completed matches on the
 * site. Nothing here is estimated: a player who has not batted has no batting figures.
 *
 * Career statistics are not stored or invented; the player card links to ESPNcricinfo and Cricbuzz
 * for those.
 */
export interface SeasonStats {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  highest: number;
  highestNotOut: boolean;
  notOuts: number;
  fours: number;
  sixes: number;
  fifties: number;
  /** Runs per 100 balls, or null before the player has faced a ball. */
  strikeRate: number | null;
  /** Runs per dismissal, or null while never out. */
  average: number | null;
  /** Legal balls bowled. */
  ballsBowled: number;
  runsConceded: number;
  wickets: number;
  /** Runs per over, or null before the player has bowled. */
  economy: number | null;
  best: { wickets: number; runs: number } | null;
  catches: number;
  stumpings: number;
}

const blank = (): SeasonStats => ({
  matches: 0, innings: 0, runs: 0, balls: 0, highest: 0, highestNotOut: false, notOuts: 0, fours: 0, sixes: 0, fifties: 0,
  strikeRate: null, average: null, ballsBowled: 0, runsConceded: 0, wickets: 0, economy: null, best: null, catches: 0, stumpings: 0,
});

/** "3.4" overs → 22 balls. */
export function oversToBalls(overs: string | number): number {
  const [o, b] = String(overs ?? '0').split('.');
  return (Number(o) || 0) * 6 + Math.min(5, Number(b) || 0);
}

const completedWithCard = (store: AppStore) =>
  store.matches.filter(m => m.status === 'completed' && (m.scorecard?.innings1?.batting?.length || m.scorecard?.innings2?.batting?.length));

let cache: { key: string; stats: Map<string, SeasonStats> } | null = null;

/** Season statistics for every player who has appeared in a completed match. */
export function seasonStats(store: AppStore): Map<string, SeasonStats> {
  const done = completedWithCard(store);
  const key = done.map(m => `${m.id}@${m.updatedAt}`).join('|');
  if (cache && cache.key === key) return cache.stats;
  const out = new Map<string, SeasonStats>();
  const row = (p: Player) => {
    let s = out.get(p.id);
    if (!s) out.set(p.id, (s = blank()));
    return s;
  };
  for (const m of done) addMatch(store, m, row);
  for (const s of out.values()) {
    s.strikeRate = s.balls ? Math.round((s.runs / s.balls) * 1000) / 10 : null;
    const outs = s.innings - s.notOuts;
    s.average = outs > 0 ? Math.round((s.runs / outs) * 10) / 10 : null;
    s.economy = s.ballsBowled ? Math.round((s.runsConceded / (s.ballsBowled / 6)) * 10) / 10 : null;
  }
  cache = { key, stats: out };
  return out;
}

function addMatch(store: AppStore, m: Match, row: (p: Player) => SeasonStats) {
  const teams = store.teams.filter(t => t.id === m.teamA || t.id === m.teamB);
  const appeared = new Set<string>();
  const seen = (p: Player | null) => {
    if (p) appeared.add(p.id);
    return p;
  };
  for (const inn of [m.scorecard?.innings1, m.scorecard?.innings2]) {
    if (!inn) continue;
    const batPool = teams.find(t => t.id === inn.teamId)?.squad || teams.flatMap(t => t.squad);
    const bowlPool = teams.find(t => t.id !== inn.teamId)?.squad || teams.flatMap(t => t.squad);
    for (const b of inn.batting || []) {
      const p = seen(resolvePlayer(b.batsman, batPool));
      if (p) {
        const s = row(p);
        const notOut = Boolean(b.isNotOut) || /not out|retired/i.test(b.dismissal || '');
        s.innings++;
        s.runs += b.runs || 0;
        s.balls += b.balls || 0;
        s.fours += b.fours || 0;
        s.sixes += b.sixes || 0;
        if (notOut) s.notOuts++;
        if ((b.runs || 0) >= 50) s.fifties++;
        if ((b.runs || 0) > s.highest || ((b.runs || 0) === s.highest && notOut)) {
          s.highest = b.runs || 0;
          s.highestNotOut = notOut;
        }
      }
      const d = (b.dismissal || '').trim();
      const cb = d.match(/^c\s+(?:&|and)\s+b\s+(.+)$/i);
      const c = cb ? null : d.match(/^c\s+(.+?)\s+b\s+/i);
      const catcher = cb ? cb[1] : c ? c[1].replace(/^†/, '') : null;
      if (catcher) {
        const f = seen(resolvePlayer(catcher, bowlPool));
        if (f) row(f).catches++;
      }
      const st = d.match(/^st\s+(.+?)\s+b\s+/i);
      if (st) {
        const k = seen(resolvePlayer(st[1].replace(/^†/, ''), bowlPool));
        if (k) row(k).stumpings++;
      }
    }
    for (const bw of inn.bowling || []) {
      const p = seen(resolvePlayer(bw.bowler, bowlPool));
      if (!p) continue;
      const s = row(p);
      const balls = oversToBalls(bw.overs);
      s.ballsBowled += balls;
      s.runsConceded += bw.runs || 0;
      s.wickets += bw.wickets || 0;
      if (balls && (!s.best || bw.wickets > s.best.wickets || (bw.wickets === s.best.wickets && bw.runs < s.best.runs))) {
        s.best = { wickets: bw.wickets || 0, runs: bw.runs || 0 };
      }
    }
  }
  for (const ids of Object.values(m.playingXI || {})) for (const id of ids) appeared.add(id);
  const byId = new Map(teams.flatMap(t => t.squad).map(p => [p.id, p]));
  for (const id of appeared) {
    const p = byId.get(id);
    if (p) row(p).matches++;
  }
}

/** One player's season stats, or null if they have not appeared in a completed match. */
export function statsFor(store: AppStore, playerId: string): SeasonStats | null {
  return seasonStats(store).get(playerId) || null;
}
