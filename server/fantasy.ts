import { AppStore, FantasyBreakdownLine, FantasyTeam, Match, Player, Team } from './db';
import { awardPoints } from './points';
import { statsFor } from './playerStats';

/**
 * Pick XI: the fantasy game.
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
  maxTopPlayers: 4,
  captainMultiplier: 2,
  viceCaptainMultiplier: 1.5,
  fanPointsDivisor: 5,
} as const;

export const SCORING = {
  playing: 20, // Increased base point value for playing in the squad (scaled up from 4)
  run: 2, // 2 pts per run in explosive 10-over format (scaled up from 1)
  boundaryBonus: 2, // 2 bonus pts per boundary four
  sixBonus: 5, // 5 bonus pts per six
  thirtyBonus: 16, // 16 bonus pts for 30+ runs
  fiftyBonus: 36, // 36 bonus pts for 50+ runs
  duck: -4, // -4 pts for dismissal without scoring
  wicket: 35, // 35 pts per wicket in 10-over innings (scaled up from 25)
  lbwBowledBonus: 12, // 12 bonus pts for bowled or LBW
  twoWicketBonus: 16, // 16 bonus pts for 2-wicket haul
  threeWicketBonus: 32, // 32 bonus pts for 3-wicket haul
  maiden: 32, // 32 bonus pts for rare T10 maiden over
  catch: 12, // 12 pts per catch
  stumping: 16, // 16 pts per stumping
  runOut: 16, // 16 pts per run out
};

/**
 * Strike-rate and economy bands, used both to score and to publish the rules, so the two can never
 * disagree again (they did: the rules page promised +12 for a strike rate above 200, the code gave +6).
 */
export const STRIKE_RATE_BANDS: { label: string; test: (sr: number) => boolean; points: number }[] = [
  { label: 'Above 200.0', test: sr => sr > 200, points: 12 },
  { label: '175.0 to 200.0', test: sr => sr >= 175, points: 8 },
  { label: '150.0 to 174.9', test: sr => sr >= 150, points: 4 },
  { label: 'Below 60.0', test: sr => sr < 60, points: -8 },
  { label: '60.0 to 79.9', test: sr => sr < 80, points: -4 },
];
export const ECONOMY_BANDS: { label: string; test: (rpo: number) => boolean; points: number }[] = [
  { label: 'Under 7.0 runs per over', test: e => e < 7, points: 12 },
  { label: '7.0 to 8.5 rpo', test: e => e <= 8.5, points: 8 },
  { label: '8.51 to 10.0 rpo', test: e => e <= 10, points: 4 },
  { label: 'Above 15.5 rpo', test: e => e > 15.5, points: -8 },
  { label: '14.0 to 15.5 rpo', test: e => e >= 14, points: -4 },
];
export const bandPoints = (bands: { test: (n: number) => boolean; points: number }[], value: number) => bands.find(b => b.test(value))?.points || 0;

