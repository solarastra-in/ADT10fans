import { AppStore, FantasyBreakdownLine, FantasyTeam, Match, Player, Team } from './db';

/**
 * Dream XI: the fantasy game.
 *
 * Pick 11 players from the two teams in a match, within 100 credits, at most 7 from one team,
 * and 1-6 of each role (wicketkeeper, batter, all-rounder, bowler). The captain scores double and
 * the vice-captain 1.5x. Lineups lock at the first ball. Points come from the match scorecard.
 */
export const DREAM_XI = {
  size: 11,
  creditCap: 100,
  maxFromOneTeam: 7,
  roleMin: 1,
  roleMax: 6,
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
  /** Season (leaderboard) points a fan gets = fantasy points / this. */
  fanPointsDivisor: 5,
} as const;

const CATEGORY_CREDITS: Record<string, number> = { icon: 10.5, platinum: 10, diamond: 9.5, gold: 9, silver: 8.5, bronze: 8 };

export function creditsFor(p: Player): number {
  if (typeof p.credits === 'number' && p.credits > 0) return p.credits;
  if (p.isIcon) return 10.5;
  return CATEGORY_CREDITS[(p.category || '').toLowerCase()] ?? 8.5;
}

export const SCORING = {
  playing: 4,
  run: 1,
  boundaryBonus: 1,
  sixBonus: 2,
  thirtyBonus: 8,
  fiftyBonus: 16,
  duck: -2,
  wicket: 25,
  lbwBowledBonus: 8,
  twoWicketBonus: 8,
  threeWicketBonus: 16,
  maiden: 16,
  catch: 8,
  stumping: 12,
  runOut: 12,
};

export function scoringRules() {
  return [
    { group: 'Batting', rules: [['Run', SCORING.run], ['Boundary bonus', SCORING.boundaryBonus], ['Six bonus', SCORING.sixBonus], ['30-run bonus', SCORING.thirtyBonus], ['50-run bonus', SCORING.fiftyBonus], ['Duck (batters, keepers, all-rounders)', SCORING.duck]] },
    { group: 'Bowling', rules: [['Wicket (not run out)', SCORING.wicket], ['Bowled or LBW bonus', SCORING.lbwBowledBonus], ['2-wicket bonus', SCORING.twoWicketBonus], ['3-wicket bonus', SCORING.threeWicketBonus], ['Maiden over', SCORING.maiden]] },
    { group: 'Fielding', rules: [['Catch', SCORING.catch], ['Stumping', SCORING.stumping], ['Run out', SCORING.runOut]] },
    { group: 'Economy (min 1 over)', rules: [['Below 7 runs per over', 6], ['7 to 7.99', 4], ['8 to 9', 2], ['14 to 15', -2], ['15.01 to 16', -4], ['Above 16', -6]] },
    { group: 'Strike rate (min 5 balls, not bowlers)', rules: [['Above 190', 6], ['170 to 190', 4], ['150 to 169.99', 2], ['70 to 80', -2], ['60 to 69.99', -4], ['Below 60', -6]] },
    { group: 'Other', rules: [['In the playing XI', SCORING.playing], ['Captain', '2x'], ['Vice-captain', '1.5x']] },
  ];
}

