import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { generateInitialProposalSettings } from './proposalDefaults';
import { AnyBackend, ConflictError, createBackend, FileBackend, isSharded, QuotaError, ShardBackend, ShardMeta, StorageBackend } from './storage';
import { ChangeSet, hashText, joinShards, keyOfShard, replaceShards, shardsOfKey, shardText, splitStore, SPLIT, track, unwrap } from './shards';

export const SUPER_ADMIN_EMAIL = 'solarastra.in@gmail.com';

export type AdminPermission =
  | 'all'
  | 'leagues'
  | 'matches'
  | 'teams'
  | 'team'
  | 'contests'
  | 'fantasy'
  | 'games'
  | 'winners'
  | 'draws'
  | 'prizes'
  | 'feeds'
  | 'social'
  | 'community'
  | 'notifications'
  | 'fanspaces'
  | 'growth'
  | 'settings'
  | 'admins';

export const ALL_PERMISSIONS: AdminPermission[] = [
  'all', 'leagues', 'matches', 'teams', 'contests', 'fantasy', 'games', 'winners', 'draws', 'prizes',
  'feeds', 'social', 'community', 'notifications', 'fanspaces', 'growth', 'settings', 'admins',
];

/** What a team official may do: only for their own franchise. */
export const TEAM_OFFICIAL_PERMISSIONS: AdminPermission[] = ['team', 'social', 'community', 'notifications'];

export type AdminRole =
  | 'superadmin'
  | 'league_admin'
  | 'contest_admin'
  | 'winner_admin'
  | 'social_admin'
  | 'team_official'
  | 'custom';

export interface AdminUserRecord {
  email: string;
  name?: string;
  role: AdminRole;
  permissions: AdminPermission[];
  /** team_official only: the franchise they manage. */
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
  provider: 'google' | 'email';
  teamId: string | null;
  teamChanges: number;
  /** Season points: what the leaderboards rank. Never goes down when prizes are redeemed. */
  points: number;
  /** Points already spent on prize redemptions. Spendable balance = points - pointsSpent. */
  pointsSpent?: number;
  streak: number;
  lastCheckin?: string;
  badges: string[];
  role: 'fan' | 'admin';
  isSuperAdmin?: boolean;
  adminRole?: AdminRole;
  permissions?: AdminPermission[];
  /** Set for team officials: the one team they can manage. */
  adminTeamId?: string | null;
  /** Optional, self-declared; used for the Fan Base map. */
  country?: string;
  city?: string;
  bio?: string;
  referralCode?: string;
  referredBy?: string | null;
  referralRewardedAt?: string | null;
  /** Set when this friend joined after the inviter reached the invite-reward limit. */
  referralInviterUnpaid?: boolean;
  createdAt: string;
  lastActiveAt?: string;
  stats?: any;
}

export interface OtpCode {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  used: boolean;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  role: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper';
  /** Fantasy credits. When unset, the default for the player's category is used (see fantasy.ts). */
  credits?: number;
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
  /** Free-form note an admin can add (e.g. "replacement for X"). */
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
  source: 'official' | 'discovery' | 'admin' | 'ai-suggestion' | 'legacy' | 'suggested';
  meta?: Record<string, any>;
  verifiedAt?: string;
  foundAt: string;
  /** Result of the last automatic pull for this handle. */
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
  /** YouTube video id, so the video can be played inside the site. */
  videoId?: string;
  sourceType?: 'youtube-rss' | 'news-rss' | 'admin' | 'ai' | 'social-syndication' | 'curator' | 'rss' | 'native-harvester' | 'instagram-graph' | 'discovery';
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
  /** Official stream / highlights link, if the league publishes one. */
  streamUrl?: string;
  /** CricketData.org match id, for automatic live scores. */
  externalId?: string;
  scoreSource?: 'manual' | 'cricketdata' | 'scraper';
  liveSyncedAt?: string;
  /** Players named in each XI (player ids). Fantasy players not in the XI score 0. */
  playingXI?: Record<string, string[]>;
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

/** Private Pick XI leagues: friends compare totals across the season. */
export interface FantasyLeague {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  memberIds: string[];
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
  /** Minimum season points needed to enter (0 = anyone signed in). */
  minPoints?: number;
  winnerUserId?: string;
  winnerName?: string;
  seed?: string | null;
  entrantsHash?: string | null;
  drawnAt?: string | null;
  createdAt?: string;
}

export interface DrawEntry {
  drawId: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: string;
}

/** Rewards fans can claim with their points. */
export interface PrizeItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  pointsCost: number;
  stock: number;
  teamOnly?: string | null;
  active: boolean;
  /** How the fan receives it, shown after claiming (e.g. "Collect at the Fan Zone with your code"). */
  fulfilment: string;
  createdAt: string;
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
  /** Points a fan and the friend who invited them each get once the friend takes part. */
  referralRewardPoints: number;
  /** How many invited friends earn the inviter points (the friend is always rewarded). 0 = no limit. */
  referralMaxRewarded: number;
  /** Minutes before the first ball when the "lineups lock soon" reminder goes out. */
  lockReminderMinutes: number;
  smtp: { host: string; port: number; user: string; pass: string; from: string; enabled: boolean };
}

