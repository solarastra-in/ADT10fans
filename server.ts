import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, Contest, Match, NotificationItem, PrizeDraw, Team, Player, FeedItem, SocialHandle, User, defaultSettings, SUPER_ADMIN_EMAIL } from './server/db';
import {
  IS_PROD, FIREBASE_PROJECT_ID, getAuthUser, requireAdmin, requireUser, upsertUser, createSession, revokeSession,
  verifyFirebaseIdToken, rateLimit, emailOtpAvailable, sendOtpEmail, hashOtp, timingSafeEqualHex, publicUser, adminEmails,
} from './server/auth';
import { seedOfficialTeams } from './server/seedOfficial';
import { syncAllFeeds } from './server/feeds';
import { pushServerConfigured, sendFcm } from './server/push';
import { runDiscoveryAgent, runSocialAgent, runNewsAgent, runScoresAgent, runContentAgent, runOpsAgent } from './server/agents';
import { computeUserBadges } from './server/badges';
import { geminiConfigured, chatWithGemini, searchGroundingCricket, generateMarketingContent, transcribeAudioVoice } from './server/gemini';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// ---------- helpers ----------
type Handler = (req: Request, res: Response, next: NextFunction) => any;
const wrap = (fn: Handler): Handler => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const isHttpsUrl = (v: unknown) => {
  if (typeof v !== 'string' || !v) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};
/** '' stays '' (field cleared); otherwise must be https, else null (= invalid) */
const optionalUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  if (!s) return '';
  return isHttpsUrl(s) ? s : null;
};
const isoOrEmpty = (v: unknown) => {
  const s = str(v, 40);
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString();
};
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
const bad = (res: Response, error: string, code = 400) => res.status(code).json({ error });
const userOf = (req: Request) => (req as any).user as User;

function brand() {
  return db.get().settings.brandName || 'ADT10 Fans';
}

// ---------- public config ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/config', (_req, res) => {
  const s = db.get();
  const st = s.settings;
  res.json({
    config: {
      brandName: st.brandName || 'ADT10 Fans',
      tagline: st.tagline || '',
      copyrightHolder: st.copyrightHolder || 'Azlir Sports',
      seasonLabel: st.seasonLabel,
      seasonStart: st.seasonStart,
      seasonEnd: st.seasonEnd,
      venue: st.venue,
      tickerText: st.tickerText,
      curatorFeedId: st.curatorFeedId,
      curatorContainerId: st.curatorContainerId,
      maxSocialPerPlatform: st.maxSocialPerPlatform || 5,
      features: {
        googleSignIn: Boolean(FIREBASE_PROJECT_ID),
        emailOtp: emailOtpAvailable(),
        gemini: geminiConfigured(),
        pushNotifications: Boolean(process.env.FCM_VAPID_KEY),
      },
      fcmVapidKey: process.env.FCM_VAPID_KEY || '',
      stats: {
        teams: s.teams.length,
        fans: s.users.length,
        handles: s.handles.filter(h => h.status === 'verified').length,
        matches: s.matches.length,
        openContests: s.contests.filter(c => c.status === 'open').length,
        openDraws: s.draws.filter(d => drawStatus(d) === 'open').length,
      },
    },
  });
});

// ---------- auth & profile ----------
app.get('/api/me', (req, res) => res.json({ user: getAuthUser(req) }));

app.get('/api/me/profile', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const { badges, stats } = computeUserBadges(user, store);
  for (const b of badges) if (b.unlocked && !user.badges.includes(b.name)) user.badges.push(b.name);
  user.stats = stats;
  db.save();
  res.json({ user, badges, stats });
});

app.post('/api/me/claim-badge', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const { badges } = computeUserBadges(user, store);
  const target = badges.find(b => b.id === str(req.body?.badgeId, 80));
  if (!target || !target.unlocked) return bad(res, 'Badge not unlocked yet');
  const key = `claimed:${user.id}:${target.id}`;
  if (store.claimedBadges[key]) return bad(res, 'Reward already claimed for this badge');
  store.claimedBadges[key] = true;
  user.points += target.rewardPoints;
  db.save();
  res.json({ success: true, pointsAdded: target.rewardPoints, user });
});

app.post('/api/me/profile/update', requireUser, (req, res) => {
  const user = userOf(req);
  const name = str(req.body?.name, 40);
  if (name) user.name = name;
  if (req.body?.avatar !== undefined) {
    const avatar = optionalUrl(req.body.avatar);
    if (avatar === null) return bad(res, 'Profile picture must be an https:// image link');
    user.avatar = avatar;
  }
  // Keep forum author details in sync.
  const store = db.get();
  for (const t of store.forumThreads) if (t.userId === user.id) { t.userName = user.name; t.userAvatar = user.avatar; }
  for (const c of store.forumComments) if (c.userId === user.id) { c.userName = user.name; c.userAvatar = user.avatar; }
  db.save();
  res.json({ success: true, user });
});

app.post('/api/auth/google', rateLimit('google', 20, 60_000), wrap(async (req, res) => {
  const idToken = str(req.body?.idToken, 5000);
  if (!idToken) return bad(res, 'Missing Google ID token');
  let profile;
  try {
    profile = await verifyFirebaseIdToken(idToken);
  } catch (e: any) {
    return bad(res, e?.message?.includes('not configured') ? e.message : 'Google sign-in could not be verified. Please try again.', 401);
  }
  const user = upsertUser(profile.email, 'google', { name: profile.name, avatar: profile.picture });
  res.json({ token: createSession(user.id), user });
}));

app.post('/api/auth/otp/request', rateLimit('otp-req', 5, 10 * 60_000), wrap(async (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 'Please enter a valid email address');
  if (!emailOtpAvailable()) return bad(res, 'Email sign-in is not available right now. Please use Google sign-in.', 503);
  const store = db.get();
  const recent = store.otpCodes.filter(o => o.email === email && Date.now() - +new Date(o.createdAt) < 60_000);
  if (recent.length) return bad(res, 'A code was just sent. Please wait a minute before requesting another.', 429);
  const code = crypto.randomInt(100000, 1000000).toString();
  store.otpCodes = store.otpCodes.filter(o => +new Date(o.expiresAt) > Date.now() && !o.used).slice(0, 500);
  store.otpCodes.unshift({
    id: newId('otp'),
    email,
    codeHash: hashOtp(email, code),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    attempts: 0,
    used: false,
    createdAt: new Date().toISOString(),
  });
  db.save();
  let mode: 'sent' | 'dev';
  try {
    mode = await sendOtpEmail(email, code, brand());
  } catch (e: any) {
    console.error('[OTP] email send failed:', e?.message);
    return bad(res, 'We could not send the email. Please try again or use Google sign-in.', 502);
  }
  if (mode === 'dev') console.log(`[OTP][dev] code for ${email}: ${code}`);
  res.json({ success: true, message: `We sent a 6-digit code to ${email}.`, ...(mode === 'dev' ? { devCode: code } : {}) });
}));

app.post('/api/auth/otp/verify', rateLimit('otp-verify', 20, 10 * 60_000), (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  const code = str(req.body?.code, 10).replace(/\D/g, '');
  if (!email || code.length !== 6) return bad(res, 'Enter the 6-digit code from your email');
  const store = db.get();
  const otp = store.otpCodes.find(o => o.email === email && !o.used && +new Date(o.expiresAt) > Date.now());
  if (!otp) return bad(res, 'That code has expired. Please request a new one.');
  otp.attempts++;
  if (otp.attempts > 5) {
    otp.used = true;
    db.save();
    return bad(res, 'Too many attempts. Please request a new code.', 429);
  }
  if (!timingSafeEqualHex(otp.codeHash, hashOtp(email, code))) {
    db.save();
    return bad(res, 'That code is not correct');
  }
  otp.used = true;
  const user = upsertUser(email, 'email');
  res.json({ token: createSession(user.id), user });
});

app.post('/api/auth/logout', (req, res) => {
  revokeSession(req);
  res.json({ success: true });
});

// ---------- teams ----------
app.get('/api/teams', (_req, res) => res.json({ teams: [...db.get().teams].sort((a, b) => a.sort - b.sort) }));

app.post('/api/admin/teams/seed-official', requireAdmin, (req, res) => {
  res.json({ success: true, ...seedOfficialTeams(Boolean(req.body?.overwrite)) });
});

