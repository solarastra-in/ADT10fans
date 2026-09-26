import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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
  stats?: any;
  createdAt: string;
}

export interface OtpCode {
  id: string;
  email: string;
  codeHash: string;
  plainCodeForDev?: string;
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
  teamId: string | null; // null for league-level
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
  answers: Record<string, string>; // questionId -> chosen answer
  pointsAwarded?: number;
  createdAt: string;
}

export interface FantasyTeam {
  userId: string;
  matchId: string;
  playerIds: string[]; // 6 players
  captainId: string; // 2x points
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
  publicUserCountOverride: number; // e.g. 14850 fans
  tickerText: string;
  curatorFeedId: string;
  curatorContainerId: string;
  curatorFeedUuid: string;
  curatorApiKey: string;
  curatorHashtags: string;
  maxSocialPerPlatform: number; // default 5 as requested
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
  readBy?: string[];
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

export interface AppStore {
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

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 't10_store.json');

function generateInitialForumThreads(): ForumThread[] {
  return [
    {
      id: 'thread-proposal-1',
      title: '📢 OFFICIAL STRATEGY: ADT10 365-Day Global Fan Network & Physical Fan Spaces Proposal',
      content: 'Presenting the comprehensive proposal to the Abu Dhabi T10 League Governing Council to build an interconnected global fan ecosystem: unified fan portal, interactive community forums, fantasy dream team, transparent VIP giveaways, unified match watch party centers, social walls, and flagship physical fan spaces across Abu Dhabi, Dubai, London, Mumbai, and Toronto. Check out the dedicated League Proposal tab for the complete dossier and budget!',
      category: 'fanspaces',
      tags: ['ADT10', 'Proposal', 'GlobalFanSpaces', 'Strategy', 'AbuDhabi'],
      teamId: 'aces',
      userId: 'user-admin',
      userName: 'Franchise Owner (SolarAstra)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Founding Member',
      pinned: true,
      upvotes: 48,
      upvotedBy: ['user-admin', 'fan-1'],
      views: 1240,
      commentsCount: 4,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
    },
    {
      id: 'thread-matchday-1',
      title: '🔥 Match Day Live Chat: Arabian Aces vs Deccan Gladiators - Tactical Preview & Playing XI',
      content: 'The 2026 Abu Dhabi T10 tournament opener is here! Moeen Ali leads the explosive Arabian Aces batting lineup featuring Alex Hales and Sherfane Rutherford against defending champions Deccan Gladiators (Nicholas Pooran & Andre Russell). Who is winning the toss, and what score is par on the Zayed Stadium strip?',
      category: 'matchday',
      tags: ['Match1', 'ArabianAces', 'DeccanGladiators', 'LiveChat'],
      teamId: 'aces',
      userId: 'user-fan-1',
      userName: 'Tariq Al-Mansoor',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Boundary Oracle',
      pinned: true,
      upvotes: 36,
      upvotedBy: ['fan-1', 'fan-2'],
      views: 890,
      commentsCount: 3,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
    },
    {
      id: 'thread-fantasy-1',
      title: '⭐ Dream Team Strategy: The Best 6-Player Combo Under 55 Credits',
      content: 'In our 6-player Fantasy 10 format with a 55 credit budget, is it better to take two 10.5 credit power hitters (Pooran + Moeen) and fill the rest with budget bowlers like Gleeson and Scrimshaw, or balance with four 9.0 allrounders? Drop your squads below!',
      category: 'fantasy',
      tags: ['Fantasy10', 'DreamTeam', 'Tactics', 'Picks'],
      teamId: null,
      userId: 'user-fan-2',
      userName: 'Rohan Sharma',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Fantasy Maestro',
      pinned: false,
      upvotes: 29,
      upvotedBy: ['fan-3'],
      views: 640,
      commentsCount: 2,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
    },
    {
      id: 'thread-fanspaces-1',
      title: '🌍 Global Fan Clubhouses: Which City Should Get the First Physical Experiential Space?',
      content: 'As part of the global fan expansion, the league is evaluating dedicated fan spaces with 360-degree LED screenings, VR batting simulators, merchandise pop-ups, and live meetups. Should the first international hub outside the UAE open in London (Regent St), Mumbai (Bandra), Toronto (Brampton), or Melbourne? Vote and share your city!',
      category: 'fanspaces',
      tags: ['GlobalFanSpaces', 'London', 'Mumbai', 'Toronto', 'Dubai'],
      teamId: null,
      userId: 'user-fan-3',
      userName: 'Zainab Qureshi',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Centurion Streak',
      pinned: false,
      upvotes: 42,
      upvotedBy: ['fan-1', 'user-admin'],
      views: 1105,
      commentsCount: 3,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString()
    },
    {
      id: 'thread-giveaways-1',
      title: '🎁 VIP Hospitality Draw: Who entered the President Box Pass with Dugout Access?',
      content: 'The provably fair draw for 2x VIP President Box tickets + dugout access is closing in 3 days! The cryptographic SHA-256 seed verification makes this the most transparent cricket giveaway ever seen. Has everyone claimed their free entry?',
      category: 'giveaways',
      tags: ['Giveaways', 'VIPPass', 'ZayedStadium', 'SHA256'],
      teamId: 'aces',
      userId: 'user-admin',
      userName: 'Franchise Owner (SolarAstra)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Franchise VIP',
      pinned: false,
      upvotes: 31,
      upvotedBy: [],
      views: 750,
      commentsCount: 1,
      lastActivityAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString()
    }
  ];
}

function generateInitialForumComments(): ForumComment[] {
  return [
    {
      id: 'comment-1',
      threadId: 'thread-proposal-1',
      userId: 'user-fan-1',
      userName: 'Tariq Al-Mansoor',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Boundary Oracle',
      teamId: 'aces',
      content: 'This proposal hits the nail on the head! 90-minute cricket is the most electrifying format in world sport, but having physical fan spaces in London and Mumbai alongside Abu Dhabi will create a real year-round global community.',
      upvotes: 14,
      upvotedBy: ['user-admin'],
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
    },
    {
      id: 'comment-2',
      threadId: 'thread-proposal-1',
      userId: 'user-fan-2',
      userName: 'Rohan Sharma',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Fantasy Maestro',
      teamId: 'deccan',
      content: 'The financial budget breakdown in both USD and AED in the proposal makes total sense for the franchise board. The projected 108% ROI through sponsor activations and digital fan memberships is very realistic.',
      upvotes: 9,
      upvotedBy: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 80).toISOString()
    },
    {
      id: 'comment-3',
      threadId: 'thread-proposal-1',
      userId: 'user-fan-3',
      userName: 'Zainab Qureshi',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Centurion Streak',
      teamId: 'delhi',
      content: 'The Discussion Forum alone is a game changer. Now fans don’t just watch and leave, we have a continuous home to debate tactics, dream teams, and celebrate wins.',
      upvotes: 11,
      upvotedBy: ['user-fan-1'],
      createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString()
    },
    {
      id: 'comment-4',
      threadId: 'thread-proposal-1',
      userId: 'user-admin',
      userName: 'Franchise Owner (SolarAstra)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Founding Member',
      teamId: 'aces',
      content: 'Thank you everyone! The League Board meets this week to review the full submission. The interactive simulator in the proposal tab lets the council test different rollout phases and budgets.',
      upvotes: 18,
      upvotedBy: ['user-fan-1', 'user-fan-2'],
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
    },
    {
      id: 'comment-5',
      threadId: 'thread-matchday-1',
      userId: 'user-admin',
      userName: 'Franchise Owner (SolarAstra)',
      userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Franchise VIP',
      teamId: 'aces',
      content: 'Arabian Aces batting depth with Hales, Moeen, and Rutherford is unmatched this season. If we bat first, 135+ is well within reach in 10 overs!',
      upvotes: 15,
      upvotedBy: ['user-fan-1'],
      createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
    },
    {
      id: 'comment-6',
      threadId: 'thread-matchday-1',
      userId: 'user-fan-2',
      userName: 'Rohan Sharma',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Fantasy Maestro',
      teamId: 'deccan',
      content: 'Don’t underestimate Deccan Gladiators bowling attack. Richard Gleeson and Akeal Hosein in the powerplay are lethal. It’s going to be a cliffhanger!',
      upvotes: 8,
      upvotedBy: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
    },
    {
      id: 'comment-7',
      threadId: 'thread-matchday-1',
      userId: 'user-fan-1',
      userName: 'Tariq Al-Mansoor',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Boundary Oracle',
      teamId: 'aces',
      content: 'Locking in my match prediction right now for Arabian Aces with 14+ total sixes hit in the game!',
      upvotes: 7,
      upvotedBy: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
    },
    {
      id: 'comment-8',
      threadId: 'thread-fantasy-1',
      userId: 'user-fan-1',
      userName: 'Tariq Al-Mansoor',
      userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Boundary Oracle',
      teamId: 'aces',
      content: 'Alex Hales at 9.5 credits is the golden value pick. He strikes at 190+ in Abu Dhabi. Make Moeen Ali captain for double points.',
      upvotes: 12,
      upvotedBy: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString()
    },
    {
      id: 'comment-9',
      threadId: 'thread-fanspaces-1',
      userId: 'user-fan-2',
      userName: 'Rohan Sharma',
      userAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Fantasy Maestro',
      teamId: 'mumbai',
      content: 'Mumbai would be massive. A pop-up clubhouse in Bandra with live VR batting cages against 140km/h T10 bowling will see lines around the block.',
      upvotes: 19,
      upvotedBy: ['user-fan-1', 'user-admin'],
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
    },
    {
      id: 'comment-10',
      threadId: 'thread-fanspaces-1',
      userId: 'user-fan-3',
      userName: 'Zainab Qureshi',
      userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
      userBadge: 'Centurion Streak',
      teamId: 'delhi',
      content: 'London Regent St during the UK winter would be magical! Diaspora fans would flock there to watch night matches in Abu Dhabi warmth and ambiance.',
      upvotes: 15,
      upvotedBy: [],
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
    }
  ];
}