export type ReactionEmoji = '👏' | '🔥' | '😂' | '😮' | '💯';
export const REACTIONS: ReactionEmoji[] = ['👏', '🔥', '😂', '😮', '💯'];

export type PointsSource =
  | 'checkin' | 'guess' | 'superover' | 'dream-xi' | 'prediction' | 'quiz'
  | 'forum-thread' | 'forum-reply' | 'forum-removed' | 'badge' | 'referral'
  | 'prize' | 'prize-refund' | 'admin';

/** One change to a fan's points (see server/points.ts). */
export interface PointsEntry {
  id: string;
  userId: string;
  at: string;
  /** Positive adds, negative takes away. */
  delta: number;
  /** 'earned' changes season points; 'spent' changes points spent on prizes. */
  bucket: 'earned' | 'spent';
  source: PointsSource;
  note?: string;
  /** What it was for: a match, contest, thread, claim, badge or friend id. */
  ref?: string;
  /** Admin email, for changes an admin made. */
  by?: string;
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
  reactions?: Partial<Record<ReactionEmoji, string[]>>;
  hidden?: boolean;
  createdAt: string;
  /** Points the author received for this post (taken back if it is removed). */
  pointsAwarded?: number;
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
  upvotedBy: string[];
  reactions?: Partial<Record<ReactionEmoji, string[]>>;
  views: number;
  commentsCount: number;
  lastActivityAt: string;
  createdAt: string;
  /** Points the author received for this post (taken back if it is removed). */
  pointsAwarded?: number;
  editedAt?: string;
}

export interface ForumReport {
  id: string;
  kind: 'thread' | 'comment';
  targetId: string;
  threadId: string;
  userId: string;
  reason: string;
  status: 'open' | 'dismissed' | 'removed';
  createdAt: string;
  decidedAt?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string }[];
  /** userId -> option id */
  votes: Record<string, string>;
  teamId?: string | null;
  matchId?: string | null;
  closesAt?: string;
  status: 'open' | 'closed';
  createdBy: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  category: 'match_result' | 'contest_deadline' | 'announcement' | 'perk' | 'fantasy';
  /** 'users' = only the listed userIds (personal notifications such as fantasy results). */
  targetAudience: 'all' | 'logged_in' | 'team' | 'users';
  teamId?: string | null;
  userIds?: string[];
  /** Per-user text for personal notifications (userId -> body). */
  perUser?: Record<string, { title?: string; body: string }>;
  data?: Record<string, any>;
  priority: 'normal' | 'high';
  createdAt: string;
  createdBy: string;
  recipientCount?: number;
  fcmSuccessCount?: number;
  fcmFailureCount?: number;
  delivery?: 'fcm' | 'in-app';
  readBy?: string[];
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

export interface Session {
  id: string; // sha256 of the bearer token
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
}

export interface PassportInterest {
  tierId: string;
  userId: string;
  createdAt: string;
}

/** One play of a daily game. Unique per (userId, game, day). */
export interface GamePlay {
  userId: string;
  game: 'guess' | 'superover';
  /** Dubai calendar day, YYYY-MM-DD. */
  day: string;
  state: any;
  finished: boolean;
  points: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppStore {
  schemaVersion: number;
  sessions: Session[];
  passportInterest: PassportInterest[];
  claimedBadges: Record<string, boolean>;
  users: User[];
  otpCodes: OtpCode[];
  teams: Team[];
  handles: SocialHandle[];
  feedItems: FeedItem[];
  matches: Match[];
  contests: Contest[];
  contestEntries: ContestEntry[];
  fantasyTeams: FantasyTeam[];
  fantasyLeagues: FantasyLeague[];
  gamePlays: GamePlay[];
  draws: PrizeDraw[];
  drawEntries: DrawEntry[];
  prizes: PrizeItem[];
  redemptions: PrizeRedemption[];
  pointsLedger: PointsEntry[];
  forumThreads: ForumThread[];
  forumComments: ForumComment[];
  forumReports: ForumReport[];
  polls: Poll[];
  notifications: NotificationItem[];
  fcmTokens: FCMDeviceToken[];
  approvals: Approval[];
  agentRuns: AgentRun[];
  /** Idempotency keys for scheduled jobs (e.g. "lock:<matchId>" -> ISO time it ran). */
  jobLog: Record<string, string>;
  settings: SystemSettings;
  fanSpaces: FanSpace[];
  fanSpaceBookings: FanSpaceBooking[];
  youthSchools: YouthCupSchool[];
  creatorPartners: CreatorPartner[];
  commentaryFeeds: CommentaryAudioFeed[];
  passportTiers: SuperfanPassportTier[];
  proposalSettings: ProposalSettings;
  adminUsers: AdminUserRecord[];
}

export const SCHEMA_VERSION = 5;

export function superAdminRecord(): AdminUserRecord {
  return {
    email: SUPER_ADMIN_EMAIL,
    name: 'Super Admin',
    role: 'superadmin',
    permissions: ['all'],
    isSuperAdmin: true,
    addedBy: 'system',
    addedAt: '2026-10-01T00:00:00.000Z',
  };
}

export function defaultSettings(): SystemSettings {
  return {
    adminEmails: [],
    brandName: 'ADT10 Fans',
    tagline: 'The Abu Dhabi T10 fan hub',
    copyrightHolder: 'Azlir Sports',
    seasonLabel: 'Abu Dhabi T10 2026',
    seasonStart: '2026-11-07',
    seasonEnd: '2026-11-20',
    venue: 'Zayed Cricket Stadium, Abu Dhabi',
    tickerText: '',
    curatorFeedId: process.env.CURATOR_FEED_ID || '',
    curatorContainerId: '',
    curatorFeedUuid: '',
    curatorApiKey: process.env.CURATOR_API_KEY || '',
    curatorHashtags: '',
    maxSocialPerPlatform: 6,
    newsQueries: '',
    referralRewardPoints: 50,
    referralMaxRewarded: 10,
    lockReminderMinutes: Math.max(5, Number(process.env.LOCK_REMINDER_MINUTES) || 30),
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT) || 587,
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM || (process.env.SMTP_USER ? `"Abu Dhabi T10 Fans" <${process.env.SMTP_USER}>` : ''),
      enabled: Boolean(process.env.SMTP_HOST),
    },
  };
}