const ROLES: Player['role'][] = ['batter', 'bowler', 'allrounder', 'wicketkeeper'];
app.post('/api/teams', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const name = str(b.name, 80);
  if (!name) return bad(res, 'Team name is required');
  const id = str(b.id, 60) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const website = optionalUrl(b.website);
  const logo = optionalUrl(b.logo);
  if (website === null) return bad(res, 'Website must be an https:// link');
  if (logo === null) return bad(res, 'Logo must be an https:// image link');
  const color = /^#[0-9a-f]{6}$/i.test(str(b.color, 7)) ? str(b.color, 7) : '#D9A92E';
  const secondaryColor = /^#[0-9a-f]{6}$/i.test(str(b.secondaryColor, 7)) ? str(b.secondaryColor, 7) : '#0F172A';
  const squad: Player[] = (Array.isArray(b.squad) ? b.squad : [])
    .map((p: any) => ({
      id: str(p.id, 80) || `${id}-${str(p.name, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      teamId: id,
      name: str(p.name, 60),
      role: ROLES.includes(p.role) ? p.role : 'batter',
      category: str(p.category, 30) || undefined,
      credits: Math.min(15, Math.max(0, num(p.credits, 8))),
      isIcon: Boolean(p.isIcon) || str(p.category, 30).toLowerCase() === 'icon',
    }))
    .filter((p: Player) => p.name);
  const existingIdx = store.teams.findIndex(t => t.id === id);
  const now = new Date().toISOString();
  const team: Team = {
    ...(existingIdx >= 0 ? store.teams[existingIdx] : {}),
    id,
    name,
    short: str(b.short, 5).toUpperCase() || name.split(/\s+/).map(w => w[0]).join('').slice(0, 4).toUpperCase(),
    color,
    secondaryColor,
    home: str(b.home, 120) || store.settings.venue || '',
    iconPlayer: str(b.iconPlayer, 60) || squad.find(p => p.isIcon)?.name || '',
    headCoach: str(b.headCoach, 60) || undefined,
    website: website || undefined,
    logo: logo || undefined,
    note: str(b.note, 400) || undefined,
    sort: existingIdx >= 0 ? store.teams[existingIdx].sort : store.teams.length + 1,
    squad,
    createdAt: existingIdx >= 0 ? store.teams[existingIdx].createdAt || now : now,
    updatedAt: now,
  };
  if (b.sort !== undefined) team.sort = num(b.sort, team.sort);
  if (existingIdx >= 0) store.teams[existingIdx] = team;
  else store.teams.push(team);
  db.save();
  res.json({ success: true, teams: store.teams });
});

app.delete('/api/teams/:id', requireAdmin, (req, res) => {
  const store = db.get();
  const id = req.params.id;
  if (store.matches.some(m => m.teamA === id || m.teamB === id)) return bad(res, 'This team has fixtures. Delete or edit those matches first.', 409);
  store.teams = store.teams.filter(t => t.id !== id);
  for (const u of store.users) if (u.teamId === id) u.teamId = null;
  store.handles = store.handles.filter(h => h.teamId !== id);
  db.save();
  res.json({ success: true, teams: store.teams });
});

// ---------- handles ----------
const PLATFORMS: SocialHandle['platform'][] = ['X', 'Instagram', 'Threads', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'RSS'];
app.get('/api/handles', (req, res) => {
  const viewer = getAuthUser(req);
  let result = db.get().handles;
  if (viewer?.role !== 'admin') result = result.filter(h => h.status === 'verified');
  const { teamId, platform } = req.query;
  if (teamId) result = result.filter(h => h.teamId === teamId);
  if (platform) result = result.filter(h => h.platform.toLowerCase() === String(platform).toLowerCase());
  res.json({ handles: result });
});

app.post('/api/handles', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  if (!PLATFORMS.includes(b.platform)) return bad(res, 'Choose a platform');
  if (!isHttpsUrl(b.url)) return bad(res, 'Profile URL must start with https://');
  const teamId = b.teamId ? str(b.teamId, 60) : null;
  if (teamId && !store.teams.some(t => t.id === teamId)) return bad(res, 'Unknown team');
  const url = str(b.url, 500);
  const now = new Date().toISOString();
  const existing = (b.id && store.handles.find(h => h.id === b.id)) || store.handles.find(h => h.url.toLowerCase() === url.toLowerCase());
  const status: SocialHandle['status'] = b.status === 'pending' ? 'pending' : 'verified';
  if (existing) {
    const urlChanged = existing.url !== url;
    Object.assign(existing, {
      platform: b.platform,
      url,
      teamId,
      handle: str(b.handle, 80) || existing.handle,
      status,
      verifiedAt: status === 'verified' ? existing.verifiedAt || now : undefined,
      meta: urlChanged ? {} : existing.meta,
    });
  } else {
    store.handles.push({
      id: newId('h'),
      teamId,
      platform: b.platform,
      handle: str(b.handle, 80) || url.replace(/\/$/, '').split('/').pop() || url,
      url,
      status,
      source: 'admin',
      meta: {},
      verifiedAt: status === 'verified' ? now : undefined,
      foundAt: now,
    });
  }
  db.save();
  res.json({ success: true, handles: store.handles });
});

app.delete('/api/handles/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.handles = store.handles.filter(h => h.id !== req.params.id);
  for (const a of store.approvals) if (a.payload?.handleId === req.params.id && a.status === 'pending') a.status = 'rejected';
  db.save();
  res.json({ success: true, handles: store.handles });
});

// ---------- feeds ----------
const FEED_PLATFORMS = ['YouTube', 'X', 'Instagram', 'Threads', 'TikTok', 'Facebook', 'LinkedIn', 'Web'] as const;
app.get('/api/feeds', (req, res) => {
  const viewer = getAuthUser(req);
  const store = db.get();
  const limit = store.settings.maxSocialPerPlatform || 5;
  const { teamId, platform, category, status } = req.query;
  let items = store.feedItems;
  if (teamId) items = items.filter(f => f.teamId === teamId);
  if (category) items = items.filter(f => f.category === category);
  if (status && viewer?.role === 'admin') items = items.filter(f => f.status === status);
  else items = items.filter(f => f.status !== 'hidden');
  const order = (a: FeedItem, b: FeedItem) =>
    (a.status === 'pinned' ? -1 : 0) - (b.status === 'pinned' ? -1 : 0) || +new Date(b.publishedAt) - +new Date(a.publishedAt);
  if (platform) {
    const filtered = items.filter(f => f.platform.toLowerCase() === String(platform).toLowerCase()).sort(order);
    return res.json({ items: filtered.slice(0, limit * 4), total: filtered.length, limitPerPlatform: limit });
  }
  const countsByPlatform: Record<string, number> = {};
  const curated: FeedItem[] = [];
  for (const p of FEED_PLATFORMS) {
    const list = items.filter(f => f.platform === p).sort(order);
    countsByPlatform[p] = list.length;
    curated.push(...list.slice(0, teamId ? limit * 2 : limit));
  }
  curated.sort(order);
  res.json({ items: curated, countsByPlatform, limitPerPlatform: limit, totalCurated: curated.length, totalAvailable: items.length });
});

const syncFeeds = wrap(async (_req, res) => {
  const r = await syncAllFeeds();
  res.json({ success: true, ...r, feedItems: db.get().feedItems });
});
app.post('/api/admin/feeds/sync', requireAdmin, syncFeeds);
app.post('/api/social/sync-real', requireAdmin, syncFeeds);

app.post('/api/feeds', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const existing = b.id ? store.feedItems.find(f => f.id === b.id) : undefined;
  if (existing) {
    if (b.status && ['live', 'hidden', 'pinned'].includes(b.status)) existing.status = b.status;
    if (b.title !== undefined) existing.title = str(b.title, 300) || existing.title;
    if (b.summary !== undefined) existing.summary = str(b.summary, 1000);
    if (b.teamId !== undefined) existing.teamId = b.teamId || null;
    if (b.url !== undefined) {
      if (!isHttpsUrl(b.url)) return bad(res, 'Link must start with https://');
      existing.url = str(b.url, 1000);
    }
    if (b.image !== undefined) {
      const img = optionalUrl(b.image);
      if (img === null) return bad(res, 'Image must be an https:// link');
      existing.image = img || null;
    }
    db.save();
    return res.json({ success: true, item: existing });
  }
  if (!isHttpsUrl(b.url)) return bad(res, 'Post link must start with https://');
  const title = str(b.title, 300);
  if (!title) return bad(res, 'Title is required');
  const image = optionalUrl(b.image);
  if (image === null) return bad(res, 'Image must be an https:// link');
  const platform = FEED_PLATFORMS.includes(b.platform) ? b.platform : 'Web';
  const item: FeedItem = {
    id: newId('feed'),
    teamId: b.teamId || null,
    platform,
    kind: ['post', 'video', 'live', 'article'].includes(b.kind) ? b.kind : platform === 'YouTube' ? 'video' : 'post',
    category: ['social', 'news', 'marketing'].includes(b.category) ? b.category : 'social',
    title,
    url: str(b.url, 1000),
    image: image || null,
    source: str(b.source, 80) || 'Admin',
    summary: str(b.summary, 1000),
    status: ['live', 'hidden', 'pinned'].includes(b.status) ? b.status : 'live',
    publishedAt: isoOrEmpty(b.publishedAt) || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    sourceType: 'admin',
  };
  store.feedItems.unshift(item);
  db.save();
  res.json({ success: true, item });
});

app.delete('/api/feeds/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.feedItems = store.feedItems.filter(f => f.id !== req.params.id);
  db.save();
  res.json({ success: true });
});

// ---------- notifications ----------
async function dispatchNotification(n: {
  title: string;
  body: string;
  category: NotificationItem['category'];
  targetAudience?: NotificationItem['targetAudience'];
  teamId?: string | null;
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
  createdBy: string;
}): Promise<NotificationItem> {
  const store = db.get();
  const audience = n.targetAudience || 'all';
  const usersById = new Map(store.users.map(u => [u.id, u]));
  const tokens = store.fcmTokens.filter(t => {
    if (!t.enabled) return false;
    if (audience === 'all') return true;
    const u = t.userId ? usersById.get(t.userId) : undefined;
    if (audience === 'logged_in') return Boolean(u);
    return Boolean(u && (!n.teamId || u.teamId === n.teamId));
  });
  const item: NotificationItem = {
    id: newId('notif'),
    title: n.title.slice(0, 160),
    body: n.body.slice(0, 1000),
    category: n.category,
    targetAudience: audience,
    teamId: n.teamId || null,
    data: n.data || {},
    priority: n.priority || 'normal',
    createdAt: new Date().toISOString(),
    createdBy: n.createdBy,
    recipientCount: tokens.length,
    fcmSuccessCount: 0,
    fcmFailureCount: 0,
    delivery: 'in-app',
    readBy: [],
  };
  store.notifications.unshift(item);
  store.notifications = store.notifications.slice(0, 200);
  db.save();

  if (pushServerConfigured() && tokens.length) {
    try {
      const r = await sendFcm(tokens.map(t => t.token), { title: item.title, body: item.body, url: n.data?.url, data: { notificationId: item.id, category: item.category } });
      item.delivery = 'fcm';
      item.fcmSuccessCount = r.success;
      item.fcmFailureCount = r.failure;
      if (r.invalidTokens.length) {
        const dead = new Set(r.invalidTokens);
        for (const t of store.fcmTokens) if (dead.has(t.token)) t.enabled = false;
      }
      db.save();
    } catch (e: any) {
      console.error('[PUSH] send failed:', e?.message);
    }
  }
  return item;
}

app.get('/api/notifications', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  let list = store.notifications.filter(n => {
    if (n.targetAudience === 'all') return true;
    if (!user) return false;
    if (n.targetAudience === 'logged_in') return true;
    return !n.teamId || user.teamId === n.teamId;
  });
  if (req.query.category && req.query.category !== 'all') list = list.filter(n => n.category === req.query.category);
  const out = list.slice(0, 50).map(({ readBy, ...n }) => ({ ...n, read: user ? (readBy || []).includes(user.id) : false }));
  res.json({
    notifications: out,
    unreadCount: user ? out.filter(n => !n.read).length : 0,
    total: out.length,
    fcmSubscribed: user ? store.fcmTokens.some(t => t.userId === user.id && t.enabled) : false,
  });
});

app.get('/api/notifications/:id', (req, res) => {
  const store = db.get();
  const n = store.notifications.find(x => x.id === req.params.id);
  if (!n) return bad(res, 'Notification not found', 404);
  const user = getAuthUser(req);
  const { readBy, ...rest } = n;
  let relatedEntity: any = null;
  if (n.data?.matchId) relatedEntity = store.matches.find(m => m.id === n.data?.matchId) || null;
  else if (n.data?.contestId) {
    const c = store.contests.find(x => x.id === n.data?.contestId);
    relatedEntity = c ? stripAnswers(c, user?.role === 'admin') : null;
  }
  res.json({ notification: { ...rest, read: user ? (readBy || []).includes(user.id) : false }, relatedEntity });
});

app.post('/api/notifications/:id/read', requireUser, (req, res) => {
  const user = userOf(req);
  const n = db.get().notifications.find(x => x.id === req.params.id);
  if (!n) return bad(res, 'Notification not found', 404);
  n.readBy = n.readBy || [];
  if (!n.readBy.includes(user.id)) n.readBy.push(user.id);
  db.save();
  res.json({ success: true, notificationId: n.id, read: true });
});

app.post('/api/notifications/mark-all-read', requireUser, (req, res) => {
  const user = userOf(req);
  for (const n of db.get().notifications) {
    n.readBy = n.readBy || [];
    if (!n.readBy.includes(user.id)) n.readBy.push(user.id);
  }
  db.save();
  res.json({ success: true, message: 'All notifications marked as read' });
});

app.post('/api/fcm/register-token', rateLimit('fcm', 20, 60_000), (req, res) => {
  const token = str(req.body?.token, 4096);
  if (token.length < 100 || !/^[\w:\-]+$/.test(token)) return bad(res, 'Invalid push token');
  const user = getAuthUser(req);
  const store = db.get();
  const now = new Date().toISOString();
  const existing = store.fcmTokens.find(t => t.token === token);
  if (existing) {
    Object.assign(existing, { userId: user?.id || existing.userId, userEmail: user?.email || existing.userEmail, enabled: true, updatedAt: now });
  } else {
    store.fcmTokens.push({
      id: newId('fcm'),
      token,
      userId: user?.id || null,
      userEmail: user?.email || null,
      deviceType: str(req.body?.deviceType, 40) || 'web',
      userAgent: str(req.body?.userAgent, 300),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    });
  }
  db.save();
  res.json({ success: true, message: 'Push notifications enabled on this device', activeSubscribers: store.fcmTokens.filter(t => t.enabled).length });
});

app.get('/api/fcm/tokens', requireAdmin, (_req, res) => {
  const tokens = db.get().fcmTokens;
  res.json({
    totalTokens: tokens.length,
    activeSubscribers: tokens.filter(t => t.enabled).length,
    pushServerConfigured: pushServerConfigured(),
    tokens: tokens.slice(-50).map(t => ({ ...t, token: t.token.slice(0, 12) + '…' })),
  });
});

app.post('/api/fcm/send', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const title = str(b.title, 160);
  const body = str(b.body, 1000);
  if (!title || !body) return bad(res, 'Title and message are required');
  const url = str(b.url, 500);
  const notif = await dispatchNotification({
    title,
    body,
    category: ['match_result', 'contest_deadline', 'announcement', 'perk'].includes(b.category) ? b.category : 'announcement',
    targetAudience: ['all', 'logged_in', 'team'].includes(b.targetAudience) ? b.targetAudience : 'all',
    teamId: b.teamId || null,
    data: { url: url.startsWith('/') || isHttpsUrl(url) ? url : '/' },
    priority: b.priority === 'high' ? 'high' : 'normal',
    createdBy: userOf(req).name || 'Admin',
  });
  res.json({
    success: true,
    notification: notif,
    message: notif.delivery === 'fcm'
      ? `Pushed to ${notif.fcmSuccessCount} device(s)${notif.fcmFailureCount ? `, ${notif.fcmFailureCount} failed` : ''}.`
      : 'Saved as an in-app notification (push server not configured).',
  });
}));

app.post('/api/admin/notifications/trigger-contest-deadline', requireAdmin, wrap(async (req, res) => {
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.body?.contestId);
  if (!contest) return bad(res, 'Choose a contest', 404);
  const mins = Math.max(1, Math.round(num(req.body?.customMinutes, 0)) || (contest.locksAt ? Math.round((+new Date(contest.locksAt) - Date.now()) / 60000) : 15));
  const notif = await dispatchNotification({
    title: `⏳ "${contest.title}" closes in ${mins} min`,
    body: contest.prize ? `Get your picks in for a chance at: ${contest.prize}` : 'Get your picks in before it locks.',
    category: 'contest_deadline',
    targetAudience: 'logged_in',
    data: { contestId: contest.id, url: '/contests', locksAt: contest.locksAt },
    priority: 'high',
    createdBy: 'Contests',
  });
  res.json({ success: true, notification: notif });
}));

function resultNotificationFor(match: Match) {
  const store = db.get();
  const a = store.teams.find(t => t.id === match.teamA);
  const b = store.teams.find(t => t.id === match.teamB);
  const w = store.teams.find(t => t.id === match.winner);
  return {
    title: `🏆 Result: ${a?.name || match.teamA} vs ${b?.name || match.teamB}`,
    body: [match.result || (w ? `${w.name} won` : 'Match completed'), [match.scoreA && `${a?.short} ${match.scoreA}`, match.scoreB && `${b?.short} ${match.scoreB}`].filter(Boolean).join(' · ')].filter(Boolean).join('. '),
    category: 'match_result' as const,
    targetAudience: 'all' as const,
    teamId: null,
    data: { matchId: match.id, url: '/matches' },
    priority: 'high' as const,
    createdBy: 'Match Centre',
  };
}

app.post('/api/admin/notifications/trigger-match-result', requireAdmin, wrap(async (req, res) => {
  const match = db.get().matches.find(m => m.id === req.body?.matchId);
  if (!match) return bad(res, 'Choose a match', 404);
  if (match.status !== 'completed') return bad(res, 'Mark the match as completed first');
  res.json({ success: true, notification: await dispatchNotification(resultNotificationFor(match)) });
}));

// ---------- matches ----------
app.get('/api/matches', (_req, res) => {
  res.json({ matches: [...db.get().matches].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)) });
});

app.post('/api/matches', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const idx = b.id ? store.matches.findIndex(m => m.id === b.id) : -1;
  const prev = idx >= 0 ? store.matches[idx] : undefined;
  const teamA = str(b.teamA ?? prev?.teamA, 60);
  const teamB = str(b.teamB ?? prev?.teamB, 60);
  if (!store.teams.some(t => t.id === teamA) || !store.teams.some(t => t.id === teamB)) return bad(res, 'Choose two existing teams');
  if (teamA === teamB) return bad(res, 'A team cannot play itself');
  const startsAt = isoOrEmpty(b.startsAt ?? prev?.startsAt);
  if (!startsAt) return bad(res, 'Start date and time are required');
  const status: Match['status'] = ['upcoming', 'live', 'completed'].includes(b.status) ? b.status : prev?.status || 'upcoming';
  const winner = b.winner !== undefined ? str(b.winner, 60) : prev?.winner || '';
  if (winner && winner !== teamA && winner !== teamB) return bad(res, 'Winner must be one of the two teams');
  const opt = (k: keyof Match, max = 200) => (b[k] !== undefined ? str(b[k], max) || undefined : (prev?.[k] as any));
  const match: Match = {
    id: prev?.id || newId('m'),
    matchNo: Math.max(1, Math.round(num(b.matchNo, prev?.matchNo || store.matches.length + 1))),
    stage: str(b.stage ?? prev?.stage, 60) || 'Group stage',
    teamA,
    teamB,
    startsAt,
    venue: str(b.venue ?? prev?.venue, 120) || store.settings.venue || '',
    status,
    scoreA: opt('scoreA', 20),
    scoreB: opt('scoreB', 20),
    oversA: opt('oversA', 10),
    oversB: opt('oversB', 10),
    currentOver: opt('currentOver', 120),
    lastCommentary: opt('lastCommentary', 300),
    topScorer: opt('topScorer', 120),
    topWicketTaker: opt('topWicketTaker', 120),
    toss: opt('toss', 200),
    playerOfTheMatch: opt('playerOfTheMatch', 120),
    scorecard: b.scorecard !== undefined ? b.scorecard : prev?.scorecard,
    result: opt('result', 200),
    winner: winner || undefined,
    totalSixes: b.totalSixes !== undefined && b.totalSixes !== '' ? Math.max(0, Math.round(num(b.totalSixes))) : prev?.totalSixes,
    firstInnings: prev?.firstInnings,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) store.matches[idx] = match;
  else store.matches.push(match);
  db.save();
  let notification: NotificationItem | undefined;
  if (match.status === 'completed' && prev?.status !== 'completed' && req.body?.notify !== false) {
    notification = await dispatchNotification(resultNotificationFor(match));
  }
  res.json({ success: true, matches: store.matches, targetMatch: match, notification });
}));

app.delete('/api/matches/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.matches = store.matches.filter(m => m.id !== req.params.id);
  store.fantasyTeams = store.fantasyTeams.filter(f => f.matchId !== req.params.id);
  db.save();
  res.json({ success: true, matches: store.matches });
});

// ---------- contests ----------
function contestLocked(c: Contest) {
  return c.status !== 'open' || (c.locksAt ? +new Date(c.locksAt) <= Date.now() : false);
}
function stripAnswers(c: Contest, isAdmin: boolean): Contest {
  if (isAdmin || c.status === 'settled') return c;
  return { ...c, questions: c.questions.map(({ answer, explain, ...q }) => q) as Contest['questions'] };
}

function drawStatus(d: PrizeDraw): PrizeDraw['status'] {
  if (d.status === 'drawn') return 'drawn';
  if (d.status === 'closed' || +new Date(d.closesAt) <= Date.now()) return 'closed';
  return 'open';
}

app.get('/api/contests', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const isAdmin = user?.role === 'admin';
  const entryCounts: Record<string, number> = {};
  for (const e of store.contestEntries) entryCounts[e.contestId] = (entryCounts[e.contestId] || 0) + 1;
  const contests = store.contests.map(c => {
    // Auto-lock once the lock time has passed.
    if (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= Date.now()) c.status = 'locked';
    return stripAnswers(c, isAdmin);
  });
  res.json({ contests, myEntries: user ? store.contestEntries.filter(e => e.userId === user.id) : [], entryCounts });
});

app.post('/api/contests/:id/enter', requireUser, rateLimit('contest', 30, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.params.id);
  if (!contest) return bad(res, 'Contest not found', 404);
  if (contestLocked(contest)) return bad(res, 'This contest is closed');
  const raw = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  const answers: Record<string, string> = {};
  for (const q of contest.questions) {
    const a = str(raw[q.id], 200);
    if (a && q.options.includes(a)) answers[q.id] = a;
  }
  if (Object.keys(answers).length !== contest.questions.length) return bad(res, 'Please answer every question');
  const existingIdx = store.contestEntries.findIndex(e => e.userId === user.id && e.contestId === contest.id);
  let pointsAwarded: number | undefined;
  if (contest.instant) {
    if (existingIdx >= 0) return bad(res, 'You have already played this quiz');
    pointsAwarded = contest.questions.reduce((sum, q) => sum + (q.answer && answers[q.id] === q.answer ? q.points : 0), 0);
    user.points += pointsAwarded;
  }
  const entry = { userId: user.id, contestId: contest.id, answers, pointsAwarded, createdAt: new Date().toISOString() };
  if (existingIdx >= 0) store.contestEntries[existingIdx] = entry;
  else store.contestEntries.push(entry);
  db.save();
  const results = contest.instant
    ? contest.questions.map(q => ({ id: q.id, correct: answers[q.id] === q.answer, answer: q.answer, explain: q.explain }))
    : undefined;
  res.json({ success: true, pointsAwarded: pointsAwarded || 0, user, results });
});

app.post('/api/admin/contests', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const title = str(b.title, 150);
  if (!title) return bad(res, 'Contest title is required');
  const questions = (Array.isArray(b.questions) ? b.questions : []).map((q: any, i: number) => ({
    id: str(q.id, 60) || `q${i + 1}-${crypto.randomUUID().slice(0, 4)}`,
    prompt: str(q.prompt, 300),
    options: Array.from(new Set((Array.isArray(q.options) ? q.options : []).map((o: any) => str(o, 120)).filter(Boolean))) as string[],
    points: Math.max(1, Math.round(num(q.points, 10))),
    answer: str(q.answer, 120) || undefined,
    explain: str(q.explain, 300) || undefined,
  }));
  if (!questions.length) return bad(res, 'Add at least one question');
  for (const q of questions) {
    if (!q.prompt) return bad(res, 'Every question needs a prompt');
    if (q.options.length < 2) return bad(res, `"${q.prompt}" needs at least two options`);
    if (q.answer && !q.options.includes(q.answer)) return bad(res, `The answer for "${q.prompt}" must be one of its options`);
  }
  const instant = Boolean(b.instant);
  if (instant && questions.some((q: any) => !q.answer)) return bad(res, 'Instant quizzes need a correct answer for every question');
  const matchId = str(b.matchId, 60) || undefined;
  if (matchId && !store.matches.some(m => m.id === matchId)) return bad(res, 'Unknown match');
  const idx = b.id ? store.contests.findIndex(c => c.id === b.id) : -1;
  const contest: Contest = {
    ...(idx >= 0 ? store.contests[idx] : {}),
    id: idx >= 0 ? store.contests[idx].id : newId('c'),
    type: ['predictor', 'sixes', 'captain', 'season', 'trivia'].includes(b.type) ? b.type : 'predictor',
    title,
    description: str(b.description, 600),
    matchId,
    locksAt: isoOrEmpty(b.locksAt) || undefined,
    status: ['open', 'locked', 'settled'].includes(b.status) ? b.status : idx >= 0 ? store.contests[idx].status : 'open',
    prize: str(b.prize, 200),
    instant,
    questions,
    createdAt: idx >= 0 ? store.contests[idx].createdAt : new Date().toISOString(),
  };
  if (idx >= 0) store.contests[idx] = contest;
  else store.contests.push(contest);
  db.save();
  res.json({ success: true, contests: store.contests });
});

app.delete('/api/admin/contests/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.contests = store.contests.filter(c => c.id !== req.params.id);
  store.contestEntries = store.contestEntries.filter(e => e.contestId !== req.params.id);
  db.save();
  res.json({ success: true, contests: store.contests });
});

app.post('/api/admin/contests/:id/toggle-status', requireAdmin, (req, res) => {
  const c = db.get().contests.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Contest not found', 404);
  if (c.status === 'settled') return bad(res, 'Settled contests cannot be reopened');
  c.status = req.body?.status === 'open' || req.body?.status === 'locked' ? req.body.status : c.status === 'open' ? 'locked' : 'open';
  if (c.status === 'open' && c.locksAt && +new Date(c.locksAt) <= Date.now()) c.locksAt = undefined;
  db.save();
  res.json({ success: true, contest: c });
});

app.post('/api/admin/contests/:id/settle', requireAdmin, wrap(async (req, res) => {
  const store = db.get();
  const contest = store.contests.find(c => c.id === req.params.id);
  if (!contest) return bad(res, 'Contest not found', 404);
  if (contest.status === 'settled') return bad(res, 'Already settled');
  const answers = req.body?.answers && typeof req.body.answers === 'object' ? req.body.answers : {};
  for (const q of contest.questions) {
    const a = str(answers[q.id], 120);
    if (a) {
      if (!q.options.includes(a)) return bad(res, `Answer for "${q.prompt}" must be one of its options`);
      q.answer = a;
    }
  }
  if (contest.questions.some(q => !q.answer)) return bad(res, 'Pick the correct answer for every question');
  contest.status = 'settled';
  let winners = 0;
  let total = 0;
  for (const e of store.contestEntries.filter(x => x.contestId === contest.id)) {
    if (contest.instant) continue; // already graded on entry
    const pts = contest.questions.reduce((s, q) => s + (e.answers[q.id] === q.answer ? q.points : 0), 0);
    e.pointsAwarded = pts;
    const u = store.users.find(x => x.id === e.userId);
    if (u && pts > 0) {
      u.points += pts;
      winners++;
      total += pts;
    }
  }
  db.save();
  await dispatchNotification({
    title: `🎯 Results: ${contest.title}`,
    body: 'Answers are in and points have been added. See where you rank on the leaderboard.',
    category: 'announcement',
    targetAudience: 'logged_in',
    data: { contestId: contest.id, url: '/contests' },
    createdBy: 'Contests',
  });
  res.json({ success: true, contest, settledEntriesCount: winners, totalPointsDistributed: total });
}));

// ---------- fantasy ----------
const FANTASY_CREDIT_CAP = 55;
app.get('/api/fantasy/:matchId', (req, res) => {
  const user = getAuthUser(req);
  res.json({ fantasyTeam: user ? db.get().fantasyTeams.find(f => f.userId === user.id && f.matchId === req.params.matchId) || null : null });
});

app.post('/api/fantasy/:matchId', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const match = store.matches.find(m => m.id === req.params.matchId);
  if (!match) return bad(res, 'Match not found', 404);
  if (match.status !== 'upcoming' || +new Date(match.startsAt) <= Date.now()) return bad(res, 'Lineups are locked for this match');
  const ids: string[] = Array.isArray(req.body?.playerIds) ? Array.from(new Set(req.body.playerIds.map((x: any) => String(x)))) : [];
  const captainId = str(req.body?.captainId, 80);
  if (ids.length !== 6 || !ids.includes(captainId)) return bad(res, 'Pick exactly 6 players and choose one of them as captain');
  const pool = store.teams.filter(t => t.id === match.teamA || t.id === match.teamB).flatMap(t => t.squad);
  const picked = ids.map(id => pool.find(p => p.id === id));
  if (picked.some(p => !p)) return bad(res, 'Players must come from the two teams in this match');
  const credits = picked.reduce((s, p) => s + (p!.credits || 0), 0);
  if (credits > FANTASY_CREDIT_CAP) return bad(res, `Your lineup uses ${credits} credits; the cap is ${FANTASY_CREDIT_CAP}`);
  const idx = store.fantasyTeams.findIndex(f => f.userId === user.id && f.matchId === match.id);
  const team = { userId: user.id, matchId: match.id, playerIds: ids, captainId, createdAt: new Date().toISOString() };
  if (idx >= 0) store.fantasyTeams[idx] = team;
  else store.fantasyTeams.push(team);
  db.save();
  res.json({ success: true, fantasyTeam: team, user });
});

// ---------- draws ----------
app.get('/api/draws', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  const myEntries = user ? store.drawEntries.filter(e => e.userId === user.id).map(e => e.drawId) : [];
  const draws = store.draws.map(d => ({
    ...d,
    status: drawStatus(d),
    winnerUserId: undefined,
    entriesCount: store.drawEntries.filter(e => e.drawId === d.id).length,
    entered: myEntries.includes(d.id),
  }));
  res.json({ draws, myEntries });
});

app.post('/api/draws/:id/enter', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return bad(res, 'Draw not found', 404);
  if (drawStatus(draw) !== 'open') return bad(res, 'This draw is closed');
  if (draw.teamOnly && user.teamId !== draw.teamOnly) {
    const t = store.teams.find(x => x.id === draw.teamOnly);
    return bad(res, `This draw is only for ${t?.name || 'one team'}'s fans`, 403);
  }
  if (store.drawEntries.some(e => e.drawId === draw.id && e.userId === user.id)) return bad(res, "You're already in this draw");
  store.drawEntries.push({ drawId: draw.id, userId: user.id, userEmail: user.email, userName: user.name, createdAt: new Date().toISOString() });
  db.save();
  res.json({ success: true, message: "You're in! Good luck." });
});

app.post('/api/admin/draws', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const title = str(b.title, 150);
  const prize = str(b.prize, 200);
  const closesAt = isoOrEmpty(b.closesAt);
  if (!title || !prize) return bad(res, 'Title and prize are required');
  if (!closesAt) return bad(res, 'Closing date is required');
  const teamOnly = str(b.teamOnly, 60) || null;
  if (teamOnly && !store.teams.some(t => t.id === teamOnly)) return bad(res, 'Unknown team');
  const idx = b.id ? store.draws.findIndex(d => d.id === b.id) : -1;
  if (idx >= 0 && store.draws[idx].status === 'drawn') return bad(res, 'This draw has already been drawn');
  const draw: PrizeDraw = {
    ...(idx >= 0 ? store.draws[idx] : {}),
    id: idx >= 0 ? store.draws[idx].id : newId('draw'),
    title,
    prize,
    description: str(b.description, 800),
    color: /^#[0-9a-f]{6}$/i.test(str(b.color, 7)) ? str(b.color, 7) : '#D9A92E',
    closesAt,
    status: b.status === 'closed' ? 'closed' : 'open',
    teamOnly,
    createdAt: idx >= 0 ? store.draws[idx].createdAt : new Date().toISOString(),
  };
  if (idx >= 0) store.draws[idx] = draw;
  else store.draws.push(draw);
  db.save();
  res.json({ success: true, draws: store.draws });
});

