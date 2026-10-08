import { PublicConfig, User, Team, SocialHandle, FeedItem, Match, Contest, PrizeDraw, SystemSettings, AchievementBadge, UserStats, ForumThread, ForumComment, NotificationItem, FCMDeviceToken } from './types';

const TOKEN_KEY = 't10_auth_token';

export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearStoredToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
};

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = 'An error occurred';
    try {
      const data = await response.json();
      errorMsg = data.error || data.message || errorMsg;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  // Auth
  getMe: () => fetchJson<{ user: User | null }>('/api/me'),
  getProfile: () => fetchJson<{ user: User; badges: AchievementBadge[]; stats: UserStats }>('/api/me/profile'),
  updateProfile: (data: { name?: string; avatar?: string }) =>
    fetchJson<{ success: boolean; user: User }>('/api/me/profile/update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  /** Exchange a Firebase Auth ID token (from signInWithPopup) for a session */
  loginGoogle: (idToken: string) =>
    fetchJson<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),
  logout: () => fetchJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
  getConfig: () => fetchJson<{ config: PublicConfig }>('/api/config'),
  requestOtp: (email: string) =>
    fetchJson<{ success: boolean; message: string; devCode?: string }>('/api/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  verifyOtp: (email: string, code: string) =>
    fetchJson<{ token: string; user: User }>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),
  claimBadge: (badgeId: string) =>
    fetchJson<{ success: boolean; pointsAdded: number; user: User }>('/api/me/claim-badge', {
      method: 'POST',
      body: JSON.stringify({ badgeId }),
    }),

  // Teams & Handles
  getTeams: () => fetchJson<{ teams: Team[] }>('/api/teams'),
  /** Admin: create the six official 2026 franchises (with their direct signings) and the league's official handles. Existing teams are kept unless overwrite=true. */
  seedOfficialTeams: (overwrite = false) =>
    fetchJson<{
      success: boolean;
      teams: Team[];
      handles: SocialHandle[];
      created: string[];
      updated: string[];
      skipped: string[];
      summary: string;
    }>('/api/admin/teams/seed-official', {
      method: 'POST',
      body: JSON.stringify({ overwrite }),
    }),
  saveTeam: (team: Partial<Team>) =>
    fetchJson<{ success: boolean; teams: Team[] }>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    }),
  deleteTeam: (id: string) =>
    fetchJson<{ success: boolean; teams: Team[] }>(`/api/teams/${id}`, {
      method: 'DELETE',
    }),
  getHandles: (params?: { teamId?: string; platform?: string; status?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{ handles: SocialHandle[] }>(`/api/handles?${search}`);
  },
  saveHandle: (handle: Partial<SocialHandle>) =>
    fetchJson<{ success: boolean; handles: SocialHandle[] }>('/api/handles', {
      method: 'POST',
      body: JSON.stringify(handle),
    }),
  deleteHandle: (id: string) =>
    fetchJson<{ success: boolean; handles: SocialHandle[] }>(`/api/handles/${id}`, {
      method: 'DELETE',
    }),

  // Feeds (Curator style)
  getFeeds: (params?: { teamId?: string; platform?: string; category?: string; status?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{
      items: FeedItem[];
      allItemsRaw?: FeedItem[];
      countsByPlatform: Record<string, number>;
      limitPerPlatform: number;
      totalCurated: number;
      totalAvailable: number;
    }>(`/api/feeds?${search}`);
  },
  saveFeedItem: (item: Partial<FeedItem>) =>
    fetchJson<{ success: boolean; item: FeedItem }>('/api/feeds', {
      method: 'POST',
      body: JSON.stringify(item),
    }),
  deleteFeedItem: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/feeds/${id}`, {
      method: 'DELETE',
    }),
  syncRealFeeds: () =>
    fetchJson<{ success: boolean; syncedCount: number; added: number; feedItems: FeedItem[]; summary: string; errors: string[] }>('/api/admin/feeds/sync', {
      method: 'POST',
    }),

  // Matches
  getMatches: () => fetchJson<{ matches: Match[] }>('/api/matches'),
  saveMatch: (match: Partial<Match>) =>
    fetchJson<{ success: boolean; matches: Match[]; targetMatch: Match; notification?: NotificationItem }>('/api/matches', {
      method: 'POST',
      body: JSON.stringify(match),
    }),

  // Contests & Draws
  /** Contests; answers are stripped until a contest is settled. myEntries = the signed-in user's entries only. */
  getContests: () => fetchJson<{ contests: Contest[]; myEntries: any[]; entryCounts: Record<string, number> }>('/api/contests'),
  enterContest: (contestId: string, answers: Record<string, string>) =>
    fetchJson<{ success: boolean; pointsAwarded?: number; user: User }>(`/api/contests/${contestId}/enter`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  getFantasy: (matchId: string) =>
    fetchJson<{ fantasyTeam: any }>(`/api/fantasy/${matchId}`),
  submitFantasy: (matchId: string, playerIds: string[], captainId: string) =>
    fetchJson<{ success: boolean; fantasyTeam: any; user: User }>(`/api/fantasy/${matchId}`, {
      method: 'POST',
      body: JSON.stringify({ playerIds, captainId }),
    }),
  /** Draws with entriesCount/entered computed server-side; no entrant emails are exposed. */
  getDraws: () => fetchJson<{ draws: PrizeDraw[]; myEntries: string[] }>('/api/draws'),
  saveDraw: (draw: Partial<PrizeDraw>) =>
    fetchJson<{ success: boolean; draws: PrizeDraw[] }>('/api/admin/draws', {
      method: 'POST',
      body: JSON.stringify(draw),
    }),
  deleteDraw: (id: string) =>
    fetchJson<{ success: boolean; draws: PrizeDraw[] }>(`/api/admin/draws/${id}`, { method: 'DELETE' }),
  getDrawEntries: (id: string) =>
    fetchJson<{ entries: { userName: string; userEmail: string; createdAt: string }[] }>(`/api/admin/draws/${id}/entries`),
  enterDraw: (drawId: string) =>
    fetchJson<{ success: boolean; message: string }>(`/api/draws/${drawId}/enter`, {
      method: 'POST',
    }),
  executeDraw: (drawId: string) =>
    fetchJson<{ success: boolean; draw: PrizeDraw; winner: any }>(`/api/draws/${drawId}/execute`, {
      method: 'POST',
    }),

  // Leaderboard & Checkin
  getLeaderboard: () => fetchJson<{ fanWars: any[]; topFans: User[] }>('/api/leaderboard'),
  checkin: () => fetchJson<{ success: boolean; user: User; pointsAdded: number }>('/api/checkin', { method: 'POST' }),
  selectTeam: (teamId: string) =>
    fetchJson<{ success: boolean; user: User }>('/api/me/team', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),

  // Discussion Forum
  getForumThreads: (params?: { category?: string; teamId?: string; search?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{ threads: ForumThread[] }>(`/api/forum/threads?${search}`);
  },
  getForumThreadDetail: (id: string) =>
    fetchJson<{ thread: ForumThread; comments: ForumComment[] }>(`/api/forum/threads/${id}`),
  createForumThread: (data: { title: string; content: string; category?: string; teamId?: string; tags?: string[] }) =>
    fetchJson<{ success: boolean; thread: ForumThread; pointsAdded: number; user: User }>('/api/forum/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  addForumComment: (threadId: string, content: string) =>
    fetchJson<{ success: boolean; comment: ForumComment; thread: ForumThread; pointsAdded: number; user: User }>(`/api/forum/threads/${threadId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  upvoteForumThread: (threadId: string) =>
    fetchJson<{ success: boolean; upvotes: number; upvoted: boolean }>(`/api/forum/threads/${threadId}/upvote`, {
      method: 'POST',
    }),
  upvoteForumComment: (commentId: string) =>
    fetchJson<{ success: boolean; upvotes: number; upvoted: boolean }>(`/api/forum/comments/${commentId}/upvote`, {
      method: 'POST',
    }),
  // Forum moderation (admin)
  deleteForumThread: (threadId: string) =>
    fetchJson<{ success: boolean }>(`/api/admin/forum/threads/${threadId}`, { method: 'DELETE' }),
  deleteForumComment: (commentId: string) =>
    fetchJson<{ success: boolean }>(`/api/admin/forum/comments/${commentId}`, { method: 'DELETE' }),
  pinForumThread: (threadId: string, pinned: boolean) =>
    fetchJson<{ success: boolean; thread: ForumThread }>(`/api/admin/forum/threads/${threadId}/pin`, {
      method: 'POST',
      body: JSON.stringify({ pinned }),
    }),

  // Admin Portal
  getAdminDashboard: () => fetchJson<any>('/api/admin/dashboard'),
  runAgent: (agentName: string) =>
    fetchJson<{ success: boolean; agent: string; result: any }>(`/api/admin/agents/${agentName}/run`, {
      method: 'POST',
    }),
  decideApproval: (approvalId: string, decision: 'approve' | 'reject') =>
    fetchJson<{ success: boolean; approval: any }>(`/api/admin/approvals/${approvalId}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  getSettings: () => fetchJson<{ settings: SystemSettings }>('/api/admin/settings'),
  saveSettings: (settings: Partial<SystemSettings>) =>
    fetchJson<{ success: boolean; settings: SystemSettings }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  // Notifications & FCM Real-Time Alerts
  getNotifications: (params?: { category?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{
      notifications: NotificationItem[];
      unreadCount: number;
      total: number;
      fcmSubscribed: boolean;
    }>(`/api/notifications?${search}`);
  },
  getNotificationDetails: (id: string) =>
    fetchJson<{
      notification: NotificationItem;
      relatedEntity: any;
      documentation?: any;
    }>(`/api/notifications/${id}`),
  markNotificationRead: (id: string) =>
    fetchJson<{ success: boolean; notificationId: string; read: boolean }>(`/api/notifications/${id}/read`, {
      method: 'POST',
    }),
  markAllNotificationsRead: () =>
    fetchJson<{ success: boolean; message: string }>('/api/notifications/mark-all-read', {
      method: 'POST',
    }),
  registerFCMToken: (token: string, deviceType?: string, userAgent?: string) =>
    fetchJson<{ success: boolean; message: string; activeSubscribers: number }>('/api/fcm/register-token', {
      method: 'POST',
      body: JSON.stringify({ token, deviceType, userAgent }),
    }),
  getFCMTokens: () =>
    fetchJson<{ totalTokens: number; activeSubscribers: number; tokens: FCMDeviceToken[] }>('/api/fcm/tokens'),
  sendPushNotification: (data: {
    title: string;
    body: string;
    category?: 'match_result' | 'contest_deadline' | 'announcement' | 'perk';
    targetAudience?: 'all' | 'logged_in' | 'team';
    teamId?: string | null;
    url?: string;
    priority?: 'normal' | 'high';
    customData?: Record<string, any>;
  }) =>
    fetchJson<{ success: boolean; notification: NotificationItem; message: string }>('/api/fcm/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triggerMatchResult: (matchId: string) =>
    fetchJson<{ success: boolean; notification: NotificationItem }>('/api/admin/notifications/trigger-match-result', {
      method: 'POST',
      body: JSON.stringify({ matchId }),
    }),
  triggerContestDeadline: (contestId: string, customMinutes?: number) =>
    fetchJson<{ success: boolean; notification: NotificationItem }>('/api/admin/notifications/trigger-contest-deadline', {
      method: 'POST',
      body: JSON.stringify({ contestId, customMinutes }),
    }),

  // Contests & Admin
  saveContest: (contest: Partial<Contest>) =>
    fetchJson<{ success: boolean; contests: Contest[] }>('/api/admin/contests', {
      method: 'POST',
      body: JSON.stringify(contest),
    }),
  deleteContest: (id: string) =>
    fetchJson<{ success: boolean; contests: Contest[] }>(`/api/admin/contests/${id}`, {
      method: 'DELETE',
    }),
  toggleContestStatus: (id: string, status?: string) =>
    fetchJson<{ success: boolean; contest: Contest }>(`/api/admin/contests/${id}/toggle-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  settleContest: (id: string, answers: Record<string, string>) =>
    fetchJson<{ success: boolean; contest: Contest; settledEntriesCount: number; totalPointsDistributed: number }>(`/api/admin/contests/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  deleteMatch: (id: string) =>
    fetchJson<{ success: boolean; matches: Match[] }>(`/api/matches/${id}`, {
      method: 'DELETE',
    }),

  // AI & Gemini SDK Features
  generateMarketing: (prompt: string, teamName?: string) =>
    fetchJson<{ text: string; source: string }>('/api/gemini/marketing', {
      method: 'POST',
      body: JSON.stringify({ prompt, teamName }),
    }),
  chatGemini: (messages: { role: 'user' | 'model'; parts: { text: string }[] }[]) =>
    fetchJson<{ text: string; source: string }>('/api/gemini/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  searchGrounding: (query: string) =>
    fetchJson<{ text: string; sources: string[]; grounded: boolean }>('/api/gemini/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  transcribeAudio: (audioBase64: string, mimeType?: string) =>
    fetchJson<{ text: string }>('/api/gemini/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64, mimeType }),
    }),

  // Activity 8: Global Physical Fan Spaces
  getFanSpaces: () =>
    fetchJson<{ spaces: any[]; bookings: any[]; totalHubs: number; activeCities: string[] }>('/api/fanspaces'),
  bookFanSpace: (id: string, data: { date: string; ticketType: string; ticketsCount: number }) =>
    fetchJson<{ success: boolean; booking: any; passCode: string; user: User }>(`/api/fanspaces/${id}/book`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getAdminFanSpaceBookings: () =>
    fetchJson<{ bookings: any[] }>('/api/admin/fanspaces/bookings'),
  saveFanSpace: (space: any) =>
    fetchJson<{ success: boolean; spaces: any[] }>('/api/admin/fanspaces', {
      method: 'POST',
      body: JSON.stringify(space),
    }),
  deleteFanSpace: (id: string) =>
    fetchJson<{ success: boolean; spaces: any[] }>(`/api/admin/fanspaces/${id}`, {
      method: 'DELETE',
    }),

  // Activity 9: Next-Gen Growth Catalysts
  getGrowthCatalysts: () =>
    fetchJson<{ youthSchools: any[]; creatorPartners: any[]; commentaryFeeds: any[]; passportTiers: any[] }>('/api/growth-catalysts'),
  saveYouthSchool: (school: any) =>
    fetchJson<{ success: boolean; youthSchools: any[] }>('/api/admin/growth/youth-school', {
      method: 'POST',
      body: JSON.stringify(school),
    }),
  deleteYouthSchool: (id: string) =>
    fetchJson<{ success: boolean; youthSchools: any[] }>(`/api/admin/growth/youth-school/${id}`, {
      method: 'DELETE',
    }),
  saveCreatorPartner: (creator: any) =>
    fetchJson<{ success: boolean; creatorPartners: any[] }>('/api/admin/growth/creator', {
      method: 'POST',
      body: JSON.stringify(creator),
    }),
  deleteCreatorPartner: (id: string) =>
    fetchJson<{ success: boolean; creatorPartners: any[] }>(`/api/admin/growth/creator/${id}`, {
      method: 'DELETE',
    }),
  saveAudioFeed: (feed: any) =>
    fetchJson<{ success: boolean; commentaryFeeds: any[] }>('/api/admin/growth/audio-feed', {
      method: 'POST',
      body: JSON.stringify(feed),
    }),
  deleteAudioFeed: (id: string) =>
    fetchJson<{ success: boolean; commentaryFeeds: any[] }>(`/api/admin/growth/audio-feed/${id}`, { method: 'DELETE' }),
  savePassportTier: (tier: any) =>
    fetchJson<{ success: boolean; passportTiers: any[] }>('/api/admin/growth/passport-tier', {
      method: 'POST',
      body: JSON.stringify(tier),
    }),
  deletePassportTier: (id: string) =>
    fetchJson<{ success: boolean; passportTiers: any[] }>(`/api/admin/growth/passport-tier/${id}`, { method: 'DELETE' }),
  /** Registers the signed-in fan's interest in a passport tier (no payment is taken). */
  subscribeSuperfanPassport: (tierId: string) =>
    fetchJson<{ success: boolean; user: any; alreadyRegistered: boolean; tier: any }>('/api/growth/superfan-passport/subscribe', {
      method: 'POST',
      body: JSON.stringify({ tierId }),
    }),

  // Proposal & Financial Budget
  /** Admin only: the proposal is confidential and not served to fans. */
  getProposalSettings: () =>
    fetchJson<{ proposalSettings: any }>('/api/admin/proposal'),
  saveProposalSettings: (settings: any) =>
    fetchJson<{ success: boolean; proposalSettings: any }>('/api/admin/proposal', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  resetProposalSettings: () =>
    fetchJson<{ success: boolean; proposalSettings: any }>('/api/admin/proposal/reset', {
      method: 'POST',
    }),
};