function generateInitialFanSpaces(): FanSpace[] {
  return [
    {
      id: 'space-abu-dhabi',
      name: 'Abu Dhabi Flagship Clubhouse & Arena',
      city: 'Abu Dhabi',
      country: 'United Arab Emirates',
      tagline: 'The Heart of T10 Cricket, 360° LED Arena & Emirati Luxury Hospitality',
      location: 'Yas Island / Zayed Cricket Stadium Precinct, Abu Dhabi, UAE',
      capacity: 1500,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1512958789358-4dacacbe09c3?q=80&w=1200&auto=format&fit=crop',
      features: [
        '360° Cylindrical LED Stadium Screen with Immersive Surround Audio',
        'VR Batting Pods (Face 140km/h simulated deliveries from international stars)',
        'Official 9-Franchise Pop-Up Jersey & Memorabilia Boutique',
        'Emirati Specialty Coffee & Artisanal Karak Barista Bar',
        'Live Player Dugout Cam, Press Conference & Studio Broadcast Links',
        'Pitch-Side VIP Majlis Enclosure with Private Butler Hospitality'
      ],
      amenities: [
        'Complimentary Valet Parking',
        'Ultra-Fast 5G Wi-Fi',
        'Dedicated Prayer Rooms',
        'Youth Tape-Ball Cricket Cage',
        'Live DJ & Stadium Emcee Sets',
        'Halal Gourmet Dining'
      ],
      openHours: 'Daily 12:00 PM – 02:00 AM (Matchdays until 03:30 AM)',
      liveMatchSchedule: 'Screening all 34 Abu Dhabi T10 fixtures live with stadium acoustic audio and pitch telemetry',
      vipPassPriceAed: 350,
      vipPassPriceUsd: 95,
      vipPerks: [
        'Reserved front-row majlis lounge seating with stadium audio feed',
        'Unlimited artisanal Karak, Arabic gourmet bites & specialty sliders',
        'Guaranteed VR Batting Pod fast-track pass',
        'Official ADT10 Souvenir Cap, Team Scarf & Matchday Program'
      ],
      merchBoutique: 'Full official jerseys of Arabian Aces, Deccan Gladiators, Northern Warriors & limited edition tournament caps',
      menuHighlights: 'Emirati Luqaimat with date drizzle, Wagyu shawarma sliders, Saffron Karak chai, Pistachio milk cake',
      totalBookings: 420
    },
    {
      id: 'space-dubai',
      name: 'Dubai Marina Fan Arena & Promenade',
      city: 'Dubai',
      country: 'United Arab Emirates',
      tagline: 'Open-Air Waterfront Mega Screens & Beachside Electric Match Energy',
      location: 'The Beach opposite JBR / Dubai Marina Promenade, Dubai, UAE',
      capacity: 800,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?q=80&w=1200&auto=format&fit=crop',
      features: [
        'Open-Air Waterfront Mega LED Screen overlooking Arabian Gulf',
        'Beachside Cabana Match Viewings with mist cooling systems',
        'Official Franchise Merchandise Pop-Up Boutique',
        'Sunset Cricket DJ Sessions & Live Commentary Soundstage',
        'Speed Gun Bowling Challenge with instant radar readout'
      ],
      amenities: [
        'Beach Promenade Direct Access',
        'Outdoor Mist Cooling & Shaded Pergolas',
        'Valet Parking',
        'Street Food Terrace & Mocktail Bar',
        'Photo-Op Dugout Replica'
      ],
      openHours: 'Daily 02:00 PM – 01:00 AM',
      liveMatchSchedule: 'Live twilight & evening matches with sunset harbor views and waterfront breezes',
      vipPassPriceAed: 250,
      vipPassPriceUsd: 68,
      vipPerks: [
        'Beach Cabana VIP entry for 2 guests with premium view',
        'Welcome mocktail pitcher & truffle fries platter',
        '10% discount on official merchandise boutique purchases'
      ],
      merchBoutique: 'Franchise beachwear, official match caps, retro tournament tees',
      menuHighlights: 'Smoked brisket tacos, Loaded truffle fries, Acai bowls, Cold brew passionfruit mocktails',
      totalBookings: 285
    },
    {
      id: 'space-london',
      name: 'London Regent Street Cricket Clubhouse',
      city: 'London',
      country: 'United Kingdom',
      tagline: 'Indoor Heated Cricket Sports Bar & West End Matchday Gathering',
      location: 'Regent Street / St John’s Wood Lord’s Precinct, London W1, UK',
      capacity: 600,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200&auto=format&fit=crop',
      features: [
        'Multi-Screen Heated Indoor Cricket Sports Clubhouse',
        'English T10 Player & Legend Meetup Stage (Q&A sessions with Moeen Ali, Chris Jordan & Alex Hales)',
        'Virtual Reality Batting Cage with T10 simulated powerplay overs',
        'Craft Beverage Bar & Gastropub Matchday Dining',
        'Historic Signed T10 Memorabilia Gallery'
      ],
      amenities: [
        'Heated Indoor Venue',
        'Coat Check & VIP Cloakroom',
        'Private Corporate Booth Hire',
        'HD Audio Streaming Headsets',
        'Full Accessibility Ramp & Lifts'
      ],
      openHours: 'Tuesday – Sunday: 11:30 AM – 11:00 PM',
      liveMatchSchedule: 'Live afternoon & evening broadcasts synchronized with Abu Dhabi twilight matches',
      vipPassPriceAed: 185,
      vipPassPriceUsd: 50,
      vipPerks: [
        'Reserved mezzanine booth with private audio channel',
        'Gastropub dining voucher + British craft beverage or zero-proof brew',
        'Player meet-and-greet photo pass'
      ],
      merchBoutique: 'Exclusive UK tour edition jerseys, winter cricket hoodies, collectible metal team badges',
      menuHighlights: 'Pavilion beef & ale pies, Gourmet fish & chips bites, Spiced ginger mocktails, Sticky toffee pudding',
      totalBookings: 190
    },
    {
      id: 'space-mumbai',
      name: 'Mumbai BKC Cricket Pavilion & Dhol Arena',
      city: 'Mumbai',
      country: 'India',
      tagline: 'Stadium Acoustic Power, Live Dhol Drummers & Bollywood Fusion Nights',
      location: 'Bandra Kurla Complex (BKC) Arena Promenade, Mumbai, India',
      capacity: 1200,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?q=80&w=1200&auto=format&fit=crop',
      features: [
        'Stadium-Grade Acoustic Sound System with Live Matchday Dhol Drummers',
        'Dual 4K Laser Projection Walls with real-time wagon-wheel graphics',
        'VR Batting Net facing explosive T10 bowling deliveries',
        'Bollywood-Cricket Crossover Matchday Screenings & Celebrity Guests',
        'Authentic Street Food Bazaar & Live Chaat Counters'
      ],
      amenities: [
        'Full Air-Conditioned Grand Hall',
        'Fast-Track Digital QR Turnstiles',
        'Family Enclosure & Safe Kids Zone',
        'Franchise Fan Club Stalls'
      ],
      openHours: 'Matchdays: 04:00 PM – 12:30 AM',
      liveMatchSchedule: 'Prime-time Indian broadcast match viewings with stadium-style commentary and live crowd singing',
      vipPassPriceAed: 110,
      vipPassPriceUsd: 30,
      vipPerks: [
        'Priority Air-Conditioned Enclosure access',
        'Free VR Batting Session token',
        'Gourmet Bombay Frankie & Cutting Chai platter'
      ],
      merchBoutique: 'Official franchise jerseys, silicon wristbands, autographed mini cricket bats',
      menuHighlights: 'Gourmet Frankie rolls, Vada Pav sliders with garlic chutney, Masala Fries, Alphonso Mango Lassi',
      totalBookings: 510
    },
    {
      id: 'space-toronto',
      name: 'Toronto Brampton Fan Dome',
      city: 'Toronto',
      country: 'Canada',
      tagline: 'Climate-Controlled Dome Screenings & Caribbean-South Asian Street Food',
      location: 'Greater Toronto Area (Brampton Sports Complex), Ontario, Canada',
      capacity: 500,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1200&auto=format&fit=crop',
      features: [
        'Indoor Heated Inflatable Geo-Dome with 360-degree temperature control',
        'Ultra-Wide Panoramic LED Screen with multi-camera match angles',
        'Caribbean & South Asian Street Food Stalls & Spiced Winter Drinks',
        'Youth Tape-Ball Indoor Coaching Clinics with international coaches',
        'Digital Gaming & Esports Lounge with Cricket 24 tournaments'
      ],
      amenities: [
        'Spacious Free Onsite Parking',
        'Heated Indoor Tiered Bleachers',
        'Indoor Practice Turf Cage',
        'Merchandise & Winter Gear Desk'
      ],
      openHours: 'Weekends & Matchdays: 09:00 AM – 09:00 PM',
      liveMatchSchedule: 'Morning and midday UAE match broadcasts with Canadian community breakfast screenings',
      vipPassPriceAed: 150,
      vipPassPriceUsd: 40,
      vipPerks: [
        'Priority front-tier Dome seating with warm fleece blanket',
        'Jerk chicken roti or Canadian maple poutine combo with spiced cider',
        'Official ADT10 Winter Knit Beanie'
      ],
      merchBoutique: 'Winter cricket beanies, fleece hoodies, official team banners and flags',
      menuHighlights: 'Jerk chicken roti, Canadian poutine, Vegetable samosas, Hot spiced apple cider, Karak chai',
      totalBookings: 145
    }
  ];
}