app.delete('/api/admin/draws/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.draws = store.draws.filter(d => d.id !== req.params.id);
  store.drawEntries = store.drawEntries.filter(e => e.drawId !== req.params.id);
  db.save();
  res.json({ success: true, draws: store.draws });
});

app.get('/api/admin/draws/:id/entries', requireAdmin, (req, res) => {
  res.json({ entries: db.get().drawEntries.filter(e => e.drawId === req.params.id).map(({ userName, userEmail, createdAt }) => ({ userName, userEmail, createdAt })) });
});

app.post('/api/draws/:id/execute', requireAdmin, (req, res) => {
  const store = db.get();
  const draw = store.draws.find(d => d.id === req.params.id);
  if (!draw) return bad(res, 'Draw not found', 404);
  if (draw.status === 'drawn') return bad(res, 'Already drawn');
  const entries = store.drawEntries.filter(e => e.drawId === draw.id).sort((a, b) => a.userId.localeCompare(b.userId));
  if (!entries.length) return bad(res, 'No entries yet');
  // Verifiable: winnerIndex = int(sha256(seed + ':' + entrantsHash)[0..8], 16) % entries (entrants sorted by id)
  const seed = crypto.randomBytes(16).toString('hex');
  const entrantsHash = crypto.createHash('sha256').update(entries.map(e => e.userId).join(':')).digest('hex');
  const h = crypto.createHash('sha256').update(`${seed}:${entrantsHash}`).digest('hex');
  const winner = entries[parseInt(h.slice(0, 8), 16) % entries.length];
  Object.assign(draw, { status: 'drawn', winnerUserId: winner.userId, winnerName: winner.userName, seed, entrantsHash, drawnAt: new Date().toISOString() });
  db.save();
  res.json({ success: true, draw, winner: { userName: winner.userName, userEmail: winner.userEmail } });
});

