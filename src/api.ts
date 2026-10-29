import type {
  PublicConfig, User, Team, Player, SocialHandle, FeedItem, Match, MatchDetail, Contest, ContestEntry, PrizeDraw, SystemSettings,
  ForumThread, ForumComment, NotificationItem, AdminUserRecord, AdminRole, AdminPermission, EnvVariableInfo, CricketSyncResult,
  FantasyTeam, DreamXIRules, FantasyMatchSummary, LeaderRow, FantasyLeague, GamesToday, GuessState, SuperOverState, Shot,
  PrizeItem, PrizeRedemption, PollView, FanWarsRow, PublicFan, FanBase, ReferralSummary, CricketDataCandidate, FeedHealthRow,
  ProfileResponse, FanSpace, FanSpaceBooking, Approval, AgentRun, ForumReportView, Reaction, ProposalSettings,
  YouthCupSchool, CreatorPartner, CommentaryAudioFeed, SuperfanPassportTier,
  AdminFanPoints, PointsHistory, PointsEntry, PlayerWithForm, LineupPreset, MatchSwingInsights, PlayerDetail,
  ConnectionsState, GridState, StatQuestion, StatWarsResult, DuelView, FanPostView, FanPostKind, FanWallResponse, FanOfTheDayView,
  FanClub, FanClubCheckInRecord, FanClubStatusResponse, VenueOffer,
} from './types';

const TOKEN_KEY = 't10_auth_token';
const REF_KEY = 't10_pending_ref';

const safeStorage = {
  get(k: string) {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  },
  remove(k: string) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  },
};

export const getStoredToken = () => safeStorage.get(TOKEN_KEY);
export const setStoredToken = (token: string) => safeStorage.set(TOKEN_KEY, token);
export const clearStoredToken = () => safeStorage.remove(TOKEN_KEY);

/** Remembers ?ref=CODE from an invite link until the visitor signs up. */
export function capturePendingReferral() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
    safeStorage.set(REF_KEY, ref.toUpperCase());
    params.delete('ref');
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }
}
export const getPendingReferral = () => safeStorage.get(REF_KEY) || undefined;
export const clearPendingReferral = () => safeStorage.remove(REF_KEY);

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: any) {
    super(message);
  }
}

function qs(params?: Record<string, any>): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  const s = search.toString();
  return s ? `?${s}` : '';
}

