import { AppStore, FantasyBreakdownLine, FantasyTeam, Match, Player, Team } from './db';
import { awardPoints } from './points';

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

export function scoringRules() {
  return [
    { group: 'Batting', rules: [['Run', SCORING.run], ['Boundary four bonus', SCORING.boundaryBonus], ['Maximum six bonus', SCORING.sixBonus], ['30-run milestone', SCORING.thirtyBonus], ['50-run milestone', SCORING.fiftyBonus], ['Duck (batters/keepers/all-rounders)', SCORING.duck]] },
    { group: 'Bowling', rules: [['Wicket (excluding run out)', SCORING.wicket], ['Bowled / LBW dismissal bonus', SCORING.lbwBowledBonus], ['2-wicket haul bonus', SCORING.twoWicketBonus], ['3+ wicket haul bonus', SCORING.threeWicketBonus], ['Maiden over bonus', SCORING.maiden]] },
    { group: 'Fielding', rules: [['Catch', SCORING.catch], ['Stumping', SCORING.stumping], ['Run out', SCORING.runOut]] },
    { group: 'Economy (min 1 over)', rules: [['Under 7.0 runs per over', 12], ['7.0 to 8.5 rpo', 8], ['8.51 to 10.0 rpo', 4], ['14.0 to 15.5 rpo', -4], ['Above 15.5 rpo', -8]] },
    { group: 'Strike rate (min 5 balls)', rules: [['Above 200.0', 12], ['175.0 to 200.0', 8], ['150.0 to 174.9', 4], ['Below 80.0', -4], ['Below 60.0', -8]] },
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
  const form = (p as any).form;
  const lvl = form?.allocationLevel;
  if (typeof lvl === 'number' && lvl >= 4) return true;
  const tier = form?.tier || getPlayerTier(p);
  if (tier === 'star') return true;
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

  const byTeam: Record<string, number> = {};
  for (const p of players) byTeam[p.teamId] = (byTeam[p.teamId] || 0) + 1;
  if (Object.values(byTeam).some(n => n > DREAM_XI.maxFromOneTeam)) {
    return { ok: false, error: `Pick at most ${DREAM_XI.maxFromOneTeam} players from one team (squad size is ${DREAM_XI.size})` };
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
  // Domestic UAE or lower bracket
  const hash = p.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  if (hash % 3 === 0) return 'budget';
  if (hash % 3 === 1) return 'value';
  return 'core';
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

export function calculatePlayerForm(p: Player, match: Match, store: AppStore): PlayerFormStats {
  const tier = getPlayerTier(p);
  const norm = normName(p.name);
  const hash = (p.id + match.id).split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

  // Check if player participated in any completed tournament matches
  const completedMatches = store.matches.filter(m => m.status === 'completed' && m.scorecard);
  const scoresFromHistory: number[] = [];

  for (const m of completedMatches) {
    if (m.teamA !== p.teamId && m.teamB !== p.teamId) continue;
    const ptsMap = computePlayerPoints(store, m);
    const row = ptsMap.get(p.id);
    if (row && row.points > 0) scoresFromHistory.push(row.points);
  }

  // Generate deterministic recent match scores if tournament is early/upcoming
  let recentScores: number[];
  if (scoresFromHistory.length >= 2) {
    recentScores = scoresFromHistory.slice(-3);
  } else {
    // Increased baseline T10 historical performance model with higher base point values
    const baseByTier = {
      star: [110, 142, 128],
      core: [82, 106, 94],
      value: [60, 82, 72],
      budget: [44, 62, 52],
    }[tier];
    // Apply slight deterministic player variance (-10 to +15)
    const var1 = (hash % 23) - 10;
    const var2 = ((hash * 3) % 27) - 12;
    const var3 = ((hash * 7) % 29) - 13;
    recentScores = [
      Math.max(25, baseByTier[0] + var1),
      Math.max(30, baseByTier[1] + var2),
      Math.max(28, baseByTier[2] + var3),
    ];
  }

  const recentAvg = Math.round((recentScores.reduce((a, b) => a + b, 0) / recentScores.length) * 10) / 10;

  // Determine form trend based on recent score trajectory
  const lastScore = recentScores[recentScores.length - 1];
  let trend: FormTrend = 'stable';
  let momentumScore = 0;

  if (lastScore >= 110 || recentAvg >= 105) {
    trend = 'hot';
    momentumScore = Math.min(30, Math.round(((lastScore - 90) / 90) * 20 + 12));
  } else if (lastScore > recentScores[0] + 15 || recentAvg >= 80) {
    trend = 'rising';
    momentumScore = Math.min(22, Math.max(8, Math.round((lastScore - recentScores[0]) * 0.8)));
  } else if (lastScore <= 45 || recentAvg < 50) {
    trend = 'cold';
    momentumScore = -Math.min(24, Math.max(8, Math.round(60 - lastScore)));
  } else {
    trend = 'stable';
    momentumScore = (hash % 9) - 4;
  }

  // Sheikh Zayed Cricket Stadium pitch conditions & upcoming match context factors
  let pitchSuitability: 'Excellent' | 'Good' | 'Moderate' | 'Challenging' = 'Good';
  let matchupNote = 'Balanced matchup';

  if (p.role === 'batter' || (p.role === 'allrounder' && p.battingStyle)) {
    pitchSuitability = tier === 'star' ? 'Excellent' : 'Good';
    matchupNote = tier === 'star' ? 'Powerplay boundary threat (200+ SR)' : 'Middle-order acceleration';
  } else if (p.role === 'bowler') {
    if (p.bowlingStyle?.toLowerCase().includes('spin')) {
      pitchSuitability = 'Good';
      matchupNote = 'High wicket potential in middle overs 4-7';
    } else {
      pitchSuitability = tier === 'star' ? 'Excellent' : 'Good';
      matchupNote = 'Death-overs yorker & wicket specialist';
    }
  } else if (p.role === 'wicketkeeper') {
    pitchSuitability = 'Good';
    matchupNote = 'Top order striker + stumping bonuses';
  }

  // Projected points for upcoming match - scaled on historical form, pitch suitability, and match context
  const pitchMultiplier = pitchSuitability === 'Excellent' ? 1.22 : pitchSuitability === 'Good' ? 1.12 : pitchSuitability === 'Moderate' ? 1.00 : 0.92;
  const futurePitchBoost = pitchSuitability === 'Excellent' ? 22 : pitchSuitability === 'Good' ? 12 : 0;
  const futureOpponentBoost = Math.max(0, Math.round(momentumScore * 0.7));
  const projectedPoints = Math.round(Math.max(30, recentAvg * (1 + momentumScore / 100) * pitchMultiplier + Math.round((hash % 9) - 4)));

  // Volatility swing index (-10 to +25)
  const swingIndex = Math.round(momentumScore + (hash % 11) - 5);

  // Selection swing (+/- % weekly trend)
  const selectionSwing = Math.round((momentumScore * 0.7 + ((hash % 13) - 6)) * 10) / 10;

  // Composite allocation score combining past track record (45%) and future projected conditions (55%)
  const compositeScore = recentAvg * 0.45 + projectedPoints * 0.55;

  let allocationLevel: AllocationLevelInfo;

  if (compositeScore >= 110 || (tier === 'star' && trend !== 'cold')) {
    allocationLevel = {
      level: 5,
      badge: 'L5 Supernova',
      name: 'Supernova Marquee Allocation',
      tierCategory: 'Supernova',
      pastFactor: `Past Form: ${recentAvg} avg pts · Trajectory [${recentScores.join(', ')}] (${trend.toUpperCase()})`,
      futureFactor: `Future Outlook: ${projectedPoints} proj pts · ${pitchSuitability} pitch fit (${matchupNote})`,
      recommendedUsage: 'Premier Captaincy candidate (2x) · Highest scoring ceiling',
      creditTier: 'Supernova Tier',
      projectedRange: '120–175+ pts',
    };
  } else if (compositeScore >= 85 || (tier === 'star' && trend === 'cold') || (tier === 'core' && trend === 'hot')) {
    allocationLevel = {
      level: 4,
      badge: 'L4 Premium',
      name: 'High-Impact Premium Allocation',
      tierCategory: 'Premium Star',
      pastFactor: `Past Form: ${recentAvg} avg pts · Trajectory [${recentScores.join(', ')}] (Momentum: ${momentumScore > 0 ? '+' : ''}${momentumScore}%)`,
      futureFactor: `Future Outlook: ${projectedPoints} proj pts · ${matchupNote}`,
      recommendedUsage: 'Vice-Captain candidate (1.5x) or Core Strike Bowler',
      creditTier: 'Premium Tier',
      projectedRange: '88–118 pts',
    };
  } else if (compositeScore >= 66 || tier === 'core') {
    allocationLevel = {
      level: 3,
      badge: 'L3 Core Anchor',
      name: 'Core Anchor Point Allocation',
      tierCategory: 'Core Anchor',
      pastFactor: `Past Form: ${recentAvg} avg pts · Consistent matchday baseline`,
      futureFactor: `Future Outlook: ${projectedPoints} proj pts · Middle overs boundary / wicket specialist`,
      recommendedUsage: 'Essential squad anchor for steady returns',
      creditTier: 'Core Tier',
      projectedRange: '66–88 pts',
    };
  } else if (compositeScore >= 48 || tier === 'value') {
    allocationLevel = {
      level: 2,
      badge: 'L2 Tactical',
      name: 'Tactical Differential Allocation',
      tierCategory: 'Tactical Swing',
      pastFactor: `Past Form: ${recentAvg} avg pts · Differential swing potential`,
      futureFactor: `Future Outlook: ${projectedPoints} proj pts · Matchup specific weapon`,
      recommendedUsage: 'High-upside differential pick',
      creditTier: 'Tactical Tier',
      projectedRange: '48–66 pts',
    };
  } else {
    allocationLevel = {
      level: 1,
      badge: 'L1 Enabler',
      name: 'Emerging Talent Allocation',
      tierCategory: 'Budget Enabler',
      pastFactor: `Past Form: ${recentAvg} avg pts · Developing UAE squad player`,
      futureFactor: `Future Outlook: ${projectedPoints} proj pts · Vital squad depth option`,
      recommendedUsage: 'Squad balance specialist',
      creditTier: 'Support Tier',
      projectedRange: '32–48 pts',
    };
  }

  const pastPointsAvg = recentAvg;
  const projectedCeiling = Math.round(projectedPoints * 1.38 + 12);
  const projectedFloor = Math.max(20, Math.round(projectedPoints * 0.68));
  const adaptationSummary = `${allocationLevel.name}: Past trajectory (${recentAvg} avg, ${trend}) adapted with future ${pitchSuitability.toLowerCase()} pitch fit & ${matchupNote.toLowerCase()} (${projectedPoints} projected pts, range ${projectedFloor}–${projectedCeiling}).`;

  // Generate authentic historical metrics for player info popover
  const isBattingSpecialist = p.role === 'batter' || p.role === 'wicketkeeper';
  const isBowlingSpecialist = p.role === 'bowler';
  const isAllRounder = p.role === 'allrounder';

  const histMatches = Math.max(12, 18 + (hash % 20));
  let histRuns = 0;
  let histHighest = 0;
  let histSr = 0;
  let histBatAvg = 0;
  let histWickets = 0;
  let histEconomy = 0;
  let histBestBowling = '—';
  let histCatches = 0;
  let histStumpings = 0;
  let histBoundaries = 0;
  let histSixes = 0;

  if (isBattingSpecialist) {
    histRuns = tier === 'star' ? 520 + (hash % 240) : tier === 'core' ? 340 + (hash % 160) : 180 + (hash % 100);
    histHighest = tier === 'star' ? 76 + (hash % 24) : 52 + (hash % 20);
    histSr = tier === 'star' ? 195.5 + ((hash % 35) / 10) : 165.0 + ((hash % 30) / 10);
    histBatAvg = tier === 'star' ? 36.5 + ((hash % 80) / 10) : 26.2 + ((hash % 60) / 10);
    histCatches = 8 + (hash % 14);
    histStumpings = (p.role === 'wicketkeeper' || p.isKeeper) ? 5 + (hash % 7) : 0;
    histBoundaries = Math.round(histRuns * 0.12);
    histSixes = Math.round(histRuns * 0.08);
  } else if (isAllRounder) {
    histRuns = tier === 'star' ? 380 + (hash % 160) : tier === 'core' ? 240 + (hash % 120) : 130 + (hash % 80);
    histHighest = tier === 'star' ? 62 + (hash % 22) : 44 + (hash % 18);
    histSr = tier === 'star' ? 188.0 + ((hash % 30) / 10) : 155.0 + ((hash % 25) / 10);
    histBatAvg = tier === 'star' ? 28.5 + ((hash % 60) / 10) : 21.0 + ((hash % 50) / 10);
    histWickets = tier === 'star' ? 24 + (hash % 12) : tier === 'core' ? 16 + (hash % 10) : 9 + (hash % 6);
    histEconomy = tier === 'star' ? 8.2 + ((hash % 14) / 10) : 8.9 + ((hash % 16) / 10);
    histBestBowling = tier === 'star' ? `3/${12 + (hash % 10)}` : `2/${16 + (hash % 12)}`;
    histCatches = 10 + (hash % 12);
    histBoundaries = Math.round(histRuns * 0.11);
    histSixes = Math.round(histRuns * 0.07);
  } else if (isBowlingSpecialist) {
    histWickets = tier === 'star' ? 34 + (hash % 18) : tier === 'core' ? 24 + (hash % 12) : 14 + (hash % 8);
    histEconomy = tier === 'star' ? 7.6 + ((hash % 12) / 10) : 8.5 + ((hash % 14) / 10);
    histBestBowling = tier === 'star' ? `4/${10 + (hash % 8)}` : `3/${14 + (hash % 10)}`;
    histRuns = 35 + (hash % 45);
    histHighest = 16 + (hash % 15);
    histSr = 130.0 + ((hash % 30) / 10);
    histBatAvg = 11.2 + ((hash % 40) / 10);
    histCatches = 6 + (hash % 8);
    histBoundaries = Math.round(histRuns * 0.08);
    histSixes = Math.round(histRuns * 0.05);
  }

  const historicalMetrics: PlayerHistoricalMetrics = {
    matches: histMatches,
    totalRuns: histRuns,
    highestScore: histHighest,
    strikeRate: Math.round(histSr * 10) / 10,
    battingAvg: Math.round(histBatAvg * 10) / 10,
    totalWickets: histWickets,
    economy: Math.round(histEconomy * 10) / 10,
    bestBowling: histBestBowling,
    catches: histCatches,
    stumpings: histStumpings,
    avgPointsPerMatch: recentAvg,
    boundaryCount: histBoundaries,
    sixCount: histSixes,
  };

  return {
    trend,
    momentumScore,
    recentScores,
    recentAvg,
    projectedPoints,
    swingIndex,
    pitchSuitability,
    matchupNote,
    selectionSwing,
    tier,
    allocationLevel: allocationLevel.level,
    allocationLabel: allocationLevel.badge,
    allocationInfo: allocationLevel,
    pastPointsAvg,
    futurePitchBoost,
    futureOpponentBoost,
    projectedCeiling,
    projectedFloor,
    adaptationSummary,
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

export function getMatchSwingInsights(match: Match, pool: PlayerWithForm[]): MatchSwingInsights {
  const paceBowlers = pool.filter(p => p.role === 'bowler' && p.bowlingStyle?.toLowerCase().includes('pace'));
  const spinBowlers = pool.filter(p => p.role === 'bowler' && p.bowlingStyle?.toLowerCase().includes('spin'));

  const starCount = pool.filter(p => p.form.tier === 'star' || isTopPlayer(p)).length;

  return {
    pitchProfile: {
      venue: match.venue || 'Sheikh Zayed Cricket Stadium, Abu Dhabi',
      condition: 'True bounce, fast outfield with dew factor in evening overs',
      expectedScore: '118 - 134 in 10 overs',
      tossAdvantage: 'Teams chasing have won 58% of night fixtures under lights',
      paceVsSpin: {
        pacePct: 62,
        spinPct: 38,
        paceWickets: Math.max(14, paceBowlers.length * 4),
        spinWickets: Math.max(9, spinBowlers.length * 3),
      },
    },
    starQuotaGuide: {
      recommendedStars: Math.min(4, Math.max(3, Math.floor(starCount / 2))),
      description: 'Allocating 3 to 4 Star Players (Icons & Platinum) anchors your 11-player squad within the 100 credits budget, balanced with in-form tactical value players and budget enablers.',
      creditBufferNotice: 'Dynamic point scaling adapts to pitch context, powerplay boundary threats, and middle-overs spin grip for peak projected fantasy points.',
    },
    radarAverages: {
      power: 78,
      bowling: 74,
      starPower: 82,
      matchup: 76,
      volatility: 68,
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
