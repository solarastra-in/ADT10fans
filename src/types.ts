export type AdminPermission =
  | 'all'
  | 'leagues'
  | 'matches'
  | 'teams'
  | 'contests'
  | 'winners'
  | 'draws'
  | 'feeds'
  | 'social'
  | 'notifications'
  | 'fanspaces'
  | 'growth'
  | 'settings'
  | 'admins';

export type AdminRole = 'superadmin' | 'league_admin' | 'contest_admin' | 'winner_admin' | 'social_admin' | 'custom';

export interface AdminUserRecord {
  email: string;
  name?: string;
  role: AdminRole;
  permissions: AdminPermission[];
  isSuperAdmin?: boolean;
  addedBy?: string;
  addedAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: 'google' | 'email';
  teamId: string | null;
  teamChanges: number;
  points: number;
  streak: number;
  lastCheckin?: string;
  badges: string[];
  role: 'fan' | 'admin';
  isSuperAdmin?: boolean;
  adminRole?: AdminRole;
  permissions?: AdminPermission[];
  createdAt: string;
  stats?: UserStats;
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

export interface PlayerStats {
  matches: number;
  innings?: number;
  runs: number;
  highestScore: string | number;
  average: number;
  strikeRate: number;
  fifties?: number;
  hundreds?: number;
  fours?: number;
  sixes?: number;
  wickets: number;
  economy: number;
  bestBowling: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  role: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper';
  credits?: number;
  isIcon: boolean;
  /** Draft category, e.g. 'Icon', 'Platinum', 'Gold', 'Diamond', 'Silver', 'Local' */
  category?: string;
  cricbuzzId?: string;
  cricbuzzRole?: string;
  battingStyle?: string;
  bowlingStyle?: string;
  isCaptain?: boolean;
  isKeeper?: boolean;
  imageId?: number;
  photoUrl?: string;
  cricbuzzProfileUrl?: string;
  nationality?: string;
  stats?: PlayerStats;
}

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  secondaryColor?: string;
  home?: string;
  iconPlayer: string;
  headCoach?: string;
  website?: string;
  note?: string;
  logo?: string;
  sort: number;
  squad: Player[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SocialHandle {
  id: string;
  teamId: string | null;
  platform: 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'RSS';
  handle: string;
  url: string;
  status: 'verified' | 'pending';
  source: 'official' | 'discovery' | 'admin' | 'ai-suggestion' | 'official-preset';
  meta?: Record<string, any>;
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
  /** true only when the item was ingested from a verified official handle's own feed */
  verifiedReal?: boolean;
  channelVerified?: boolean;
  /** How the item got here: youtube-rss (official channel RSS), news-rss (Google News), social-handle (team social media handle), social-syndication (live social feed syndication), admin (added by an admin), ai (admin-approved AI draft) */
  sourceType?: 'youtube-rss' | 'news-rss' | 'admin' | 'ai' | 'social-handle' | 'social-syndication';
  handleId?: string | null;
}

export interface BattingScorecardEntry {
  batsman: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isNotOut?: boolean;
}

export interface BowlingScorecardEntry {
  bowler: string;
  overs: string | number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dots?: number;
}

export interface FallOfWicketEntry {
  wicket: number;
  score: number;
  over: string;
  player: string;
}

export interface InningsScorecard {
  teamId: string;
  teamName?: string;
  totalRuns: number;
  wickets: number;
  overs: string;
  runRate?: number;
  extras?: {
    total: number;
    wides?: number;
    noBalls?: number;
    byes?: number;
    legByes?: number;
  };
  batting: BattingScorecardEntry[];
  bowling: BowlingScorecardEntry[];
  didNotBat?: string[];
  fallOfWickets?: FallOfWicketEntry[];
}

export interface MatchScorecard {
  innings1?: InningsScorecard;
  innings2?: InningsScorecard;
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
  oversA?: string;
  scoreB?: string;
  oversB?: string;
  firstInnings?: number;
  winner?: string;
  result?: string;
  totalSixes?: number;
  topScorer?: string;
  topWicketTaker?: string;
  currentOver?: string;
  lastCommentary?: string;
  updatedAt: string;
  toss?: string;
  playerOfTheMatch?: string;
  scorecard?: MatchScorecard;
}

export interface ContestQuestion {
  id: string;
  prompt: string;
  options: string[];
  points: number;
  answer?: string;
  explain?: string;
}

export interface Contest {
  id: string;
  type: 'predictor' | 'sixes' | 'captain' | 'season' | 'trivia';
  title: string;
  description: string;
  matchId?: string | null;
  locksAt?: string | null;
  status: 'open' | 'locked' | 'settled';
  prize: string;
  questions: ContestQuestion[];
  instant?: boolean;
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
  winnerUserId?: string;
  winnerName?: string;
  seed?: string | null;
  entrantsHash?: string | null;
  drawnAt?: string | null;
  /** Number of entrants (computed by the server) */
  entriesCount?: number;
  /** Whether the signed-in user has entered (computed by the server) */
  entered?: boolean;
  createdAt?: string;
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
  kind: 'handle' | 'post' | 'score' | 'website';
  title: string;
  detail: string;
  payload: any;
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
  brandName: string;
  tagline: string;
  copyrightHolder: string;
  seasonLabel: string;
  seasonStart: string; // ISO date, '' when not set
  seasonEnd: string;   // ISO date, '' when not set
  venue: string;
  tickerText: string; // '' hides the ticker
  curatorFeedId: string;
  curatorContainerId: string;
  curatorFeedUuid: string;
  curatorApiKey: string;
  curatorHashtags: string;
  maxSocialPerPlatform: number;
  newsQueries: string; // one Google News query per line; blank lines ignored
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string; // write-only; the server returns '' or '********'
    from: string;
    enabled: boolean;
  };
}

/** Public, non-secret configuration returned by GET /api/config */
export interface PublicConfig {
  brandName: string;
  tagline: string;
  copyrightHolder: string;
  seasonLabel: string;
  seasonStart: string;
  seasonEnd: string;
  venue: string;
  tickerText: string;
  curatorFeedId: string;
  curatorContainerId: string;
  maxSocialPerPlatform: number;
  features: {
    googleSignIn: boolean;
    emailOtp: boolean;
    gemini: boolean;
    pushNotifications: boolean;
  };
  fcmVapidKey: string;
  stats: {
    teams: number;
    fans: number;       // real registered users
    handles: number;    // verified handles
    matches: number;
    openContests: number;
    openDraws: number;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'match_result' | 'contest_deadline' | 'announcement' | 'perk';
  targetAudience: 'all' | 'logged_in' | 'team';
  teamId?: string | null;
  data?: Record<string, any>;
  priority: 'normal' | 'high';
  createdAt: string;
  createdBy: string;
  recipientCount?: number;
  fcmSuccessCount?: number;
  fcmFailureCount?: number;
  /** 'fcm' when pushed via Firebase Cloud Messaging, 'in-app' when stored only */
  delivery?: 'fcm' | 'in-app';
  read?: boolean;
}

export interface FCMDeviceToken {
  id: string;
  token: string;
  userId?: string | null;
  userEmail?: string | null;
  deviceType: string;
  userAgent?: string;
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
  mapUrl?: string;
  bookingEnabled?: boolean;
}

export interface FanSpaceBooking {
  id: string;
  spaceId: string;
  spaceName: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string;
  ticketType: 'standard_entry' | 'vip_pass';
  ticketsCount: number;
  passCode: string;
  createdAt: string;
}

export interface YouthCupSchool {
  id: string;
  name: string;
  region: string;
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
  followers?: string; // optional; only show when an admin has entered it
  streamUrl: string;  // must be the creator's real channel/profile URL
  specialty: string;
  status: 'live' | 'scheduled' | 'partnered';
  totalWatchViews?: string;
  avatar?: string;
}

export interface CommentaryAudioFeed {
  id: string;
  language: 'Arabic' | 'English' | 'Hindi' | 'Urdu' | 'Bengali';
  commentator: string;
  status: 'live' | 'standby';
  streamUrl: string; // real audio stream / broadcast URL
  description?: string;
  sampleAudioText?: string;
  bitrate?: string;
  listenersCount?: number;
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
  /** Real count of fans who registered interest */
  totalSubscribers: number;
  description?: string;
  /** Optional external checkout/registration URL; when empty the button registers interest only */
  signupUrl?: string;
}

export interface ProposalActivity {
  id: string;
  number: number;
  title: string;
  tag: string;
  need: string;
  relevance: string;
  what: string;
  usdCost: number;
  aedCost: number;
  capexUsd: number;
  opexUsd: number;
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
  upvotedBy: string[];
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
  pinned: boolean;
  upvotes: number;
  upvotedBy: string[];
  views: number;
  commentsCount: number;
  lastActivityAt: string;
  createdAt: string;
}