export const normName = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|†|\*/g, '')
    .replace(/[^a-z\s-]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Finds the squad player a scorecard name refers to (exact name, then unique surname within the pool). */
export function resolvePlayer(name: string, pool: Player[]): Player | null {
  const n = normName(name);
  if (!n) return null;
  const exact = pool.find(p => normName(p.name) === n);
  if (exact) return exact;
  const parts = n.split(' ');
  const last = parts[parts.length - 1];
  const sameLast = pool.filter(p => {
    const pp = normName(p.name).split(' ');
    return pp[pp.length - 1] === last;
  });
  if (sameLast.length === 1) return sameLast[0];
  if (sameLast.length > 1 && parts.length > 1) {
    const initial = parts[0][0];
    const byInitial = sameLast.filter(p => normName(p.name)[0] === initial);
    if (byInitial.length === 1) return byInitial[0];
  }
  return null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  credits?: number;
  counts?: Record<string, number>;
}

export function lineupPool(store: AppStore, match: Match): Player[] {
  return store.teams.filter(t => t.id === match.teamA || t.id === match.teamB).flatMap(t => t.squad);
}

export function validateLineup(pool: Player[], playerIds: string[], captainId: string, viceCaptainId: string): ValidationResult {
  const ids = Array.from(new Set(playerIds));
  if (ids.length !== DREAM_XI.size) return { ok: false, error: `Pick exactly ${DREAM_XI.size} different players` };
  const picked = ids.map(id => pool.find(p => p.id === id));
  if (picked.some(p => !p)) return { ok: false, error: 'Players must come from the two teams in this match' };
  const players = picked as Player[];
  if (!ids.includes(captainId)) return { ok: false, error: 'Choose a captain from your 11' };
  if (!ids.includes(viceCaptainId)) return { ok: false, error: 'Choose a vice-captain from your 11' };
  if (captainId === viceCaptainId) return { ok: false, error: 'Captain and vice-captain must be different players' };
  const credits = Math.round(players.reduce((s, p) => s + creditsFor(p), 0) * 10) / 10;
  if (credits > DREAM_XI.creditCap) return { ok: false, error: `Your team uses ${credits} credits; the limit is ${DREAM_XI.creditCap}` };
  const byTeam: Record<string, number> = {};
  for (const p of players) byTeam[p.teamId] = (byTeam[p.teamId] || 0) + 1;
  if (Object.values(byTeam).some(n => n > DREAM_XI.maxFromOneTeam)) return { ok: false, error: `You can pick at most ${DREAM_XI.maxFromOneTeam} players from one team` };
  const counts: Record<string, number> = { wicketkeeper: 0, batter: 0, allrounder: 0, bowler: 0 };
  for (const p of players) counts[p.role] = (counts[p.role] || 0) + 1;
  const label: Record<string, string> = { wicketkeeper: 'wicketkeeper', batter: 'batter', allrounder: 'all-rounder', bowler: 'bowler' };
  for (const [role, n] of Object.entries(counts)) {
    if (n < DREAM_XI.roleMin) return { ok: false, error: `Pick at least ${DREAM_XI.roleMin} ${label[role]}` };
    if (n > DREAM_XI.roleMax) return { ok: false, error: `Pick at most ${DREAM_XI.roleMax} ${label[role]}s` };
  }
  return { ok: true, credits, counts };
}

export function lineupLocked(match: Match) {
  return match.status !== 'upcoming' || +new Date(match.startsAt) <= Date.now();
}

const oversToBalls = (o: string | number) => {
  const [whole, part] = String(o).split('.');
  return (Number(whole) || 0) * 6 + (Number(part) || 0);
};

export interface PlayerMatchPoints {
  playerId: string;
  name: string;
  teamId: string;
  points: number;
  detail: string[];
}

/** Fantasy points for every squad player in a completed match, from its scorecard. */
export function computePlayerPoints(store: AppStore, match: Match): Map<string, PlayerMatchPoints> {
  const teams = store.teams.filter(t => t.id === match.teamA || t.id === match.teamB);
  const pool = teams.flatMap(t => t.squad);
  const out = new Map<string, PlayerMatchPoints>();
  const get = (p: Player) => {
    let row = out.get(p.id);
    if (!row) {
      row = { playerId: p.id, name: p.name, teamId: p.teamId, points: 0, detail: [] };
      out.set(p.id, row);
    }
    return row;
  };
  const add = (p: Player | null, pts: number, why: string) => {
    if (!p || !pts) return;
    const row = get(p);
    row.points += pts;
    row.detail.push(`${why} ${pts > 0 ? '+' : ''}${pts}`);
  };
  // A fielder who took a catch, stumping or run out was on the field, so counts as playing.
  const field = (p: Player | null, pts: number, why: string) => {
    if (p) playing.add(p.id);
    add(p, pts, why);
  };
  const inningsList = [match.scorecard?.innings1, match.scorecard?.innings2].filter(Boolean) as NonNullable<Match['scorecard']>['innings1'][];
  const playing = new Set<string>();
  for (const ids of Object.values(match.playingXI || {})) for (const id of ids) playing.add(id);

  for (const inn of inningsList) {
    if (!inn) continue;
    const battingTeam = teams.find(t => t.id === inn.teamId);
    const bowlingTeam = teams.find(t => t.id !== inn.teamId);
    const batPool = battingTeam?.squad || pool;
    const bowlPool = bowlingTeam?.squad || pool;
    for (const b of inn.batting || []) {
      const p = resolvePlayer(b.batsman, batPool);
      if (!p) continue;
      playing.add(p.id);
      add(p, b.runs * SCORING.run, `${b.runs} run(s)`);
      add(p, (b.fours || 0) * SCORING.boundaryBonus, `${b.fours} four(s)`);
      add(p, (b.sixes || 0) * SCORING.sixBonus, `${b.sixes} six(es)`);
      if (b.runs >= 50) add(p, SCORING.fiftyBonus, '50 bonus');
      else if (b.runs >= 30) add(p, SCORING.thirtyBonus, '30 bonus');
      const out = !b.isNotOut && !/not out|retired/i.test(b.dismissal || '');
      if (b.runs === 0 && out && b.balls > 0 && p.role !== 'bowler') add(p, SCORING.duck, 'duck');
      if (b.balls >= 5 && p.role !== 'bowler') {
        const sr = (b.runs / b.balls) * 100;
        const bonus = sr > 190 ? 6 : sr >= 170 ? 4 : sr >= 150 ? 2 : sr < 60 ? -6 : sr < 70 ? -4 : sr <= 80 ? -2 : 0;
        add(p, bonus, `strike rate ${sr.toFixed(0)}`);
      }
      // Fielding and bowling credit from the dismissal text, e.g. "c Hetmyer b Boult", "st Pooran b Narine", "run out (Salt)", "lbw b Ali".
      const d = (b.dismissal || '').trim();
      const caught = d.match(/^c\s+(?:&|and)\s+b\s+(.+)$/i);
      if (caught) field(resolvePlayer(caught[1], bowlPool), SCORING.catch, 'catch');
      else {
        const c = d.match(/^c\s+(.+?)\s+b\s+(.+)$/i);
        if (c) field(resolvePlayer(c[1].replace(/^†/, ''), bowlPool), SCORING.catch, 'catch');
      }
      const st = d.match(/^st\s+(.+?)\s+b\s+/i);
      if (st) field(resolvePlayer(st[1].replace(/^†/, ''), bowlPool), SCORING.stumping, 'stumping');
      const ro = d.match(/run out\s*\(([^)]+)\)/i);
      if (ro) {
        const fielders = ro[1].split('/').map(s => s.trim()).filter(Boolean);
        for (const f of fielders.slice(0, 2)) field(resolvePlayer(f, bowlPool), fielders.length > 1 ? Math.round(SCORING.runOut / 2) : SCORING.runOut, 'run out');
      }
      if (/^(lbw\s+b|b)\s+/i.test(d)) {
        const bowler = d.replace(/^(lbw\s+b|b)\s+/i, '');
        add(resolvePlayer(bowler, bowlPool), SCORING.lbwBowledBonus, 'bowled/LBW bonus');
      }
    }
    for (const bw of inn.bowling || []) {
      const p = resolvePlayer(bw.bowler, bowlPool);
      if (!p) continue;
      playing.add(p.id);
      add(p, (bw.wickets || 0) * SCORING.wicket, `${bw.wickets} wicket(s)`);
      if (bw.wickets >= 3) add(p, SCORING.threeWicketBonus, '3-wicket bonus');
      else if (bw.wickets >= 2) add(p, SCORING.twoWicketBonus, '2-wicket bonus');
      add(p, (bw.maidens || 0) * SCORING.maiden, `${bw.maidens} maiden(s)`);
      const balls = oversToBalls(bw.overs);
      if (balls >= 6) {
        const econ = bw.runs / (balls / 6);
        const bonus = econ < 7 ? 6 : econ < 8 ? 4 : econ <= 9 ? 2 : econ > 16 ? -6 : econ > 15 ? -4 : econ >= 14 ? -2 : 0;
        add(p, bonus, `economy ${econ.toFixed(1)}`);
      }
    }
    for (const name of inn.didNotBat || []) {
      const p = resolvePlayer(name, batPool);
      if (p) playing.add(p.id);
    }
  }
  for (const id of playing) {
    const p = pool.find(x => x.id === id);
    if (p) add(p, SCORING.playing, 'in the XI');
  }
  return out;
}