// ---------- fan actions ----------
app.post('/api/checkin', requireUser, (req, res) => {
  const user = userOf(req);
  const now = new Date();
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const last = user.lastCheckin ? new Date(user.lastCheckin) : null;
  if (last && dayKey(last) === dayKey(now)) return bad(res, "You've already checked in today. Come back tomorrow!");
  const yesterday = new Date(now.getTime() - 86400000);
  user.streak = last && dayKey(last) === dayKey(yesterday) ? user.streak + 1 : 1;
  const pts = 10 * Math.min(user.streak, 5);
  user.points += pts;
  user.lastCheckin = now.toISOString();
  db.save();
  res.json({ success: true, user, pointsAdded: pts });
});

app.post('/api/me/team', requireUser, (req, res) => {
  const user = userOf(req);
  const team = db.get().teams.find(t => t.id === req.body?.teamId);
  if (!team) return bad(res, 'Team not found', 404);
  if (user.teamId !== team.id) {
    user.teamId = team.id;
    user.teamChanges += 1;
  }
  db.save();
  res.json({ success: true, user });
});

app.get('/api/leaderboard', (_req, res) => {
  const store = db.get();
  const totals = new Map(store.teams.map(t => [t.id, { team: t, points: 0, fansCount: 0 }]));
  for (const u of store.users) {
    const row = u.teamId ? totals.get(u.teamId) : undefined;
    if (row) {
      row.points += u.points;
      row.fansCount++;
    }
  }
  const fanWars = [...totals.values()].sort((a, b) => b.points - a.points || a.team.sort - b.team.sort);
  const topFans = [...store.users].filter(u => u.points > 0).sort((a, b) => b.points - a.points).slice(0, 20).map(publicUser);
  res.json({ fanWars, topFans });
});

