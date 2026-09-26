import { User, Team, SocialHandle, FeedItem, Match, Contest, PrizeDraw, SystemSettings, AchievementBadge, UserStats, ForumThread, ForumComment, NotificationItem, FCMDeviceToken } from './types';

const TOKEN_KEY = 't10_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${response.status}`);
  }
  return response.json();
}

export const api = {
  // Auth & Profile
  getMe: () => fetchJson<{ user: User | null }>('/api/me'),
  getProfile: () =>
    fetchJson<{ user: User; badges: AchievementBadge[]; stats: UserStats }>('/api/me/profile'),
  claimBadge: (badgeId: string) =>
    fetchJson<{ success: boolean; pointsAdded: number; user: User }>('/api/me/claim-badge', {
      method: 'POST',
      body: JSON.stringify({ badgeId }),
    }),
  updateProfile: (data: { name?: string; avatar?: string }) =>
    fetchJson<{ success: boolean; user: User }>('/api/me/profile/update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  loginGoogle: (email: string, name?: string, avatar?: string) =>
    fetchJson<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, avatar }),
    }),
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

  // Teams & Handles
  getTeams: () => fetchJson<{ teams: Team[] }>('/api/teams'),
  saveTeam: (team: Partial<Team>) =>
    fetchJson<{ success: boolean; teams: Team[] }>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(team),
    }),
  deleteTeam: (id: string) =>
    fetchJson<{ success: boolean; teams: Team[] }>(`/api/teams/${id}`, {
      method: 'DELETE',
    }),
  getHandles: (params?: { teamId?: string; platform?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{ handles: SocialHandle[] }>(`/api/handles${search ? '?' + search : ''}`);
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
  getFeeds: (params?: { teamId?: string; platform?: string; category?: string }) => {
    const search = new URLSearchParams(params as any).toString();
    return fetchJson<{
      items: FeedItem[];
      countsByPlatform: Record<string, number>;
      limitPerPlatform: number;
      totalCurated: number;
      totalAvailable: number;
    }>(`/api/feeds${search ? '?' + search : ''}`);
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

  // Matches
  getMatches: () => fetchJson<{ matches: Match[] }>('/api/matches'),
  saveMatch: (match: Partial<Match>) =>
    fetchJson<{ success: boolean; matches: Match[] }>('/api/matches', {
      method: 'POST',
      body: JSON.stringify(match),
    }),
  simulateBall: (matchId: string) =>
    fetchJson<{ success: boolean; match: Match; summary: string }>(`/api/matches/${matchId}/simulate-ball`, {
      method: 'POST',
    }),

  // Contests & Draws
  getContests: () => fetchJson<{ contests: Contest[]; entries: any[] }>('/api/contests'),
  enterContest: (contestId: string, answers: Record<string, string>) =>
    fetchJson<{ success: boolean; pointsAwarded?: number; user: User }>(`/api/contests/${contestId}/enter`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  getFantasy: (matchId: string) =>
    fetchJson<{ fantasyTeam: any }>('/api/fantasy/${matchId}'),
  submitFantasy: (matchId: string, playerIds: string[], captainId: string) =>
    fetchJson<{ success: boolean; fantasyTeam: any; user: User }>(`/api/fantasy/${matchId}`, {
      method: 'POST',
      body: JSON.stringify({ playerIds, captainId }),
    }),
  getDraws: () => fetchJson<{ draws: PrizeDraw[]; entries: any[] }>('/api/draws'),
  enterDraw: (drawId: string) =>
    fetchJson<{ success: boolean; message: string }>(`/api/draws/${drawId}/enter`, {
      method: 'POST',
    }),
  executeDraw: (drawId: string) =>
    fetchJson<{ success: boolean; draw: PrizeDraw; winner: any }>(`/api/draws/${drawId}/execute`, {
      method: 'POST',
    }),

  // Fan Actions
  checkin: () => fetchJson<{ success: boolean; user: User; pointsAdded: number }>('/api/checkin', {
    method: 'POST',
  }),
  selectTeam: (teamId: string) =>
    fetchJson<{ success: boolean; user: User }>('/api/me/team', {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    }),
  getLeaderboard: () => fetchJson<{ fanWars: any[]; topFans: any[] }>('/api/leaderboard'),

  // Discussion Forum
  getForumThreads: (params?: { category?: string; teamId?: string; search?: string }) => {
    const searchParams = new URLSearchParams(params as any).toString();
    return fetchJson<{ threads: ForumThread[] }>(`/api/forum/threads${searchParams ? '?' + searchParams : ''}`);
  },
  createForumThread: (data: { title: string; content: string; category?: string; teamId?: string; tags?: string[] }) =>
    fetchJson<{ success: boolean; thread: ForumThread; pointsAdded: number; user: User }>('/api/forum/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getForumThreadDetail: (threadId: string) =>
    fetchJson<{ thread: ForumThread; comments: ForumComment[] }>(`/api/forum/threads/${threadId}`),
  addForumComment: (threadId: string, content: string) =>
    fetchJson<{ success: boolean; comment: ForumComment; thread: ForumThread; pointsAdded: number; user: User }>(
      `/api/forum/threads/${threadId}/comments`,
      {
        method: 'POST',
        body: JSON.stringify({ content }),
      }
    ),
  upvoteForumThread: (threadId: string) =>
    fetchJson<{ success: boolean; upvotes: number; upvoted: boolean }>(`/api/forum/threads/${threadId}/upvote`, {
      method: 'POST',
    }),
  upvoteForumComment: (commentId: string) =>
    fetchJson<{ success: boolean; upvotes: number; upvoted: boolean }>(`/api/forum/comments/${commentId}/upvote`, {
      method: 'POST',
    }),

  // Admin Portal
  getAdminDashboard: () => fetchJson<any>('/api/admin/dashboard'),
  runAgent: (agentName: string) =>
    fetchJson<{ success: boolean; agent: string; result: any }>(`/api/admin/agents/${agentName}/run`, {
      method: 'POST',
    }),
  decideApproval: (id: string, decision: 'approve' | 'reject') =>
    fetchJson<{ success: boolean; approval: any }>(`/api/admin/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  getSettings: () => fetchJson<{ settings: SystemSettings }>('/api/admin/settings'),
  saveSettings: (settings: Partial<SystemSettings>) =>
    fetchJson<{ success: boolean; settings: SystemSettings }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  resetDemo: () => fetchJson<{ success: boolean; store: any }>('/api/admin/demo-reset', { method: 'POST' }),

  // Notifications & FCM Real-Time Alerts
  getNotifications: (params?: { category?: string }) => {
    const search = params ? new URLSearchParams(params as any).toString() : '';
    return fetchJson<{
      notifications: NotificationItem[];
      unreadCount: number;
      total: number;
      fcmSubscribed: boolean;
    }>(`/api/notifications${search ? '?' + search : ''}`);
  },
  getNotificationDetails: (id: string) =>
    fetchJson<{
      notification: NotificationItem;
      relatedEntity?: any;
      documentation?: Record<string, any>;
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
  sendPushNotification: (payload: {
    title: string;
    body: string;
    category?: string;
    targetAudience?: 'all' | 'logged_in' | 'team';
    teamId?: string | null;
    url?: string;
    priority?: 'normal' | 'high';
    customData?: Record<string, any>;
  }) =>
    fetchJson<{ success: boolean; notification: NotificationItem; message: string }>('/api/fcm/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  triggerContestDeadline: (contestId: string, customMinutes?: number) =>
    fetchJson<{ success: boolean; notification: NotificationItem }>(
      '/api/admin/notifications/trigger-contest-deadline',
      {
        method: 'POST',
        body: JSON.stringify({ contestId, customMinutes }),
      }
    ),
  triggerMatchResult: (matchId: string) =>
    fetchJson<{ success: boolean; notification: NotificationItem }>(
      '/api/admin/notifications/trigger-match-result',
      {
        method: 'POST',
        body: JSON.stringify({ matchId }),
      }
    ),

  // Gemini AI Features
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
  generateMusic: (prompt: string) =>
    fetchJson<{ status: string; message: string; audioData?: string; audioUrl?: string }>('/api/gemini/music', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  generateVideo: (prompt: string, imageBase64?: string, aspectRatio?: '16:9' | '9:16') =>
    fetchJson<{ status: string; videoUrl?: string; operationName?: string; message: string }>('/api/gemini/video', {
      method: 'POST',
      body: JSON.stringify({ prompt, imageBase64, aspectRatio }),
    }),

  // Activity 8: Global Physical Fan Spaces
  getFanSpaces: () =>
    fetchJson<{ spaces: any[]; bookings: any[]; totalHubs: number; activeCities: string[] }>('/api/fanspaces'),
  bookFanSpace: (id: string, payload: { date?: string; ticketType?: string; ticketsCount?: number }) =>
    fetchJson<{ success: boolean; booking: any; passCode: string; user?: any }>(`/api/fanspaces/${id}/book`, {
      method: 'POST',
      body: JSON.stringify(payload),
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

  // Activity 9: Growth Catalysts
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
  subscribeSuperfanPassport: () =>
    fetchJson<{ success: boolean; user: any }>('/api/growth/superfan-passport/subscribe', {
      method: 'POST',
    }),

  // Proposal & Financial Budget
  getProposalSettings: () =>
    fetchJson<{ proposalSettings: any }>('/api/proposal'),
  saveProposalSettings: (settings: any) =>
    fetchJson<{ success: boolean; proposalSettings: any }>('/api/admin/proposal', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),
  resetProposalSettings: () =>
    fetchJson<{ success: boolean; proposalSettings: any }>('/api/admin/proposal/reset', {
      method: 'POST',
    }),

  // Contests & Matches Admin
  saveContest: (contest: any) =>
    fetchJson<{ success: boolean; contests: any[] }>('/api/admin/contests', {
      method: 'POST',
      body: JSON.stringify(contest),
    }),
  deleteContest: (id: string) =>
    fetchJson<{ success: boolean; contests: any[] }>(`/api/admin/contests/${id}`, {
      method: 'DELETE',
    }),
  toggleContestStatus: (id: string, status?: string) =>
    fetchJson<{ success: boolean; contest: any }>(`/api/admin/contests/${id}/toggle-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  settleContest: (id: string, answers: Record<string, string>) =>
    fetchJson<{ success: boolean; contest: any; settledEntriesCount: number; totalPointsDistributed: number }>(`/api/admin/contests/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  deleteMatch: (id: string) =>
    fetchJson<{ success: boolean; matches: any[] }>(`/api/matches/${id}`, {
      method: 'DELETE',
    }),
};