export function seedSmtpFromEnv(s: AppStore['settings']['smtp']): boolean {
  let changed = false;
  if (!s.host && process.env.SMTP_HOST) { s.host = process.env.SMTP_HOST; changed = true; }
  if ((!s.port || s.port === 587) && process.env.SMTP_PORT) { s.port = Number(process.env.SMTP_PORT) || 587; changed = true; }
  if (!s.user && process.env.SMTP_USER) { s.user = process.env.SMTP_USER; changed = true; }
  if (!s.pass && process.env.SMTP_PASS) { s.pass = process.env.SMTP_PASS; changed = true; }
  if (!s.from) {
    if (process.env.SMTP_FROM) {
      s.from = process.env.SMTP_FROM;
      changed = true;
    } else if (s.user || process.env.SMTP_USER) {
      s.from = `"Abu Dhabi T10 Fans" <${s.user || process.env.SMTP_USER}>`;
      changed = true;
    }
  }
  if (!s.enabled && (s.host || process.env.SMTP_HOST)) {
    s.enabled = true;
    changed = true;
  }
  return changed;
}

/** A brand-new store. Teams, squads and verified handles are added by seedOfficial.initializeStore(). */
export function emptyStore(): AppStore {
  return {
    schemaVersion: SCHEMA_VERSION,
    sessions: [],
    passportInterest: [],
    claimedBadges: {},
    users: [],
    otpCodes: [],
    teams: [],
    handles: [],
    feedItems: [],
    matches: [],
    contests: [],
    contestEntries: [],
    fantasyTeams: [],
    fantasyLeagues: [],
    gamePlays: [],
    draws: [],
    drawEntries: [],
    prizes: [],
    redemptions: [],
    pointsLedger: [],
    forumThreads: [],
    forumComments: [],
    forumReports: [],
    polls: [],
    notifications: [],
    fcmTokens: [],
    approvals: [],
    agentRuns: [],
    jobLog: {},
    settings: defaultSettings(),
    fanSpaces: [],
    fanSpaceBookings: [],
    youthSchools: [],
    creatorPartners: [],
    commentaryFeeds: [],
    passportTiers: [],
    proposalSettings: generateInitialProposalSettings(),
    adminUsers: [superAdminRecord()],
  };
}

// Demo content that older versions generated automatically.
const LEGACY_SEED_IDS = new Set([
  'thread-proposal-1', 'thread-matchday-1', 'thread-fantasy-1', 'thread-fanspaces-1', 'thread-giveaways-1',
  ...Array.from({ length: 10 }, (_, i) => `comment-${i + 1}`),
  'user-admin',
]);
const STOCK_IMAGE = /unsplash\.com|dicebear\.com|picsum\.photos|placeholder\.com/i;

/**
 * Feed items earlier versions invented rather than pulled from a real source: placeholder status ids,
 * stock photos, a placeholder YouTube video, or the generator's source type.
 */