export function scoreLineup(ft: FantasyTeam, playerPoints: Map<string, PlayerMatchPoints>, pool: Player[]): { total: number; breakdown: FantasyBreakdownLine[] } {
  const breakdown: FantasyBreakdownLine[] = ft.playerIds.map(id => {
    const row = playerPoints.get(id);
    const p = pool.find(x => x.id === id);
    const multiplier = id === ft.captainId ? DREAM_XI.captainMultiplier : id === ft.viceCaptainId ? DREAM_XI.viceCaptainMultiplier : 1;
    const base = row?.points || 0;
    return { playerId: id, name: p?.name || row?.name || id, base, multiplier, total: Math.round(base * multiplier * 10) / 10, detail: row?.detail.join(', ') || 'did not score' };
  });
  return { total: Math.round(breakdown.reduce((s, b) => s + b.total, 0) * 10) / 10, breakdown };
}

export interface ScoreMatchResult {
  matchId: string;
  scored: number;
  topScore: number;
  pointsAwarded: number;
  unmatchedNames: string[];
}

/**
 * Scores every Dream XI lineup for a completed match and adds season points to each fan.
 * Safe to run again after a scorecard correction: the previous award is reversed first.
 */
export function scoreMatchFantasy(store: AppStore, matchId: string): ScoreMatchResult {
  const match = store.matches.find(m => m.id === matchId);
  if (!match) throw new Error('Match not found');
  const pool = lineupPool(store, match);
  const playerPoints = computePlayerPoints(store, match);
  const lineups = store.fantasyTeams.filter(f => f.matchId === matchId);
  let pointsAwarded = 0;
  for (const ft of lineups) {
    const { total, breakdown } = scoreLineup(ft, playerPoints, pool);
    const user = store.users.find(u => u.id === ft.userId);
    const previous = ft.scoredAt ? Math.round((ft.points || 0) / DREAM_XI.fanPointsDivisor) : 0;
    const now = Math.round(total / DREAM_XI.fanPointsDivisor);
    if (user) user.points = Math.max(0, user.points - previous + now);
    pointsAwarded += now;
    ft.points = total;
    ft.breakdown = breakdown;
    ft.scoredAt = new Date().toISOString();
  }
  const ranked = [...lineups].sort((a, b) => (b.points || 0) - (a.points || 0));
  let rank = 0;
  let prev: number | null = null;
  ranked.forEach((ft, i) => {
    if (ft.points !== prev) rank = i + 1;
    prev = ft.points ?? 0;
    ft.rank = rank;
  });
  // Names in the scorecard that matched no squad player (admins should fix spelling or add the player).
  const unmatched = new Set<string>();
  for (const inn of [match.scorecard?.innings1, match.scorecard?.innings2]) {
    if (!inn) continue;
    for (const b of inn.batting || []) if (!resolvePlayer(b.batsman, pool)) unmatched.add(b.batsman);
    for (const b of inn.bowling || []) if (!resolvePlayer(b.bowler, pool)) unmatched.add(b.bowler);
  }
  return { matchId, scored: lineups.length, topScore: ranked[0]?.points || 0, pointsAwarded, unmatchedNames: [...unmatched] };
}

/** Season totals for a set of users (for private leagues and the Dream XI leaderboard). */
export function fantasySeasonTotals(store: AppStore, userIds?: Set<string>) {
  const totals = new Map<string, { userId: string; points: number; matches: number; best: number }>();
  for (const ft of store.fantasyTeams) {
    if (!ft.scoredAt) continue;
    if (userIds && !userIds.has(ft.userId)) continue;
    const row = totals.get(ft.userId) || { userId: ft.userId, points: 0, matches: 0, best: 0 };
    row.points = Math.round((row.points + (ft.points || 0)) * 10) / 10;
    row.matches++;
    row.best = Math.max(row.best, ft.points || 0);
    totals.set(ft.userId, row);
  }
  return [...totals.values()].sort((a, b) => b.points - a.points);
}

export function teamOfPlayer(teams: Team[], playerId: string) {
  return teams.find(t => t.squad.some(p => p.id === playerId)) || null;
}
