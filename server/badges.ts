import { AppStore, User } from './db';

export interface AchievementBadge {
  id: string;
  name: string;
  category: 'predictions' | 'fantasy' | 'games' | 'community' | 'loyalty';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  description: string;
  requirement: string;
  link: string;
  icon: string;
  currentProgress: number;
  maxProgress: number;
  unlocked: boolean;
  claimed: boolean;
  rewardPoints: number;
}

export interface UserStats {
  contestsEntered: number;
  contestsWon: number;
  predictionPoints: number;
  fantasyTeamsCreated: number;
  fantasyMatchesScored: number;
  fantasyBestScore: number;
  fantasyTotalPoints: number;
  gamesPlayed: number;
  guessSolved: number;
  bestSuperOver: number;
  forumThreads: number;
  forumReplies: number;
  currentStreak: number;
  drawsEntered: number;
  prizesClaimed: number;
  friendsInvited: number;
  totalBadgesUnlocked: number;
  badgesClaimedCount: number;
}

type Def = Omit<AchievementBadge, 'currentProgress' | 'unlocked' | 'claimed'> & { progress: (s: UserStats) => number };

const DEFS: Def[] = [
  { id: 'first-prediction', name: 'First Call', category: 'predictions', tier: 'bronze', description: 'Entered your first prediction contest.', requirement: 'Enter 1 prediction contest', link: '/contests', icon: 'Target', maxProgress: 1, rewardPoints: 20, progress: s => s.contestsEntered },
  { id: 'sharp-predictor', name: 'Sharp Predictor', category: 'predictions', tier: 'silver', description: 'Scored points in three prediction contests.', requirement: 'Score points in 3 contests', link: '/contests', icon: 'Award', maxProgress: 3, rewardPoints: 60, progress: s => s.contestsWon },
  { id: 'first-xi', name: 'Team Selector', category: 'fantasy', tier: 'bronze', description: 'Saved your first Dream XI.', requirement: 'Save 1 Dream XI', link: '/fantasy', icon: 'Users', maxProgress: 1, rewardPoints: 20, progress: s => s.fantasyTeamsCreated },
  { id: 'fantasy-regular', name: 'Season Selector', category: 'fantasy', tier: 'silver', description: 'Had a Dream XI scored in five matches.', requirement: 'Play Dream XI in 5 matches', link: '/fantasy', icon: 'CalendarCheck', maxProgress: 5, rewardPoints: 80, progress: s => s.fantasyMatchesScored },
  { id: 'fantasy-century', name: 'Double Century', category: 'fantasy', tier: 'gold', description: 'Scored 200 points with one Dream XI.', requirement: 'Score 200+ in one match', link: '/fantasy', icon: 'Trophy', maxProgress: 200, rewardPoints: 120, progress: s => s.fantasyBestScore },
  { id: 'daily-player', name: 'Daily Player', category: 'games', tier: 'bronze', description: 'Finished five daily games.', requirement: 'Finish 5 daily games', link: '/games', icon: 'Gamepad2', maxProgress: 5, rewardPoints: 30, progress: s => s.gamesPlayed },
  { id: 'scout', name: 'Scout', category: 'games', tier: 'silver', description: 'Guessed the mystery player five times.', requirement: 'Solve Guess the Player 5 times', link: '/games', icon: 'Search', maxProgress: 5, rewardPoints: 60, progress: s => s.guessSolved },
  { id: 'finisher', name: 'Finisher', category: 'games', tier: 'gold', description: 'Scored 30 or more in a Super Over.', requirement: 'Score 30+ in Super Over', link: '/games', icon: 'Flame', maxProgress: 30, rewardPoints: 100, progress: s => s.bestSuperOver },
  { id: 'voice', name: 'Fan Voice', category: 'community', tier: 'bronze', description: 'Started a forum thread.', requirement: 'Start 1 thread', link: '/forum', icon: 'MessageSquare', maxProgress: 1, rewardPoints: 20, progress: s => s.forumThreads },
  { id: 'regular', name: 'Terrace Regular', category: 'community', tier: 'silver', description: 'Posted ten replies in the forum.', requirement: 'Post 10 replies', link: '/forum', icon: 'MessagesSquare', maxProgress: 10, rewardPoints: 50, progress: s => s.forumReplies },
  { id: 'recruiter', name: 'Recruiter', category: 'community', tier: 'gold', description: 'Three friends joined with your invite and took part.', requirement: 'Invite 3 friends who play', link: '/profile', icon: 'UserPlus', maxProgress: 3, rewardPoints: 100, progress: s => s.friendsInvited },
  { id: 'streak-3', name: 'On a Roll', category: 'loyalty', tier: 'bronze', description: 'Checked in three days running.', requirement: '3-day check-in streak', link: '/profile', icon: 'Zap', maxProgress: 3, rewardPoints: 20, progress: s => s.currentStreak },
  { id: 'streak-7', name: 'Ever Present', category: 'loyalty', tier: 'gold', description: 'Checked in seven days running.', requirement: '7-day check-in streak', link: '/profile', icon: 'Crown', maxProgress: 7, rewardPoints: 80, progress: s => s.currentStreak },
  { id: 'draw-entrant', name: 'In It To Win It', category: 'loyalty', tier: 'bronze', description: 'Entered a prize draw.', requirement: 'Enter 1 prize draw', link: '/prizes', icon: 'Gift', maxProgress: 1, rewardPoints: 10, progress: s => s.drawsEntered },
];