// ---------- forum ----------
const FORUM_CATEGORIES = ['matchday', 'tactics', 'franchises', 'fantasy', 'fanspaces', 'giveaways', 'general'];
app.get('/api/forum/threads', (req, res) => {
  const { category, teamId, search } = req.query;
  let threads = [...db.get().forumThreads];
  if (category && category !== 'all') threads = threads.filter(t => t.category === category);
  if (teamId && teamId !== 'all') threads = threads.filter(t => t.teamId === teamId);
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    threads = threads.filter(t => t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q) || t.tags?.some(g => g.toLowerCase().includes(q)));
  }
  threads.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || +new Date(b.lastActivityAt || b.createdAt) - +new Date(a.lastActivityAt || a.createdAt));
  res.json({ threads: threads.slice(0, 200).map(({ upvotedBy, ...t }) => ({ ...t, upvotedBy })) });
});

app.post('/api/forum/threads', requireUser, rateLimit('thread', 5, 10 * 60_000), (req, res) => {
  const user = userOf(req);
  const title = str(req.body?.title, 150);
  const content = str(req.body?.content, 5000);
  if (title.length < 5) return bad(res, 'Title must be at least 5 characters');
  if (content.length < 10) return bad(res, 'Post must be at least 10 characters');
  const store = db.get();
  const teamId = req.body?.teamId && store.teams.some(t => t.id === req.body.teamId) ? req.body.teamId : null;
  const tags = (Array.isArray(req.body?.tags) ? req.body.tags : []).map((t: any) => str(t, 24)).filter(Boolean).slice(0, 5);
  const now = new Date().toISOString();
  const thread = {
    id: newId('thread'),
    title,
    content,
    category: FORUM_CATEGORIES.includes(req.body?.category) ? req.body.category : 'general',
    tags,
    teamId,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userBadge: user.role === 'admin' ? 'Admin' : undefined,
    pinned: false,
    upvotes: 0,
    upvotedBy: [],
    views: 0,
    commentsCount: 0,
    lastActivityAt: now,
    createdAt: now,
  };
  store.forumThreads.unshift(thread);
  user.points += 15;
  db.save();
  res.json({ success: true, thread, pointsAdded: 15, user });
});

