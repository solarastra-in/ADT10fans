import { User, AppStore } from './db';

export interface AchievementBadge {
  id: string;
  name: string;
  category: 'contest' | 'streak' | 'fantasy' | 'loyalty';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  description: string;
  requirement: string;
  lore?: string;
  tip?: string;
  actionTab?: string;
  actionLabel?: string;
  icon: string;
  currentProgress: number;
  maxProgress: number;
  unlocked: boolean;
  unlockedAt?: string;
  claimed?: boolean;
  rewardPoints: number;
}

export interface UserStats {
  contestsEntered: number;
  contestsWon: number;
  predictionPoints: number;
  fantasyTeamsCreated: number;
  fantasyBestScore: number;
  fantasyTotalPoints: number;
  currentStreak: number;
  highestStreak: number;
  drawsEntered: number;
  totalBadgesUnlocked: number;
  badgesClaimedCount: number;
}

export function computeUserBadges(user: User, store: AppStore): {
  badges: AchievementBadge[];
  stats: UserStats;
} {
  const userEntries = store.contestEntries.filter(e => e.userId === user.id);
  const userWonEntries = userEntries.filter(e => (e.pointsAwarded || 0) > 0);
  const userFantasy = store.fantasyTeams.filter(f => f.userId === user.id);
  const userDrawEntries = store.drawEntries.filter(d => d.userId === user.id);

  const contestsEntered = userEntries.length;
  const contestsWon = userWonEntries.length;
  const predictionPoints = userEntries.reduce((acc, curr) => acc + (curr.pointsAwarded || 0), 0);
  const fantasyTeamsCreated = userFantasy.length;
  
  // Calculate fantasy points
  let fantasyTotalPoints = 0;
  let fantasyBestScore = 0;
  for (const ft of userFantasy) {
    const pts = ft.points || 120; // default estimated match score
    fantasyTotalPoints += pts;
    if (pts > fantasyBestScore) fantasyBestScore = pts;
  }
  if (userFantasy.length > 0 && fantasyTotalPoints === 0) {
    fantasyTotalPoints = userFantasy.length * 120;
    fantasyBestScore = 120;
  }

  const currentStreak = user.streak || 1;
  const highestStreak = Math.max(currentStreak, user.role === 'admin' ? 14 : 7);
  const drawsEntered = userDrawEntries.length;

  const anyStore = store as any;
  const claimedBadges = anyStore.claimedBadges || {};

  const list: AchievementBadge[] = [
    // ==========================================
    // 1. CONTEST WINS & PREDICTION ACCURACY
    // ==========================================
    {
      id: 'first-strike',
      name: 'First Strike',
      category: 'contest',
      tier: 'bronze',
      description: 'Locked in your first official Abu Dhabi T10 match prediction.',
      requirement: 'Enter at least 1 prediction contest',
      lore: 'The Zayed Stadium roar begins with a single bold prediction. You took the leap.',
      tip: 'Go to Contests & Fantasy and pick the match winner or boundary tally.',
      actionTab: 'contests',
      actionLabel: 'Enter Contests',
      icon: 'Target',
      currentProgress: Math.min(contestsEntered, 1),
      maxProgress: 1,
      unlocked: contestsEntered >= 1 || user.badges.includes('First Strike') || user.role === 'admin',
      unlockedAt: contestsEntered >= 1 ? user.createdAt : undefined,
      rewardPoints: 50
    },
    {
      id: 'boundary-oracle',
      name: 'Boundary Oracle',
      category: 'contest',
      tier: 'silver',
      description: 'Accurately forecast the boundary count or powerplay fireworks in a T10 showdown.',
      requirement: 'Participate in any Sixes or Boundary challenge',
      lore: 'In 90-minute cricket, the boundary rope is where champions are made.',
      tip: 'Enter the match-specific Sixes & Boundaries predictor.',
      actionTab: 'contests',
      actionLabel: 'Predict Boundaries',
      icon: 'Zap',
      currentProgress: userEntries.some(e => e.contestId.includes('six') || e.contestId.includes('boundary')) || user.role === 'admin' ? 1 : 0,
      maxProgress: 1,
      unlocked: userEntries.some(e => e.contestId.includes('six') || e.contestId.includes('boundary')) || user.role === 'admin',
      rewardPoints: 100
    },
    {
      id: 'sharp-predictor',
      name: 'Sharp Predictor',
      category: 'contest',
      tier: 'silver',
      description: 'Demonstrated tactical cricketing foresight by winning points in multiple fixtures.',
      requirement: 'Win points in 3 or more prediction contests',
      lore: 'A single correct call is luck. Multiple wins reveal the analytical mind of a seasoned strategist.',
      tip: 'Consistently review match pitch reports and franchise squads before locking answers.',
      actionTab: 'contests',
      actionLabel: 'Open Predictors',
      icon: 'Award',
      currentProgress: Math.min(contestsWon, 3),
      maxProgress: 3,
      unlocked: contestsWon >= 3 || user.badges.includes('Predictor Master') || user.role === 'admin',
      rewardPoints: 150
    },
    {
      id: 'trivia-ace',
      name: 'Trivia Ace',
      category: 'contest',
      tier: 'gold',
      description: 'Mastered the lore and iconic records of the world’s fastest cricket league.',
      requirement: 'Complete the Abu Dhabi T10 History Quiz',
      lore: 'From the inaugural season to the latest high-octane editions, you know every milestone.',
      tip: 'Solve all trivia questions under the Contests tab.',
      actionTab: 'contests',
      actionLabel: 'Play Trivia Quiz',
      icon: 'Star',
      currentProgress: userEntries.some(e => e.contestId.includes('trivia')) || user.badges.includes('Trivia Ace') || user.role === 'admin' ? 1 : 0,
      maxProgress: 1,
      unlocked: userEntries.some(e => e.contestId.includes('trivia')) || user.badges.includes('Trivia Ace') || user.role === 'admin',
      rewardPoints: 150
    },
    {
      id: 'prophet-of-the-desert',
      name: 'Prophet of the Desert',
      category: 'contest',
      tier: 'platinum',
      description: 'Projected the 2026 championship winner before tournament knockouts.',
      requirement: 'Lock in your pick for the Season Oracle 2026',
      lore: 'Few dare to forecast the tournament climax before the dust of group stages settles.',
      tip: 'Enter the Season Oracle 2026 contest to back your predicted title lifter.',
      actionTab: 'contests',
      actionLabel: 'Lock Season Pick',
      icon: 'Eye',
      currentProgress: userEntries.some(e => e.contestId.includes('season')) || user.role === 'admin' ? 1 : 0,
      maxProgress: 1,
      unlocked: userEntries.some(e => e.contestId.includes('season')) || user.role === 'admin',
      rewardPoints: 250
    },
    {
      id: 'undefeated-forecaster',
      name: 'Undefeated Forecaster',
      category: 'contest',
      tier: 'diamond',
      description: 'Achieved elite contest mastery with 5+ winning predictions and top-tier points.',
      requirement: 'Score winning points across 5 distinct contests',
      lore: 'The undisputed oracle of Abu Dhabi T10. Your name echoes in the commentary box.',
      tip: 'Keep playing daily match predictions to reach 5 verified victories.',
      actionTab: 'contests',
      actionLabel: 'Climb Contest Ranks',
      icon: 'Crown',
      currentProgress: Math.min(contestsWon, 5),
      maxProgress: 5,
      unlocked: contestsWon >= 5 || (user.role === 'admin' && (user.points || 0) >= 1000),
      rewardPoints: 500
    },

    // ==========================================
    // 2. DAILY CHECK-IN STREAKS
    // ==========================================
    {
      id: 'desert-starter',
      name: 'Desert Starter',
      category: 'streak',
      tier: 'bronze',
      description: 'Maintained a 3-day consecutive check-in streak for league updates.',
      requirement: 'Reach a 3-day streak',
      lore: 'The commitment begins. You showed up three days straight under the Abu Dhabi sun.',
      tip: 'Tap the Daily Check-in button each day to build your streak multiplier.',
      actionTab: 'profile',
      actionLabel: 'Claim Streak',
      icon: 'Flame',
      currentProgress: Math.min(currentStreak, 3),
      maxProgress: 3,
      unlocked: currentStreak >= 3 || user.role === 'admin',
      rewardPoints: 50
    },
    {
      id: 'floodlight-faithful',
      name: 'Floodlight Faithful',
      category: 'streak',
      tier: 'silver',
      description: 'Kept the fire burning for an entire week of nonstop franchise action.',
      requirement: 'Reach a 7-day daily streak',
      lore: 'Seven consecutive days under the stadium lights. Your loyalty is undeniable.',
      tip: 'Never miss a day. Keep the daily streak alive for 7 straight days.',
      actionTab: 'profile',
      actionLabel: 'Claim Streak',
      icon: 'Sun',
      currentProgress: Math.min(currentStreak, 7),
      maxProgress: 7,
      unlocked: currentStreak >= 7 || user.badges.includes('7-Day Streak Master') || user.role === 'admin',
      rewardPoints: 150
    },
    {
      id: 'iron-fanatic',
      name: 'Iron Fanatic',
      category: 'streak',
      tier: 'gold',
      description: 'Two full weeks of uninterrupted daily engagement with your favorite franchise.',
      requirement: 'Reach a 14-day daily streak',
      lore: 'Iron will, golden spirit. 14 days of unwavering dedication to the fastest format.',
      tip: 'Set a daily reminder to visit the portal and claim your streak bonus.',
      actionTab: 'profile',
      actionLabel: 'Maintain Streak',
      icon: 'Shield',
      currentProgress: Math.min(currentStreak, 14),
      maxProgress: 14,
      unlocked: currentStreak >= 14 || (user.role === 'admin' && (user.streak || 0) >= 12),
      rewardPoints: 300
    },
    {
      id: 'desert-sandstorm',
      name: 'Desert Sandstorm',
      category: 'streak',
      tier: 'platinum',
      description: 'An unstoppable 21-day cyclone of daily attendance across the league season.',
      requirement: 'Reach a 21-day daily streak',
      lore: 'A force of nature. 21 continuous days of backing your team through every over.',
      tip: 'Keep logging in daily to reach this legendary 3-week milestone.',
      actionTab: 'profile',
      actionLabel: 'Maintain Streak',
      icon: 'Zap',
      currentProgress: Math.min(currentStreak, 21),
      maxProgress: 21,
      unlocked: currentStreak >= 21 || user.role === 'admin',
      rewardPoints: 400
    },
    {
      id: 'season-legend',
      name: 'Season Legend',
      category: 'streak',
      tier: 'diamond',
      description: 'The pinnacle of fan dedication with a 30-day continuous presence.',
      requirement: 'Reach a 30-day streak',
      lore: 'Enshrined in the Abu Dhabi T10 Hall of Fame. True superfans never skip a day.',
      tip: '30 days of dedication unlocks this maximum tier badge and 600 bonus points.',
      actionTab: 'profile',
      actionLabel: 'Maintain Streak',
      icon: 'Crown',
      currentProgress: Math.min(currentStreak, 30),
      maxProgress: 30,
      unlocked: currentStreak >= 30,
      rewardPoints: 600
    },

    // ==========================================
    // 3. FANTASY LEAGUE PERFORMANCE
    // ==========================================
    {
      id: 'tactical-architect',
      name: 'Tactical Architect',
      category: 'fantasy',
      tier: 'bronze',
      description: 'Drafted your first 6-player Fantasy 10 team within the 55-credit salary cap.',
      requirement: 'Build 1 Fantasy 10 lineup',
      lore: 'Balancing superstar credits with emerging explosive hitters is an art form.',
      tip: 'Head to Contests & Fantasy to pick 6 players and draft your matchday squad.',
      actionTab: 'contests',
      actionLabel: 'Build Fantasy Squad',
      icon: 'Users',
      currentProgress: Math.min(fantasyTeamsCreated, 1),
      maxProgress: 1,
      unlocked: fantasyTeamsCreated >= 1 || user.role === 'admin',
      rewardPoints: 75
    },
    {
      id: 'captain-fantastic',
      name: 'Captain Fantastic',
      category: 'fantasy',
      tier: 'silver',
      description: 'Designated an explosive Captain who delivered double match points.',
      requirement: 'Pick a Captain in Fantasy 10',
      lore: 'Leadership under pressure. You entrusted your double points to the right match-winner.',
      tip: 'Select your star icon player as Captain when submitting your Fantasy 10 team.',
      actionTab: 'contests',
      actionLabel: 'Draft Captain',
      icon: 'Star',
      currentProgress: userFantasy.some(f => !!f.captainId) || user.role === 'admin' ? 1 : 0,
      maxProgress: 1,
      unlocked: userFantasy.some(f => !!f.captainId) || user.role === 'admin',
      rewardPoints: 120
    },
    {
      id: 'budget-optimizer',
      name: 'Budget Optimizer',
      category: 'fantasy',
      tier: 'silver',
      description: 'Assembled a potent 6-player lineup with room to spare under the salary cap.',
      requirement: 'Submit a valid team under 52 credits',
      lore: 'Finding undervalued talent in the franchise draft defines the best team managers.',
      tip: 'Draft high-impact domestic all-rounders alongside your marquee international icon.',
      actionTab: 'contests',
      actionLabel: 'Manage Lineup',
      icon: 'Trophy',
      currentProgress: fantasyTeamsCreated >= 1 || user.role === 'admin' ? 1 : 0,
      maxProgress: 1,
      unlocked: fantasyTeamsCreated >= 1 || user.role === 'admin',
      rewardPoints: 100
    },
    {
      id: 'fantasy-centurion',
      name: 'Fantasy Centurion',
      category: 'fantasy',
      tier: 'gold',
      description: 'Crossed the prestigious 250+ fantasy points barrier in Fantasy 10.',
      requirement: 'Accumulate 250+ total fantasy points',
      lore: 'Centuries are rare in T10, but your fantasy squad blasted past 250 with ease.',
      tip: 'Submit lineups for multiple matches to accumulate fantasy points rapidly.',
      actionTab: 'contests',
      actionLabel: 'Play Fantasy 10',
      icon: 'Trophy',
      currentProgress: Math.min(fantasyTotalPoints, 250),
      maxProgress: 250,
      unlocked: fantasyTotalPoints >= 250 || user.role === 'admin',
      rewardPoints: 250
    },
    {
      id: 'high-roller-xi',
      name: 'High Roller XI',
      category: 'fantasy',
      tier: 'platinum',
      description: 'Engineered a masterclass matchday lineup scoring 150+ points in a single 10-over game.',
      requirement: 'Score 150+ points in a single match lineup',
      lore: 'Sixes raining into the grandstands, wickets tumbling in clusters. A dream performance.',
      tip: 'Pick power-hitters at the top of the order and death bowlers who take cheap wickets.',
      actionTab: 'contests',
      actionLabel: 'Optimize Squad',
      icon: 'Medal',
      currentProgress: Math.min(fantasyBestScore, 150),
      maxProgress: 150,
      unlocked: fantasyBestScore >= 150 || (user.role === 'admin' && fantasyBestScore >= 100),
      rewardPoints: 350
    },
    {
      id: 'master-strategist',
      name: 'Master Strategist',
      category: 'fantasy',
      tier: 'diamond',
      description: 'Ranked among the premier franchise tacticians with 500+ total fantasy points.',
      requirement: 'Reach 500+ total fantasy points across matches',
      lore: 'Tactical genius recognized across all 9 franchises. A true master of the 10-over game.',
      tip: 'Compete in every scheduled matchday to build your supreme fantasy tally.',
      actionTab: 'contests',
      actionLabel: 'Enter Next Match',
      icon: 'Crown',
      currentProgress: Math.min(fantasyTotalPoints, 500),
      maxProgress: 500,
      unlocked: fantasyTotalPoints >= 500 || (user.role === 'admin' && (user.points || 0) >= 1000),
      rewardPoints: 500
    },

    // ==========================================
    // 4. FRANCHISE LOYALTY & VIP PASSES
    // ==========================================
    {
      id: 'aces-loyalist',
      name: 'Aces Loyalist',
      category: 'loyalty',
      tier: 'gold',
      description: 'Backed the Arabian Aces franchise, channeling all fan points into Fan Wars.',
      requirement: 'Select Arabian Aces as your backed franchise',
      lore: 'Gold and navy blue flowing through your veins. Standing proud with the Aces.',
      tip: 'Select Arabian Aces from the team switcher to represent them in Fan Wars.',
      actionTab: 'teams',
      actionLabel: 'Back Arabian Aces',
      icon: 'Shield',
      currentProgress: user.teamId === 'aces' ? 1 : 0,
      maxProgress: 1,
      unlocked: user.teamId === 'aces' || user.badges.includes('Aces Loyalist'),
      rewardPoints: 100
    },
    {
      id: 'vip-contender',
      name: 'VIP Contender',
      category: 'loyalty',
      tier: 'silver',
      description: 'Entered the cryptographic provably fair VIP Grand Final Prize Draw.',
      requirement: 'Enter at least 1 prize draw',
      lore: 'Your ticket is in the digital drum. The President Box hospitality pass awaits.',
      tip: 'Head over to Prize Draws and claim your free entry ticket.',
      actionTab: 'draws',
      actionLabel: 'Enter Prize Draw',
      icon: 'Gift',
      currentProgress: Math.min(drawsEntered, 1),
      maxProgress: 1,
      unlocked: drawsEntered >= 1 || user.role === 'admin',
      rewardPoints: 80
    },
    {
      id: 'founding-vip',
      name: 'Founding VIP',
      category: 'loyalty',
      tier: 'diamond',
      description: 'Inaugural pillar of the franchise and VIP platform pioneer.',
      requirement: 'Franchise VIP or Founding Member status',
      lore: 'Present from day one when the autonomous platform revolutionized cricket.',
      tip: 'Awarded to official franchise owners, VIP administrators, and founding fans.',
      actionTab: 'home',
      actionLabel: 'View Franchise Hub',
      icon: 'Sparkles',
      currentProgress: user.role === 'admin' || user.badges.includes('Founding Member') ? 1 : 0,
      maxProgress: 1,
      unlocked: user.role === 'admin' || user.badges.includes('Founding Member'),
      rewardPoints: 500
    }
  ];

  // Attach claimed status to each badge
  let badgesClaimedCount = 0;
  for (const b of list) {
    const claimKey = `claimed:${user.id}:${b.id}`;
    b.claimed = !!claimedBadges[claimKey];
    if (b.claimed) badgesClaimedCount++;
  }

  const totalBadgesUnlocked = list.filter(b => b.unlocked).length;

  const stats: UserStats = {
    contestsEntered,
    contestsWon,
    predictionPoints,
    fantasyTeamsCreated,
    fantasyBestScore,
    fantasyTotalPoints,
    currentStreak,
    highestStreak,
    drawsEntered,
    totalBadgesUnlocked,
    badgesClaimedCount
  };

  return { badges: list, stats };
}
