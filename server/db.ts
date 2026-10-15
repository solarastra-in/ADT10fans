import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { generateInitialProposalSettings } from './proposalDefaults';
import { ConflictError, createBackend, FileBackend, StorageBackend } from './storage';

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
  source: 'official' | 'discovery' | 'admin' | 'ai-suggestion' | 'legacy';
  meta?: Record<string, any>;
  verifiedAt?: string;
  foundAt: string;
  /** Result of the last automatic pull for this handle. */
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'empty' | 'error' | 'embed-only';
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
  sourceType?: 'youtube-rss' | 'news-rss' | 'admin' | 'ai' | 'social-syndication' | 'curator' | 'rss' | 'native-harvester';
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
  scoreSource?: 'manual' | 'cricketdata';
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
  points?: number;
  rank?: number;
  breakdown?: FantasyBreakdownLine[];
  scoredAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Private Dream XI leagues: friends compare totals across the season. */
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
  /** Minutes before the first ball when the "lineups lock soon" reminder goes out. */
  lockReminderMinutes: number;
  smtp: { host: string; port: number; user: string; pass: string; from: string; enabled: boolean };
}

export type ReactionEmoji = '👏' | '🔥' | '😂' | '😮' | '💯';
export const REACTIONS: ReactionEmoji[] = ['👏', '🔥', '😂', '😮', '💯'];

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

export const SCHEMA_VERSION = 3;

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
    lockReminderMinutes: Math.max(5, Number(process.env.LOCK_REMINDER_MINUTES) || 30),
    smtp: { host: '', port: 587, user: '', pass: '', from: '', enabled: false },
  };
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
  for (const u of out.users as any[]) {
    if (u.avatar && STOCK_IMAGE.test(u.avatar)) u.avatar = '';
    if (typeof u.pointsSpent !== 'number') u.pointsSpent = 0;
  }
  for (const t of out.forumThreads as any[]) if (t.userAvatar && STOCK_IMAGE.test(t.userAvatar)) t.userAvatar = '';
  for (const c of out.forumComments as any[]) if (c.userAvatar && STOCK_IMAGE.test(c.userAvatar)) c.userAvatar = '';
  for (const t of out.teams as any[]) {
    for (const p of t.squad || []) delete p.stats; // unverified stats from an earlier version
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out as AppStore;
}

const DATA_DIR = path.resolve(process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/adt10-data' : path.join(process.cwd(), 'data')));
export const STORE_PATH = path.join(DATA_DIR, 't10_store.json');

/** Per-request context (set by storeSync) so code can tell which request is writing. */
export const requestContext = new AsyncLocalStorage<{ id: string }>();

type InitHook = (store: AppStore) => boolean | void;

class DatabaseManager {
  readonly backend: StorageBackend;
  private store: AppStore = emptyStore();
  private version: string | null = null;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private readyPromise: Promise<void> | null = null;
  private lastFreshCheck = 0;
  private initHooks: InitHook[] = [];
  /** Increments on every save(); storeSync compares it to tell whether a request changed anything. */
  epoch = 0;

  constructor() {
    this.backend = createBackend(STORE_PATH);
  }

  get shared() {
    return this.backend.shared;
  }

  /** Functions run on every load (seeding official data, reconciling handles). Return true if they changed the store. */
  onLoad(hook: InitHook) {
    this.initHooks.push(hook);
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
    const { data, version } = await this.backend.load();
    let raw: any = null;
    if (data) {
      try {
        raw = JSON.parse(data);
      } catch (e) {
        console.error('[DB] Store is not valid JSON; starting from an empty store and keeping a copy of the old one.');
        if (this.backend instanceof FileBackend) {
          try {
            new FileBackend(`${STORE_PATH}.corrupt-${Date.now()}`).saveSync(data);
          } catch {
            /* ignore */
          }
        }
      }
    }
    const needsMigration = !raw || (Number(raw.schemaVersion) || 1) < SCHEMA_VERSION;
    this.store = migrate(raw);
    this.version = version;
    this.lastFreshCheck = Date.now();
    let changed = needsMigration;
    for (const hook of this.initHooks) if (hook(this.store)) changed = true;
    if (changed) {
      this.dirty = true;
      this.epoch++;
      if (!this.shared) this.scheduleWrite();
      else {
        try {
          await this.commit();
        } catch (e) {
          if (e instanceof ConflictError) return this.reload();
          throw e;
        }
      }
    }
  }

  /** For the shared backend: reload when another instance has written since we last looked. */
  async refreshIfStale(maxAgeMs = 0): Promise<void> {
    if (!this.shared) return;
    if (maxAgeMs && Date.now() - this.lastFreshCheck < maxAgeMs) return;
    const current = await this.backend.currentVersion();
    this.lastFreshCheck = Date.now();
    if (current !== this.version) await this.reload();
  }

  get(): AppStore {
    return this.store;
  }

  /** Marks the store as changed. File backend: written shortly after. Shared backend: written at the end of the request. */
  save() {
    this.dirty = true;
    this.epoch++;
    if (!this.shared) this.scheduleWrite();
  }

  private scheduleWrite() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.commit().catch(e => console.error('[DB] write failed:', e?.message || e));
    }, 150);
    this.saveTimer.unref?.();
  }

  /** Writes now if anything changed. Shared backend throws ConflictError when another instance wrote first. */
  async commit(): Promise<void> {
    if (!this.dirty) return;
    const payload = JSON.stringify(this.store);
    this.dirty = false;
    try {
      this.version = await this.backend.save(payload, this.version);
    } catch (e) {
      this.dirty = true;
      throw e;
    }
  }

  /** Discard unsaved changes (after a conflict) by reloading from storage. */
  async discardAndReload() {
    this.dirty = false;
    await this.reload();
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.commit();
  }

  flushSync() {
    if (!this.dirty || !(this.backend instanceof FileBackend)) return;
    try {
      this.backend.saveSync(JSON.stringify(this.store));
      this.dirty = false;
    } catch (e) {
      console.error('[DB] final write failed:', e);
    }
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
   * Runs `fn` against the latest store and writes the result, retrying when another instance wrote
   * at the same time. Used by scheduled jobs that run outside an HTTP request.
   */
  transaction<T>(fn: (store: AppStore) => Promise<T> | T, attempts = 8): Promise<T> {
    return this.exclusive(async () => {
      for (let i = 0; ; i++) {
        await this.refreshIfStale();
        const result = await fn(this.store);
        try {
          await this.commit();
          return result;
        } catch (e) {
          if (!(e instanceof ConflictError) || i >= attempts - 1) throw e;
          await this.discardAndReload();
          await new Promise(r => setTimeout(r, 40 * (i + 1) + Math.random() * 60));
        }
      }
    });
  }

  /**
   * Apply a change. Inside a request it runs directly (storeSync writes at the end of the request);
   * outside one (timers) it runs as a transaction.
   */
  async mutate<T>(fn: (store: AppStore) => Promise<T> | T): Promise<T> {
    if (requestContext.getStore() || !this.shared) {
      const r = await fn(this.store);
      this.save();
      return r;
    }
    return this.transaction(fn);
  }

  resetProposal(): ProposalSettings {
    this.store.proposalSettings = generateInitialProposalSettings();
    this.save();
    return this.store.proposalSettings;
  }
}

export const db = new DatabaseManager();

if (!process.env.VERCEL) {
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      db.flushSync();
      if (db.shared) db.flush().finally(() => process.exit(0));
      else process.exit(0);
    });
  }
}