app.get('/api/forum/threads/:id', (req, res) => {
  const store = db.get();
  const thread = store.forumThreads.find(t => t.id === req.params.id);
  if (!thread) return bad(res, 'Thread not found', 404);
  thread.views = (thread.views || 0) + 1;
  db.save();
  const comments = store.forumComments.filter(c => c.threadId === thread.id).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  res.json({ thread, comments });
});

app.post('/api/forum/threads/:id/comments', requireUser, rateLimit('comment', 20, 10 * 60_000), (req, res) => {
  const user = userOf(req);
  const content = str(req.body?.content, 3000);
  if (content.length < 2) return bad(res, 'Reply cannot be empty');
  const store = db.get();
  const thread = store.forumThreads.find(t => t.id === req.params.id);
  if (!thread) return bad(res, 'Thread not found', 404);
  const comment = {
    id: newId('comment'),
    threadId: thread.id,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    userBadge: user.role === 'admin' ? 'Admin' : undefined,
    teamId: user.teamId || null,
    content,
    upvotes: 0,
    upvotedBy: [],
    createdAt: new Date().toISOString(),
  };
  store.forumComments.push(comment);
  thread.commentsCount = store.forumComments.filter(c => c.threadId === thread.id).length;
  thread.lastActivityAt = comment.createdAt;
  user.points += 5;
  db.save();
  res.json({ success: true, comment, thread, pointsAdded: 5, user });
});

function toggleVote(entity: { upvotes: number; upvotedBy?: string[] }, userId: string) {
  entity.upvotedBy = entity.upvotedBy || [];
  const had = entity.upvotedBy.includes(userId);
  entity.upvotedBy = had ? entity.upvotedBy.filter(id => id !== userId) : [...entity.upvotedBy, userId];
  entity.upvotes = entity.upvotedBy.length;
  return !had;
}
app.post('/api/forum/threads/:id/upvote', requireUser, (req, res) => {
  const t = db.get().forumThreads.find(x => x.id === req.params.id);
  if (!t) return bad(res, 'Thread not found', 404);
  const upvoted = toggleVote(t, userOf(req).id);
  db.save();
  res.json({ success: true, upvotes: t.upvotes, upvoted });
});
app.post('/api/forum/comments/:id/upvote', requireUser, (req, res) => {
  const c = db.get().forumComments.find(x => x.id === req.params.id);
  if (!c) return bad(res, 'Comment not found', 404);
  const upvoted = toggleVote(c, userOf(req).id);
  db.save();
  res.json({ success: true, upvotes: c.upvotes, upvoted });
});

app.delete('/api/admin/forum/threads/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.forumThreads = store.forumThreads.filter(t => t.id !== req.params.id);
  store.forumComments = store.forumComments.filter(c => c.threadId !== req.params.id);
  db.save();
  res.json({ success: true });
});
app.delete('/api/admin/forum/comments/:id', requireAdmin, (req, res) => {
  const store = db.get();
  const c = store.forumComments.find(x => x.id === req.params.id);
  store.forumComments = store.forumComments.filter(x => x.id !== req.params.id);
  const t = c && store.forumThreads.find(x => x.id === c.threadId);
  if (t) t.commentsCount = store.forumComments.filter(x => x.threadId === t.id).length;
  db.save();
  res.json({ success: true });
});
app.post('/api/admin/forum/threads/:id/pin', requireAdmin, (req, res) => {
  const t = db.get().forumThreads.find(x => x.id === req.params.id);
  if (!t) return bad(res, 'Thread not found', 404);
  t.pinned = Boolean(req.body?.pinned);
  db.save();
  res.json({ success: true, thread: t });
});

// ---------- admin: dashboard, agents, approvals, settings ----------
function maskedSettings() {
  const s = db.get().settings;
  return {
    ...s,
    adminEmails: adminEmails(),
    curatorApiKey: s.curatorApiKey ? '********' : '',
    smtp: { ...s.smtp, pass: s.smtp.pass ? '********' : '' },
  };
}

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const s = db.get();
  res.json({
    usersCount: s.users.length,
    handlesCount: s.handles.length,
    feedItemsCount: s.feedItems.length,
    matchesCount: s.matches.length,
    contestsCount: s.contests.length,
    drawsCount: s.draws.length,
    notificationsCount: s.notifications.length,
    fcmSubscribersCount: s.fcmTokens.filter(t => t.enabled).length,
    pendingApprovals: s.approvals.filter(a => a.status === 'pending'),
    agentRuns: s.agentRuns.slice(0, 20),
    settings: maskedSettings(),
    integrations: {
      gemini: geminiConfigured(),
      smtp: emailOtpAvailable() && (IS_PROD || Boolean(process.env.SMTP_HOST || s.settings.smtp.enabled)),
      pushServer: pushServerConfigured(),
      pushClient: Boolean(process.env.FCM_VAPID_KEY),
      googleSignIn: Boolean(FIREBASE_PROJECT_ID),
      curator: Boolean(s.settings.curatorFeedId),
      persistentStorage: Boolean(process.env.DATA_DIR),
    },
  });
});

const AGENTS: Record<string, () => Promise<any>> = {
  discovery: runDiscoveryAgent,
  social: runSocialAgent,
  news: runNewsAgent,
  scores: runScoresAgent,
  content: runContentAgent,
  ops: runOpsAgent,
};
app.post('/api/admin/agents/:name/run', requireAdmin, wrap(async (req, res) => {
  const fn = AGENTS[req.params.name];
  if (!fn) return bad(res, 'Unknown agent');
  res.json({ success: true, agent: req.params.name, result: await fn() });
}));

app.post('/api/admin/approvals/:id/decide', requireAdmin, (req, res) => {
  const store = db.get();
  const a = store.approvals.find(x => x.id === req.params.id);
  if (!a) return bad(res, 'Approval not found', 404);
  if (a.status !== 'pending') return bad(res, 'Already decided');
  const approve = req.body?.decision === 'approve';
  a.status = approve ? 'approved' : 'rejected';
  a.decidedAt = new Date().toISOString();
  if (a.kind === 'handle') {
    const h = store.handles.find(x => x.id === a.payload?.handleId);
    if (h) {
      if (approve) {
        h.status = 'verified';
        h.verifiedAt = a.decidedAt;
      } else {
        store.handles = store.handles.filter(x => x.id !== h.id);
      }
    }
  } else if (a.kind === 'post' && approve) {
    store.feedItems.unshift({
      id: newId('feed'),
      teamId: a.payload?.teamId || null,
      platform: 'Web',
      kind: 'article',
      category: 'marketing',
      title: str(a.payload?.title, 200) || a.title,
      url: '/matches',
      image: null,
      source: brand(),
      summary: str(a.payload?.summary, 1200),
      status: 'live',
      publishedAt: a.decidedAt,
      createdAt: a.decidedAt,
      sourceType: 'ai',
    });
  }
  db.save();
  res.json({ success: true, approval: a });
});

app.get('/api/admin/settings', requireAdmin, (_req, res) => res.json({ settings: maskedSettings() }));

app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const b = req.body || {};
  const s = db.get().settings;
  const d = defaultSettings();
  const textKeys = ['brandName', 'tagline', 'copyrightHolder', 'seasonLabel', 'venue', 'tickerText', 'curatorFeedId', 'curatorContainerId', 'curatorFeedUuid', 'curatorHashtags'] as const;
  for (const k of textKeys) if (b[k] !== undefined) (s as any)[k] = str(b[k], k === 'tickerText' ? 300 : 120);
  if (!s.brandName) s.brandName = d.brandName;
  if (!s.copyrightHolder) s.copyrightHolder = d.copyrightHolder;
  if (b.seasonStart !== undefined) s.seasonStart = str(b.seasonStart, 10);
  if (b.seasonEnd !== undefined) s.seasonEnd = str(b.seasonEnd, 10);
  if (b.newsQueries !== undefined) s.newsQueries = str(b.newsQueries, 2000);
  if (b.maxSocialPerPlatform !== undefined) s.maxSocialPerPlatform = Math.min(20, Math.max(1, Math.round(num(b.maxSocialPerPlatform, 5))));
  if (b.curatorApiKey !== undefined && b.curatorApiKey !== '********') s.curatorApiKey = str(b.curatorApiKey, 200);
  if (b.adminEmails !== undefined) {
    const list = (Array.isArray(b.adminEmails) ? b.adminEmails : String(b.adminEmails).split(','))
      .map((e: any) => String(e).trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    s.adminEmails = list.filter((e: string) => !envAdmins.includes(e));
    const me = userOf(req).email.toLowerCase();
    if (!envAdmins.includes(me) && !s.adminEmails.includes(me)) s.adminEmails.push(me); // never lock yourself out
  }
  if (b.smtp && typeof b.smtp === 'object') {
    s.smtp = {
      host: b.smtp.host !== undefined ? str(b.smtp.host, 120) : s.smtp.host,
      port: b.smtp.port !== undefined ? Math.round(num(b.smtp.port, 587)) : s.smtp.port,
      user: b.smtp.user !== undefined ? str(b.smtp.user, 120) : s.smtp.user,
      pass: b.smtp.pass && b.smtp.pass !== '********' ? String(b.smtp.pass).slice(0, 200) : s.smtp.pass,
      from: b.smtp.from !== undefined ? str(b.smtp.from, 160) : s.smtp.from,
      enabled: b.smtp.enabled !== undefined ? Boolean(b.smtp.enabled) : s.smtp.enabled,
    };
  }
  db.save();
  res.json({ success: true, settings: maskedSettings() });
});