/** Links of the invented posts removed by the v5 migration. */
const FABRICATED_POST_URLS_2026_10_15 = [
  'https://x.com/arabianacesT10/status/1841452093847298048',
  'https://www.instagram.com/p/DAq_AcesKit2026/',
  'https://x.com/arabianacesT10/status/1841328901247891200',
  'https://www.threads.com/@arabianacesofficial/post/DAq_Threads01',
  'https://www.instagram.com/p/DAq_NetPractice/',
  'https://www.tiktok.com/@arabianaces/video/7289012489012',
  'https://www.facebook.com/arabianacesofficial/posts/10928301928301',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://x.com/UAEBullsT10/status/1841567829102938102',
  'https://www.instagram.com/p/DAq_BullsSpinTwins/',
  'https://www.youtube.com/watch?v=7uV8h8Wk5oM',
  'https://www.threads.com/@delhibullst10/post/DAq_BullsThreads',
  'https://x.com/UnitedTigersT10/status/1841790123491829012',
  'https://www.instagram.com/p/DAq_TigersCamp2026/',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://x.com/YasLionsT10/status/1841890123849182091',
  'https://www.instagram.com/p/DAq_YasLionsKit/',
  'https://x.com/EmiratesEaglesT10/status/1841980123849120918',
  'https://www.instagram.com/p/DAq_EaglesFielding/',
  'https://x.com/RoyalChampionsT10/status/1842090123849182910',
  'https://www.instagram.com/p/DAq_ChampionsArmor/',
  'https://x.com/T10League/status/1841678901239847101',
  'https://www.instagram.com/p/DAq_LeagueTrophyTour/',
  'https://www.youtube.com/watch?v=3JZ_D3ELPTg',
  'https://www.tiktok.com/@abudhabit10/video/7291028301928',
];

export function isFabricatedFeedItem(f: any): boolean {
  if (!f || typeof f !== 'object') return true;
  if (f.sourceType === 'social-handle') return true;
  if (typeof f.id === 'string' && /^(feed-(central|aces|bulls|tigers|lions|eagles|champions)-|yt-dyn-|post-dyn-)/.test(f.id)) return true;
  const url = String(f.url || '');
  if (/dQw4w9WgXcQ/.test(url)) return true;
  if (/(x|twitter)\.com\/[^/]+\/status\/1[89]\d{5}$/.test(url)) return true; // 7-digit placeholder ids
  if (f.image && STOCK_IMAGE.test(String(f.image))) return true;
  return false;
}

/**
 * Upgrade a store written by an older version. Real accounts, forum posts and everything an admin
 * created are kept. Invented demo content is dropped; unconfirmed handles go to the approval queue.
 */
