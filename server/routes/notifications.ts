import { Router } from 'express';
import { db } from '../db';
import { canManageTeam, getAuthUser, rateLimit, requireAdmin, requireUser, teamScopeOf } from '../auth';
import { bad, isHttpsUrl, newId, str, userOf, wrap } from '../http';
import { dispatchNotification, viewFor, visibleTo } from '../notify';
import { pushServerConfigured } from '../push';
import { stripAnswers } from './play';

export const notificationsRouter = Router();

notificationsRouter.get('/notifications', (req, res) => {
  const user = getAuthUser(req);
  const store = db.get();
  let list = store.notifications.filter(n => visibleTo(n, user));
  if (req.query.category && req.query.category !== 'all') list = list.filter(n => n.category === req.query.category);
  const out = list.slice(0, 50).map(n => viewFor(n, user));
  res.json({
    notifications: out,
    unreadCount: user ? out.filter(n => !n.read).length : 0,
    total: out.length,
    fcmSubscribed: user ? store.fcmTokens.some(t => t.userId === user.id && t.enabled) : false,
  });
});

notificationsRouter.get('/notifications/:id', (req, res) => {
  const store = db.get();
  const user = getAuthUser(req);
  const n = store.notifications.find(x => x.id === req.params.id);
  if (!n || !visibleTo(n, user)) return bad(res, 'Notification not found', 404);
  let relatedEntity: any = null;
  if (n.data?.matchId) relatedEntity = store.matches.find(m => m.id === n.data?.matchId) || null;
  else if (n.data?.contestId) {
    const c = store.contests.find(x => x.id === n.data?.contestId);
    relatedEntity = c ? stripAnswers(c, false) : null;
  }
  res.json({ notification: viewFor(n, user), relatedEntity });
});

notificationsRouter.post('/notifications/:id/read', requireUser, (req, res) => {
  const user = userOf(req);
  const n = db.get().notifications.find(x => x.id === req.params.id);
  if (!n || !visibleTo(n, user)) return bad(res, 'Notification not found', 404);
  n.readBy = n.readBy || [];
  if (!n.readBy.includes(user.id)) n.readBy.push(user.id);
  db.save();
  res.json({ success: true, notificationId: n.id, read: true });
});

notificationsRouter.post('/notifications/mark-all-read', requireUser, (req, res) => {
  const user = userOf(req);
  for (const n of db.get().notifications) {
    if (!visibleTo(n, user)) continue;
    n.readBy = n.readBy || [];
    if (!n.readBy.includes(user.id)) n.readBy.push(user.id);
  }
  db.save();
  res.json({ success: true });
});

notificationsRouter.post('/fcm/register-token', rateLimit('fcm', 20, 60_000), (req, res) => {
  const token = str(req.body?.token, 4096);
  if (token.length < 100 || !/^[\w:\-]+$/.test(token)) return bad(res, 'Invalid push token');
  const user = getAuthUser(req);
  const store = db.get();
  const now = new Date().toISOString();
  const existing = store.fcmTokens.find(t => t.token === token);
  if (existing) Object.assign(existing, { userId: user?.id || existing.userId, userEmail: user?.email || existing.userEmail, enabled: true, updatedAt: now });
  else store.fcmTokens.push({ id: newId('fcm'), token, userId: user?.id || null, userEmail: user?.email || null, deviceType: str(req.body?.deviceType, 40) || 'web', userAgent: str(req.body?.userAgent, 300), enabled: true, createdAt: now, updatedAt: now });
  db.save();
  res.json({ success: true, message: 'Push notifications are on for this device' });
});

notificationsRouter.post('/fcm/unregister-token', (req, res) => {
  const token = str(req.body?.token, 4096);
  const t = db.get().fcmTokens.find(x => x.token === token);
  if (t) {
    t.enabled = false;
    db.save();
  }
  res.json({ success: true });
});

notificationsRouter.get('/fcm/tokens', requireAdmin('notifications'), (_req, res) => {
  const tokens = db.get().fcmTokens;
  res.json({
    totalTokens: tokens.length,
    activeSubscribers: tokens.filter(t => t.enabled).length,
    pushServerConfigured: pushServerConfigured(),
    tokens: tokens.slice(-50).map(t => ({ ...t, token: t.token.slice(0, 12) + '…' })),
  });
});

notificationsRouter.get('/admin/notifications', requireAdmin('notifications'), (req, res) => {
  const user = userOf(req);
  const scope = teamScopeOf(user);
  const list = db.get().notifications.filter(n => scope === null || n.teamId === scope);
  res.json({ notifications: list.slice(0, 100).map(({ readBy, perUser, userIds, ...n }) => ({ ...n, reads: (readBy || []).length, personal: Boolean(perUser) })) });
});

notificationsRouter.post('/fcm/send', requireAdmin('notifications'), wrap(async (req, res) => {
  const b = req.body || {};
  const user = userOf(req);
  const title = str(b.title, 160);
  const body = str(b.body, 1000);
  if (!title || !body) return bad(res, 'Title and message are required');
  const url = str(b.url, 500);
  let audience = ['all', 'logged_in', 'team'].includes(b.targetAudience) ? b.targetAudience : 'all';
  let teamId = b.teamId || null;
  // Team officials can only message their own team's fans.
  const scope = teamScopeOf(user);
  if (scope !== null) {
    audience = 'team';
    teamId = scope;
  }
  if (audience === 'team' && !teamId) return bad(res, 'Choose which team’s fans to notify');
  if (teamId && !canManageTeam(user, teamId)) return bad(res, 'You can only notify your own team’s fans', 403);
  const notif = await dispatchNotification({
    title,
    body,
    category: ['match_result', 'contest_deadline', 'announcement', 'perk'].includes(b.category) ? b.category : 'announcement',
    targetAudience: audience,
    teamId,
    data: { url: url.startsWith('/') || isHttpsUrl(url) ? url : '/' },
    priority: b.priority === 'high' ? 'high' : 'normal',
    createdBy: user.name || 'Admin',
  });
  res.json({
    success: true,
    notification: viewFor(notif, null),
    message: notif.delivery === 'fcm' ? `Pushed to ${notif.fcmSuccessCount} device(s)${notif.fcmFailureCount ? `, ${notif.fcmFailureCount} failed` : ''}.` : 'Saved as an in-app notification (push is not configured).',
  });
}));