// ---------- Admins & RBAC Management ----------
app.get('/api/admin/admins', requireAdmin('admins'), (_req, res) => {
  const store = db.get();
  const list = [...(store.adminUsers || [])];
  if (!list.some(a => a.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())) {
    list.unshift({
      email: SUPER_ADMIN_EMAIL,
      name: 'Super Admin',
      role: 'superadmin',
      permissions: [
        'all',
        'leagues',
        'matches',
        'teams',
        'contests',
        'winners',
        'draws',
        'feeds',
        'social',
        'notifications',
        'fanspaces',
        'growth',
        'settings',
        'admins',
      ],
      isSuperAdmin: true,
      addedBy: 'system',
      addedAt: '2026-11-01T00:00:00.000Z',
    });
  }
  res.json({ admins: list, superAdminEmail: SUPER_ADMIN_EMAIL });
});

app.post('/api/admin/admins', requireAdmin('admins'), (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 'Valid email required');
  const role = (req.body?.role || 'league_admin') as any;
  const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : ['leagues'];
  const name = str(req.body?.name, 80) || email.split('@')[0];

  const store = db.get();
  if (!store.adminUsers) store.adminUsers = [];

  const existingIdx = store.adminUsers.findIndex(a => a.email.toLowerCase() === email);
  const caller = userOf(req);
  const now = new Date().toISOString();

  if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
    if (existingIdx !== -1) {
      store.adminUsers[existingIdx] = {
        ...store.adminUsers[existingIdx],
        name: name || store.adminUsers[existingIdx].name,
        role: 'superadmin',
        isSuperAdmin: true,
        permissions: [
          'all',
          'leagues',
          'matches',
          'teams',
          'contests',
          'winners',
          'draws',
          'feeds',
          'social',
          'notifications',
          'fanspaces',
          'growth',
          'settings',
          'admins',
        ],
        updatedAt: now,
      };
    }
  } else {
    const isSuper = role === 'superadmin';
    const rec = {
      email,
      name,
      role,
      permissions: isSuper
        ? [
            'all',
            'leagues',
            'matches',
            'teams',
            'contests',
            'winners',
            'draws',
            'feeds',
            'social',
            'notifications',
            'fanspaces',
            'growth',
            'settings',
            'admins',
          ]
        : permissions,
      isSuperAdmin: isSuper,
      addedBy: caller.email,
      addedAt: existingIdx !== -1 ? store.adminUsers[existingIdx].addedAt : now,
      updatedAt: now,
    };
    if (existingIdx !== -1) {
      store.adminUsers[existingIdx] = rec;
    } else {
      store.adminUsers.push(rec);
    }
  }

  const user = store.users.find(u => u.email.toLowerCase() === email);
  if (user) {
    user.role = 'admin';
    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      user.isSuperAdmin = true;
      user.adminRole = 'superadmin';
      user.permissions = [
        'all',
        'leagues',
        'matches',
        'teams',
        'contests',
        'winners',
        'draws',
        'feeds',
        'social',
        'notifications',
        'fanspaces',
        'growth',
        'settings',
        'admins',
      ];
    } else {
      user.isSuperAdmin = role === 'superadmin';
      user.adminRole = role;
      user.permissions = role === 'superadmin' ? ['all'] : permissions;
    }
  }

  db.save();
  res.json({ success: true, admins: store.adminUsers });
});

app.delete('/api/admin/admins/:email', requireAdmin('admins'), (req, res) => {
  const target = str(req.params.email, 200).toLowerCase();
  if (target === SUPER_ADMIN_EMAIL.toLowerCase()) {
    return bad(res, 'Super admin (solarastra.in@gmail.com) cannot be removed');
  }
  const store = db.get();
  store.adminUsers = (store.adminUsers || []).filter(a => a.email.toLowerCase() !== target);

  const user = store.users.find(u => u.email.toLowerCase() === target);
  if (user) {
    user.role = 'fan';
    user.isSuperAdmin = false;
    user.adminRole = undefined;
    user.permissions = [];
  }
  db.save();
  res.json({ success: true, admins: store.adminUsers });
});

// ---------- fan spaces ----------
app.get('/api/fanspaces', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  res.json({
    spaces: store.fanSpaces,
    bookings: user ? store.fanSpaceBookings.filter(b => b.userId === user.id) : [],
    totalHubs: store.fanSpaces.length,
    activeCities: [...new Set(store.fanSpaces.map(s => s.city).filter(Boolean))],
  });
});

