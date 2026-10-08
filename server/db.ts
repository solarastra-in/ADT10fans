import fs from 'fs';
import path from 'path';
import { generateInitialProposalSettings } from './proposalDefaults';

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
  createdAt: string;
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
  credits: number;
  isIcon: boolean;
  category?: string;
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
  verifiedReal?: boolean;
  channelVerified?: boolean;
  sourceType?: 'youtube-rss' | 'news-rss' | 'admin' | 'ai';
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
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    enabled: boolean;
  };
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
  id: string;          // sha256 of the bearer token
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
  draws: PrizeDraw[];
  drawEntries: DrawEntry[];
  forumThreads: ForumThread[];
  forumComments: ForumComment[];
  notifications: NotificationItem[];
  fcmTokens: FCMDeviceToken[];
  approvals: Approval[];
  agentRuns: AgentRun[];
  settings: SystemSettings;
  fanSpaces: FanSpace[];
  fanSpaceBookings: FanSpaceBooking[];
  youthSchools: YouthCupSchool[];
  creatorPartners: CreatorPartner[];
  commentaryFeeds: CommentaryAudioFeed[];
  passportTiers: SuperfanPassportTier[];
  proposalSettings: ProposalSettings;
}

export const SCHEMA_VERSION = 2;

// Where the JSON store lives. On Cloud Run / containers mount a persistent volume
// (e.g. a Cloud Storage FUSE volume) and point DATA_DIR at it, otherwise data is lost on restart.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const STORE_PATH = path.join(DATA_DIR, 't10_store.json');

export function defaultSettings(): SystemSettings {
  return {
    adminEmails: [],
    brandName: 'ADT10 Fans',
    tagline: 'The Abu Dhabi T10 fan hub',
    copyrightHolder: 'Azlir Sports',
    seasonLabel: '',
    seasonStart: '',
    seasonEnd: '',
    venue: '',
    tickerText: '',
    curatorFeedId: process.env.CURATOR_FEED_ID || '',
    curatorContainerId: 'curator-feed-default-feed-layout',
    curatorFeedUuid: '',
    curatorApiKey: process.env.CURATOR_API_KEY || '',
    curatorHashtags: '',
    maxSocialPerPlatform: 5,
    newsQueries: '',
    smtp: { host: '', port: 587, user: '', pass: '', from: '', enabled: false },
  };
}

/** A brand-new, empty store. Everything fans see is created by an admin in the Admin Console. */
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
    draws: [],
    drawEntries: [],
    forumThreads: [],
    forumComments: [],
    notifications: [],
    fcmTokens: [],
    approvals: [],
    agentRuns: [],
    settings: defaultSettings(),
    fanSpaces: [],
    fanSpaceBookings: [],
    youthSchools: [],
    creatorPartners: [],
    commentaryFeeds: [],
    passportTiers: [],
    proposalSettings: generateInitialProposalSettings(),
  };
}

// IDs of the demo content that older versions of this app generated automatically.
const LEGACY_SEED_IDS = new Set([
  'thread-proposal-1', 'thread-matchday-1', 'thread-fantasy-1', 'thread-fanspaces-1', 'thread-giveaways-1',
  ...Array.from({ length: 10 }, (_, i) => `comment-${i + 1}`),
  'user-admin',
]);

/**
 * Upgrade a store written by an older version. v1 stores were pre-filled with invented
 * teams, squads, posts, scores, notifications, fan spaces, creators etc. We keep what real
 * people created (accounts, their forum posts, their team choice) and drop the demo content,
 * so the admin can seed the official data from the Admin Console.
 */