export function scoringRules() {
  return [
    { group: 'Batting', rules: [['Run', SCORING.run], ['Boundary four bonus', SCORING.boundaryBonus], ['Maximum six bonus', SCORING.sixBonus], ['30-run milestone', SCORING.thirtyBonus], ['50-run milestone', SCORING.fiftyBonus], ['Duck (batters/keepers/all-rounders)', SCORING.duck]] },
    { group: 'Bowling', rules: [['Wicket (excluding run out)', SCORING.wicket], ['Bowled / LBW dismissal bonus', SCORING.lbwBowledBonus], ['2-wicket haul bonus', SCORING.twoWicketBonus], ['3+ wicket haul bonus', SCORING.threeWicketBonus], ['Maiden over bonus', SCORING.maiden]] },
    { group: 'Fielding', rules: [['Catch', SCORING.catch], ['Stumping', SCORING.stumping], ['Run out', SCORING.runOut]] },
    { group: 'Economy (min 1 over)', rules: ECONOMY_BANDS.map(b => [b.label, b.points]) },
    { group: 'Strike rate (min 5 balls, not bowlers)', rules: STRIKE_RATE_BANDS.map(b => [b.label, b.points]) },
    { group: 'Squad & Multipliers', rules: [['In the match playing squad', SCORING.playing], ['Captain (C)', '2x multiplier'], ['Vice-Captain (VC)', '1.5x multiplier']] },
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

export function isTopPlayer(p: Player | PlayerWithForm): boolean {
  // From the official category (and admin-set credits) only, so the star limit is the same for every fan.
  if (getPlayerTier(p) === 'star') return true;
  const playerCredits = (p as any).credits ?? creditsFor(p);
  return playerCredits >= 9.5;
}

export function validateLineup(pool: Player[], playerIds: string[], captainId: string, viceCaptainId: string): ValidationResult {
  const ids = Array.from(new Set(playerIds));
  if (ids.length !== DREAM_XI.size) return { ok: false, error: `Pick exactly ${DREAM_XI.size} players for your fantasy squad` };
  const picked = ids.map(id => pool.find(p => p.id === id));
  if (picked.some(p => !p)) return { ok: false, error: 'Players must come from the two teams in this match' };
  const players = picked as Player[];
  if (!ids.includes(captainId)) return { ok: false, error: `Choose a captain from your ${DREAM_XI.size} players` };
  if (!ids.includes(viceCaptainId)) return { ok: false, error: `Choose a vice-captain from your ${DREAM_XI.size} players` };
  if (captainId === viceCaptainId) return { ok: false, error: 'Captain and vice-captain must be different players' };

  // Shape of the team first (the clearer message when several rules are broken), then the budget.
  const byTeam: Record<string, number> = {};
  for (const p of players) byTeam[p.teamId] = (byTeam[p.teamId] || 0) + 1;
  if (Object.values(byTeam).some(n => n > DREAM_XI.maxFromOneTeam)) {
    return { ok: false, error: `Pick at most ${DREAM_XI.maxFromOneTeam} players from one team (squad size is ${DREAM_XI.size})` };
  }

  // Calculate total credits & budget check
  const totalCredits = Math.round(players.reduce((sum, p) => sum + ((p as any).credits ?? creditsFor(p)), 0) * 10) / 10;
  if (DREAM_XI.creditCap && totalCredits > DREAM_XI.creditCap) {
    return { ok: false, error: `Squad cost (${totalCredits.toFixed(1)} credits) exceeds the ${DREAM_XI.creditCap} credits budget limit` };
  }

  // Top players restriction: ensures only few good players and remaining are mediocre
  const topCount = players.filter(p => isTopPlayer(p)).length;
  if (DREAM_XI.maxTopPlayers && topCount > DREAM_XI.maxTopPlayers) {
    return { ok: false, error: `Squad can have at most ${DREAM_XI.maxTopPlayers} top/star players (${topCount} selected). Balance with budget enablers.` };
  }

  const counts: Record<string, number> = { wicketkeeper: 0, batter: 0, allrounder: 0, bowler: 0 };
  for (const p of players) counts[p.role] = (counts[p.role] || 0) + 1;
  const label: Record<string, string> = { wicketkeeper: 'Wicketkeeper', batter: 'Batter', allrounder: 'All-Rounder', bowler: 'Bowler' };
  for (const [role, n] of Object.entries(counts)) {
    if (n < DREAM_XI.roleMin) {
      return { ok: false, error: `A balanced 11-player squad must include at least ${DREAM_XI.roleMin} ${label[role]}` };
    }
    if (n > DREAM_XI.roleMax) {
      return { ok: false, error: `Squad can have at most ${DREAM_XI.roleMax} ${label[role]}s` };
    }
  }
  return { ok: true, counts, credits: totalCredits };
}

export type FormTrend = 'hot' | 'rising' | 'stable' | 'cold';
export type PlayerTier = 'star' | 'core' | 'value' | 'budget';

export type PointAllocationLevel = 1 | 2 | 3 | 4 | 5;

export interface AllocationLevelInfo {
  level: PointAllocationLevel;
  badge: string;
  name: string;
  tierCategory: 'Supernova' | 'Premium Star' | 'Core Anchor' | 'Tactical Swing' | 'Budget Enabler';
  pastFactor: string;
  futureFactor: string;
  recommendedUsage: string;
  creditTier: string;
  projectedRange: string;
}

export interface PlayerHistoricalMetrics {
  /** Always this season's figures from real scorecards. */
  scope?: 'season';
  matches: number;
  totalRuns: number;
  highestScore: number;
  strikeRate: number;
  battingAvg: number;
  totalWickets: number;
  economy: number;
  bestBowling: string;
  catches: number;
  stumpings: number;
  avgPointsPerMatch: number;
  boundaryCount: number;
  sixCount: number;
}

export interface PlayerFormStats {
  trend: FormTrend;
  momentumScore: number;
  recentScores: number[];
  recentAvg: number;
  projectedPoints: number;
  swingIndex: number;
  pitchSuitability: 'Excellent' | 'Good' | 'Moderate' | 'Challenging';
  matchupNote: string;
  selectionSwing: number;
  tier: PlayerTier;
  allocationLevel: PointAllocationLevel;
  allocationLabel: string;
  allocationInfo: AllocationLevelInfo;
  pastPointsAvg: number;
  futurePitchBoost: number;
  futureOpponentBoost: number;
  projectedCeiling: number;
  projectedFloor: number;
  adaptationSummary: string;
  historicalMetrics?: PlayerHistoricalMetrics;
}

export interface PlayerWithForm extends Player {
  selectedBy?: number;
  form: PlayerFormStats;
}

export interface LineupPreset {
  id: string;
  name: string;
  tagline: string;
  description: string;
  badge: string;
  playerIds: string[];
  captainId: string;
  viceCaptainId: string;
  totalCredits: number;
  starCount: number;
}

export interface MatchSwingInsights {
  pitchProfile: {
    venue: string;
    condition: string;
    expectedScore: string;
    tossAdvantage: string;
    paceVsSpin: { pacePct: number; spinPct: number; paceWickets: number; spinWickets: number };
  };
  starQuotaGuide: {
    recommendedStars: number;
    description: string;
    creditBufferNotice: string;
  };
  radarAverages: {
    power: number;
    bowling: number;
    starPower: number;
    matchup: number;
    volatility: number;
  };
}

const KNOWN_MARQUEE_NAMES = new Set([
  'kieron pollard', 'nicholas pooran', 'andre russell', 'david miller', 'chris lynn',
  'sunil narine', 'wanindu hasaranga', 'rashid khan', 'alex hales', 'sikandar raza',
  'moeen ali', 'trent boult', 'mohammad amir', 'chris jordan', 'rahmanullah gurbaz',
  'jason roy', 'shimron hetmyer', 'phil salt', 'quinton de kock', 'tim david',
  'dwayne bravo', 'shakib al hasan', 'glenn phillips', 'faf du plessis', 'dasun shanaka',
  'liam livingstone', 'bhanuka rajapaksa', 'evin lewis', 'johnson charles'
]);

export function getPlayerTier(p: Player): PlayerTier {
  const norm = normName(p.name);
  if (p.isIcon || p.category?.toLowerCase() === 'icon' || KNOWN_MARQUEE_NAMES.has(norm)) return 'star';
  if (p.category?.toLowerCase() === 'platinum' || p.isCaptain) return 'star';
  if (p.category?.toLowerCase() === 'diamond' || p.category?.toLowerCase() === 'gold') return 'core';
  if (p.role === 'allrounder' || p.isKeeper) return 'core';
  if (p.category?.toLowerCase() === 'silver') return 'value';
  // Everyone else (domestic and lower-bracket signings). This used to be picked from a hash of the
  // player's id, which gave similar players different prices at random.
  return 'value';
}

const TIER_BASE_CREDITS: Record<PlayerTier, number> = {
  star: 10.0,
  core: 9.0,
  value: 8.0,
  budget: 7.5,
};

export function creditsFor(p: Player, formTrend?: FormTrend): number {
  if (typeof p.credits === 'number' && p.credits > 0) return p.credits;
  const tier = getPlayerTier(p);
  let base = TIER_BASE_CREDITS[tier];
  if (p.isIcon) base = 10.5;
  if (formTrend === 'hot') base = Math.min(10.5, base + 0.5);
  else if (formTrend === 'cold') base = Math.max(7.0, base - 0.5);
  return Math.round(base * 10) / 10;
}

/**
 * A player's form for the Pick XI builder.
 *
 * Only real data is reported as such: recent scores are the player's actual Pick XI points from this
 * season's completed matches, and `historicalMetrics` are this season's figures from real scorecards
 * (absent until the player has appeared). Projections are labelled as estimates and come from the
 * player's official category plus any real scores. Earlier versions invented "recent scores" and
 * career statistics from a hash of the player's id; those are gone.
 */
export function calculatePlayerForm(p: Player, match: Match, store: AppStore): PlayerFormStats {
  const tier = getPlayerTier(p);
  const completed = store.matches
    .filter(m => m.status === 'completed' && m.scorecard && (m.teamA === p.teamId || m.teamB === p.teamId))
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const history: number[] = [];
  for (const m of completed) {
    const row = computePlayerPoints(store, m).get(p.id);
    if (row) history.push(row.points);
  }
  const recentScores = history.slice(-3);
  const played = history.length > 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const recentAvg = played ? round1(recentScores.reduce((a, b) => a + b, 0) / recentScores.length) : 0;
  const seasonAvg = played ? round1(history.reduce((a, b) => a + b, 0) / history.length) : 0;

  // Trend only from real scores (two or more matches).
  let trend: FormTrend = 'stable';
  let momentumScore = 0;
  if (recentScores.length >= 2) {
    const first = recentScores[0];
    const last = recentScores[recentScores.length - 1];
    if (recentAvg >= 100 || last >= 110) {
      trend = 'hot';
      momentumScore = Math.min(30, Math.max(8, Math.round((last - 80) / 3)));
    } else if (last >= first + 15) {
      trend = 'rising';
      momentumScore = Math.min(22, Math.max(5, Math.round((last - first) * 0.6)));
    } else if (last <= first - 25 || recentAvg < 30) {
      trend = 'cold';
      momentumScore = -Math.min(24, Math.max(5, Math.round((first - last) * 0.6)));
    }
  }

  // A neutral description of what the player does; no claims about statistics we do not have.
  const style = p.role === 'bowler' ? p.bowlingStyle : p.role === 'allrounder' ? [p.battingStyle, p.bowlingStyle].filter(Boolean).join(', ') : p.battingStyle;
  const roleName = { batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder', wicketkeeper: 'Wicketkeeper' }[p.role];
  const matchupNote = style ? `${roleName} · ${style}` : roleName;
  const pitchSuitability: PlayerFormStats['pitchSuitability'] = 'Good';

  // Estimate for this match: the category baseline, blended with real scores once there are any.
  const baseline = { star: 95, core: 75, value: 58, budget: 45 }[tier];
  const projectedPoints = Math.round(played ? recentAvg * 0.6 + baseline * 0.4 : baseline);
  const projectedCeiling = Math.round(projectedPoints * 1.35);
  const projectedFloor = Math.round(projectedPoints * 0.6);
  const compositeScore = played ? recentAvg * 0.45 + projectedPoints * 0.55 : baseline;

  const pastFactor = played
    ? `This season: ${seasonAvg} Pick XI pts a match over ${history.length} match(es) [${recentScores.join(', ')}]`
    : 'No completed matches this season yet';
  const futureFactor = `Estimate: ${projectedPoints} pts (${played ? 'this season\'s scores and ' : ''}${tier === 'star' ? 'Icon/Platinum or marquee signing' : 'signing category'})`;
  const projectedRange = `${projectedFloor}–${projectedCeiling} pts (estimate)`;
  const level = (n: PointAllocationLevel, badge: string, name: string, tierCategory: AllocationLevelInfo['tierCategory'], recommendedUsage: string, creditTier: string): AllocationLevelInfo => ({
    level: n, badge, name, tierCategory, pastFactor, futureFactor, recommendedUsage, creditTier, projectedRange,
  });
  let allocationLevel: AllocationLevelInfo;
  if (compositeScore >= 110 || (tier === 'star' && trend !== 'cold')) {
    allocationLevel = level(5, 'L5 Marquee', 'Marquee pick', 'Supernova', 'Captain (2x) candidate', 'Top tier');
  } else if (compositeScore >= 85 || (tier === 'star' && trend === 'cold') || (tier === 'core' && trend === 'hot')) {
    allocationLevel = level(4, 'L4 Premium', 'Premium pick', 'Premium Star', 'Vice-captain (1.5x) candidate', 'Premium tier');
  } else if (compositeScore >= 66 || tier === 'core') {
    allocationLevel = level(3, 'L3 Core', 'Core pick', 'Core Anchor', 'Steady squad anchor', 'Core tier');
  } else if (compositeScore >= 48 || tier === 'value') {
    allocationLevel = level(2, 'L2 Value', 'Value pick', 'Tactical Swing', 'Differential pick', 'Value tier');
  } else {
    allocationLevel = level(1, 'L1 Budget', 'Budget pick', 'Budget Enabler', 'Frees up credits for stars', 'Budget tier');
  }

  const season = statsFor(store, p.id);
  const historicalMetrics: PlayerHistoricalMetrics | undefined = season
    ? {
        scope: 'season',
        matches: season.matches,
        totalRuns: season.runs,
        highestScore: season.highest,
        strikeRate: season.strikeRate ?? 0,
        battingAvg: season.average ?? 0,
        totalWickets: season.wickets,
        economy: season.economy ?? 0,
        bestBowling: season.best ? `${season.best.wickets}/${season.best.runs}` : '—',
        catches: season.catches,
        stumpings: season.stumpings,
        avgPointsPerMatch: seasonAvg,
        boundaryCount: season.fours,
        sixCount: season.sixes,
      }
    : undefined;

  return {
    trend,
    momentumScore,
    recentScores,
    recentAvg,
    projectedPoints,
    swingIndex: momentumScore,
    pitchSuitability,
    matchupNote,
    selectionSwing: 0,
    tier,
    allocationLevel: allocationLevel.level,
    allocationLabel: allocationLevel.badge,
    allocationInfo: allocationLevel,
    pastPointsAvg: seasonAvg,
    futurePitchBoost: 0,
    futureOpponentBoost: Math.max(0, Math.round(momentumScore * 0.7)),
    projectedCeiling,
    projectedFloor,
    adaptationSummary: `${pastFactor}. ${futureFactor}.`,
    historicalMetrics,
  };
}

export function lineupPoolWithForm(store: AppStore, match: Match): PlayerWithForm[] {
  const rawPool = lineupPool(store, match);
  const lineups = store.fantasyTeams.filter(f => f.matchId === match.id);

  return rawPool.map(p => {
    const form = calculatePlayerForm(p, match, store);
    const dynamicCredits = creditsFor(p, form.trend);
    const selectedBy = lineups.length
      ? Math.round((lineups.filter(f => f.playerIds.includes(p.id)).length / lineups.length) * 100)
      : Math.min(95, Math.max(12, Math.round(form.projectedPoints * 1.1 + (form.tier === 'star' ? 30 : 0))));

    return {
      ...p,
      credits: dynamicCredits,
      selectedBy,
      form,
    };
  });
}

/**
 * Generate 4 diverse, realistic lineup variations for a match so users can easily pick
 * 3-4 marquee star players, or explore bowling-heavy, balanced, or differential strategies.
 */
export function generateLineupVariations(pool: PlayerWithForm[], match: Match): LineupPreset[] {
  const sortedByRank = [...pool].sort((a, b) => b.form.projectedPoints - a.form.projectedPoints);
  const stars = pool.filter(p => p.form.tier === 'star');
  const nonStars = pool.filter(p => p.form.tier !== 'star');

  const minCostInPool = Math.min(...pool.map(p => p.credits || 7.5));

  const buildLineup = (
    pickCriteria: (candidates: PlayerWithForm[]) => PlayerWithForm[],
    targetStars = 3,
    preferredCaptainTier: 'star' | 'any' = 'star'
  ): { playerIds: string[]; captainId: string; viceCaptainId: string; totalCredits: number; starCount: number } | null => {
    const picked: PlayerWithForm[] = [];
    const roles: Record<string, number> = { wicketkeeper: 0, batter: 0, allrounder: 0, bowler: 0 };
    const teams: Record<string, number> = { [match.teamA]: 0, [match.teamB]: 0 };

    const canAdd = (p: PlayerWithForm) => {
      if (picked.some(x => x.id === p.id)) return false;
      if (picked.length >= DREAM_XI.size) return false;
      const curStars = picked.filter(x => x.form.tier === 'star' || isTopPlayer(x)).length;
      if (curStars >= targetStars && (p.form.tier === 'star' || isTopPlayer(p))) return false;
      if ((teams[p.teamId] || 0) >= DREAM_XI.maxFromOneTeam) return false;
      if ((roles[p.role] || 0) >= DREAM_XI.roleMax) return false;

      const pCost = p.credits || 8.0;
      const curCost = picked.reduce((s, x) => s + (x.credits || 8.0), 0);
      const remainingPicks = DREAM_XI.size - picked.length - 1;
      if (curCost + pCost + remainingPicks * 7.0 > (DREAM_XI.creditCap || 100)) return false;

      const left = DREAM_XI.size - picked.length - 1;
      const neededRoles = ['wicketkeeper', 'batter', 'allrounder', 'bowler'].filter(r => r !== p.role && (roles[r] || 0) === 0).length;
      if (neededRoles > left && left <= 3) return false;
      return true;
    };

    // First ensure 1 of each major role is covered
    for (const r of ['wicketkeeper', 'batter', 'bowler', 'allrounder'] as const) {
      if (picked.length >= DREAM_XI.size) break;
      const candidates = pool.filter(p => p.role === r && canAdd(p)).sort((a, b) => b.form.projectedPoints - a.form.projectedPoints);
      const chosen = candidates[0];
      if (chosen && canAdd(chosen)) {
        picked.push(chosen);
        roles[chosen.role]++;
        teams[chosen.teamId]++;
      }
    }

    // Prioritize stars up to targetStars
    const stars = pool.filter(p => p.form.tier === 'star' || isTopPlayer(p)).sort((a, b) => b.form.projectedPoints - a.form.projectedPoints);
    for (const s of stars) {
      if (picked.length >= DREAM_XI.size) break;
      if (picked.filter(x => x.form.tier === 'star' || isTopPlayer(x)).length >= targetStars) break;
      if (canAdd(s)) {
        picked.push(s);
        roles[s.role]++;
        teams[s.teamId]++;
      }
    }

    // Fill remaining spots using pickCriteria
    const remainingCandidates = pickCriteria(pool);
    for (const p of remainingCandidates) {
      if (picked.length >= DREAM_XI.size) break;
      if (canAdd(p)) {
        picked.push(p);
        roles[p.role]++;
        teams[p.teamId]++;
      }
    }

    if (picked.length !== DREAM_XI.size) return null;

    const totalProjected = Math.round(picked.reduce((s, p) => s + (p.form?.projectedPoints || 70), 0));
    const starCount = picked.filter(p => p.form.tier === 'star' || isTopPlayer(p)).length;

    // Pick captain & vice captain
    const eligibleCaptains = preferredCaptainTier === 'star'
      ? picked.filter(p => p.form.tier === 'star' || isTopPlayer(p))
      : picked;
    const captain = (eligibleCaptains.length ? eligibleCaptains : picked).sort((a, b) => b.form.projectedPoints - a.form.projectedPoints)[0] || picked[0];
    const vice = picked.filter(p => p.id !== captain.id).sort((a, b) => b.form.projectedPoints - a.form.projectedPoints)[0] || picked[1];

    return {
      playerIds: picked.map(p => p.id),
      captainId: captain.id,
      viceCaptainId: vice.id,
      totalCredits: totalProjected,
      starCount,
    };
  };

  const presets: LineupPreset[] = [];

  // 1. "Star Power XI" (anchors top marquee match-winners with budget balance)
  const starLineup = buildLineup(cands => {
    return [...cands].sort((a, b) => b.form.projectedPoints - a.form.projectedPoints);
  }, 4, 'star') || buildLineup(cands => {
    return [...cands].sort((a, b) => b.form.projectedPoints - a.form.projectedPoints);
  }, 3, 'star');

  if (starLineup) {
    presets.push({
      id: 'preset-stars',
      name: 'Star Power XI',
      tagline: 'Maximum Match-Winner Ceiling',
      description: 'Anchors marquee international icons (3-4 stars) with peak scoring potential, balanced with disciplined budget enablers.',
      badge: '⭐ Star Power',
      ...starLineup,
    });
  }

  // 2. "Balanced Core XI" (steady high floor across both squads)
  const balancedLineup = buildLineup(cands => {
    return [...cands].sort((a, b) => b.form.recentAvg - a.form.recentAvg);
  }, 3, 'any') || buildLineup(cands => {
    return [...cands].sort((a, b) => b.form.recentAvg - a.form.recentAvg);
  }, 2, 'any');

  if (balancedLineup) {
    presets.push({
      id: 'preset-balanced',
      name: 'Balanced Core XI',
      tagline: 'High Consistency & Depth',
      description: 'Evenly distributed across both teams with verified tournament consistency, balanced credit economy, and dependable baseline returns.',
      badge: '⚖️ Balanced',
      ...balancedLineup,
    });
  }

  // 3. "Death-Overs Strike XI" (prioritizing 35pt wickets & death hitting)
  const bowlingLineup = buildLineup(cands => {
    return [...cands].sort((a, b) => {
      const aBowl = a.role === 'bowler' || a.role === 'allrounder' ? 1 : 0;
      const bBowl = b.role === 'bowler' || b.role === 'allrounder' ? 1 : 0;
      if (aBowl !== bBowl) return bBowl - aBowl;
      return b.form.projectedPoints - a.form.projectedPoints;
    });
  }, 3, 'any');

  if (bowlingLineup) {
    presets.push({
      id: 'preset-bowling',
      name: 'Death-Overs Strike XI',
      tagline: 'Wicket-Heavy Bowling Strategy',
      description: 'Capitalizes on 35-point wicket bonuses, maiden overs, and death-overs economy bonuses with balanced all-rounder depth.',
      badge: '🎯 Bowling Strike',
      ...bowlingLineup,
    });
  }

  // 4. "Contrarian Differential XI" (low ownership upside for leaderboard climbs)
  const differentialLineup = buildLineup(cands => {
    return [...cands].sort((a, b) => {
      const aDiff = (100 - (a.selectedBy || 50)) * 0.4 + a.form.momentumScore;
      const bDiff = (100 - (b.selectedBy || 50)) * 0.4 + b.form.momentumScore;
      return bDiff - aDiff;
    });
  }, 2, 'any');

  if (differentialLineup) {
    presets.push({
      id: 'preset-differential',
      name: 'Contrarian Differential XI',
      tagline: 'High-Ceiling League Weapon',
      description: 'Smart low-ownership picks poised for breakout match-winning performances while conserving credit budget.',
      badge: '⚡ High Swing',
      ...differentialLineup,
    });
  }

  return presets;
}

/**
 * Conditions summary for the Pick XI builder, worked out from this season's completed matches at the
 * venue. Until there are any, it says so instead of quoting figures (earlier versions shipped fixed,
 * invented numbers such as a chasing win rate).
 */
export function getMatchSwingInsights(match: Match, pool: PlayerWithForm[], store?: AppStore): MatchSwingInsights {
  const starCount = pool.filter(p => isTopPlayer(p)).length;
  const done = (store?.matches || []).filter(m => m.status === 'completed' && m.scorecard?.innings1 && m.scorecard?.innings2);
  const firsts = done.map(m => m.scorecard!.innings1!.totalRuns).filter(n => Number.isFinite(n) && n > 0);
  const decided = done.filter(m => m.winner);
  const chaseWins = decided.filter(m => m.winner === m.scorecard!.innings2!.teamId).length;
  let pace = 0;
  let spin = 0;
  if (store) {
    const byName = new Map(store.teams.flatMap(t => t.squad).map(p => [normName(p.name), p]));
    for (const m of done) {
      for (const inn of [m.scorecard!.innings1!, m.scorecard!.innings2!]) {
        for (const bw of inn.bowling || []) {
          const style = (byName.get(normName(bw.bowler))?.bowlingStyle || '').toLowerCase();
          if (/spin|break|orthodox|googly|chinaman/.test(style)) spin += bw.wickets || 0;
          else if (style) pace += bw.wickets || 0;
        }
      }
    }
  }
  const total = pace + spin;
  const avgFirst = firsts.length ? Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length) : null;
  return {
    pitchProfile: {
      venue: match.venue || 'Zayed Cricket Stadium, Abu Dhabi',
      condition: done.length ? `Based on ${done.length} completed match(es) this season` : 'No completed matches this season yet',
      expectedScore: avgFirst ? `${avgFirst} average first-innings total this season` : 'Not enough matches yet',
      tossAdvantage: decided.length ? `Chasing teams have won ${chaseWins} of ${decided.length} this season` : 'Not enough matches yet',
      paceVsSpin: {
        pacePct: total ? Math.round((pace / total) * 100) : 0,
        spinPct: total ? Math.round((spin / total) * 100) : 0,
        paceWickets: pace,
        spinWickets: spin,
      },
    },
    starQuotaGuide: {
      recommendedStars: Math.min(DREAM_XI.maxTopPlayers || 4, Math.max(1, Math.floor(starCount / 2))),
      description: `Up to ${DREAM_XI.maxTopPlayers || 4} star players (Icon, Platinum and marquee signings) fit in a lineup; fill the rest within the ${DREAM_XI.creditCap}-credit budget.`,
      creditBufferNotice: 'Stars cost more credits, so cheaper picks leave room for them.',
    },
    radarAverages: {
      power: 0,
      bowling: 0,
      starPower: pool.length ? Math.round((starCount / pool.length) * 100) : 0,
      matchup: 0,
      volatility: 0,
    },
  };
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
        const bonus = bandPoints(STRIKE_RATE_BANDS, sr);
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
        const bonus = bandPoints(ECONOMY_BANDS, econ);
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
 * Scores every Pick XI lineup for a completed match and adds season points to each fan.
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
    if (user && now !== previous) {
      const label = `Match ${match.matchNo || ''} · ${total} Pick XI points`.replace('Match  · ', '');
      awardPoints(store, user, now - previous, 'dream-xi', previous ? `${label} (scorecard corrected, was ${previous})` : label, matchId);
    }
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

/** Season totals for a set of users (for private leagues and the Pick XI leaderboard). */
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