export function migrate(raw: any): AppStore {
  const fresh = emptyStore();
  if (!raw || typeof raw !== 'object') return fresh;
  const out: any = { ...fresh, ...raw };
  out.settings = { ...fresh.settings, ...(raw.settings || {}), smtp: { ...fresh.settings.smtp, ...(raw.settings?.smtp || {}) } };
  for (const k of Object.keys(fresh) as (keyof AppStore)[]) {
    if (Array.isArray((fresh as any)[k]) && !Array.isArray(out[k])) out[k] = [];
  }
  if (!out.jobLog || typeof out.jobLog !== 'object') out.jobLog = {};
  if (!out.claimedBadges || typeof out.claimedBadges !== 'object') out.claimedBadges = {};
  if (!out.proposalSettings) out.proposalSettings = fresh.proposalSettings;
  if (!out.adminUsers.some((a: AdminUserRecord) => a.email?.toLowerCase() === SUPER_ADMIN_EMAIL)) out.adminUsers.unshift(superAdminRecord());

  const version = Number(raw.schemaVersion) || 1;
  if (version < 2) {
    // v1 stores: drop demo users/threads and stock avatars.
    out.users = out.users.filter((u: User) => !LEGACY_SEED_IDS.has(u.id));
    const userIds = new Set(out.users.map((u: User) => u.id));
    out.forumThreads = out.forumThreads.filter((t: ForumThread) => !LEGACY_SEED_IDS.has(t.id) && userIds.has(t.userId));
    const threadIds = new Set(out.forumThreads.map((t: ForumThread) => t.id));
    out.forumComments = out.forumComments.filter((c: ForumComment) => !LEGACY_SEED_IDS.has(c.id) && threadIds.has(c.threadId) && userIds.has(c.userId));
    out.fcmTokens = out.fcmTokens.filter((t: FCMDeviceToken) => !String(t.token).startsWith('fcm_web_'));
    if (out.settings.smtp.from === 'noreply@t10fanhub.com') out.settings.smtp.from = '';
    if (out.settings.smtp.host === 'smtp.gmail.com' && !out.settings.smtp.user) out.settings.smtp.host = '';
  }
  if (version < 3) {
    out.feedItems = out.feedItems.filter((f: FeedItem) => !isFabricatedFeedItem(f));
    for (const f of out.feedItems as any[]) {
      delete f.verifiedReal;
      delete f.channelVerified;
      const vid = String(f.url || '').match(/[?&]v=([\w-]{11})/);
      if (f.platform === 'YouTube' && vid) f.videoId = vid[1];
    }
    // Handles that earlier versions pre-filled without checking become suggestions for an admin to confirm.
    for (const h of out.handles as any[]) {
      if (h.source === 'official-preset') {
        h.source = 'legacy';
        h.status = 'pending';
        h.verifiedAt = undefined;
      }
    }
    if (out.settings.tickerText?.includes('LIVE · ARABIAN ACES')) out.settings.tickerText = '';
    if (out.settings.curatorHashtags === 'AbuDhabiT10,ArabianAces,T10League') out.settings.curatorHashtags = '';
    if (out.settings.curatorContainerId === 'curator-feed-default-feed-layout') out.settings.curatorContainerId = '';
    out.settings.adminEmails = (out.settings.adminEmails || []).filter((e: string) => e.toLowerCase() !== SUPER_ADMIN_EMAIL);
  }
  if (version < 4) {
    // A version of the "native harvester" (October 2026) stored invented posts (ids starting "seed-",
    // stock photos, placeholder links) and unchecked links an AI search returned. Remove both; the
    // harvester now keeps only posts the platform itself confirms.
    out.feedItems = out.feedItems.filter((f: FeedItem) => !isFabricatedFeedItem(f) && !String(f.id).startsWith('seed-') && f.sourceType !== 'native-harvester');
  }
  if (version < 5) {
    // A commit from 15 October 2026 seeded 25 invented "official" posts (made-up post ids, stock
    // photos, invented like counts, and unrelated YouTube videos presented as team videos). Remove
    // them, and anything else that looks invented.
    const invented = new Set(FABRICATED_POST_URLS_2026_10_15);
    out.feedItems = out.feedItems.filter((f: FeedItem) => !invented.has(String(f.url)) && !isFabricatedFeedItem(f) && f.sourceType !== 'native-harvester');
    for (const h of out.handles as any[]) {
      if (h.meta?.channelId && !/^UC[\w-]{22}$/.test(h.meta.channelId)) delete h.meta.channelId;
    }
  }
  for (const u of out.users as any[]) {
    if (u.avatar && STOCK_IMAGE.test(u.avatar)) u.avatar = '';
    if (typeof u.pointsSpent !== 'number') u.pointsSpent = 0;
  }
  for (const t of out.forumThreads as any[]) if (t.userAvatar && STOCK_IMAGE.test(t.userAvatar)) t.userAvatar = '';
  for (const t of out.teams as any[]) {
    for (const p of t.squad || []) delete p.stats;
  }
  seedSmtpFromEnv(out.settings.smtp);
  out.schemaVersion = SCHEMA_VERSION;
  return out as AppStore;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/adt10-data' : path.join(process.cwd(), 'data')));
/** Where older versions kept the whole store as one file; read once to move it into shards. */
export const STORE_PATH = path.join(DATA_DIR, 't10_store.json');

/** Per-request context (set by storeSync) so code can tell which request is writing. */
export const requestContext = new AsyncLocalStorage<{ id: string }>();

type InitHook = (store: AppStore) => boolean | void;

/** Upgrades a raw store and runs the init hooks (seeding official data). */
function prepare(raw: any, hooks: InitHook[]): { store: AppStore; changed: boolean } {
  const needsMigration = !raw || (Number(raw.schemaVersion) || 1) < SCHEMA_VERSION;
  const store = migrate(raw);
  let changed = needsMigration;
  for (const hook of hooks) if (hook(store)) changed = true;
  return { store, changed };
}

/** Puts back any top-level key a partial reload left missing, so code can rely on every collection existing. */
function fillDefaults(store: any) {
  const fresh: any = emptyStore();
  for (const k of Object.keys(fresh)) if (store[k] === undefined || store[k] === null) store[k] = fresh[k];
}

/** Turns on the check that every change to the store went through change tracking (tests). */
const VERIFY = () => process.env.STORE_VERIFY === '1';

interface Engine {
  readonly shared: boolean;
  load(hooks: InitHook[]): Promise<void>;
  refresh(maxAgeMs: number): Promise<void>;
  get(): AppStore;
  /** db.save(): something changed (the sharded engine already knows what). */
  saved(): void;
  /** True when there are changes not yet written. */
  readonly dirty: boolean;
  commit(): Promise<void>;
  /** Throws away unwritten changes and catches up with storage. */
  discard(hooks: InitHook[]): Promise<void>;
  /** Writes everything that differs from storage, including changes made outside change tracking. Returns the number of shards fixed. */
  reconcile(): Promise<number>;
}

/**
 * The store split into shards (see shards.ts). Changes are recorded by proxies as code makes them,
 * and a commit writes only the shards that changed.
 */
class ShardEngine implements Engine {
  private raw: AppStore = emptyStore();
  private proxy: AppStore;
  /** What storage holds for each shard, as far as this server knows (including deleted markers). */
  private metas = new Map<string, ShardMeta>();
  /** Hash of each live shard's text as last read or written. */
  private hashes = new Map<string, string>();
  private token: string | null = null;
  private lastFreshCheck = 0;
  private untrackedSave = false;
  readonly changes: ChangeSet;

  /** Called with the keys another server changed, after they are applied here. */
  onExternal: (keys: Set<string>, store: AppStore) => void = () => undefined;

  constructor(
    private readonly backend: ShardBackend,
    onChange: () => void,
  ) {
    this.changes = new ChangeSet(onChange);
    this.proxy = track(this.raw, this.changes);
  }

  get shared() {
    return this.backend.shared;
  }
  get dirty() {
    return !this.changes.empty || this.untrackedSave;
  }
  get() {
    return this.proxy;
  }
  saved() {
    if (this.changes.empty) this.untrackedSave = true;
  }

  private setRaw(raw: AppStore) {
    this.raw = raw;
    this.proxy = track(raw, this.changes);
  }

  async load(hooks: InitHook[]): Promise<void> {
    const { metas, token } = await this.backend.changes(null);
    const live = metas.filter(m => !m.deleted);
    let raw: any = null;
    let texts = new Map<string, string>();
    if (live.length) {
      texts = await this.backend.read(live, token);
      raw = joinShards(texts.values());
    } else {
      const legacy = await this.backend.legacy();
      if (legacy) {
        try {
          raw = JSON.parse(legacy);
          console.log('[STORE] Moving the store from the single-document layout to shards (the old copy is left in place).');
        } catch {
          console.error('[STORE] The old store is not valid JSON; starting from an empty store. The old copy is left untouched.');
        }
      }
    }
    this.metas = new Map(metas.map(m => [m.name, m]));
    this.hashes = new Map([...texts].map(([n, t]) => [n, hashText(t)]));
    this.token = token;
    const { store } = prepare(raw, hooks);
    this.changes.clear();
    this.untrackedSave = false;
    this.setRaw(store);
    this.lastFreshCheck = Date.now();
    // Migrations, the init hooks and a move from the old layout are written now.
    if ((await this.reconcile()) > 0) {
      try {
        await this.commit();
      } catch (e) {
        if (e instanceof ConflictError) return this.load(hooks); // another server wrote first: start again from its copy
        console.warn('[DB] initial write failed, continuing with the loaded store:', (e as Error)?.message || e);
      }
    }
  }

  async refresh(maxAgeMs: number) {
    if (!this.backend.shared) return;
    if (maxAgeMs && Date.now() - this.lastFreshCheck < maxAgeMs) return;
    for (let attempt = 0; ; attempt++) {
      try {
        const { metas, token } = await this.backend.changes(this.token);
        this.lastFreshCheck = Date.now();
        const changed = metas.filter(m => this.metas.get(m.name)?.version !== m.version);
        if (changed.length) await this.apply(changed, token);
        this.token = token;
        return;
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 3) throw e;
      }
    }
  }

  /** Replaces the given shards with storage's copy as of `token`. */
  private async apply(metas: ShardMeta[], token: string) {
    const texts = await this.backend.read(metas.filter(m => !m.deleted && m.chunks > 0), token);
    const byKey = new Map<string, Map<string, string | null>>();
    for (const m of metas) {
      const key = keyOfShard(m.name);
      if (!byKey.has(key)) byKey.set(key, new Map());
      byKey.get(key)!.set(m.name, m.deleted ? null : (texts.get(m.name) ?? null));
    }
    for (const [key, t] of byKey) replaceShards(this.raw, key, t);
    fillDefaults(this.raw);
    try {
      this.onExternal(new Set(byKey.keys()), this.raw);
    } catch (e) {
      console.warn('[DB] change listener failed:', (e as Error)?.message);
    }
    for (const m of metas) {
      if (m.version) this.metas.set(m.name, m);
      else this.metas.delete(m.name);
      const text = texts.get(m.name);
      if (text !== undefined) this.hashes.set(m.name, hashText(text));
      else this.hashes.delete(m.name);
    }
  }

  /** Shards that may have changed: recorded shards plus every shard (old and new) of a replaced key. */
  private candidates(): Set<string> {
    const out = new Set(this.changes.shards);
    for (const key of this.changes.keys) {
      for (const s of shardsOfKey(this.raw, key)) out.add(s);
      for (const [name, m] of this.metas) if (!m.deleted && keyOfShard(name) === key) out.add(name);
      if (!SPLIT[key]) out.add(`k.${key}`);
    }
    return out;
  }

  /** Current text of each candidate shard (null = the shard is now empty). Groups each split collection once. */
  private textsOf(names: Set<string>): Map<string, string | null> {
    const byKey = new Map<string, string[]>();
    for (const n of names) {
      const k = keyOfShard(n);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(n);
    }
    const out = new Map<string, string | null>();
    for (const [key, list] of byKey) {
      if (SPLIT[key] && list.length > 2) {
        const all = splitStore({ [key]: (this.raw as any)[key] || [] });
        for (const n of list) out.set(n, all.get(n) ?? null);
      } else {
        for (const n of list) out.set(n, shardText(this.raw as any, n));
      }
    }
    return out;
  }

  async commit() {
    if (this.changes.empty && this.untrackedSave) {
      // db.save() was called but no change was recorded: compare everything, in case something
      // changed the store without going through tracking.
      this.untrackedSave = false;
      await this.reconcile();
    }
    if (this.changes.empty) return;
    const pending = this.changes.snapshot();
    const texts = this.textsOf(this.candidates());
    const writes: { name: string; text: string | null; expected: string | null; prevChunks: number; hash: string }[] = [];
    for (const [name, text] of texts) {
      const meta = this.metas.get(name);
      const live = Boolean(meta && !meta.deleted);
      if (text === null) {
        if (live) writes.push({ name, text: null, expected: meta!.version, prevChunks: meta!.chunks, hash: '' });
        continue;
      }
      const hash = hashText(text);
      if (live && this.hashes.get(name) === hash) continue;
      writes.push({ name, text, expected: meta?.version || null, prevChunks: meta?.chunks || 0, hash });
    }
    if (writes.length) {
      const result = await this.backend.write(writes);
      for (const w of writes) {
        const m = result.get(w.name);
        if (m) this.metas.set(w.name, m);
        if (w.text === null) this.hashes.delete(w.name);
        else this.hashes.set(w.name, w.hash);
      }
    }
    // Only forget what was written; changes made while the write was in flight stay recorded.
    for (const s of pending.shards) this.changes.shards.delete(s);
    for (const k of pending.keys) this.changes.keys.delete(k);
    if (VERIFY()) {
      const missed = await this.reconcile();
      if (missed) console.error(`[STORE] untracked change: ${missed} shard(s) changed without being recorded`);
    }
  }

  async discard(hooks: InitHook[]) {
    const local = this.candidates();
    this.changes.clear();
    this.untrackedSave = false;
    if (!this.backend.shared) {
      // One server: nothing else writes, so reloading is the simplest way back.
      return this.load(hooks);
    }
    for (let attempt = 0; ; attempt++) {
      try {
        const { metas, token } = await this.backend.changes(this.token);
        const changed = metas.filter(m => this.metas.get(m.name)?.version !== m.version);
        const seen = new Set(changed.map(m => m.name));
        const reset = [...local].filter(n => !seen.has(n)).map(n => this.metas.get(n) ?? { name: n, version: '', chunks: 0, deleted: true });
        await this.apply([...changed, ...reset], token);
        this.token = token;
        this.lastFreshCheck = Date.now();
        return;
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 3) throw e;
      }
    }
  }

  async reconcile(): Promise<number> {
    const texts = splitStore(this.raw as any);
    let n = 0;
    for (const [name, text] of texts) {
      const meta = this.metas.get(name);
      if (!meta || meta.deleted || this.hashes.get(name) !== hashText(text)) {
        this.changes.shard(name);
        n++;
      }
    }
    for (const [name, meta] of this.metas) {
      if (!meta.deleted && !texts.has(name)) {
        this.changes.shard(name);
        n++;
      }
    }
    return n;
  }

  /** Size of each shard as last written, for the admin dashboard. */
  stats() {
    let shards = 0;
    for (const m of this.metas.values()) if (!m.deleted) shards++;
    return { shards };
  }
}