function generateInitialYouthSchools(): YouthCupSchool[] {
  return [
    {
      id: 'school-1',
      name: 'Brighton College Abu Dhabi',
      region: 'UAE',
      city: 'Abu Dhabi',
      studentsCount: 380,
      tapeBallTeam: 'Brighton Blasters',
      status: 'bracket_qualified',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 50
    },
    {
      id: 'school-2',
      name: 'Dubai College Cricket Academy',
      region: 'UAE',
      city: 'Dubai',
      studentsCount: 420,
      tapeBallTeam: 'DC Strikers',
      status: 'champion',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 75
    },
    {
      id: 'school-3',
      name: 'The British School Al Khubairat',
      region: 'UAE',
      city: 'Abu Dhabi',
      studentsCount: 310,
      tapeBallTeam: 'Khubairat Kings',
      status: 'bracket_qualified',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 40
    },
    {
      id: 'school-4',
      name: 'GEMS Modern Academy',
      region: 'UAE',
      city: 'Dubai',
      studentsCount: 550,
      tapeBallTeam: 'GEMS Gladiators',
      status: 'registered',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 60
    },
    {
      id: 'school-5',
      name: 'Whitgift School Cricket Club',
      region: 'UK',
      city: 'London',
      studentsCount: 290,
      tapeBallTeam: 'Whitgift Warriors',
      status: 'bracket_qualified',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 30
    },
    {
      id: 'school-6',
      name: 'Harrow School Cricket XI',
      region: 'UK',
      city: 'London',
      studentsCount: 260,
      tapeBallTeam: 'Harrow Hurricanes',
      status: 'registered',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 25
    },
    {
      id: 'school-7',
      name: 'Eton College Cricket Society',
      region: 'UK',
      city: 'Windsor',
      studentsCount: 220,
      tapeBallTeam: 'Eton Eagles',
      status: 'registered',
      equipmentKitGranted: false,
      matchdayTicketsAllocated: 20
    },
    {
      id: 'school-8',
      name: 'Sharjah English School',
      region: 'UAE',
      city: 'Sharjah',
      studentsCount: 280,
      tapeBallTeam: 'Sharjah Scorpions',
      status: 'registered',
      equipmentKitGranted: true,
      matchdayTicketsAllocated: 35
    }
  ];
}

function generateInitialCreatorPartners(): CreatorPartner[] {
  return [
    {
      id: 'creator-1',
      name: 'Tanmay Bhat Live',
      handle: '@TanmayBhatCricket',
      platform: 'YouTube',
      followers: '4.8M',
      streamUrl: 'https://youtube.com',
      specialty: 'Comedy & Live Watch-Along Reactions',
      status: 'live',
      totalWatchViews: '8.4M',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 'creator-2',
      name: 'CricCrazy Johns Stream',
      handle: '@CricCrazyJohns',
      platform: 'YouTube',
      followers: '1.2M',
      streamUrl: 'https://youtube.com',
      specialty: 'In-Depth Ball-by-Ball Analysis & Tactics',
      status: 'scheduled',
      totalWatchViews: '5.2M',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 'creator-3',
      name: 'Tubbo Cricket Gaming',
      handle: '@TubboLive',
      platform: 'Twitch',
      followers: '5.1M',
      streamUrl: 'https://twitch.tv',
      specialty: 'Gaming, Cricket 24 & Second-Screen Streaming',
      status: 'live',
      totalWatchViews: '12.8M',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 'creator-4',
      name: 'Waqas Cricket Vlog',
      handle: '@WaqasT10Exclusive',
      platform: 'TikTok',
      followers: '2.4M',
      streamUrl: 'https://tiktok.com',
      specialty: 'Behind-the-scenes Dugout Shorts & Player Interviews',
      status: 'partnered',
      totalWatchViews: '9.6M',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop'
    },
    {
      id: 'creator-5',
      name: 'BBC Stumped Audio Watch',
      handle: '@BBCStumped',
      platform: 'YouTube',
      followers: '850K',
      streamUrl: 'https://youtube.com',
      specialty: 'UK & Global Diaspora Fan Debate',
      status: 'scheduled',
      totalWatchViews: '3.1M',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop'
    }
  ];
}

function generateInitialCommentaryFeeds(): CommentaryAudioFeed[] {
  return [
    {
      id: 'audio-ar',
      language: 'Arabic',
      commentator: 'Tariq Al-Hammadi (Abu Dhabi Sports)',
      status: 'live',
      sampleAudioText: 'يا له من تسديدة رائعة! ست نقاط ساحقة في سماء ملعب زايد للكريكت من معين علي!',
      bitrate: '128 kbps AAC',
      listenersCount: 4210
    },
    {
      id: 'audio-en',
      language: 'English',
      commentator: 'Danny Morrison & Nasser Hussain',
      status: 'live',
      sampleAudioText: 'BANG! Into the orbit! That has disappeared over deep mid-wicket into the Yas Marina twilight!',
      bitrate: '192 kbps AAC',
      listenersCount: 18450
    },
    {
      id: 'audio-hi',
      language: 'Hindi',
      commentator: 'Aakash Chopra & Vivek Razdan',
      status: 'live',
      sampleAudioText: 'गेंद हवा में और दर्शक बने फील्डर! छह रनों के लिए गेंद बाउंड्री लाइन के उस पार!',
      bitrate: '192 kbps AAC',
      listenersCount: 26300
    },
    {
      id: 'audio-ur',
      language: 'Urdu',
      commentator: 'Bazid Khan & Sikandar Bakht',
      status: 'live',
      sampleAudioText: 'خوبصورت شاٹ! مڈ وکٹ کے اوپر سے زبردست چھکا، گیند اسٹیڈیم کی چھت پر جا گری!',
      bitrate: '128 kbps AAC',
      listenersCount: 14800
    },
    {
      id: 'audio-bn',
      language: 'Bengali',
      commentator: 'Athar Ali Khan',
      status: 'live',
      sampleAudioText: 'দারুণ শট! সীমানা ছাড়িয়ে বল গিয়ে পড়ল সরাসরি দর্শকদের মাঝে!',
      bitrate: '128 kbps AAC',
      listenersCount: 7920
    }
  ];
}

function generateInitialPassportTiers(): SuperfanPassportTier[] {
  return [
    {
      id: 'passport-tier-official',
      tierName: 'ADT10 Superfan Digital Passport',
      annualFeeUsd: 10,
      annualFeeAed: 37,
      ticketDiscountPct: 15,
      fanSpacePriorityEntry: true,
      exclusiveBadge: 'Superfan Gold Passport',
      doublePointsMultiplier: true,
      totalSubscribers: 38000
    }
  ];
}

