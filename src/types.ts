export interface ForumComment {
  id: string;
  threadId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  userBadge?: string;
  teamId?: string | null;
  content: string;
  upvotes: number;
  upvotedBy?: string[];
  createdAt: string;
}

export interface ForumThread {
  id: string;
  title: string;
  content: string;
  category: 'matchday' | 'tactics' | 'franchises' | 'fantasy' | 'fanspaces' | 'giveaways' | 'general';
  tags: string[];
  teamId?: string | null;
  userId: string;
  userName: string;
  userAvatar: string;
  userBadge?: string;
  pinned?: boolean;
  upvotes: number;
  upvotedBy?: string[];
  views: number;
  commentsCount: number;
  lastActivityAt: string;
  createdAt: string;
}

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

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: 'google' | 'email';
  teamId?: string | null;
  teamChanges: number;
  points: number;
  streak: number;
  lastCheckin?: string;
  badges: string[];
  role: 'admin' | 'fan';
  stats?: UserStats;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  role: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper';
  credits: number;
  isIcon: boolean;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  secondaryColor?: string;
  home: string;
  iconPlayer: string;
  headCoach?: string;
  website?: string;
  note?: string;
  sort: number;
  squad: Player[];
}

export interface SocialHandle {
  id: string;
  teamId: string | null;
  platform: 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'RSS';
  handle: string;
  url: string;
  status: 'verified' | 'pending';
  source: string;
  meta: Record<string, any>;
  verifiedAt?: string;
  foundAt: string;
}

export interface FeedItem {
  id: string;
  teamId: string | null;
  platform: 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'Web';
  kind: 'post' | 'video' | 'live' | 'article';
  category: 'social' | 'news' | 'marketing';
  title: string;
  url: string;
  image?: string | null;
  source: string;
  summary?: string;
  status: 'live' | 'hidden' | 'pinned';
  publishedAt: string;
  createdAt: string;
  likes?: number;
  views?: string;
}

export interface Match {
  id: string;
  matchNo: number;
  stage: string;
  teamA: string;
  teamB: string;
  startsAt: string;
  venue: string;
  status: 'upcoming' | 'live' | 'completed';
  scoreA?: string;
  scoreB?: string;
  oversA?: string;
  oversB?: string;
  winner?: string;
  result?: string;
  totalSixes?: number;
  firstInnings?: number;
  topScorer?: string;
  topWicketTaker?: string;
  currentOver?: string;
  lastCommentary?: string;
  isDemo?: boolean;
  updatedAt: string;
}

export interface Contest {
  id: string;
  type: 'predictor' | 'sixes' | 'captain' | 'season' | 'trivia';
  title: string;
  description: string;
  matchId?: string;
  locksAt?: string;
  status: 'open' | 'locked' | 'settled';
  prize: string;
  instant?: boolean;
  questions: {
    id: string;
    prompt: string;
    options: string[];
    points: number;
    answer?: string;
    explain?: string;
  }[];
  createdAt: string;
}

export interface ContestEntry {
  userId: string;
  contestId: string;
  answers: Record<string, string>;
  pointsAwarded?: number;
  createdAt: string;
}

export interface FantasyTeam {
  userId: string;
  matchId: string;
  playerIds: string[];
  captainId: string;
  points?: number;
  createdAt: string;
}

export interface PrizeDraw {
  id: string;
  title: string;
  prize: string;
  description: string;
  color: string;
  closesAt: string;
  status: 'open' | 'closed' | 'drawn';
  teamOnly?: string | null;
  winnerUserId?: string | null;
  winnerName?: string | null;
  seed?: string | null;
  entrantsHash?: string | null;
  drawnAt?: string | null;
}

export interface DrawEntry {
  drawId: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
}

export interface Approval {
  id: string;
  kind: 'handle' | 'website' | 'post';
  title: string;
  detail: string;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt?: string;
}

export interface AgentRun {
  id: string;
  agent: string;
  startedAt: string;
  finishedAt: string;
  status: 'success' | 'warning' | 'error';
  summary: string;
  items: number;
}