app.post('/api/fanspaces/:id/book', requireUser, rateLimit('booking', 10, 60_000), (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const space = store.fanSpaces.find(s => s.id === req.params.id);
  if (!space) return bad(res, 'Fan Space not found', 404);
  if (space.status === 'sold_out' || space.bookingEnabled === false) return bad(res, 'Reservations are not open for this Fan Space');
  const ticketType = ['standard_entry', 'vip_pass'].includes(req.body?.ticketType) ? req.body.ticketType : 'standard_entry';
  const ticketsCount = Math.min(6, Math.max(1, Math.round(num(req.body?.ticketsCount, 1))));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(req.body?.date, 10)) ? str(req.body.date, 10) : '';
  if (!date) return bad(res, 'Choose a date');
  const reserved = store.fanSpaceBookings.filter(b => b.spaceId === space.id && b.date === date).reduce((s, b) => s + b.ticketsCount, 0);
  if (space.capacity && reserved + ticketsCount > space.capacity) return bad(res, 'That date is full');
  const passCode = `${(space.city || 'FS').slice(0, 3).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const booking = {
    id: newId('bk'), spaceId: space.id, spaceName: space.name, userId: user.id, userName: user.name, userEmail: user.email,
    date, ticketType, ticketsCount, passCode, createdAt: new Date().toISOString(),
  };
  store.fanSpaceBookings.unshift(booking as any);
  space.totalBookings = store.fanSpaceBookings.filter(b => b.spaceId === space.id).reduce((s, b) => s + b.ticketsCount, 0);
  db.save();
  res.json({ success: true, booking, passCode, user });
});

app.get('/api/admin/fanspaces/bookings', requireAdmin, (_req, res) => res.json({ bookings: db.get().fanSpaceBookings }));

app.post('/api/admin/fanspaces', requireAdmin, (req, res) => {
  const b = req.body || {};
  const store = db.get();
  const name = str(b.name, 100);
  const city = str(b.city, 60);
  if (!name || !city) return bad(res, 'Name and city are required');
  const image = optionalUrl(b.image);
  const mapUrl = optionalUrl(b.mapUrl);
  if (image === null || mapUrl === null) return bad(res, 'Image and map links must start with https://');
  const list = (v: any) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : []).map((x: any) => str(x, 80)).filter(Boolean);
  const idx = b.id ? store.fanSpaces.findIndex(s => s.id === b.id) : -1;
  const space = {
    ...(idx >= 0 ? store.fanSpaces[idx] : {}),
    id: idx >= 0 ? store.fanSpaces[idx].id : newId('space'),
    name,
    city,
    country: str(b.country, 60),
    tagline: str(b.tagline, 160),
    location: str(b.location, 200),
    capacity: Math.max(0, Math.round(num(b.capacity, 0))),
    status: ['active', 'upcoming', 'sold_out'].includes(b.status) ? b.status : 'upcoming',
    image: image || '',
    mapUrl: mapUrl || '',
    features: list(b.features),
    amenities: list(b.amenities),
    openHours: str(b.openHours, 120),
    liveMatchSchedule: str(b.liveMatchSchedule, 200),
    vipPassPriceAed: Math.max(0, num(b.vipPassPriceAed, 0)),
    vipPassPriceUsd: Math.max(0, num(b.vipPassPriceUsd, 0)),
    vipPerks: list(b.vipPerks),
    merchBoutique: str(b.merchBoutique, 200),
    menuHighlights: str(b.menuHighlights, 200),
    bookingEnabled: b.bookingEnabled !== false,
    totalBookings: idx >= 0 ? store.fanSpaces[idx].totalBookings : 0,
  };
  if (idx >= 0) store.fanSpaces[idx] = space as any;
  else store.fanSpaces.push(space as any);
  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

app.delete('/api/admin/fanspaces/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.fanSpaces = store.fanSpaces.filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, spaces: store.fanSpaces });
});

// ---------- growth ----------
app.get('/api/growth-catalysts', (_req, res) => {
  const s = db.get();
  res.json({ youthSchools: s.youthSchools, creatorPartners: s.creatorPartners, commentaryFeeds: s.commentaryFeeds, passportTiers: s.passportTiers });
});

function upsert<T extends { id: string }>(list: T[], item: T, idProvided: boolean): T[] {
  const idx = idProvided ? list.findIndex(x => x.id === item.id) : -1;
  if (idx >= 0) list[idx] = { ...list[idx], ...item };
  else list.push(item);
  return list;
}

app.post('/api/admin/growth/youth-school', requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 120);
  if (!name) return bad(res, 'School name is required');
  const store = db.get();
  upsert(store.youthSchools, {
    id: str(b.id, 60) || newId('school'),
    name,
    region: str(b.region, 40) || 'UAE',
    city: str(b.city, 60),
    studentsCount: Math.max(0, Math.round(num(b.studentsCount, 0))),
    tapeBallTeam: str(b.tapeBallTeam, 80),
    status: ['registered', 'bracket_qualified', 'champion'].includes(b.status) ? b.status : 'registered',
    equipmentKitGranted: Boolean(b.equipmentKitGranted),
    matchdayTicketsAllocated: Math.max(0, Math.round(num(b.matchdayTicketsAllocated, 0))),
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});
app.delete('/api/admin/growth/youth-school/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.youthSchools = store.youthSchools.filter(s => s.id !== req.params.id);
  db.save();
  res.json({ success: true, youthSchools: store.youthSchools });
});

app.post('/api/admin/growth/creator', requireAdmin, (req, res) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  if (!name) return bad(res, 'Creator name is required');
  if (!isHttpsUrl(b.streamUrl)) return bad(res, "Add the creator's channel or profile link (https://)");
  const avatar = optionalUrl(b.avatar);
  if (avatar === null) return bad(res, 'Avatar must be an https:// image link');
  const store = db.get();
  upsert(store.creatorPartners, {
    id: str(b.id, 60) || newId('creator'),
    name,
    handle: str(b.handle, 80),
    platform: ['YouTube', 'Twitch', 'Kick', 'TikTok'].includes(b.platform) ? b.platform : 'YouTube',
    followers: str(b.followers, 20) || undefined,
    streamUrl: str(b.streamUrl, 500),
    specialty: str(b.specialty, 120),
    status: ['live', 'scheduled', 'partnered'].includes(b.status) ? b.status : 'partnered',
    totalWatchViews: str(b.totalWatchViews, 20) || undefined,
    avatar: avatar || '',
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});
app.delete('/api/admin/growth/creator/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.creatorPartners = store.creatorPartners.filter(c => c.id !== req.params.id);
  db.save();
  res.json({ success: true, creatorPartners: store.creatorPartners });
});

app.post('/api/admin/growth/audio-feed', requireAdmin, (req, res) => {
  const b = req.body || {};
  if (!isHttpsUrl(b.streamUrl)) return bad(res, 'Add the stream or broadcast link (https://)');
  const store = db.get();
  upsert(store.commentaryFeeds, {
    id: str(b.id, 60) || newId('audio'),
    language: ['Arabic', 'English', 'Hindi', 'Urdu', 'Bengali'].includes(b.language) ? b.language : 'English',
    commentator: str(b.commentator, 80),
    status: b.status === 'live' ? 'live' : 'standby',
    streamUrl: str(b.streamUrl, 500),
    description: str(b.description, 300) || undefined,
  } as any, Boolean(b.id));
  db.save();
  res.json({ success: true, commentaryFeeds: store.commentaryFeeds });
});
app.delete('/api/admin/growth/audio-feed/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.commentaryFeeds = store.commentaryFeeds.filter(f => f.id !== req.params.id);
  db.save();
  res.json({ success: true, commentaryFeeds: store.commentaryFeeds });
});

app.post('/api/admin/growth/passport-tier', requireAdmin, (req, res) => {
  const b = req.body || {};
  const tierName = str(b.tierName, 60);
  if (!tierName) return bad(res, 'Tier name is required');
  const signupUrl = optionalUrl(b.signupUrl);
  if (signupUrl === null) return bad(res, 'Sign-up link must start with https://');
  const store = db.get();
  const id = str(b.id, 60) || newId('tier');
  upsert(store.passportTiers, {
    id,
    tierName,
    description: str(b.description, 400) || undefined,
    annualFeeUsd: Math.max(0, num(b.annualFeeUsd, 0)),
    annualFeeAed: Math.max(0, num(b.annualFeeAed, 0)),
    ticketDiscountPct: Math.min(100, Math.max(0, num(b.ticketDiscountPct, 0))),
    fanSpacePriorityEntry: Boolean(b.fanSpacePriorityEntry),
    exclusiveBadge: str(b.exclusiveBadge, 60),
    doublePointsMultiplier: Boolean(b.doublePointsMultiplier),
    signupUrl: signupUrl || undefined,
    totalSubscribers: store.passportInterest.filter(p => p.tierId === id).length,
  }, Boolean(b.id));
  db.save();
  res.json({ success: true, passportTiers: store.passportTiers });
});
app.delete('/api/admin/growth/passport-tier/:id', requireAdmin, (req, res) => {
  const store = db.get();
  store.passportTiers = store.passportTiers.filter(t => t.id !== req.params.id);
  store.passportInterest = store.passportInterest.filter(p => p.tierId !== req.params.id);
  db.save();
  res.json({ success: true, passportTiers: store.passportTiers });
});

app.post('/api/growth/superfan-passport/subscribe', requireUser, (req, res) => {
  const user = userOf(req);
  const store = db.get();
  const tier = store.passportTiers.find(t => t.id === req.body?.tierId) || (store.passportTiers.length === 1 ? store.passportTiers[0] : undefined);
  if (!tier) return bad(res, 'Choose a membership tier', 404);
  const already = store.passportInterest.some(p => p.tierId === tier.id && p.userId === user.id);
  if (!already) store.passportInterest.push({ tierId: tier.id, userId: user.id, createdAt: new Date().toISOString() });
  tier.totalSubscribers = store.passportInterest.filter(p => p.tierId === tier.id).length;
  db.save();
  res.json({ success: true, user, alreadyRegistered: already, tier });
});

// ---------- proposal (confidential, admin only) ----------
app.get('/api/admin/proposal', requireAdmin, (_req, res) => res.json({ proposalSettings: db.get().proposalSettings }));
app.post('/api/admin/proposal', requireAdmin, (req, res) => {
  const store = db.get();
  store.proposalSettings = { ...store.proposalSettings, ...req.body, updatedAt: new Date().toISOString() };
  db.save();
  res.json({ success: true, proposalSettings: store.proposalSettings });
});
app.post('/api/admin/proposal/reset', requireAdmin, (_req, res) => res.json({ success: true, proposalSettings: db.resetProposal() }));

// ---------- Gemini ----------
const teamNames = () => db.get().teams.map(t => t.name);
const geminiError = (res: Response, e: any) => bad(res, e?.status === 503 ? e.message : `The AI assistant had a problem: ${e?.message || 'unknown error'}`, e?.status === 503 ? 503 : 502);

app.post('/api/gemini/chat', requireUser, rateLimit('ai', 20, 10 * 60_000), wrap(async (req, res) => {
  if (!Array.isArray(req.body?.messages) || !req.body.messages.length) return bad(res, 'Message required');
  try {
    res.json(await chatWithGemini(req.body.messages, teamNames()));
  } catch (e) {
    geminiError(res, e);
  }
}));
app.post('/api/gemini/search', requireUser, rateLimit('ai', 20, 10 * 60_000), wrap(async (req, res) => {
  const q = str(req.body?.query, 500);
  if (!q) return bad(res, 'Query required');
  try {
    res.json(await searchGroundingCricket(q, teamNames()));
  } catch (e) {
    geminiError(res, e);
  }
}));
app.post('/api/gemini/marketing', requireAdmin, wrap(async (req, res) => {
  try {
    res.json(await generateMarketingContent(str(req.body?.prompt, 2000) || 'Write a matchday social post.', { teamName: str(req.body?.teamName, 80) }));
  } catch (e) {
    geminiError(res, e);
  }
}));
app.post('/api/gemini/transcribe', requireAdmin, wrap(async (req, res) => {
  if (!req.body?.audioBase64) return bad(res, 'Audio required');
  try {
    res.json(await transcribeAudioVoice(String(req.body.audioBase64), str(req.body.mimeType, 60) || 'audio/webm'));
  } catch (e) {
    geminiError(res, e);
  }
}));

// ---------- SEO ----------
function baseUrl(req: Request) {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /proposal\nDisallow: /api/\n\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const today = new Date().toISOString().split('T')[0];
  const routes = ['/', '/matches', '/teams', ...db.get().teams.map(t => `/teams/${encodeURIComponent(t.id)}`), '/social', '/forum', '/contests', '/draws', '/leaderboard', '/fanspaces', '/growth'];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    routes.map(r => `  <url><loc>${base}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    `\n</urlset>`
  );
});

app.use('/api', (_req, res) => bad(res, 'Not found', 404));

// JSON errors instead of HTML stack traces
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err);
  if (res.headersSent) return;
  res.status(err?.status || 500).json({ error: IS_PROD ? 'Something went wrong' : err?.message || 'Server error' });
});

// ---------- static / Vite ----------
async function startServer() {
  if (!IS_PROD) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(process.cwd(), 'dist');
    if (!fs.existsSync(path.join(dist, 'index.html'))) {
      console.error('dist/index.html not found. Run `npm run build` before `npm start`.');
      process.exit(1);
    }
    app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // Ensure official 2026 Cricbuzz franchises & confirmed squads (18 players each, stats included, amounts removed) are seeded
  const currentStore = db.get();
  const needsSquadUpgrade = !currentStore.teams || currentStore.teams.length === 0 ||
    currentStore.teams.some(t => !t.squad || t.squad.length < 18 || t.squad.some(p => p.credits !== undefined));

  if (needsSquadUpgrade) {
    console.log('[SETUP] Seeding/upgrading official 2026 Cricbuzz franchises & confirmed 18-player squads with career stats...');
    seedOfficialTeams(true);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ADT10 Fans running on http://0.0.0.0:${PORT} (${IS_PROD ? 'production' : 'development'})`);
    if (!process.env.ADMIN_EMAILS && !db.get().settings.adminEmails.length) {
      console.warn('[SETUP] No admins configured. Set ADMIN_EMAILS=you@example.com to access the Admin Console.');
    }
  });

  // Background agent: refresh official YouTube + news feeds periodically.
  const minutes = Math.max(0, num(process.env.FEED_SYNC_MINUTES, 30));
  if (minutes > 0) {
    const tick = () => {
      const s = db.get();
      if (!s.teams.length && !s.handles.length) return;
      syncAllFeeds().then(r => console.log(`[FEEDS] ${r.summary}`)).catch(e => console.warn('[FEEDS] sync failed:', e?.message));
    };
    setTimeout(tick, 20_000).unref();
    setInterval(tick, minutes * 60_000).unref();
  }
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