/**
 * The whole store as one document (Cloud Storage, or Firestore through the browser SDK).
 * A commit compares the store with what was last read or written and writes only if it differs, so
 * changes made without db.save() (inside db.mutate outside a request) are not lost.
 */
class BlobEngine implements Engine {
  private store: AppStore = emptyStore();
  private version: string | null = null;
  private isDirty = false;
  private lastFreshCheck = 0;
  private lastHash = '';

  constructor(
    private readonly backend: StorageBackend,
    private readonly onChange: () => void,
  ) {}

  get shared() {
    return this.backend.shared;
  }
  get dirty() {
    return this.isDirty;
  }
  get() {
    return this.store;
  }
  saved() {
    this.isDirty = true;
  }

  async load(hooks: InitHook[]): Promise<void> {
    const { data, version } = await this.backend.load();
    let raw: any = null;
    if (data) {
      try {
        raw = JSON.parse(data);
      } catch {
        console.error('[DB] Store is not valid JSON; starting from an empty store.');
      }
    }
    const { store, changed } = prepare(raw, hooks);
    this.store = store;
    this.version = version;
    this.lastFreshCheck = Date.now();
    this.isDirty = false;
    this.lastHash = data ? hashText(data) : '';
    if (changed) {
      this.isDirty = true;
      this.onChange();
      try {
        await this.commit();
      } catch (e) {
        if (e instanceof ConflictError) return this.load(hooks);
        console.warn('[DB] initial commit failed, continuing with store:', (e as any)?.message || e);
      }
    }
  }