export interface SystemSettings {
  adminEmails: string[];
  publicUserCountOverride: number;
  tickerText: string;
  curatorFeedId: string;
  curatorContainerId: string;
  curatorFeedUuid: string;
  curatorApiKey: string;
  curatorHashtags: string;
  maxSocialPerPlatform: number;
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    enabled: boolean;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'match_result' | 'contest_deadline' | 'announcement' | 'perk';
  targetAudience: 'all' | 'logged_in' | 'team';
  teamId?: string | null;
  data?: {
    matchId?: string;
    contestId?: string;
    url?: string;
    scoreSummary?: string;
    winnerName?: string;
    locksAt?: string;
    prize?: string;
    [key: string]: any;
  };
  priority?: 'normal' | 'high';
  createdAt: string;
  createdBy: string;
  recipientCount?: number;
  fcmSuccessCount?: number;
  fcmFailureCount?: number;
  read?: boolean;
}

export interface FCMDeviceToken {
  id: string;
  userId?: string | null;
  token: string;
  userEmail?: string | null;
  deviceType: string;
  userAgent: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FanSpace {
  id: string;
  name: string;
  city: string;
  country: string;
  tagline: string;
  location: string;
  capacity: number;
  status: 'active' | 'upcoming' | 'sold_out';
  image: string;
  features: string[];
  amenities: string[];
  openHours: string;
  liveMatchSchedule: string;
  vipPassPriceAed: number;
  vipPassPriceUsd: number;
  vipPerks: string[];
  merchBoutique: string;
  menuHighlights: string;
  totalBookings: number;
}

export interface FanSpaceBooking {
  id: string;
  spaceId: string;
  spaceName: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  ticketType: 'standard_entry' | 'vip_pass' | 'vr_cage_reservation';
  ticketsCount: number;
  passCode: string;
  createdAt: string;
}

export interface YouthCupSchool {
  id: string;
  name: string;
  region: 'UAE' | 'UK';
  city: string;
  studentsCount: number;
  tapeBallTeam: string;
  status: 'registered' | 'bracket_qualified' | 'champion';
  equipmentKitGranted: boolean;
  matchdayTicketsAllocated: number;
}

export interface CreatorPartner {
  id: string;
  name: string;
  handle: string;
  platform: 'YouTube' | 'Twitch' | 'Kick' | 'TikTok';
  followers: string;
  streamUrl: string;
  specialty: string;
  status: 'live' | 'scheduled' | 'partnered';
  totalWatchViews: string;
  avatar: string;
}

export interface CommentaryAudioFeed {
  id: string;
  language: 'Arabic' | 'English' | 'Hindi' | 'Urdu' | 'Bengali';
  commentator: string;
  status: 'live' | 'standby';
  sampleAudioText: string;
  bitrate: string;
  listenersCount: number;
}

export interface SuperfanPassportTier {
  id: string;
  tierName: string;
  annualFeeUsd: number;
  annualFeeAed: number;
  ticketDiscountPct: number;
  fanSpacePriorityEntry: boolean;
  exclusiveBadge: string;
  doublePointsMultiplier: boolean;
  totalSubscribers: number;
}

export interface ProposalActivity {
  id: string;
  number: number;
  title: string;
  tag: string;
  need: string;
  relevance: string;
  what: string;
  capexUsd: number;
  opexUsd: number;
  usdCost: number;
  aedCost: number;
  timeline: string;
  outcome: string;
  kpis: string[];
  franchiseBenefit: string;
  leagueBenefit: string;
}

export interface ProposalSettings {
  exchangeRateUsdToAed: number;
  revenueStreams: {
    predictorSponsorshipUsd: number;
    fantasySponsorshipUsd: number;
    fanSpacesNamingRightsUsd: number;
    merchAndFbUsd: number;
    superfanPassportUsers: number;
    superfanPassportFeeUsd: number;
  };
  activities: ProposalActivity[];
  updatedAt: string;
}