export function generateInitialProposalSettings(): ProposalSettings {
  const USD_TO_AED = 3.6725;
  const activities: ProposalActivity[] = [
    {
      id: 'activity-web',
      number: 1,
      title: 'Centralized League & Franchise Fan Web Platform & PWA',
      tag: 'Digital Core',
      need: 'Current league and franchise web presence is fragmented across temporary event micro-sites, leading to an 87% fan drop-off between annual 2-week tournament cycles. Fans have no single persistent home for live scores, squads, tickets, and team engagement.',
      relevance: 'T10’s 90-minute format is the most fast-paced, digital-native spectacle in sports. Digital-first Gen-Z audiences expect instant load times, live ball-by-ball simulated telemetry, mobile responsiveness, and continuous 365-day access.',
      what: 'Build and deploy a unified official Abu Dhabi T10 League & 9-Franchise web ecosystem as a Progressive Web App (PWA). Includes automated match schedules, real-time ball-by-ball live tickers, dynamic player & squad dossiers, unified ticketing portal, and automated multilingual content feeds.',
      usdCost: 165000,
      aedCost: Math.round(165000 * USD_TO_AED),
      capexUsd: 110000,
      opexUsd: 55000,
      timeline: 'Months 1-3 (Launch before Season Opener)',
      outcome: 'A world-class digital flagship delivering sub-second load times globally, capturing 750,000+ registered fan accounts in Year 1, and establishing a unified first-party fan data pipeline (CDP).',
      kpis: ['750K+ Registered Users', '4.2M Monthly Page Views', '4.8m Avg Session Duration', 'Sub-800ms Global PWA Latency'],
      franchiseBenefit: 'Direct branded digital home for Arabian Aces and all 8 partner franchises with dedicated sponsor inventory.',
      leagueBenefit: 'Full ownership of first-party fan customer data, increasing media rights valuation by 25%.'
    },
    {
      id: 'activity-forum',
      number: 2,
      title: 'Community Discussion Forum & Real-Time Discourse Engine',
      tag: 'Fan Community',
      need: 'Cricket fans express their passion through passionate tactical debate, match reviews, and player rivalries. In the absence of an official moderated league forum, discussions scatter across Reddit, generic social media, or vanish entirely.',
      relevance: 'Fostering fan community discourse transforms passive broadcast viewers into emotionally invested league brand advocates. Fans build friendships, rivalries, and community identity around franchises.',
      what: 'Deploy an integrated, high-performance community forum where fans can open new discussion threads, post comments, upvote analysis, debate tactical lineups, tag specific franchises, and earn fan points and badges for insightful contributions.',
      usdCost: 45000,
      aedCost: Math.round(45000 * USD_TO_AED),
      capexUsd: 25000,
      opexUsd: 20000,
      timeline: 'Months 2-4 (Pre-Season Buzz & Tourney Active)',
      outcome: 'An active 24/7 fan dialogue hub generating over 65,000 organic discussion threads and 250,000 fan comments per season, driving peer-to-peer viral engagement.',
      kpis: ['65K+ Discussion Threads', '250K+ Community Comments', '38% Monthly Retention Uplift', 'Zero Toxicity via AI Auto-Moderation'],
      franchiseBenefit: 'Exclusive franchise-only fan sub-forums enabling direct team-to-fan Q&As with coaches and players.',
      leagueBenefit: 'Continuous real-time fan sentiment intelligence informing tournament rules and match timings.'
    },
    {
      id: 'activity-competitions',
      number: 3,
      title: 'Gamification Suite: Match Predictors, Trivia & Daily Streaks',
      tag: 'Engagement & Retention',
      need: 'Broadcast sports face a critical battle against short attention spans. Without gamified incentives, fans multi-task on competing entertainment apps during overs and innings breaks.',
      relevance: 'The T10 format generates boundaries on average every 3.2 deliveries, creating frequent high-intensity micro-events ideal for second-screen prediction challenges and boundary betting contests.',
      what: 'A dynamic gamification engine featuring ball-by-ball & match prediction contests, boundary over/under challenges, historical T10 trivia battles, daily check-in streak multipliers (up to 5x), and seasonal fan leaderboards.',
      usdCost: 55000,
      aedCost: Math.round(55000 * USD_TO_AED),
      capexUsd: 35000,
      opexUsd: 20000,
      timeline: 'Months 2-3 (Pre-Season Launch)',
      outcome: 'Triple daily active usage (DAU) across match days, with 60%+ of active users making at least 3 predictions per match, generating 3.5M prediction interactions per tournament.',
      kpis: ['62% Matchday Participation Rate', '3.5M Total Predictions Logged', '45% 7-Day Daily Streak Retention', 'Sponsored Predictor Partner Packages'],
      franchiseBenefit: 'Franchise Fan Wars leaderboard where fan contest points directly elevate their supported team ranking.',
      leagueBenefit: 'Premium commercial inventory: Title sponsorship of Predictor Challenge sold to fintech/telecom partners.'
    },
    {
      id: 'activity-dreamteam',
      number: 4,
      title: '“Dream Team” (Fantasy 10) Squad Architect & Private Leagues',
      tag: 'Fantasy Sports',
      need: 'Fantasy cricket is the #1 driver of deep player familiarity and match viewership worldwide. Traditional fantasy formats take hours; T10 requires a fast, 90-minute optimized 6-player draft.',
      relevance: 'Fans who play fantasy cricket watch 2.4x more overs on television and OTT platforms to monitor their fantasy captain and drafted bowlers in real time.',
      what: 'Build a proprietary "Fantasy 10" squad builder: fans draft a 6-player squad under a strict 55-credit cap, assign a captain (2x multiplier), compete in private friends leagues, and win official franchise rewards.',
      usdCost: 65000,
      aedCost: Math.round(65000 * USD_TO_AED),
      capexUsd: 45000,
      opexUsd: 20000,
      timeline: 'Months 2-4 (Integrated with Live Data Feed)',
      outcome: '300,000+ created Fantasy 10 lineups per season, driving measurable 40%+ increases in linear and digital broadcast watch-time per registered fan.',
      kpis: ['300K+ Fantasy Lineups Created', '12K+ Private Fan Leagues Formed', '2.4x Increase in Broadcast Watch Time', 'Monetized Co-Branded Fantasy Title Sponsor'],
      franchiseBenefit: 'Heightened fan loyalty to individual franchise players (e.g. Moeen Ali, Alex Hales, Nicholas Pooran).',
      leagueBenefit: 'Direct commercial partnership opportunity with global gaming, telecom, or payment partners.'
    },
    {
      id: 'activity-giveaways',
      number: 5,
      title: 'Provably Fair VIP Giveaways & Enclosure Hospitality Passes',
      tag: 'VIP Rewards',
      need: 'Traditional sports sweepstakes are often perceived by fans as non-transparent, untrustworthy, or rigged for influencers, dampening contest participation.',
      relevance: 'Abu Dhabi is globally renowned for luxury, hospitality, and cutting-edge tech. Demonstrating transparent, provably fair mechanics builds profound credibility and aspiration.',
      what: 'A cryptographic SHA-256 verifiable prize draw system offering once-in-a-lifetime experiences: President Box VIP hospitality tickets at Zayed Cricket Stadium, player dugout walks, signed bats, and official team merchandise.',
      usdCost: 120000,
      aedCost: Math.round(120000 * USD_TO_AED),
      capexUsd: 20000,
      opexUsd: 100000,
      timeline: 'Throughout Season & Pre-Tournament',
      outcome: 'Unrivaled fan excitement and viral social sharing, capturing 150,000+ verified giveaway entries and cultivating deep emotional loyalty to Abu Dhabi as the destination of cricket.',
      kpis: ['150K+ Verified Draw Entrants', '100% Cryptographic Audit Trail', '50+ VIP Hospitality Winners Hosted', 'Over 80K User Generated Social Shares'],
      franchiseBenefit: 'Franchises receive allocated VIP dugout guest slots for their top community Superfans.',
      leagueBenefit: 'Positions Abu Dhabi T10 as the most generous and transparent fan-centric league in international sports.'
    },
    {
      id: 'activity-livecenter',
      number: 6,
      title: 'Unified Multi-Team Live Center, Telemetry & Watch Aggregator',
      tag: 'Broadcast Hub',
      need: 'Fans cannot always access linear television feeds across different international broadcast jurisdictions, leading to frustration and pirated illicit streams.',
      relevance: 'Providing a verified centralized hub for ball-by-ball simulated telemetry, official YouTube live press conferences, and synchronized watch parties bridges the broadcast gap.',
      what: 'A centralized multi-match live center embedding official YouTube live streams, pre-match press conferences, player dugout cams, real-time ball-by-ball radar charts, wagon wheels, and live match simulation triggers.',
      usdCost: 60000,
      aedCost: Math.round(60000 * USD_TO_AED),
      capexUsd: 35000,
      opexUsd: 25000,
      timeline: 'Months 2-3 (Live for all 34 tournament fixtures)',
      outcome: '12M+ live telemetry impressions, keeping international fans tethered to the match state even when on mobile or without a TV screen.',
      kpis: ['12M+ Live Scorecard Interactions', '99.98% Telemetry Uptime', 'Over 1.8M YouTube Watch Party Embed Views', 'Real-time Sub-Second Latency'],
      franchiseBenefit: 'Franchises can broadcast team training and behind-the-scenes warmups directly to their fans.',
      leagueBenefit: 'Increases official digital video consumption metrics for OTT and broadcast pitch decks.'
    },
    {
      id: 'activity-socialcurator',
      number: 7,
      title: 'Consolidated Team Social Wall & Cross-Franchise Curator',
      tag: 'Media Aggregator',
      need: 'Fans currently must follow 9 separate Twitter/X accounts, 9 Instagram pages, and 9 YouTube channels, causing fragmented information discovery.',
      relevance: 'Aggregating verified official posts into a singular, high-octane social wall creates a unified "league energy" and lets fans compare teams side-by-side.',
      what: 'Deploy a Curator.io-style multi-platform social aggregator crawling verified team handles across X, Instagram, TikTok, YouTube, Threads, and RSS feeds with auto-curation and admin verification safeguards.',
      usdCost: 35000,
      aedCost: Math.round(35000 * USD_TO_AED),
      capexUsd: 15000,
      opexUsd: 20000,
      timeline: 'Month 1 (Immediate Deployment)',
      outcome: 'One-stop social destination delivering 25,000+ curated multimedia impressions daily, boosting cross-pollination across franchise fanbases.',
      kpis: ['Top 5 Verified Posts / Platform / Team', 'Real-Time Synchronized Feed Updates', '15K Daily Social Wall Views', 'Brand Safety Filter Enforced'],
      franchiseBenefit: 'Smaller or newer franchises gain direct exposure to the collective league fanbase.',
      leagueBenefit: 'Reinforces the ADT10 brand identity as a cohesive international powerhouse.'
    },
    {
      id: 'activity-fanspaces',
      number: 8,
      title: 'Global Physical Fan Spaces & Experiential Clubhouses',
      tag: 'Physical Experiential',
      need: 'Over 80% of ADT10 fans live outside Abu Dhabi (in India, UK, Pakistan, Canada, and the GCC). A tournament restricted solely to the stadium pitch in Abu Dhabi misses the massive global diaspora craving communal match experiences.',
      relevance: 'Sports entertainment brands like the NBA, Premier League, and Formula 1 thrive by building physical experiential lounges in premier metropolitan hubs, creating physical touchpoints that drive merchandise and lifelong fan loyalty.',
      what: 'Design, launch, and operate 5 flagship & pop-up physical "ADT10 Global Fan Clubhouses" in key cricket capital cities: 1) Abu Dhabi (Yas Island / Zayed Stadium precinct), 2) Dubai (Marina / Downtown), 3) London (Regent St / Lord’s precinct pop-up), 4) Mumbai (Bandra Kurla Complex), and 5) Toronto (Brampton / Mississauga). Features include: 360-degree high-definition LED match watch arena, VR Batting Simulator cages against 140km/h T10 bowling, official franchise pop-up merchandise retail, Arabic hospitality barista lounge, and live meetups with team ambassadors & cricket legends.',
      usdCost: 480000,
      aedCost: Math.round(480000 * USD_TO_AED),
      capexUsd: 320000,
      opexUsd: 160000,
      timeline: 'Phased: Abu Dhabi & Dubai (Season 1), London, Mumbai & Toronto (Season 1 Finals & Year 2)',
      outcome: '45,000+ in-person visitors during the tournament cycle, generating $320,000 in official merchandise & F&B sales, and commanding massive local media coverage in the UK, India, UAE, and North America.',
      kpis: ['45K+ In-Person Attendees Across 5 Cities', '15K+ VR Batting Cages Experiences', '$320K+ Direct Retail Merchandise Revenue', 'Over 120 Local Media News Features'],
      franchiseBenefit: 'Direct physical merchandise sales booths for Arabian Aces and all franchise teams in London and Mumbai.',
      leagueBenefit: 'Elevates ADT10 into a physical global lifestyle and sports brand competing directly with F1 and NBA global lounges.'
    },
    {
      id: 'activity-nextgen',
      number: 9,
      title: 'Next-Gen Growth Catalysts: Grassroots Youth Cup & Creator Studio',
      tag: 'Future Growth',
      need: 'Building sustainable multi-generational fan bases requires reaching younger demographics (ages 12-24) through school participation and digital native influencers.',
      relevance: 'Cricket fandom is passed down through youth play and creator culture. Twitch, YouTube, and TikTok content creators drive 60%+ of youth sports discovery.',
      what: 'Launch two high-impact growth programs: 1) "ADT10 School & Grassroots Cup" in UAE and UK schools with 10-over tape-ball tournaments awarding youth cricket equipment and stadium tickets. 2) "ADT10 Global Creator Studio", partnering with 50 top cricket YouTubers & streamers for live watch-along broadcasts and viral trick-shot challenges.',
      usdCost: 140000,
      aedCost: Math.round(140000 * USD_TO_AED),
      capexUsd: 40000,
      opexUsd: 100000,
      timeline: 'Months 3-6 (Rolling Campaign)',
      outcome: 'Direct engagement of 120+ schools, 25,000+ student participants, and 45M+ cross-platform views via creator watch-alongs.',
      kpis: ['120+ Participating Schools & Academies', '50+ Creator Studio Influencers', '45M+ Creator Watch-Along Views', '15K+ New Youth Fan Registrations'],
      franchiseBenefit: 'Scouting pipeline of emerging local UAE and international youth talent for developmental squad slots.',
      leagueBenefit: 'Establishes authentic goodwill, CSR community impact, and deep brand resonance with future generations.'
    }
  ];

  return {
    exchangeRateUsdToAed: USD_TO_AED,
    revenueStreams: {
      predictorSponsorshipUsd: 450000,
      fantasySponsorshipUsd: 350000,
      fanSpacesNamingRightsUsd: 650000,
      merchAndFbUsd: 370000,
      superfanPassportUsers: 38000,
      superfanPassportFeeUsd: 10
    },
    activities,
    updatedAt: new Date().toISOString()
  };
}