  async refresh(maxAgeMs: number) {
    if (!this.shared) return;
    if (maxAgeMs && Date.now() - this.lastFreshCheck < maxAgeMs) return;
    const current = await this.backend.currentVersion();
    this.lastFreshCheck = Date.now();
    if (current !== this.version) await this.load(this.hooks);
  }

  hooks: InitHook[] = [];

  async commit() {
    const payload = JSON.stringify(this.store);
    const hash = hashText(payload);
    this.isDirty = false;
    if (hash === this.lastHash) return;
    try {
      this.version = await this.backend.save(payload, this.version);
      this.lastHash = hash;
    } catch (e) {
      this.isDirty = true;
      throw e;
    }
  }

  async discard(hooks: InitHook[]) {
    this.isDirty = false;
    await this.load(hooks);
  }

  async reconcile() {
    return 0;
  }
}

class DatabaseManager {
  readonly backend: AnyBackend;
  private readonly engine: Engine;
  private saveTimer: NodeJS.Timeout | null = null;
  private readyPromise: Promise<void> | null = null;
  private initHooks: InitHook[] = [];
  /** Increments on every change; storeSync compares it to tell whether a request changed anything. */
  epoch = 0;

  constructor() {
    this.backend = createBackend(DATA_DIR, STORE_PATH);
    const onChange = () => {
      this.epoch++;
      if (!this.engine.shared) this.scheduleWrite();
    };
    this.engine = isSharded(this.backend) ? new ShardEngine(this.backend, onChange) : new BlobEngine(this.backend, onChange);
    if (this.engine instanceof ShardEngine) this.engine.onExternal = (keys, store) => this.externalHooks.forEach(h => h(keys, store));
    if (this.engine instanceof BlobEngine) this.engine.hooks = this.initHooks;
  }

