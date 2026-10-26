// Shared client types. They mirror server/db.ts (the server is the source of truth).

export type AdminPermission =
  | 'all' | 'leagues' | 'matches' | 'teams' | 'team' | 'contests' | 'fantasy' | 'games' | 'winners' | 'draws' | 'prizes'
  | 'feeds' | 'social' | 'community' | 'notifications' | 'fanspaces' | 'growth' | 'settings' | 'admins';

export type AdminRole = 'superadmin' | 'league_admin' | 'contest_admin' | 'winner_admin' | 'social_admin' | 'team_official' | 'custom';

export interface AdminUserRecord {
  email: string;
  name?: string;
  role: AdminRole;
  permissions: AdminPermission[];
  teamId?: string | null;
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
  provider?: 'google' | 'email';
  teamId: string | null;
  teamChanges?: number;
  points: number;
  pointsSpent?: number;
  /** Points available to spend on prizes. */
  balance?: number;
  streak: number;
  lastCheckin?: string;
  badges: string[];
  role?: 'fan' | 'admin';
  isSuperAdmin?: boolean;
  adminRole?: AdminRole;
  permissions?: AdminPermission[];
  adminTeamId?: string | null;
  country?: string;
  city?: string;
  bio?: string;
  referralCode?: string;
  createdAt?: string;
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

export type PlayerRole = 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper';

export interface Player {
  id: string;
  teamId: string;
  name: string;
  role: PlayerRole;
  credits?: number;
  /** Admin-set credits (null = automatic from the category). */
  creditsOverride?: number | null;
  isIcon: boolean;
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
  note?: string;
  selectedBy?: number;
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
  fans?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type SocialPlatform = 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'RSS';

export interface SocialHandle {
  id: string;
  teamId: string | null;
  platform: SocialPlatform;
  handle: string;
  url: string;
  status: 'verified' | 'pending';
  source: string;
  meta?: Record<string, any>;
  verifiedAt?: string;
  foundAt: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'empty' | 'error' | 'embed-only' | 'needs-setup';
  lastSyncNote?: string;
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
  videoId?: string;
  sourceType?: string;
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
  extras?: { total: number; wides?: number; noBalls?: number; byes?: number; legByes?: number };
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
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
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
  streamUrl?: string;
  externalId?: string;
  scoreSource?: 'manual' | 'cricketdata' | 'scraper';
  liveSyncedAt?: string;
}

export interface MatchDetail {
  match: Match;
  fantasy: {
    lineups: number;
    mostPicked: { playerId: string; name: string; pct: number; captainPct: number }[];
    playerPoints: { playerId: string; name: string; teamId: string; points: number; detail: string }[];
  };
  contests: { id: string; title: string; status: string }[];
  polls: string[];
  threads: { id: string; title: string; commentsCount: number }[];
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
  locksAt?: string;
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

export interface FantasyBreakdownLine {
  playerId: string;
  name: string;
  base: number;
  multiplier: number;
  total: number;
  detail: string;
}
export interface FantasyTeam {
  userId: string;
  matchId: string;
  playerIds: string[];
  captainId: string;
  viceCaptainId?: string;
  variationId?: string;
  variationName?: string;
  points?: number;
  rank?: number;
  breakdown?: FantasyBreakdownLine[];
  scoredAt?: string;
  createdAt: string;
  updatedAt?: string;
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

export interface PlayerFormStats {
  trend: FormTrend;
  momentumScore: number; // e.g. +18, +5, -12
  recentScores: number[]; // last 3 match fantasy points
  recentAvg: number;
  projectedPoints: number;
  swingIndex: number; // swing volatility score
  pitchSuitability: 'Excellent' | 'Good' | 'Moderate' | 'Challenging';
  matchupNote: string;
  selectionSwing: number; // weekly swing % e.g. +9.4%
  tier: PlayerTier;
  // Multi-level adaptable point allocation
  allocationLevel: PointAllocationLevel;
  allocationLabel: string;
  allocationInfo?: AllocationLevelInfo;
  pastPointsAvg: number;
  futurePitchBoost: number;
  futureOpponentBoost: number;
  projectedCeiling: number;
  projectedFloor: number;
  adaptationSummary: string;
  historicalMetrics?: PlayerHistoricalMetrics;
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

export interface PlayerWithForm extends Player {
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

export interface PickXIRules {
  size: number;
  maxFromOneTeam: number;
  roleMin: number;
  roleMax: number;
  captainMultiplier: number;
  viceCaptainMultiplier: number;
  fanPointsDivisor: number;
  creditCap?: number;
  maxTopPlayers?: number;
}
export type DreamXIRules = PickXIRules;
export interface FantasyMatchSummary {
  matchId: string;
  matchNo: number;
  teamA: string;
  teamB: string;
  startsAt: string;
  status: Match['status'];
  locked: boolean;
  lineups: number;
  mine: { points: number | null; rank: number | null; saved: boolean; variationsCount?: number } | null;
}
export interface LeaderRow {
  userId: string;
  name: string;
  avatar: string;
  teamId: string | null;
  points: number;
  rank: number;
  matches?: number;
  best?: number;
}
export interface FantasyLeague {
  id: string;
  name: string;
  code: string;
  isOwner: boolean;
  members: LeaderRow[];
}

export interface GuessState {
  day: string;
  available: boolean;
  maxGuesses?: number;
  clues?: { label: string; value: string }[];
  guesses?: { playerId: string; name: string; teamId?: string; teamName?: string; role?: string; correct: boolean; sameTeam: boolean; sameRole: boolean }[];
  finished?: boolean;
  solved?: boolean;
  points?: number;
  answer?: { id: string; name: string; teamId: string; teamName: string; photoUrl?: string } | null;
}
export type Shot = 'defend' | 'rotate' | 'drive' | 'loft' | 'slog';
export interface SuperOverState {
  day: string;
  target: number;
  shots: { id: Shot; label: string; hint: string }[];
  balls: { shot: Shot; outcome: number | 'W' }[];
  runs: number;
  wickets: number;
  ballsLeft: number;
  finished: boolean;
  points: number;
  bonus: number;
  last?: { shot: Shot; outcome: number | 'W' };
}
export interface GamesToday {
  day: string;
  guess: GuessState;
  superOver: SuperOverState;
  leaderboards: { guess: { userId: string; name: string; avatar: string; teamId: string | null; points: number }[]; superover: { userId: string; name: string; avatar: string; teamId: string | null; points: number }[] };
  players: { id: string; name: string; teamId: string; role?: string }[];
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
  minPoints?: number;
  winnerName?: string;
  seed?: string | null;
  entrantsHash?: string | null;
  drawnAt?: string | null;
  createdAt?: string;
  entriesCount?: number;
  entered?: boolean;
  wonByMe?: boolean;
  verification?: { seed?: string | null; entrantsHash?: string | null; entries: number };
}

export interface PrizeItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  pointsCost: number;
  stock: number;
  teamOnly?: string | null;
  active: boolean;
  fulfilment: string;
  createdAt: string;
  claimed?: number;
}
export type PointsSource =
  | 'checkin' | 'guess' | 'superover' | 'dream-xi' | 'prediction' | 'quiz'
  | 'forum-thread' | 'forum-reply' | 'forum-removed' | 'badge' | 'referral'
  | 'prize' | 'prize-refund' | 'admin';

export interface PointsEntry {
  id: string;
  userId: string;
  at: string;
  delta: number;
  bucket: 'earned' | 'spent';
  source: PointsSource;
  label: string;
  note?: string;
  ref?: string;
  by?: string;
}

export interface PointsHistory {
  points: number;
  pointsSpent: number;
  balance: number;
  bySource: Partial<Record<PointsSource, number>>;
  earlier: number;
  history: PointsEntry[];
}

export interface AdminFanPoints {
  id: string;
  name: string;
  email: string;
  teamId: string | null;
  createdAt: string;
  points: number;
  pointsSpent: number;
  balance: number;
  invited: number;
}

export interface PrizeRedemption {
  id: string;
  prizeId: string;
  prizeTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  pointsCost: number;
  code: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
  createdAt: string;
  updatedAt?: string;
  note?: string;
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
  seasonStart: string;
  seasonEnd: string;
  venue: string;
  tickerText: string;
  curatorFeedId: string;
  curatorContainerId: string;
  curatorFeedUuid: string;
  curatorApiKey: string;
  curatorHashtags: string;
  maxSocialPerPlatform: number;
  newsQueries: string;
  referralRewardPoints: number;
  referralMaxRewarded: number;
  lockReminderMinutes: number;
  smtp: { host: string; port: number; user: string; pass: string; from: string; enabled: boolean };
}

export interface PublicConfig {
  brandName: string;
  tagline: string;
  copyrightHolder: string;
  seasonLabel: string;
  seasonStart: string;
  seasonEnd: string;
  venue: string;
  tickerText: string;
  isSuperAdmin?: boolean;
  maxSocialPerPlatform: number;
  referralRewardPoints: number;
  referralMaxRewarded: number;
  features: { googleSignIn: boolean; emailOtp: boolean; gemini: boolean; pushNotifications: boolean; liveScores: boolean; curator: boolean };
  fcmVapidKey: string;
  stats: { teams: number; players: number; fans: number; handles: number; matches: number; openContests: number; openDraws: number; prizes: number; forumThreads: number };
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'match_result' | 'contest_deadline' | 'announcement' | 'perk' | 'fantasy';
  targetAudience: 'all' | 'logged_in' | 'team' | 'users';
  teamId?: string | null;
  data?: Record<string, any>;
  priority: 'normal' | 'high';
  createdAt: string;
  createdBy: string;
  recipientCount?: number;
  fcmSuccessCount?: number;
  fcmFailureCount?: number;
  delivery?: 'fcm' | 'in-app';
  read?: boolean;
  reads?: number;
  personal?: boolean;
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
  reservedToday?: number;
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
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  cancelledAt?: string | null;
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
  followers?: string;
  streamUrl: string;
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
  streamUrl: string;
  description?: string;
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
  description?: string;
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

export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
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
  upvoted?: boolean;
  reactions?: Reaction[];
  hidden?: boolean;
  createdAt: string;
  editedAt?: string;
}
export interface ForumThread {
  id: string;
  title: string;
  content: string;
  category: 'matchday' | 'tactics' | 'franchises' | 'fantasy' | 'fanspaces' | 'giveaways' | 'general';
  tags: string[];
  teamId?: string | null;
  matchId?: string | null;
  userId: string;
  userName: string;
  userAvatar: string;
  userBadge?: string;
  pinned: boolean;
  locked?: boolean;
  hidden?: boolean;
  upvotes: number;
  upvoted?: boolean;
  reactions?: Reaction[];
  views: number;
  commentsCount: number;
  lastActivityAt: string;
  createdAt: string;
  editedAt?: string;
}
export interface ForumReportView {
  id: string;
  kind: 'thread' | 'comment';
  targetId: string;
  threadId: string;
  reason: string;
  createdAt: string;
  threadTitle: string;
  excerpt: string;
  author: string;
  hidden: boolean;
}

export interface PollView {
  id: string;
  question: string;
  teamId: string | null;
  matchId: string | null;
  closesAt: string | null;
  status: 'open' | 'closed';
  createdAt: string;
  total: number;
  myVote: string | null;
  options: { id: string; text: string; votes: number; pct: number }[];
}

export interface FanWarsRow {
  team: { id: string; name: string; short: string; color: string };
  points: number;
  fansCount: number;
}
export interface PublicFan {
  id: string;
  name: string;
  avatar: string;
  teamId: string | null;
  points: number;
  badges: string[];
  streak: number;
  country?: string;
}
export interface FanBase {
  totalFans: number;
  unaffiliated: number;
  teams: { teamId: string; fans: number; points: number; activeThisWeek: number; topFans: PublicFan[]; threads: number }[];
  countries: { country: string; fans: number }[];
  recent: { name: string; avatar: string; teamId: string | null; country?: string; joinedAt: string }[];
}

export interface ReferralSummary {
  code: string;
  rewardPoints: number;
  invited: number;
  joinedAndPlayed: number;
  pointsEarned: number;
  friends: { name: string; joinedAt: string; rewarded: boolean }[];
}

export interface CricketDataCandidate {
  id: string;
  name: string;
  date: string;
  status: string;
}

export interface EnvVariableInfo {
  key: string;
  label: string;
  category: string;
  value: string;
  isSecret: boolean;
  isSetInEnv: boolean;
  isOverridden: boolean;
  requiresRestart: boolean;
  restartReason: string;
  /** Can only be set in the host's environment variables (needed before the store can be read). */
  envOnly: boolean;
  source: 'console' | 'environment' | 'default' | 'unset';
  description: string;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
}

export interface CricketSyncResult {
  success: boolean;
  provider: string;
  seriesId: string;
  teamsCount: number;
  playersCount: number;
  teamsUpdated: string[];
  added: string[];
  removed: string[];
  linked: number;
  executionTimeMs: number;
  timestamp: string;
  logs: { timestamp: string; level: 'info' | 'warn' | 'success' | 'error'; message: string }[];
  error?: string;
  dryRun: boolean;
}

export interface FeedHealthRow {
  id: string;
  teamId: string | null;
  platform: SocialPlatform;
  handle: string;
  url: string;
  status: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncNote: string | null;
  items: number;
  channelId: string | null;
}

export interface ProfileResponse {
  user: User;
  badges: AchievementBadge[];
  stats: UserStats;
  fantasy: { points: number; matches: number; best: number };
  fantasyHistory: { matchId: string; matchNo?: number; teamA?: string; teamB?: string; startsAt?: string; points: number | null; rank: number | null; scored: boolean }[];
  games: { played: number; points: number; guessSolved: number; bestSuperOver: number };
  redemptions: PrizeRedemption[];
  bookings: FanSpaceBooking[];
}