function migrate(raw: any): AppStore {
  const fresh = emptyStore();
  if (raw && raw.schemaVersion >= SCHEMA_VERSION) {
    // Fill any collections added since the store was written.
    const merged: any = { ...fresh, ...raw };
    merged.settings = { ...fresh.settings, ...(raw.settings || {}), smtp: { ...fresh.settings.smtp, ...(raw.settings?.smtp || {}) } };
    return merged as AppStore;
  }

  console.log('[DB] Migrating legacy store to schema v2 (removing generated demo content).');
  const out = fresh;
  const legacySettings = raw?.settings || {};
  out.settings = {
    ...fresh.settings,
    adminEmails: Array.isArray(legacySettings.adminEmails) ? legacySettings.adminEmails : [],
    curatorFeedId: legacySettings.curatorFeedId || fresh.settings.curatorFeedId,
    curatorContainerId: legacySettings.curatorContainerId || fresh.settings.curatorContainerId,
    curatorFeedUuid: legacySettings.curatorFeedUuid || '',
    curatorApiKey: legacySettings.curatorApiKey || fresh.settings.curatorApiKey,
    maxSocialPerPlatform: Number(legacySettings.maxSocialPerPlatform) || 5,
    smtp: { ...fresh.settings.smtp, ...(legacySettings.smtp || {}) },
  };
  if (out.settings.smtp.from === 'noreply@t10fanhub.com') out.settings.smtp.from = '';
  if (out.settings.smtp.host === 'smtp.gmail.com' && !out.settings.smtp.user) out.settings.smtp.host = '';

  const users: User[] = (raw?.users || []).filter((u: User) => !LEGACY_SEED_IDS.has(u.id));
  const avatarIsStock = (a?: string) => !a || /unsplash\.com|dicebear\.com/.test(a);
  out.users = users.map(u => ({ ...u, avatar: avatarIsStock(u.avatar) ? '' : u.avatar }));
  const userIds = new Set(out.users.map(u => u.id));

  out.forumThreads = (raw?.forumThreads || []).filter((t: ForumThread) => !LEGACY_SEED_IDS.has(t.id) && userIds.has(t.userId));
  const threadIds = new Set(out.forumThreads.map(t => t.id));
  out.forumComments = (raw?.forumComments || []).filter((c: ForumComment) => !LEGACY_SEED_IDS.has(c.id) && threadIds.has(c.threadId) && userIds.has(c.userId));
  for (const t of out.forumThreads) {
    t.commentsCount = out.forumComments.filter(c => c.threadId === t.id).length;
    t.upvotedBy = (t.upvotedBy || []).filter(id => userIds.has(id));
    t.upvotes = t.upvotedBy.length;
    t.views = Math.max(0, Number(t.views) || 0);
    t.userAvatar = avatarIsStock(t.userAvatar) ? '' : t.userAvatar;
  }
  for (const c of out.forumComments) {
    c.upvotedBy = (c.upvotedBy || []).filter(id => userIds.has(id));
    c.upvotes = c.upvotedBy.length;
    c.userAvatar = avatarIsStock(c.userAvatar) ? '' : c.userAvatar;
  }
  out.fcmTokens = (raw?.fcmTokens || []).filter((t: FCMDeviceToken) => !String(t.token).startsWith('fcm_web_'));
  if (raw?.proposalSettings) out.proposalSettings = raw.proposalSettings;
  return out;
}

class DatabaseManager {
  private store: AppStore;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.store = this.load();
  }

  private load(): AppStore {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
      const migrated = migrate(raw);
      if (!raw.schemaVersion || raw.schemaVersion < SCHEMA_VERSION) {
        // Keep a backup of the legacy file before we overwrite it.
        fs.copyFileSync(STORE_PATH, STORE_PATH + `.v${raw.schemaVersion || 1}.bak`);
        this.writeNow(migrated);
      }
      return migrated;
    }
    const fresh = emptyStore();
    this.writeNow(fresh);
    return fresh;
  }

  private writeNow(store: AppStore) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = STORE_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store), 'utf-8');
    fs.renameSync(tmp, STORE_PATH); // atomic replace
  }

  public get(): AppStore {
    return this.store;
  }

  /** Persist soon (coalesces bursts of writes). */
  public save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.flush();
    }, 150);
  }

  public flush() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    try {
      this.writeNow(this.store);
    } catch (e) {
      console.error('[DB] Failed to save store:', e);
    }
  }

  public resetProposal(): ProposalSettings {
    this.store.proposalSettings = generateInitialProposalSettings();
    this.save();
    return this.store.proposalSettings;
  }
}

export const db = new DatabaseManager();
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { db.flush(); process.exit(0); });
}
