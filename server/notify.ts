import crypto from 'crypto';
import { db, NotificationItem, User } from './db';
import { pushServerConfigured, sendFcm } from './push';
import { inParallel, runInBackground } from './background';

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
 * Stores a notification (shown in the in-app notification centre) and, when FCM is configured, pushes
 * it to subscribed devices.
 *
 * The notification is stored in one short write. Pushes are sent afterwards in the background, many
 * at a time, outside the write lock: sending one personal push per fan used to hold every other
 * change on the server for minutes after a match. Delivery counts are added when sending finishes.
 */
export async function dispatchNotification(input: NotificationInput): Promise<NotificationItem> {
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
  const sendTo = await db.mutate(store => {
    const tokens = recipients(item);
    item.recipientCount = item.targetAudience === 'users' ? (item.userIds || []).length : tokens.length;
    if (pushServerConfigured() && tokens.length) item.delivery = 'fcm';
    store.notifications.unshift(item);
    store.notifications = store.notifications.slice(0, 300);
    const byToken = new Map(store.fcmTokens.map(t => [t.token, t.userId]));
    return tokens.map(token => ({ token, userId: byToken.get(token) || null }));
  });
  if (item.delivery === 'fcm') void runInBackground(`push ${item.id}`, () => deliver(item, sendTo));
  return item;
}

/** Sends the pushes for a stored notification, then records the counts and disables dead tokens. */
async function deliver(item: NotificationItem, targets: { token: string; userId: string | null }[]) {
  const url = typeof item.data?.url === 'string' ? item.data.url : '/';
  const data = { notificationId: item.id, category: item.category };
  // Fans with the same text are sent together.
  const groups = new Map<string, { title: string; body: string; tokens: string[] }>();
  for (const t of targets) {
    const personal = item.perUser && t.userId ? item.perUser[t.userId] : undefined;
    const title = personal?.title || item.title;
    const body = personal?.body || item.body;
    const k = `${title}\u0000${body}`;
    if (!groups.has(k)) groups.set(k, { title, body, tokens: [] });
    groups.get(k)!.tokens.push(t.token);
  }
  let success = 0;
  let failure = 0;
  const dead = new Set<string>();
  await inParallel([...groups.values()], 8, async g => {
    try {
      const r = await sendFcm(g.tokens, { title: g.title, body: g.body, url, data });
      success += r.success;
      failure += r.failure;
      for (const t of r.invalidTokens) dead.add(t);
    } catch (e: any) {
      failure += g.tokens.length;
      console.error('[PUSH] send failed:', e?.message);
    }
  });
  await db.mutate(store => {
    const n = store.notifications.find(x => x.id === item.id);
    if (n) {
      n.fcmSuccessCount = success;
      n.fcmFailureCount = failure;
    }
    if (dead.size) for (const t of store.fcmTokens) if (dead.has(t.token)) t.enabled = false;
  });
}