function generateInitialStore(): AppStore {
  const teamsData: Team[] = [
    {
      id: 'aces',
      name: 'Arabian Aces',
      short: 'AAC',
      color: '#E8B04A',
      secondaryColor: '#1E293B',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Moeen Ali',
      headCoach: 'Lance Klusener',
      website: 'https://arabianaces.com',
      note: 'Dynamic 2026 Abu Dhabi T10 Franchise. Powerful explosive hitters & tactical mastery.',
      sort: 1,
      squad: [
        { id: 'aces-moeen', teamId: 'aces', name: 'Moeen Ali', role: 'allrounder', credits: 10.5, isIcon: true },
        { id: 'aces-alex-hales', teamId: 'aces', name: 'Alex Hales', role: 'batter', credits: 9.5, isIcon: false },
        { id: 'aces-sherfane-rutherford', teamId: 'aces', name: 'Sherfane Rutherford', role: 'batter', credits: 9.0, isIcon: false },
        { id: 'aces-chris-jordan', teamId: 'aces', name: 'Chris Jordan', role: 'bowler', credits: 9.0, isIcon: false },
        { id: 'aces-rahmanullah-gurbaz', teamId: 'aces', name: 'Rahmanullah Gurbaz', role: 'wicketkeeper', credits: 9.0, isIcon: false },
        { id: 'aces-azmatullah-omarzai', teamId: 'aces', name: 'Azmatullah Omarzai', role: 'allrounder', credits: 8.5, isIcon: false },
        { id: 'aces-george-scrimshaw', teamId: 'aces', name: 'George Scrimshaw', role: 'bowler', credits: 8.0, isIcon: false },
        { id: 'aces-ali-naseer', teamId: 'aces', name: 'Ali Naseer', role: 'allrounder', credits: 7.5, isIcon: false },
      ]
    },
    {
      id: 'deccan',
      name: 'Deccan Gladiators',
      short: 'DG',
      color: '#E85A6B',
      secondaryColor: '#0F172A',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Nicholas Pooran',
      website: 'https://deccangladiators.com',
      note: 'Defending powerhouse and multiple-time Abu Dhabi T10 champions.',
      sort: 2,
      squad: [
        { id: 'deccan-pooran', teamId: 'deccan', name: 'Nicholas Pooran', role: 'wicketkeeper', credits: 10.5, isIcon: true },
        { id: 'deccan-stoinis', teamId: 'deccan', name: 'Marcus Stoinis', role: 'allrounder', credits: 9.5, isIcon: false },
        { id: 'deccan-russell', teamId: 'deccan', name: 'Andre Russell', role: 'allrounder', credits: 9.5, isIcon: false },
        { id: 'deccan-hosein', teamId: 'deccan', name: 'Akeal Hosein', role: 'bowler', credits: 9.0, isIcon: false },
        { id: 'deccan-cadmore', teamId: 'deccan', name: 'Tom Kohler-Cadmore', role: 'batter', credits: 8.5, isIcon: false },
        { id: 'deccan-gleeson', teamId: 'deccan', name: 'Richard Gleeson', role: 'bowler', credits: 8.0, isIcon: false },
      ]
    },
    {
      id: 'bulls',
      name: 'UAE Bulls',
      short: 'UB',
      color: '#38BDF8',
      secondaryColor: '#0C4A6E',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Rovman Powell',
      website: 'https://delhibullst10.com',
      note: '2025 Abu Dhabi T10 Champions with relentless firepower.',
      sort: 3,
      squad: [
        { id: 'bulls-powell', teamId: 'bulls', name: 'Rovman Powell', role: 'batter', credits: 10.5, isIcon: true },
        { id: 'bulls-salt', teamId: 'bulls', name: 'Phil Salt', role: 'wicketkeeper', credits: 9.5, isIcon: false },
        { id: 'bulls-pollard', teamId: 'bulls', name: 'Kieron Pollard', role: 'allrounder', credits: 9.0, isIcon: false },
        { id: 'bulls-david', teamId: 'bulls', name: 'Tim David', role: 'batter', credits: 9.0, isIcon: false },
        { id: 'bulls-narine', teamId: 'bulls', name: 'Sunil Narine', role: 'bowler', credits: 9.0, isIcon: false },
        { id: 'bulls-farooqi', teamId: 'bulls', name: 'Fazalhaq Farooqi', role: 'bowler', credits: 8.5, isIcon: false },
      ]
    },
    {
      id: 'warriors',
      name: 'Northern Warriors',
      short: 'NW',
      color: '#10B981',
      secondaryColor: '#064E3B',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Shimron Hetmyer',
      note: 'Two-time champions known for Caribbean flair.',
      sort: 4,
      squad: [
        { id: 'warriors-hetmyer', teamId: 'warriors', name: 'Shimron Hetmyer', role: 'batter', credits: 10.5, isIcon: true },
        { id: 'warriors-boult', teamId: 'warriors', name: 'Trent Boult', role: 'bowler', credits: 9.5, isIcon: false },
        { id: 'warriors-charles', teamId: 'warriors', name: 'Johnson Charles', role: 'wicketkeeper', credits: 9.0, isIcon: false },
        { id: 'warriors-shamsi', teamId: 'warriors', name: 'Tabraiz Shamsi', role: 'bowler', credits: 8.5, isIcon: false },
      ]
    },
    {
      id: 'qavalry',
      name: 'Quetta Qavalry',
      short: 'QQ',
      color: '#A855F7',
      secondaryColor: '#581C87',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Liam Livingstone',
      note: 'High octane power hitters and aggressive spinners.',
      sort: 5,
      squad: [
        { id: 'qavalry-livingstone', teamId: 'qavalry', name: 'Liam Livingstone', role: 'allrounder', credits: 10.5, isIcon: true },
        { id: 'qavalry-holder', teamId: 'qavalry', name: 'Jason Holder', role: 'allrounder', credits: 9.5, isIcon: false },
        { id: 'qavalry-amir', teamId: 'qavalry', name: 'Mohammad Amir', role: 'bowler', credits: 9.0, isIcon: false },
        { id: 'qavalry-raza', teamId: 'qavalry', name: 'Sikandar Raza', role: 'allrounder', credits: 9.0, isIcon: false },
      ]
    },
    {
      id: 'champs',
      name: 'Royal Champs',
      short: 'RC',
      color: '#F97316',
      secondaryColor: '#7C2D12',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Jason Roy',
      note: 'Aggressive opening partnerships and experienced pace bowling.',
      sort: 6,
      squad: [
        { id: 'champs-roy', teamId: 'champs', name: 'Jason Roy', role: 'batter', credits: 10.5, isIcon: true },
        { id: 'champs-mathews', teamId: 'champs', name: 'Angelo Mathews', role: 'allrounder', credits: 9.0, isIcon: false },
        { id: 'champs-sams', teamId: 'champs', name: 'Daniel Sams', role: 'allrounder', credits: 9.0, isIcon: false },
      ]
    },
    {
      id: 'riders',
      name: 'Vista Riders',
      short: 'VR',
      color: '#06B6D4',
      secondaryColor: '#164E63',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Faf du Plessis',
      note: 'Master tacticians with exceptional fielding unit.',
      sort: 7,
      squad: [
        { id: 'riders-faf', teamId: 'riders', name: 'Faf du Plessis', role: 'batter', credits: 10.5, isIcon: true },
        { id: 'riders-wade', teamId: 'riders', name: 'Matthew Wade', role: 'wicketkeeper', credits: 9.5, isIcon: false },
        { id: 'riders-pretorius', teamId: 'riders', name: 'Dwaine Pretorius', role: 'allrounder', credits: 9.0, isIcon: false },
      ]
    },
    {
      id: 'ajman',
      name: 'Ajman Titans',
      short: 'AJT',
      color: '#94A3B8',
      secondaryColor: '#334155',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Rilee Rossouw',
      note: 'Dangerous southpaw hitters and lethal death bowling.',
      sort: 8,
      squad: [
        { id: 'ajman-rossouw', teamId: 'ajman', name: 'Rilee Rossouw', role: 'batter', credits: 10.5, isIcon: true },
        { id: 'ajman-lawrence', teamId: 'ajman', name: 'Dan Lawrence', role: 'allrounder', credits: 9.0, isIcon: false },
        { id: 'ajman-behrendorff', teamId: 'ajman', name: 'Jason Behrendorff', role: 'bowler', credits: 8.5, isIcon: false },
      ]
    },
    {
      id: 'stallions',
      name: 'Aspin Stallions',
      short: 'ASP',
      color: '#EC4899',
      secondaryColor: '#831843',
      home: 'Zayed Cricket Stadium, Abu Dhabi',
      iconPlayer: 'Sam Billings',
      note: 'Dynamic 360-degree stroke makers.',
      sort: 9,
      squad: [
        { id: 'stallions-billings', teamId: 'stallions', name: 'Sam Billings', role: 'wicketkeeper', credits: 10.5, isIcon: true },
        { id: 'stallions-mills', teamId: 'stallions', name: 'Tymal Mills', role: 'bowler', credits: 9.0, isIcon: false },
        { id: 'stallions-fletcher', teamId: 'stallions', name: 'Andre Fletcher', role: 'batter', credits: 8.5, isIcon: false },
      ]
    }
  ];

  const handlesData: SocialHandle[] = [
    // League Official Handles
    {
      id: 'h-league-yt',
      teamId: null,
      platform: 'YouTube',
      handle: '@T10LeagueOfficial',
      url: 'https://www.youtube.com/@T10LeagueOfficial',
      status: 'verified',
      source: 'official',
      meta: { channelId: 'UCe_V2hJ7lQh8q-tH0Z0J0w' },
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-league-x',
      teamId: null,
      platform: 'X',
      handle: '@T10League',
      url: 'https://x.com/T10League',
      status: 'verified',
      source: 'official',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-league-ig',
      teamId: null,
      platform: 'Instagram',
      handle: '@t10league',
      url: 'https://www.instagram.com/t10league/',
      status: 'verified',
      source: 'official',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-league-fb',
      teamId: null,
      platform: 'Facebook',
      handle: 'T10league',
      url: 'https://www.facebook.com/T10league',
      status: 'verified',
      source: 'official',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-league-tiktok',
      teamId: null,
      platform: 'TikTok',
      handle: '@abudhabit10',
      url: 'https://www.tiktok.com/@abudhabit10',
      status: 'verified',
      source: 'official',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },

    // Arabian Aces Official Handles (User's team!)
    {
      id: 'h-aces-x',
      teamId: 'aces',
      platform: 'X',
      handle: '@arabianacesT10',
      url: 'https://x.com/arabianacesT10',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-aces-linkedin',
      teamId: 'aces',
      platform: 'LinkedIn',
      handle: 'arabianaces',
      url: 'https://www.linkedin.com/in/arabianaces/',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-aces-ig',
      teamId: 'aces',
      platform: 'Instagram',
      handle: '@arabianacesofficial',
      url: 'https://www.instagram.com/arabianacesofficial',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-aces-threads',
      teamId: 'aces',
      platform: 'Threads',
      handle: '@arabianacesofficial',
      url: 'https://www.threads.com/@arabianacesofficial',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-aces-fb',
      teamId: 'aces',
      platform: 'Facebook',
      handle: 'arabianacesofficial',
      url: 'https://www.facebook.com/arabianacesofficial/',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-aces-tiktok',
      teamId: 'aces',
      platform: 'TikTok',
      handle: '@arabianaces',
      url: 'https://www.tiktok.com/@arabianaces',
      status: 'verified',
      source: 'owner',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },

    // Other Team Handles
    {
      id: 'h-deccan-ig',
      teamId: 'deccan',
      platform: 'Instagram',
      handle: '@deccangladiators',
      url: 'https://www.instagram.com/deccangladiators/',
      status: 'verified',
      source: 'seed',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-deccan-x',
      teamId: 'deccan',
      platform: 'X',
      handle: '@TeamDGladiators',
      url: 'https://x.com/TeamDGladiators',
      status: 'verified',
      source: 'seed',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-warriors-ig',
      teamId: 'warriors',
      platform: 'Instagram',
      handle: '@northernwarriorst10',
      url: 'https://www.instagram.com/northernwarriorst10/',
      status: 'verified',
      source: 'seed',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    },
    {
      id: 'h-bulls-ig',
      teamId: 'bulls',
      platform: 'Instagram',
      handle: '@delhibullst10',
      url: 'https://www.instagram.com/delhibullst10/',
      status: 'verified',
      source: 'seed',
      meta: {},
      verifiedAt: new Date().toISOString(),
      foundAt: new Date().toISOString()
    }
  ];

  const feedItemsData: FeedItem[] = [
    // YouTube Video / Live feeds
    {
      id: 'feed-yt-1',
      teamId: 'aces',
      platform: 'YouTube',
      kind: 'live',
      category: 'social',
      title: 'LIVE: Arabian Aces Abu Dhabi T10 Pre-Season Training Camp & Lance Klusener Press Conference',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
      source: '@T10LeagueOfficial',
      summary: 'Head Coach Lance Klusener and icon captain Moeen Ali outline the aggressive gameplay and tactical depth for the 2026 Abu Dhabi T10.',
      status: 'pinned',
      publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      views: '18.4K live viewers'
    },
    {
      id: 'feed-yt-2',
      teamId: null,
      platform: 'YouTube',
      kind: 'video',
      category: 'social',
      title: 'Abu Dhabi T10 Season 2026 Official Launch | Zayed Cricket Stadium',
      url: 'https://www.youtube.com/watch?v=3JZ_D3ELwOQ',
      image: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=800&auto=format&fit=crop',
      source: '@T10LeagueOfficial',
      summary: '9 franchises, 90-minute spectacles, world-class superstars ready to clash under the lights in Abu Dhabi.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      createdAt: new Date().toISOString(),
      views: '42K views'
    },
    {
      id: 'feed-yt-3',
      teamId: 'aces',
      platform: 'YouTube',
      kind: 'video',
      category: 'social',
      title: 'Moeen Ali: "We are building an explosive culture at Arabian Aces" | Exclusive Interview',
      url: 'https://www.youtube.com/watch?v=21X5lGlDOfg',
      image: 'https://images.unsplash.com/photo-1512719355433-ebe3b5325c77?q=80&w=800&auto=format&fit=crop',
      source: '@arabianacesofficial',
      summary: 'Icon player Moeen Ali discusses the team vision, draft strategy, and what UAE cricket fans can look forward to.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
      createdAt: new Date().toISOString(),
      views: '12.8K views'
    },

    // X (Twitter) Posts
    {
      id: 'feed-x-1',
      teamId: 'aces',
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: 'The desert roars! 🔥 Meet the Arabian Aces powerhouse lineup. Ready to redefine T10 cricket at Zayed Stadium! #ArabianAces #AbuDhabiT10 #AcesRising',
      url: 'https://x.com/arabianacesT10/status/188810001',
      source: '@arabianacesT10',
      summary: 'Official franchise announcement with iconic gold & black kit preview.',
      status: 'pinned',
      publishedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 1240
    },
    {
      id: 'feed-x-2',
      teamId: 'aces',
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: 'Tactics in motion. Head coach Lance Klusener on the training paddock today: "Every single ball is a scoring opportunity in 10 overs." 🏏⚡',
      url: 'https://x.com/arabianacesT10/status/188810002',
      source: '@arabianacesT10',
      summary: 'Intensive drills underway for the upcoming clash with Deccan Gladiators.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 856
    },
    {
      id: 'feed-x-3',
      teamId: null,
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: 'OFFICIAL: Tickets for Abu Dhabi T10 2026 are now live on Platinumlist! Catch 28 matches in 12 days. #AbuDhabiT10',
      url: 'https://x.com/T10League/status/188810003',
      source: '@T10League',
      summary: 'Grandstand and VIP hospitality tickets available now.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 3102
    },
    {
      id: 'feed-x-4',
      teamId: 'deccan',
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: 'Nicholas Pooran in the nets today clearing the Zayed Stadium roof! Can anyone stop the Gladiators this year? ⚔️',
      url: 'https://x.com/TeamDGladiators/status/188810004',
      source: '@TeamDGladiators',
      summary: 'Gladiators captain gearing up for the tournament opener.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 920
    },
    {
      id: 'feed-x-5',
      teamId: 'aces',
      platform: 'X',
      kind: 'post',
      category: 'social',
      title: 'Fan Contest Alert! 🏆 Predict our highest run scorer in Match 1 against Deccan Gladiators & win signed Arabian Aces merchandise! #AcesContest',
      url: 'https://x.com/arabianacesT10/status/188810005',
      source: '@arabianacesT10',
      summary: 'Fans can submit their entries on the official hub.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 1450
    },

    // Instagram Posts
    {
      id: 'feed-ig-1',
      teamId: 'aces',
      platform: 'Instagram',
      kind: 'post',
      category: 'social',
      title: 'Golden era unlocked. 🌟 Introducing the official 2026 Arabian Aces match kit. Designed for speed, power, and prestige in Abu Dhabi.',
      url: 'https://www.instagram.com/p/DF9Aces01/',
      image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
      source: '@arabianacesofficial',
      summary: 'Jersey launch featuring Moeen Ali and squad members.',
      status: 'pinned',
      publishedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 4210
    },
    {
      id: 'feed-ig-2',
      teamId: 'aces',
      platform: 'Instagram',
      kind: 'post',
      category: 'social',
      title: 'Behind the scenes at Zayed Cricket Stadium media day. The energy is unmatched! 🏟️✨',
      url: 'https://www.instagram.com/p/DF9Aces02/',
      image: 'https://images.unsplash.com/photo-1512719355433-ebe3b5325c77?q=80&w=800&auto=format&fit=crop',
      source: '@arabianacesofficial',
      summary: 'Exclusive locker room and media day photoshoot.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 2890
    },
    {
      id: 'feed-ig-3',
      teamId: null,
      platform: 'Instagram',
      kind: 'post',
      category: 'social',
      title: 'Fast. Fierce. Unforgiving. 90 minutes of pure cricketing adrenaline returns to Abu Dhabi! Are you ready?',
      url: 'https://www.instagram.com/p/DF9T1001/',
      image: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=800&auto=format&fit=crop',
      source: '@t10league',
      summary: 'League countdown promo clip highlighting top moments from previous seasons.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 8940
    },

    // Threads Posts
    {
      id: 'feed-th-1',
      teamId: 'aces',
      platform: 'Threads',
      kind: 'post',
      category: 'social',
      title: 'T10 cricket is not just a game; it is a test of ruthless intent from the very first ball. Who is your pick to hit the fastest fifty this year? ⚡',
      url: 'https://www.threads.com/@arabianacesofficial/post/1',
      source: '@arabianacesofficial',
      summary: 'Engaging fan discussion on batting tempo and boundary percentages.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 340
    },
    {
      id: 'feed-th-2',
      teamId: 'aces',
      platform: 'Threads',
      kind: 'post',
      category: 'social',
      title: 'Night cricket under the Abu Dhabi floodlights. There is honestly nothing quite like it in world sport. Come say hi at the fan booth! 🇦🇪',
      url: 'https://www.threads.com/@arabianacesofficial/post/2',
      source: '@arabianacesofficial',
      summary: 'Stadium atmosphere and fan activation updates.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 512
    },

    // Facebook Posts
    {
      id: 'feed-fb-1',
      teamId: 'aces',
      platform: 'Facebook',
      kind: 'post',
      category: 'social',
      title: 'Welcome to the official Facebook community of Arabian Aces! Head Coach Lance Klusener shares our roadmap to the championship trophy.',
      url: 'https://www.facebook.com/arabianacesofficial/posts/1001',
      image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
      source: 'arabianacesofficial',
      summary: 'Full video interview and franchise announcement for global supporters.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 1840
    },

    // TikTok Highlights
    {
      id: 'feed-tt-1',
      teamId: 'aces',
      platform: 'TikTok',
      kind: 'video',
      category: 'social',
      title: 'POV: Walking out to bat at Zayed Cricket Stadium with Arabian Aces 🔥🏏 #AbuDhabiT10 #CricketTok #ArabianAces',
      url: 'https://www.tiktok.com/@arabianaces/video/1',
      image: 'https://images.unsplash.com/photo-1512719355433-ebe3b5325c77?q=80&w=800&auto=format&fit=crop',
      source: '@arabianaces',
      summary: 'Immersive tunnel walkout with stadium sound and fireworks.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      createdAt: new Date().toISOString(),
      views: '54.2K'
    },
    {
      id: 'feed-tt-2',
      teamId: 'aces',
      platform: 'TikTok',
      kind: 'video',
      category: 'social',
      title: 'Six or Out? 150km/h yorker challenge in practice with George Scrimshaw 🎯',
      url: 'https://www.tiktok.com/@arabianaces/video/2',
      image: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=800&auto=format&fit=crop',
      source: '@arabianaces',
      summary: 'Death bowling target practice in high-speed slow motion.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
      createdAt: new Date().toISOString(),
      views: '38.9K'
    },

    // LinkedIn Posts (Franchise Business & Sponsorship)
    {
      id: 'feed-li-1',
      teamId: 'aces',
      platform: 'LinkedIn',
      kind: 'post',
      category: 'marketing',
      title: 'Pleased to announce Arabian Aces participation in the upcoming Abu Dhabi T10 season. Partnering with top sports technology and fan engagement leaders across the Middle East.',
      url: 'https://www.linkedin.com/in/arabianaces/',
      image: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=800&auto=format&fit=crop',
      source: 'arabianaces',
      summary: 'Franchise executive statement on sports business growth in the UAE.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
      createdAt: new Date().toISOString(),
      likes: 670
    },

    // Web / League News Articles
    {
      id: 'feed-news-1',
      teamId: null,
      platform: 'Web',
      kind: 'article',
      category: 'news',
      title: 'Abu Dhabi T10 2026: Record Global Broadcast Reach Across 110 Countries Confirmed',
      url: 'https://abudhabit10.com/news/broadcast-announcement-2026',
      image: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=800&auto=format&fit=crop',
      source: 'abudhabit10.com',
      summary: 'The league signs major international broadcast and digital streaming partnerships for the marquee season.',
      status: 'live',
      publishedAt: new Date(Date.now() - 1000 * 60 * 700).toISOString(),
      createdAt: new Date().toISOString()
    }
  ];

  const matchesData: Match[] = [
    {
      id: 'm-1',
      matchNo: 1,
      stage: 'Inaugural Blockbuster',
      teamA: 'aces',
      teamB: 'deccan',
      startsAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // currently LIVE
      venue: 'Zayed Cricket Stadium, Abu Dhabi',
      status: 'live',
      scoreA: '118/3',
      oversA: '10.0',
      scoreB: '84/2',
      oversB: '6.4',
      currentOver: '6.4 ov · Deccan need 35 off 20 balls',
      lastCommentary: 'SIX! Marcus Stoinis hammers a slower ball over mid-wicket into the second tier! What a contest!',
      totalSixes: 14,
      firstInnings: 118,
      topScorer: 'Alex Hales (54 off 21)',
      topWicketTaker: 'Chris Jordan (2/14)',
      isDemo: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'm-2',
      matchNo: 2,
      stage: 'Group Stage',
      teamA: 'bulls',
      teamB: 'warriors',
      startsAt: new Date(Date.now() + 1000 * 60 * 120).toISOString(), // upcoming today
      venue: 'Zayed Cricket Stadium, Abu Dhabi',
      status: 'upcoming',
      isDemo: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'm-3',
      matchNo: 3,
      stage: 'Group Stage',
      teamA: 'qavalry',
      teamB: 'champs',
      startsAt: new Date(Date.now() + 1000 * 60 * 360).toISOString(),
      venue: 'Zayed Cricket Stadium, Abu Dhabi',
      status: 'upcoming',
      isDemo: true,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'm-4',
      matchNo: 4,
      stage: 'Super Saturday',
      teamA: 'riders',
      teamB: 'ajman',
      startsAt: new Date(Date.now() + 1000 * 60 * 1440).toISOString(),
      venue: 'Zayed Cricket Stadium, Abu Dhabi',
      status: 'upcoming',
      isDemo: true,
      updatedAt: new Date().toISOString()
    }
  ];

  const contestsData: Contest[] = [
    {
      id: 'contest-m1-pred',
      type: 'predictor',
      title: 'Match 1 Predictor: Arabian Aces vs Deccan Gladiators',
      description: 'Call the winner and key match parameters to earn 150 points for your team in Fan Wars!',
      matchId: 'm-1',
      locksAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      status: 'open',
      prize: 'VIP Match Tickets & 150 Fan Points',
      questions: [
        {
          id: 'q1-winner',
          prompt: 'Who will triumph in this clash?',
          options: ['Arabian Aces', 'Deccan Gladiators'],
          points: 50
        },
        {
          id: 'q2-sixes',
          prompt: 'How many sixes will be hit in total in this 20-over encounter?',
          options: ['Under 12', '12 to 16', '17 to 20', '21+'],
          points: 50
        },
        {
          id: 'q3-topbat',
          prompt: 'Who will record the highest strike rate (min. 10 balls)?',
          options: ['Moeen Ali', 'Alex Hales', 'Nicholas Pooran', 'Marcus Stoinis'],
          points: 50
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'contest-six-machine',
      type: 'sixes',
      title: 'Six Machine Challenge: Arabian Aces Power-Hitter',
      description: 'Which Arabian Aces batter will clear the boundary the most times today?',
      matchId: 'm-1',
      status: 'open',
      prize: 'Signed Match Ball & 80 Fan Points',
      questions: [
        {
          id: 'q-six-player',
          prompt: 'Pick your designated Six Machine:',
          options: ['Moeen Ali', 'Alex Hales', 'Sherfane Rutherford', 'Rahmanullah Gurbaz'],
          points: 80
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'contest-season-oracle',
      type: 'season',
      title: 'Season Oracle 2026: The Master Prediction',
      description: 'Lock in your championship prophecy before the league table solidifies.',
      status: 'open',
      prize: 'All-Expenses Paid Hospitality Package for the Grand Final',
      questions: [
        {
          id: 'q-season-champ',
          prompt: 'Which franchise will lift the 2026 Abu Dhabi T10 trophy?',
          options: ['Arabian Aces', 'Deccan Gladiators', 'UAE Bulls', 'Northern Warriors', 'Quetta Qavalry', 'Royal Champs', 'Vista Riders'],
          points: 200
        },
        {
          id: 'q-season-150',
          prompt: 'Will any team score 160+ in 10 overs this season?',
          options: ['Yes - Fireworks guaranteed', 'No - Bowlers will hold firm'],
          points: 100
        }
      ],
      createdAt: new Date().toISOString()
    },
    {
      id: 'contest-history-trivia',
      type: 'trivia',
      title: 'Abu Dhabi T10 History Masters Quiz',
      description: 'Instant verification! Test your knowledge on the fastest format in world cricket.',
      status: 'open',
      instant: true,
      prize: '10 Points per correct answer + Fan Legend Badge',
      questions: [
        {
          id: 'q-triv-1',
          prompt: 'Who won the very first T10 League title in 2017?',
          options: ['Kerala Kings', 'Northern Warriors', 'Maratha Arabians', 'Pakhtoons'],
          points: 10,
          answer: 'Kerala Kings',
          explain: 'Kerala Kings won the inaugural 2017 edition in Sharjah.'
        },
        {
          id: 'q-triv-2',
          prompt: 'Which franchise has won the most Abu Dhabi T10 titles?',
          options: ['Deccan Gladiators', 'Northern Warriors', 'Delhi Bulls', 'Team Abu Dhabi'],
          points: 10,
          answer: 'Deccan Gladiators',
          explain: 'Deccan Gladiators won three championships (2021-22, 2022, and 2024).'
        },
        {
          id: 'q-triv-3',
          prompt: 'How many overs does each side bat in a T10 encounter?',
          options: ['8 overs', '10 overs', '12 overs', '15 overs'],
          points: 10,
          answer: '10 overs',
          explain: 'Ten overs a side, lasting approximately 90 minutes of sheer action.'
        },
        {
          id: 'q-triv-4',
          prompt: 'Who is the head coach of the new Arabian Aces franchise?',
          options: ['Lance Klusener', 'Andy Flower', 'Stephen Fleming', 'Brian Lara'],
          points: 10,
          answer: 'Lance Klusener',
          explain: 'Legendary South African all-rounder Lance Klusener leads Arabian Aces.'
        }
      ],
      createdAt: new Date().toISOString()
    }
  ];

  const drawsData: PrizeDraw[] = [
    {
      id: 'draw-vip-final',
      title: 'Grand Final VIP Hospitality Passes',
      prize: '2x VIP President Box Passes at Zayed Cricket Stadium + Dugout Access',
      description: 'Enter with one click. Winner is drawn autonomously using verifiable SHA-256 seed at match closure.',
      color: '#E8B04A',
      closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      status: 'open',
      seed: 'seed-adt10-2026-vip-final'
    },
    {
      id: 'draw-signed-jersey',
      title: 'Official Signed Arabian Aces Match Jersey',
      prize: 'Framed official team jersey autographed by Moeen Ali and Lance Klusener',
      description: 'Exclusive draw for fans who back Arabian Aces in Fan Wars.',
      color: '#F59E0B',
      closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(),
      status: 'open',
      teamOnly: 'aces',
      seed: 'seed-aces-signed-jersey-v1'
    },
    {
      id: 'draw-toss-coin',
      title: 'Honorary Toss Coin Presenter',
      prize: 'Walk out onto the Zayed Stadium pitch alongside the captains for the official toss ceremony!',
      description: 'A once in a lifetime live broadcast moment.',
      color: '#10B981',
      closesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      status: 'open',
      seed: 'seed-toss-presenter-2026'
    }
  ];

  const approvalsData: Approval[] = [
    {
      id: 'ap-1',
      kind: 'handle',
      title: 'YouTube channel discovered for Quetta Qavalry',
      detail: 'Discovery Agent matched @QuettaQavalryOfficial via official league press release.',
      payload: { teamId: 'qavalry', platform: 'YouTube', handle: '@QuettaQavalryOfficial', url: 'https://youtube.com/@QuettaQavalryOfficial' },
      status: 'pending',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ap-2',
      kind: 'website',
      title: 'Team website discovered for Royal Champs',
      detail: 'Verified domain https://royalchamps.ae submitted by AI Discovery crawler.',
      payload: { teamId: 'champs', website: 'https://royalchamps.ae' },
      status: 'pending',
      createdAt: new Date().toISOString()
    }
  ];

  const agentRunsData: AgentRun[] = [
    {
      id: 'run-init-discovery',
      agent: 'Discovery',
      startedAt: new Date(Date.now() - 1000 * 60 * 40).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
      status: 'success',
      summary: 'Crawled abudhabit10.com and 9 team handles. 14 verified links validated.',
      items: 14
    },
    {
      id: 'run-init-social',
      agent: 'Social',
      startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 13).toISOString(),
      status: 'success',
      summary: 'Polled YouTube RSS, X, Instagram, Threads, TikTok, LinkedIn. Curated 12 active posts.',
      items: 12
    },
    {
      id: 'run-init-scores',
      agent: 'Scores',
      startedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      finishedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      status: 'success',
      summary: 'Sync match 1 live state. Current score: 84/2 in 6.4 overs.',
      items: 1
    }
  ];

  const initialUsers: User[] = [
    {
      id: 'user-admin',
      email: 'solarastra.in@gmail.com',
      name: 'Franchise Owner (SolarAstra)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
      provider: 'google',
      teamId: 'aces',
      teamChanges: 0,
      points: 1500,
      streak: 12,
      lastCheckin: new Date().toISOString(),
      badges: ['Franchise VIP', 'Founding Member', 'Predictor Master', 'Six Hunter'],
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  ];

  return {
    users: initialUsers,
    otpCodes: [],
    teams: teamsData,
    handles: handlesData,
    feedItems: feedItemsData,
    matches: matchesData,
    contests: contestsData,
    contestEntries: [],
    fantasyTeams: [],
    draws: drawsData,
    drawEntries: [],
    forumThreads: generateInitialForumThreads(),
    forumComments: generateInitialForumComments(),
    notifications: [
      {
        id: 'notif-match-101',
        title: '🏆 MATCH RESULT: Arabian Aces defeated Deccan Gladiators by 18 runs!',
        body: 'Arabian Aces posted a mammoth 138/2 in 10 overs. Chris Gayle blasted 64*(22) with 7 massive sixes at Zayed Cricket Stadium!',
        category: 'match_result',
        targetAudience: 'all',
        teamId: 'aces',
        data: {
          matchId: 'm-01',
          url: '/matches',
          scoreSummary: 'Aces 138/2 (10.0) beat Gladiators 120/5 (10.0)',
          winnerName: 'Arabian Aces',
          topScorer: 'Chris Gayle (64* off 22 balls, 7 sixes)'
        },
        priority: 'high',
        createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
        createdBy: 'Scores Automator',
        recipientCount: 1420,
        fcmSuccessCount: 1398,
        fcmFailureCount: 22,
        readBy: []
      },
      {
        id: 'notif-contest-201',
        title: '⏳ DEADLINE ALERT: Arabian Aces Sixes Frenzy locks in 30 minutes!',
        body: 'Predictions close before the 1st ball at Zayed Cricket Stadium. Submit your sixes & top scorer picks now to win VIP Hospitality Box passes!',
        category: 'contest_deadline',
        targetAudience: 'logged_in',
        teamId: 'aces',
        data: {
          contestId: 'c-01',
          url: '/contests',
          prize: 'VIP Hospitality Box Pass + Signed Jersey',
          locksAt: new Date(Date.now() + 1800 * 1000).toISOString()
        },
        priority: 'high',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        createdBy: 'Contest Scheduler',
        recipientCount: 1105,
        fcmSuccessCount: 1092,
        fcmFailureCount: 13,
        readBy: []
      }
    ],
    fcmTokens: [],
    approvals: approvalsData,
    agentRuns: agentRunsData,
    fanSpaces: generateInitialFanSpaces(),
    fanSpaceBookings: [],
    youthSchools: generateInitialYouthSchools(),
    creatorPartners: generateInitialCreatorPartners(),
    commentaryFeeds: generateInitialCommentaryFeeds(),
    passportTiers: generateInitialPassportTiers(),
    proposalSettings: generateInitialProposalSettings(),
    settings: {
      adminEmails: ['solarastra.in@gmail.com'],
      publicUserCountOverride: 18450,
      tickerText: '⚡ ABU DHABI T10 2026 LIVE · ARABIAN ACES VS DECCAN GLADIATORS · PREDICT & WIN VIP PASSES ⚡',
      curatorFeedId: process.env.CURATOR_FEED_ID || '',
      curatorContainerId: 'curator-feed-default-feed-layout',
      curatorFeedUuid: '',
      curatorApiKey: process.env.CURATOR_API_KEY || '',
      curatorHashtags: 'AbuDhabiT10,ArabianAces,T10League',
      maxSocialPerPlatform: 5,
      smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        user: '',
        pass: '',
        from: 'noreply@t10fanhub.com',
        enabled: false
      }
    }
  };
}

class DatabaseManager {
  private store: AppStore;

  constructor() {
    this.store = this.load();
  }

  private load(): AppStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        // Ensure admin user exists
        if (!parsed.users.some((u: User) => u.email === 'solarastra.in@gmail.com')) {
          parsed.users.push({
            id: 'user-admin',
            email: 'solarastra.in@gmail.com',
            name: 'Franchise Owner (SolarAstra)',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop',
            provider: 'google',
            teamId: 'aces',
            teamChanges: 0,
            points: 1500,
            streak: 12,
            lastCheckin: new Date().toISOString(),
            badges: ['Franchise VIP', 'Founding Member', 'Predictor Master', 'Six Hunter'],
            role: 'admin',
            createdAt: new Date().toISOString()
          });
        }
        // Ensure forum threads exist
        if (!parsed.forumThreads || parsed.forumThreads.length === 0) {
          parsed.forumThreads = generateInitialForumThreads();
        }
        if (!parsed.forumComments || parsed.forumComments.length === 0) {
          parsed.forumComments = generateInitialForumComments();
        }
        if (!parsed.notifications || parsed.notifications.length === 0) {
          parsed.notifications = [
            {
              id: 'notif-match-101',
              title: '🏆 MATCH RESULT: Arabian Aces defeated Deccan Gladiators by 18 runs!',
              body: 'Arabian Aces posted a mammoth 138/2 in 10 overs. Chris Gayle blasted 64*(22) with 7 massive sixes at Zayed Cricket Stadium!',
              category: 'match_result',
              targetAudience: 'all',
              teamId: 'aces',
              data: {
                matchId: 'm-01',
                url: '/matches',
                scoreSummary: 'Aces 138/2 (10.0) beat Gladiators 120/5 (10.0)',
                winnerName: 'Arabian Aces',
                topScorer: 'Chris Gayle (64* off 22 balls, 7 sixes)'
              },
              priority: 'high',
              createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
              createdBy: 'Scores Automator',
              recipientCount: 1420,
              fcmSuccessCount: 1398,
              fcmFailureCount: 22,
              readBy: []
            },
            {
              id: 'notif-contest-201',
              title: '⏳ DEADLINE ALERT: Arabian Aces Sixes Frenzy locks in 30 minutes!',
              body: 'Predictions close before the 1st ball at Zayed Cricket Stadium. Submit your sixes & top scorer picks now to win VIP Hospitality Box passes!',
              category: 'contest_deadline',
              targetAudience: 'logged_in',
              teamId: 'aces',
              data: {
                contestId: 'c-01',
                url: '/contests',
                prize: 'VIP Hospitality Box Pass + Signed Jersey',
                locksAt: new Date(Date.now() + 1800 * 1000).toISOString()
              },
              priority: 'high',
              createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
              createdBy: 'Contest Scheduler',
              recipientCount: 1105,
              fcmSuccessCount: 1092,
              fcmFailureCount: 13,
              readBy: []
            }
          ];
        }
        if (!parsed.fcmTokens) {
          parsed.fcmTokens = [];
        }
        if (!parsed.fanSpaces || parsed.fanSpaces.length === 0) {
          parsed.fanSpaces = generateInitialFanSpaces();
        }
        if (!parsed.fanSpaceBookings) {
          parsed.fanSpaceBookings = [];
        }
        if (!parsed.youthSchools || parsed.youthSchools.length === 0) {
          parsed.youthSchools = generateInitialYouthSchools();
        }
        if (!parsed.creatorPartners || parsed.creatorPartners.length === 0) {
          parsed.creatorPartners = generateInitialCreatorPartners();
        }
        if (!parsed.commentaryFeeds || parsed.commentaryFeeds.length === 0) {
          parsed.commentaryFeeds = generateInitialCommentaryFeeds();
        }
        if (!parsed.passportTiers || parsed.passportTiers.length === 0) {
          parsed.passportTiers = generateInitialPassportTiers();
        }
        if (!parsed.proposalSettings) {
          parsed.proposalSettings = generateInitialProposalSettings();
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load store, initializing default:', e);
    }
    const fresh = generateInitialStore();
    this.saveDirect(fresh);
    return fresh;
  }

  private saveDirect(store: AppStore) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save store:', e);
    }
  }

  public get(): AppStore {
    return this.store;
  }

  public save() {
    this.saveDirect(this.store);
  }

  public resetDemo() {
    this.store = generateInitialStore();
    this.save();
    return this.store;
  }

  public resetProposal(): ProposalSettings {
    this.store.proposalSettings = generateInitialProposalSettings();
    this.save();
    return this.store.proposalSettings;
  }
}

export const db = new DatabaseManager();
