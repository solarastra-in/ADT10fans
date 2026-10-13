import crypto from 'crypto';
import { db, NotificationItem, User } from './db';
import { pushServerConfigured, sendFcm } from './push';

export interface NotificationInput {
  title: string;
  body: string;
  category: NotificationItem['category'];
  targetAudience?: NotificationItem['targetAudience'];
  teamId?: string | null;
  userIds?: string[];
  perUser?: NotificationItem['perUser'];
  data?: Record<string, any>;
  priority?: 'normal' | 'high';
  createdBy: string;
}

/** Whether a notification is meant for this viewer (null = signed out). */
export function visibleTo(n: NotificationItem, user: User | null): boolean {
  const audience = n.targetAudience || 'all';
  if (audience === 'all') return true;
  if (!user) return false;
  if (audience === 'logged_in') return true;
  if (audience === 'users') return (n.userIds || []).includes(user.id);
  return !n.teamId || user.teamId === n.teamId;
}

/** The notification as this viewer sees it (personal text, read flag; never other users' data). */
export function viewFor(n: NotificationItem, user: User | null) {
  const { readBy, perUser, userIds, ...rest } = n;
  const mine = user && perUser ? perUser[user.id] : undefined;
  return {
    ...rest,
    title: mine?.title || n.title,
    body: mine?.body || n.body,
    read: user ? (readBy || []).includes(user.id) : false,
  };
}

function recipients(n: NotificationItem): string[] {
  const store = db.get();
  const usersById = new Map(store.users.map(u => [u.id, u]));
  return store.fcmTokens
    .filter(t => {
      if (!t.enabled) return false;
      const u = t.userId ? usersById.get(t.userId) || null : null;
      if ((n.targetAudience || 'all') === 'all') return true;
      return visibleTo(n, u);
    })
    .map(t => t.token);
}

/**
 * Stores a notification (shown in the in-app notification centre) and sends it as a push to
 * subscribed devices when FCM is configured. Personal notifications (perUser) are pushed one by one
 * so each fan gets their own text.
 */
export async function dispatchNotification(input: NotificationInput): Promise<NotificationItem> {
  const store = db.get();
  const item: NotificationItem = {
    id: 'notif-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10),
    title: input.title.slice(0, 160),
    body: input.body.slice(0, 1000),
    category: input.category,
    targetAudience: input.targetAudience || 'all',
    teamId: input.teamId || null,
    userIds: input.userIds,
    perUser: input.perUser,
    data: input.data || {},
    priority: input.priority || 'normal',
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
    recipientCount: 0,
    fcmSuccessCount: 0,
    fcmFailureCount: 0,
    delivery: 'in-app',
    readBy: [],
  };
  const tokens = recipients(item);
  item.recipientCount = item.targetAudience === 'users' ? (item.userIds || []).length : tokens.length;
  store.notifications.unshift(item);
  store.notifications = store.notifications.slice(0, 300);
  db.save();

  if (pushServerConfigured() && tokens.length) {
    try {
      const url = typeof item.data?.url === 'string' ? item.data.url : '/';
      const data = { notificationId: item.id, category: item.category };
      let success = 0;
      let failure = 0;
      const dead: string[] = [];
      if (item.perUser) {
        const byToken = new Map(store.fcmTokens.map(t => [t.token, t.userId]));
        for (const token of tokens) {
          const uid = byToken.get(token);
          const personal = uid ? item.perUser[uid] : undefined;
          const r = await sendFcm([token], { title: personal?.title || item.title, body: personal?.body || item.body, url, data });
          success += r.success;
          failure += r.failure;
          dead.push(...r.invalidTokens);
        }
      } else {
        const r = await sendFcm(tokens, { title: item.title, body: item.body, url, data });
        success = r.success;
        failure = r.failure;
        dead.push(...r.invalidTokens);
      }
      item.delivery = 'fcm';
      item.fcmSuccessCount = success;
      item.fcmFailureCount = failure;
      if (dead.length) {
        const deadSet = new Set(dead);
        for (const t of store.fcmTokens) if (deadSet.has(t.token)) t.enabled = false;
      }
      db.save();
    } catch (e: any) {
      console.error('[PUSH] send failed:', e?.message);
    }
  }
  return item;
}