export function userStats(user: User, store: AppStore): Omit<UserStats, 'totalBadgesUnlocked' | 'badgesClaimedCount'> {
  const entries = store.contestEntries.filter(e => e.userId === user.id);
  const fantasy = store.fantasyTeams.filter(f => f.userId === user.id);
  const scored = fantasy.filter(f => f.scoredAt);
  const plays = store.gamePlays.filter(p => p.userId === user.id && p.finished);
  return {
    contestsEntered: entries.length,
    contestsWon: entries.filter(e => (e.pointsAwarded || 0) > 0).length,
    predictionPoints: entries.reduce((s, e) => s + (e.pointsAwarded || 0), 0),
    fantasyTeamsCreated: fantasy.length,
    fantasyMatchesScored: scored.length,
    fantasyBestScore: Math.max(0, ...scored.map(f => f.points || 0)),
    fantasyTotalPoints: Math.round(scored.reduce((s, f) => s + (f.points || 0), 0) * 10) / 10,
    gamesPlayed: plays.length,
    guessSolved: plays.filter(p => p.game === 'guess' && p.state?.solved).length,
    bestSuperOver: Math.max(0, ...plays.filter(p => p.game === 'superover').map(p => (p.state?.balls || []).reduce((s: number, b: any) => s + (b.outcome === 'W' ? 0 : b.outcome), 0))),
    forumThreads: store.forumThreads.filter(t => t.userId === user.id).length,
    forumReplies: store.forumComments.filter(c => c.userId === user.id).length,
    currentStreak: user.streak || 0,
    drawsEntered: store.drawEntries.filter(d => d.userId === user.id).length,
    prizesClaimed: store.redemptions.filter(r => r.userId === user.id && r.status !== 'cancelled').length,
    friendsInvited: store.users.filter(u => u.referredBy === user.id && u.referralRewardedAt).length,
  };
}

export function computeUserBadges(user: User, store: AppStore): { badges: AchievementBadge[]; stats: UserStats } {
  const base = userStats(user, store);
  const badges = DEFS.map(({ progress, ...d }) => {
    const p = Math.min(d.maxProgress, progress(base as UserStats));
    const unlocked = p >= d.maxProgress || user.badges.includes(d.name);
    return { ...d, currentProgress: p, unlocked, claimed: Boolean(store.claimedBadges[`claimed:${user.id}:${d.id}`]) };
  });
  return {
    badges,
    stats: { ...base, totalBadgesUnlocked: badges.filter(b => b.unlocked).length, badgesClaimedCount: badges.filter(b => b.claimed).length },
  };
}