async function req<T>(url: string, options: RequestInit & { json?: unknown; anonymous?: boolean } = {}): Promise<T> {
  const token = options.anonymous ? null : getStoredToken();
  const headers = new Headers(options.headers || {});
  if (options.json !== undefined) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const { json, anonymous: _anonymous, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(url, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch {
    throw new ApiError('You appear to be offline. Check your connection and try again.', 0);
  }
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!response.ok) throw new ApiError(data?.error || data?.message || `Request failed (${response.status})`, response.status, data);
  return data as T;
}
const post = <T>(url: string, json: unknown = {}) => req<T>(url, { method: 'POST', json });

/**
 * Data that is the same for every visitor (fixtures, scores, squads, players, leaderboards) is read
 * without the sign-in header, so the CDN can answer it for everyone during a match instead of every
 * open page reaching the server. Admins read it fresh (past the cache) so they see their own edits.
 */
let freshReads = false;
export const setFreshReads = (on: boolean) => {
  freshReads = on;
};
const pub = <T>(url: string) => (freshReads ? req<T>(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`) : req<T>(url, { anonymous: true }));
const del = <T>(url: string, json?: unknown) => req<T>(url, { method: 'DELETE', ...(json !== undefined ? { json } : {}) });

type Ok = { success: boolean };

export const api = {
  // ----- account -----
  getConfig: () => req<{ config: PublicConfig }>('/api/config'),
  getMe: () => req<{ user: User | null }>('/api/me'),
  getProfile: () => req<ProfileResponse>('/api/me/profile'),
  updateProfile: (data: { name?: string; avatar?: string; country?: string; city?: string; bio?: string }) => post<Ok & { user: User }>('/api/me/profile/update', data),
  deleteAccount: () => del<Ok>('/api/me', { confirm: 'DELETE' }),
  loginGoogle: (idToken: string, ref?: string) => post<{ token: string; user: User; created: boolean }>('/api/auth/google', { idToken, ref }),
  requestOtp: (email: string) => post<{ success: boolean; message: string; devCode?: string }>('/api/auth/otp/request', { email }),
  verifyOtp: (email: string, code: string, ref?: string) => post<{ token: string; user: User; created: boolean }>('/api/auth/otp/verify', { email, code, ref }),
  logout: () => post<Ok>('/api/auth/logout'),
  claimBadge: (badgeId: string) => post<Ok & { pointsAdded: number; user: User }>('/api/me/claim-badge', { badgeId }),
  checkin: () => post<Ok & { user: User; pointsAdded: number }>('/api/checkin'),
  selectTeam: (teamId: string) => post<Ok & { user: User }>('/api/me/team', { teamId }),
  getReferral: () => req<ReferralSummary>('/api/me/referral'),
  getMyPoints: () => req<PointsHistory>('/api/me/points'),

  // ----- teams, players, handles -----
  getTeams: () => pub<{ teams: Team[] }>('/api/teams'),
  getPlayer: (id: string) => pub<PlayerDetail>(`/api/players/${encodeURIComponent(id)}`),
  seedOfficialTeams: (overwrite = false, teamId?: string) => post<Ok & { teams: Team[]; handles: SocialHandle[]; created: string[]; updated: string[]; skipped: string[]; summary: string }>('/api/admin/teams/seed-official', { overwrite, teamId }),
  saveTeam: (team: Partial<Team>) => post<Ok & { team: Team; teams: Team[] }>('/api/teams', team),
  resolvePlayerLinks: (opts: { all?: boolean; teamId?: string } = {}) => post<Ok & { checked: number; updated: number; report: string[] }>('/api/admin/players/links/resolve', opts),
  saveSquad: (teamId: string, squad: Partial<Player>[], force = false) => post<Ok & { team: Team; teams: Team[] }>(`/api/teams/${encodeURIComponent(teamId)}/squad`, { squad, force }),
  deleteTeam: (id: string) => del<Ok & { teams: Team[] }>(`/api/teams/${encodeURIComponent(id)}`),
  getHandles: (params?: { teamId?: string; platform?: string }) => req<{ handles: SocialHandle[] }>(`/api/handles${qs(params)}`),
  saveHandle: (handle: Partial<SocialHandle>) => post<Ok & { handle: SocialHandle; sync: { status: string; note: string; items: number } | null; handles: SocialHandle[] }>('/api/handles', handle),
  syncHandle: (id: string) => post<Ok & { status: string; note: string; items: number }>(`/api/handles/${id}/sync`),
  deleteHandle: (id: string) => del<Ok & { handles: SocialHandle[] }>(`/api/handles/${id}`),
  testCricketProvider: (options: { provider?: string; seriesId?: string; apiUrl?: string; apiKey?: string }) => post<any>('/api/admin/cricket/test-connection', options),
  fetchAndPersistCricketSquads: (options: { provider?: string; seriesId?: string; apiUrl?: string; apiKey?: string; overwrite?: boolean; dryRun?: boolean; teamId?: string }) => post<CricketSyncResult>('/api/admin/cricket/fetch-squads', options),

  // ----- feeds -----
  getFeeds: (params?: { teamId?: string; platform?: string; category?: string; status?: string; kind?: string; limit?: number; before?: string }) =>
    req<{ items: FeedItem[]; total: number; countsByPlatform: Record<string, number>; hasMore: boolean }>(`/api/feeds${qs(params)}`),
  saveFeedItem: (item: Partial<FeedItem>) => post<Ok & { item: FeedItem }>('/api/feeds', item),
  addFeedFromLink: (data: { url: string; teamId?: string | null; title?: string; category?: string; pinned?: boolean }) => post<Ok & { item: FeedItem }>('/api/admin/feeds/from-link', data),
  deleteFeedItem: (id: string) => del<Ok>(`/api/feeds/${id}`),
  syncRealFeeds: () => post<Ok & { syncedCount: number; added: number; summary: string; errors: string[]; handles: any[] }>('/api/admin/feeds/sync'),
  pullSocialFeeds: (teamId?: string) => post<Ok & { totalItems?: number; added?: number; summary?: string }>('/api/feeds/pull', { teamId }),
  harvestFeeds: (teamId?: string) => post<Ok & { summary: string; items: number; status: string }>('/api/admin/feeds/harvest', { teamId }),
  bulkIngestFeedUrls: (data: { urls: string[] | string; teamId?: string | null; pinned?: boolean; category?: string }) => post<Ok & { added: number; items: FeedItem[]; errors: string[] }>('/api/admin/feeds/bulk-ingest', data),
  getFeedHealth: () => req<{ handles: FeedHealthRow[]; curator: { configured: boolean; items: number }; news: number }>('/api/admin/feeds/health'),
  getCuratorConfig: () => req<{ success: boolean; feedId: string; feedIdSource: string; hasApiKey: boolean; apiKeySource: string; containerId: string; isConfigured: boolean }>('/api/curator/config'),
  fetchCuratorFeed: () => req<{ success: boolean; feedId: string; posts: FeedItem[]; rawCount: number; message: string }>('/api/curator/feed'),
  syncCuratorFeed: () => post<{ success: boolean; feedId: string; posts: FeedItem[]; rawCount: number; message: string }>('/api/curator/sync'),

  // ----- matches -----
  getMatches: (params?: { teamId?: string; status?: string }) => pub<{ matches: Match[] }>(`/api/matches${qs(params)}`),
  getLiveMatch: () => req<{ hasLive: boolean; match: Match | null; nextMatch: Match | null; recentMatch: Match | null; teams: Team[]; serverTime: string }>('/api/matches/live'),
  getMatch: (id: string) => pub<MatchDetail>(`/api/matches/${encodeURIComponent(id)}`),
  saveMatch: (match: Partial<Match> & { notify?: boolean }) => post<Ok & { matches: Match[]; targetMatch: Match; notification?: NotificationItem; fantasy?: any }>('/api/matches', match),
  deleteMatch: (id: string) => del<Ok & { matches: Match[] }>(`/api/matches/${id}`),
  liveSyncMatch: (id: string) => post<Ok & { status: string; justCompleted: boolean; scorecard: boolean; scorecardNote?: string; match: Match }>(`/api/admin/matches/${id}/live-sync`),
  findCricketDataMatches: () => req<{ matches: CricketDataCandidate[] }>('/api/admin/cricketdata/matches'),
  seedOfficialMatches: (overwrite = false) => post<Ok & { count: number; matches: Match[] }>('/api/admin/matches/seed-official', { overwrite }),
  importSchedule: (data: { fileData?: string; fileName?: string; mimeType?: string; text?: string; overwrite?: boolean }) =>
    post<Ok & { count: number; total: number; matches: Match[] }>('/api/admin/matches/import-schedule', data),

  // ----- predictions -----
  getContests: () => req<{ contests: Contest[]; myEntries: ContestEntry[]; entryCounts: Record<string, number> }>('/api/contests'),
  enterContest: (contestId: string, answers: Record<string, string>) => post<Ok & { pointsAwarded?: number; user: User; results?: { id: string; correct: boolean; answer?: string; explain?: string }[] }>(`/api/contests/${contestId}/enter`, { answers }),
  saveContest: (contest: Partial<Omit<Contest, 'locksAt' | 'matchId'>> & { locksAt?: string | null; matchId?: string | null }) => post<Ok & { contest: Contest; contests: Contest[] }>('/api/admin/contests', contest),
  deleteContest: (id: string) => del<Ok & { contests: Contest[] }>(`/api/admin/contests/${id}`),
  toggleContestStatus: (id: string, status?: 'open' | 'locked') => post<Ok & { contest: Contest }>(`/api/admin/contests/${id}/toggle-status`, status ? { status } : {}),
  settleContest: (id: string, answers: Record<string, string>) => post<Ok & { contest: Contest; settledEntriesCount: number; totalPointsDistributed: number }>(`/api/admin/contests/${id}/settle`, { answers }),

  // ----- Pick XI -----
  getFantasyHub: () => req<{ rules: DreamXIRules; matches: FantasyMatchSummary[]; season: { points: number; matches: number; best: number } | null }>('/api/fantasy'),
  getFantasyRules: () => req<{ rules: DreamXIRules; scoring: { group: string; rules: [string, number | string][] }[] }>('/api/fantasy/rules'),
  getFantasy: (matchId: string) => req<{ match: Match; locked: boolean; rules: DreamXIRules; pool: PlayerWithForm[]; fantasyTeam: FantasyTeam | null; fantasyTeams?: FantasyTeam[]; lineups: number; presets?: LineupPreset[]; swingInsights?: MatchSwingInsights }>(`/api/fantasy/${encodeURIComponent(matchId)}`),
  submitFantasy: (matchId: string, playerIds: string[], captainId: string, viceCaptainId: string, variationId?: string, variationName?: string) => post<Ok & { fantasyTeam: FantasyTeam; fantasyTeams: FantasyTeam[]; credits: number; user: User }>(`/api/fantasy/${encodeURIComponent(matchId)}`, { playerIds, captainId, viceCaptainId, variationId, variationName }),
  deleteFantasy: (matchId: string, variationId?: string) => del<Ok & { fantasyTeams: FantasyTeam[] }>(`/api/fantasy/${encodeURIComponent(matchId)}${variationId ? `?variationId=${encodeURIComponent(variationId)}` : ''}`),
  getFantasyLeaderboard: (matchId?: string) => pub<{ rows: LeaderRow[] }>(`/api/fantasy/leaderboard${qs({ matchId })}`),
  rescoreFantasy: (matchId: string) => post<Ok & { scored: number; topScore: number; unmatchedNames: string[] }>(`/api/admin/fantasy/${matchId}/score`),
  getLeagues: () => req<{ leagues: FantasyLeague[] }>('/api/fantasy-leagues'),
  createLeague: (name: string) => post<Ok & { league: { id: string; code: string; name: string } }>('/api/fantasy-leagues', { name }),
  joinLeague: (code: string) => post<Ok & { league: { id: string; name: string }; already?: boolean }>('/api/fantasy-leagues/join', { code }),
  leaveLeague: (id: string) => post<Ok>(`/api/fantasy-leagues/${id}/leave`),

  // ----- daily games -----
  getGamesToday: () => req<GamesToday>('/api/games/today'),
  getFanWall: (params?: { teamId?: string; kind?: string; before?: string }) => req<FanWallResponse>(`/api/fanwall${qs(params)}`),
  getFanPost: (id: string) => req<{ post: FanPostView }>(`/api/fanwall/${encodeURIComponent(id)}`),
  createFanPost: (body: { text: string; kind: FanPostKind; matchId?: string; photo?: string }) => post<Ok & { post: FanPostView; pointsAdded: number; message: string; user: User }>('/api/fanwall/new', body),
  reactFanPost: (id: string, emoji: string) => post<Ok & { reactions: Reaction[] }>(`/api/fanwall/${encodeURIComponent(id)}/react`, { emoji }),
  reportFanPost: (id: string, reason: string) => post<Ok & { message: string }>(`/api/fanwall/${encodeURIComponent(id)}/report`, { reason }),
  deleteFanPost: (id: string) => del<Ok>(`/api/fanwall/${encodeURIComponent(id)}`),
  getAdminFanWall: (status: 'pending' | 'reported' | 'live' | 'hidden') => req<{ posts: FanPostView[]; counts: { pending: number; reported: number; live: number }; today: { day: string; postId: string; userName: string; points: number } | null; fanOfTheDayPoints: number }>(`/api/admin/fanwall?status=${status}`),
  moderateFanPost: (id: string, action: 'approve' | 'hide' | 'restore' | 'delete') => post<Ok & { post: FanPostView | null }>(`/api/admin/fanwall/${encodeURIComponent(id)}/${action}`, {}),
  featureFanPost: (id: string, body: { points?: number; note?: string }) => post<Ok & { fanOfTheDay: FanOfTheDayView | null }>(`/api/admin/fanwall/${encodeURIComponent(id)}/feature`, body),
  submitConnections: (playerIds: string[]) => post<Ok & { connections: ConnectionsState; user: User }>('/api/games/connections', { playerIds }),
  submitGrid: (cell: string, playerId: string) => post<Ok & { grid: GridState; user: User }>('/api/games/grid', { cell, playerId }),
  startStatWars: (duel?: string) => post<Ok & { startedAt: string; seconds: number; questions: StatQuestion[] }>('/api/games/statwars/start', duel ? { duel } : {}),
  finishStatWars: (answers: ('a' | 'b' | null)[], duel?: string) => post<Ok & StatWarsResult>('/api/games/statwars/finish', duel ? { answers, duel } : { answers }),
  getDuels: () => req<{ mine: DuelView[]; open: DuelView[] }>('/api/duels'),
  getDuel: (code: string) => req<{ duel: DuelView }>(`/api/duels/${encodeURIComponent(code)}`),
  createDuel: (open: boolean) => post<Ok & { duel: DuelView }>('/api/duels', { open }),
  joinDuel: (code: string) => post<Ok & { duel: DuelView }>(`/api/duels/${encodeURIComponent(code)}/join`, {}),
  submitGuess: (playerId: string) => post<Ok & { guess: GuessState; user: User }>('/api/games/guess', { playerId }),
  playSuperOverBall: (shot: Shot) => post<Ok & { superOver: SuperOverState; user: User }>('/api/games/superover', { shot }),

  // ----- prizes & draws -----
  getPrizes: () => req<{ prizes: PrizeItem[]; balance: number | null; myRedemptions: PrizeRedemption[]; limits?: { dailyClaimsUsed: number; dailyClaimsMax: number; pendingClaimsCount: number; pendingClaimsMax: number } | null }>('/api/prizes'),
  redeemPrize: (id: string) => post<Ok & { redemption: PrizeRedemption; fulfilment: string; user: User }>(`/api/prizes/${id}/redeem`),
  getAdminPrizes: () => req<{ prizes: PrizeItem[]; redemptions: PrizeRedemption[] }>('/api/admin/prizes'),
  savePrize: (p: Partial<PrizeItem>) => post<Ok & { prize: PrizeItem; prizes: PrizeItem[] }>('/api/admin/prizes', p),
  deletePrize: (id: string) => del<Ok & { prizes: PrizeItem[] }>(`/api/admin/prizes/${id}`),
  updateRedemption: (id: string, status: 'fulfilled' | 'cancelled', note?: string) => post<Ok & { redemption: PrizeRedemption }>(`/api/admin/redemptions/${id}`, { status, note }),
  seedOfficialPrizes: (overwrite = false) => post<Ok & { prizesCount: number; drawsCount: number; prizes: PrizeItem[]; draws: PrizeDraw[] }>('/api/admin/prizes/seed-official', { overwrite }),
  getAdminPoints: (params?: { q?: string; id?: string }) => req<{ fans: AdminFanPoints[]; detail?: { id: string; fan: AdminFanPoints; bySource: PointsHistory['bySource']; ledger: PointsEntry[]; claims: PrizeRedemption[]; unitemised: number } }>(`/api/admin/points${qs(params)}`),
  adjustPoints: (userId: string, delta: number, reason: string) => post<Ok & { applied: number; points: number; balance: number }>(`/api/admin/points/${userId}/adjust`, { delta, reason }),
  getDraws: () => req<{ draws: PrizeDraw[]; myEntries: string[] }>('/api/draws'),
  saveDraw: (draw: Partial<PrizeDraw>) => post<Ok & { draws: PrizeDraw[] }>('/api/admin/draws', draw),
  deleteDraw: (id: string) => del<Ok & { draws: PrizeDraw[] }>(`/api/admin/draws/${id}`),
  getDrawEntries: (id: string) => req<{ entries: { userName: string; userEmail: string; createdAt: string }[] }>(`/api/admin/draws/${id}/entries`),
  enterDraw: (drawId: string) => post<Ok & { message: string }>(`/api/draws/${drawId}/enter`),
  executeDraw: (drawId: string) => post<Ok & { draw: PrizeDraw; winner: { userName: string; userEmail: string } }>(`/api/draws/${drawId}/execute`),

  // ----- community -----
  getLeaderboard: (teamId?: string) => req<{ fanWars: FanWarsRow[]; topFans: PublicFan[]; myRank: number | null }>(`/api/leaderboard${qs({ teamId })}`),
  getFanBase: () => pub<FanBase>('/api/fans'),
  getForumThreads: (params?: { category?: string; teamId?: string; search?: string; sort?: string; matchId?: string }) => req<{ threads: ForumThread[] }>(`/api/forum/threads${qs(params)}`),
  getForumThreadDetail: (id: string) => req<{ thread: ForumThread; comments: ForumComment[]; canModerate: boolean }>(`/api/forum/threads/${encodeURIComponent(id)}`),
  createForumThread: (data: { title: string; content: string; category?: string; teamId?: string | null; matchId?: string | null; tags?: string[] }) => post<Ok & { thread: ForumThread; pointsAdded: number; user: User }>('/api/forum/threads', data),
  editForumThread: (id: string, data: { title?: string; content?: string }) => req<Ok & { thread: ForumThread }>(`/api/forum/threads/${id}`, { method: 'PATCH', json: data }),
  deleteOwnThread: (id: string) => del<Ok>(`/api/forum/threads/${id}`),
  addForumComment: (threadId: string, content: string) => post<Ok & { comment: ForumComment; thread: ForumThread; pointsAdded: number; user: User }>(`/api/forum/threads/${threadId}/comments`, { content }),
  deleteOwnComment: (id: string) => del<Ok>(`/api/forum/comments/${id}`),
  upvoteForumThread: (threadId: string) => post<Ok & { upvotes: number; upvoted: boolean }>(`/api/forum/threads/${threadId}/upvote`),
  upvoteForumComment: (commentId: string) => post<Ok & { upvotes: number; upvoted: boolean }>(`/api/forum/comments/${commentId}/upvote`),
  react: (kind: 'threads' | 'comments', id: string, emoji: string) => post<Ok & { reactions: Reaction[] }>(`/api/forum/${kind}/${id}/react`, { emoji }),
  report: (kind: 'threads' | 'comments', id: string, reason: string) => post<Ok & { message: string; hidden: boolean }>(`/api/forum/${kind}/${id}/report`, { reason }),
  deleteForumThread: (threadId: string) => del<Ok>(`/api/admin/forum/threads/${threadId}`),
  deleteForumComment: (commentId: string) => del<Ok>(`/api/admin/forum/comments/${commentId}`),
  pinForumThread: (threadId: string, pinned: boolean) => post<Ok & { thread: ForumThread }>(`/api/admin/forum/threads/${threadId}/pin`, { value: pinned }),
  moderateThread: (threadId: string, action: 'pin' | 'lock' | 'hide', value: boolean) => post<Ok & { thread: ForumThread }>(`/api/admin/forum/threads/${threadId}/${action}`, { value }),
  getReports: () => req<{ reports: ForumReportView[] }>('/api/admin/forum/reports'),
  decideReport: (id: string, action: 'dismiss' | 'remove') => post<Ok>(`/api/admin/forum/reports/${id}`, { action }),
  getPolls: (params?: { teamId?: string; matchId?: string }) => req<{ polls: PollView[] }>(`/api/polls${qs(params)}`),
  votePoll: (id: string, optionId: string) => post<Ok & { poll: PollView }>(`/api/polls/${id}/vote`, { optionId }),
  savePoll: (p: { id?: string; question: string; options: string[]; teamId?: string | null; matchId?: string | null; closesAt?: string; status?: string }) => post<Ok & { poll: PollView }>('/api/admin/polls', p),
  deletePoll: (id: string) => del<Ok>(`/api/admin/polls/${id}`),

  // ----- notifications -----
  getNotifications: (params?: { category?: string }) => req<{ notifications: NotificationItem[]; unreadCount: number; total: number; fcmSubscribed: boolean }>(`/api/notifications${qs(params)}`),
  getNotificationDetails: (id: string) => req<{ notification: NotificationItem; relatedEntity: any }>(`/api/notifications/${id}`),
  markNotificationRead: (id: string) => post<Ok>(`/api/notifications/${id}/read`),
  markAllNotificationsRead: () => post<Ok>('/api/notifications/mark-all-read'),
  registerFCMToken: (token: string, deviceType = 'web', userAgent = '') => post<Ok>('/api/fcm/register-token', { token, deviceType, userAgent }),
  getFCMTokens: () => req<{ totalTokens: number; activeSubscribers: number; pushServerConfigured: boolean; tokens: any[] }>('/api/fcm/tokens'),
  getAdminNotifications: () => req<{ notifications: NotificationItem[] }>('/api/admin/notifications'),
  sendPushNotification: (payload: { title: string; body: string; category?: string; targetAudience?: string; teamId?: string | null; url?: string; priority?: string }) => post<Ok & { notification: NotificationItem; message: string }>('/api/fcm/send', payload),
  triggerContestDeadline: (contestId: string, customMinutes?: number) => post<Ok & { notification: NotificationItem }>('/api/admin/notifications/trigger-contest-deadline', { contestId, customMinutes }),
  triggerMatchResult: (matchId: string) => post<Ok & { notification: NotificationItem }>('/api/admin/notifications/trigger-match-result', { matchId }),

  // ----- fan spaces -----
  getFanSpaces: () => req<{ spaces: FanSpace[]; bookings: FanSpaceBooking[]; totalHubs: number; activeCities: string[] }>('/api/fanspaces'),
  bookFanSpace: (spaceId: string, data: { date: string; ticketType: string; ticketsCount: number }) => post<Ok & { booking: FanSpaceBooking; passCode: string; user: User }>(`/api/fanspaces/${spaceId}/book`, data),
  cancelBooking: (id: string) => post<Ok & { booking: FanSpaceBooking }>(`/api/fanspaces/bookings/${id}/cancel`),
  getAdminFanSpaceBookings: () => req<{ bookings: FanSpaceBooking[] }>('/api/admin/fanspaces/bookings'),
  checkInFanSpace: (code: string, anyDate = false) => post<Ok & { booking: FanSpaceBooking }>('/api/admin/fanspaces/checkin', { code, anyDate }),
  saveFanSpace: (space: Partial<FanSpace>) => post<Ok & { spaces: FanSpace[] }>('/api/admin/fanspaces', space),
  deleteFanSpace: (id: string) => del<Ok & { spaces: FanSpace[] }>(`/api/admin/fanspaces/${id}`),

  // ----- fan clubs & check-in -----
  getFanClubs: () => pub<{ clubs: FanClub[] }>('/api/fanclub/clubs'),
  getFanClubStatus: () => req<FanClubStatusResponse>('/api/fanclub/my-status'),
  verifySocialFollow: (platform: 'instagram' | 'twitter', handle: string) => post<Ok & { pointsAwarded: number; user: User }>('/api/fanclub/social-verify', { platform, handle }),
  fanClubAdminCheckIn: (data: { qrPayload?: string; code?: string; fanClubId: string; matchId?: string }) => post<Ok & { pointsAwarded: number; fan: any; fanClub: FanClub; match: Match; checkInRecord: FanClubCheckInRecord }>('/api/fanclub/admin/checkin', data),
  fanClubAdminRedeemOffer: (data: { userId: string; offerId: string; fanClubId: string }) => post<Ok & { message: string; offer: VenueOffer; fan: User }>('/api/fanclub/admin/redeem-offer', data),
  getFanClubAdminStats: (fanClubId?: string) => req<{ totalCheckIns: number; todayCheckIns: number; recentCheckIns: FanClubCheckInRecord[] }>(`/api/fanclub/admin/stats${qs({ fanClubId })}`),
  getAdminFanClubs: () => req<{ fanClubs: FanClub[] }>('/api/admin/fanclubs'),
  saveAdminFanClub: (club: Partial<FanClub>) => post<Ok & { fanClub: FanClub }>('/api/admin/fanclubs', club),
  deleteAdminFanClub: (id: string) => del<Ok & { removed: number }>(`/api/admin/fanclubs/${id}`),
  seedAdminFanClubs: () => post<Ok & { fanClubs: FanClub[]; message: string }>('/api/admin/fanclubs/seed'),

  // ----- growth -----
  getGrowthCatalysts: () => req<{ youthSchools: YouthCupSchool[]; creatorPartners: CreatorPartner[]; commentaryFeeds: CommentaryAudioFeed[]; passportTiers: SuperfanPassportTier[] }>('/api/growth-catalysts'),
  saveYouthSchool: (s: Partial<YouthCupSchool>) => post<Ok & { youthSchools: YouthCupSchool[] }>('/api/admin/growth/youth-school', s),
  deleteYouthSchool: (id: string) => del<Ok & { youthSchools: YouthCupSchool[] }>(`/api/admin/growth/youth-school/${id}`),
  saveCreatorPartner: (c: Partial<CreatorPartner>) => post<Ok & { creatorPartners: CreatorPartner[] }>('/api/admin/growth/creator', c),
  deleteCreatorPartner: (id: string) => del<Ok & { creatorPartners: CreatorPartner[] }>(`/api/admin/growth/creator/${id}`),
  saveAudioFeed: (f: Partial<CommentaryAudioFeed>) => post<Ok & { commentaryFeeds: CommentaryAudioFeed[] }>('/api/admin/growth/audio-feed', f),
  deleteAudioFeed: (id: string) => del<Ok & { commentaryFeeds: CommentaryAudioFeed[] }>(`/api/admin/growth/audio-feed/${id}`),
  savePassportTier: (t: Partial<SuperfanPassportTier>) => post<Ok & { passportTiers: SuperfanPassportTier[] }>('/api/admin/growth/passport-tier', t),
  deletePassportTier: (id: string) => del<Ok & { passportTiers: SuperfanPassportTier[] }>(`/api/admin/growth/passport-tier/${id}`),
  subscribeSuperfanPassport: (tierId?: string) => post<Ok & { user: User; alreadyRegistered: boolean }>('/api/growth/superfan-passport/subscribe', { tierId }),

  // ----- admin -----
  getAdminDashboard: () => req<any>('/api/admin/dashboard'),
  runAgent: (name: string) => post<Ok & { agent: string; result: any }>(`/api/admin/agents/${name}/run`),
  runScheduledJobs: (only?: string) => post<any>(`/api/cron/run${qs({ only })}`),
  decideApproval: (id: string, decision: 'approve' | 'reject') => post<Ok & { approval: Approval }>(`/api/admin/approvals/${id}/decide`, { decision }),
  getSettings: () => req<{ settings: SystemSettings }>('/api/admin/settings'),
  saveSettings: (s: Partial<SystemSettings>) => post<Ok & { settings: SystemSettings }>('/api/admin/settings', s),
  testSmtp: (data?: { host?: string; port?: number; user?: string; pass?: string; from?: string; to?: string }) => post<{ success: boolean; message: string }>('/api/admin/smtp/test', data || {}),
  getAdmins: () => req<{ admins: AdminUserRecord[]; superAdminEmail: string; rolePresets: Record<AdminRole, AdminPermission[]>; permissions: AdminPermission[] }>('/api/admin/admins'),
  saveAdmin: (a: { email: string; name?: string; role: AdminRole; permissions?: AdminPermission[]; teamId?: string | null }) => post<Ok & { admins: AdminUserRecord[] }>('/api/admin/admins', a),
  deleteAdmin: (email: string) => del<Ok & { admins: AdminUserRecord[]; note?: string }>(`/api/admin/admins/${encodeURIComponent(email)}`),
  getEnvVariables: () => req<{ variables: EnvVariableInfo[] }>('/api/admin/env'),
  saveEnvVariables: (overrides: Record<string, string>) => post<{ success: boolean; message: string; updatedKeys: string[]; refusedKeys?: string[]; requiresRestartKeys: string[]; hasRestartRequired: boolean; error?: string }>('/api/admin/env', { overrides }),
  getProposalSettings: () => req<{ proposalSettings: ProposalSettings }>('/api/admin/proposal'),
  saveProposalSettings: (p: Partial<ProposalSettings>) => post<Ok & { proposalSettings: ProposalSettings }>('/api/admin/proposal', p),
  resetProposalSettings: () => post<Ok & { proposalSettings: ProposalSettings }>('/api/admin/proposal/reset'),

  // ----- unofficial scrapers -----
  getScraperLiveMatches: () => pub<{ success: boolean; count: number; sources: string[]; matches: any[] }>('/api/scraper/live'),
  syncMatchFromScraper: (matchId: string, data: { provider: 'cricbuzz' | 'cricinfo'; externalId: string; slug?: string }) => post<{ success: boolean; message: string; match: any }>(`/api/scraper/sync/${matchId}`, data),
  testScraper: (target: { url?: string; matchId?: string }) => post<{ success: boolean; provider: string; matchId: string; summary: any; scorecard: any; inningsCount: number }>('/api/scraper/test', target),
  seedScraperSeries: (data?: { seriesId?: string; seriesSlug?: string }) => post<{ success: boolean; message: string; seriesId: string; seriesUrl: string }>('/api/scraper/seed-series', data || {}),

  // ----- AI assistant -----
  chatGemini: (messages: { role: 'user' | 'model'; parts: { text: string }[] }[]) => post<{ text: string; source: string }>('/api/gemini/chat', { messages }),
  searchGrounding: (query: string) => post<{ text: string; sources: string[]; grounded: boolean }>('/api/gemini/search', { query }),
  generateMarketing: (prompt: string, teamName?: string) => post<{ text: string; source: string }>('/api/gemini/marketing', { prompt, teamName }),
  transcribeAudio: (audioBase64: string, mimeType: string) => post<{ text: string }>('/api/gemini/transcribe', { audioBase64, mimeType }),
};

export type Api = typeof api;
export type { AgentRun };