  get shared() {
    return this.engine.shared;
  }

  /** True when the store is split into shards (the current layout). */
  get sharded() {
    return this.engine instanceof ShardEngine;
  }

  shardStats() {
    return this.engine instanceof ShardEngine ? this.engine.stats() : null;
  }

  /** Functions run on every full load (seeding official data, reconciling handles). Return true if they changed the store. */
  onLoad(hook: InitHook) {
    this.initHooks.push(hook);
  }

  private externalHooks: ((keys: Set<string>, store: AppStore) => void)[] = [];
  /**
   * Functions run when another server's changes are picked up without a full reload (sharded storage).
   * They must only read the store. `keys` are the top-level keys that changed.
   */
  onExternalChange(hook: (keys: Set<string>, store: AppStore) => void) {
    this.externalHooks.push(hook);
  }

  ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.reload().catch(err => {
        this.readyPromise = null;
        throw err;
      });
    }
    return this.readyPromise;
  }

  async reload(): Promise<void> {
    await this.engine.load(this.initHooks);
  }

  /** For shared storage: catch up with writes from other servers (checked at most every maxAgeMs). */
  async refreshIfStale(maxAgeMs = 0): Promise<void> {
    await this.engine.refresh(maxAgeMs);
  }

  get(): AppStore {
    return this.engine.get();
  }

  /** Marks the store as changed. One server: written shortly after. Shared storage: written at the end of the request. */
  save() {
    this.engine.saved();
    this.epoch++;
    if (!this.shared) this.scheduleWrite();
  }

  private scheduleWrite() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.exclusive(() => this.engine.commit()).catch(e => console.error('[DB] write failed:', e?.message || e));
    }, 150);
    this.saveTimer.unref?.();
  }

  /** Writes now if anything changed. Shared storage throws ConflictError when another server wrote the same shard first. */
  async commit(): Promise<void> {
    await this.engine.commit();
  }

  /** Discards unsaved changes (after a conflict) and catches up with storage. */
  async discardAndReload() {
    await this.engine.discard(this.initHooks);
  }

  /** Writes anything that differs from storage. Cheap safety net, run with the scheduled jobs. */
  async reconcile(): Promise<number> {
    return this.engine.reconcile();
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.engine.commit();
  }

  /** On exit (one server): file writes complete synchronously inside commit(). */
  flushSync() {
    if (this.shared || !this.engine.dirty) return;
    this.engine.commit().catch(e => console.error('[DB] final write failed:', e));
  }

  private chain: Promise<unknown> = Promise.resolve();
  /** Number of write sections running on this instance. */
  busy = 0;

  /** Runs write sections one at a time on this instance (requests that change data, scheduled jobs). */
  exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
      this.busy++;
      try {
        return await fn();
      } finally {
        this.busy--;
      }
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => undefined);
    return p;
  }

  /**
   * Runs `fn` against the latest store and writes the result, retrying when another server wrote the
   * same data at the same time. Keep `fn` short and free of network calls: it holds this server's
   * write lock while it runs.
   */
  transaction<T>(fn: (store: AppStore) => Promise<T> | T, attempts = 8): Promise<T> {
    return this.exclusive(async () => {
      for (let i = 0; ; i++) {
        await this.refreshIfStale();
        const result = await fn(this.get());
        try {
          await this.commit();
          return result;
        } catch (e) {
          if (!(e instanceof ConflictError) || i >= attempts - 1) {
            await this.discardAndReload().catch(() => undefined);
            throw e;
          }
          await this.discardAndReload();
          await new Promise(r => setTimeout(r, 40 * (i + 1) + Math.random() * 60));
        }
      }
    });
  }

  /**
   * Apply a change. Inside a request it runs directly (storeSync writes at the end of the request);
   * outside one (timers, jobs) it runs as a transaction.
   */
  async mutate<T>(fn: (store: AppStore) => Promise<T> | T): Promise<T> {
    if (requestContext.getStore() || !this.shared) {
      const r = await fn(this.get());
      this.save();
      return r;
    }
    return this.transaction(fn);
  }

  resetProposal(): ProposalSettings {
    this.get().proposalSettings = generateInitialProposalSettings();
    this.save();
    return this.get().proposalSettings;
  }
}

export { ConflictError, QuotaError, unwrap };
export const db = new DatabaseManager();
db.onLoad(store => seedSmtpFromEnv(store.settings.smtp));

if (!process.env.VERCEL) {
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      db.flushSync();
      if (db.shared) db.flush().finally(() => process.exit(0));
      else setTimeout(() => process.exit(0), 50);
    });
  }
}
