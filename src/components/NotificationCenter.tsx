import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { navigate } from '../router';
import { Button, Modal, Notice, cx, useFormat } from './ui';
import type { NotificationItem } from '../types';

const ICON: Record<string, string> = { match_result: '🏆', contest_deadline: '⏳', announcement: '📣', perk: '🎁', fantasy: '🏏' };

export function NotificationCenter() {
  const { user, config, toast } = useApp();
  const t = useT();
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [subscribed, setSubscribed] = useState(false);
  const [pushState, setPushState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.getNotifications();
      if (!r || !Array.isArray(r.notifications)) return;
      setItems(prev => {
        const newest = r.notifications[0];
        if (prev.length && newest && !prev.some(p => p.id === newest.id) && !newest.read) {
          toast(`${ICON[newest.category] || '🔔'} ${newest.title}`, 'info');
        }
        return r.notifications;
      });
      setUnread(r.unreadCount ?? 0);
      setSubscribed(Boolean(r.fcmSubscribed));
    } catch {
      /* offline: keep what we have */
    }
  }, [toast]);

  useEffect(() => {
    load();
    const id = setInterval(load, user ? 60_000 : 300_000);
    return () => clearInterval(id);
  }, [load, user?.id]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    if (config?.features?.pushNotifications) {
      import('../firebase').then(m => m.registerForegroundPushListener(() => load())).then(u => (unsub = u));
    }
    return () => unsub?.();
  }, [config?.features.pushNotifications, load]);

  const enablePush = async () => {
    setBusy(true);
    try {
      const { requestFCMToken } = await import('../firebase');
      const r = await requestFCMToken(config?.fcmVapidKey);
      if (r.token) {
        await api.registerFCMToken(r.token, 'web', navigator.userAgent);
        setSubscribed(true);
        setPushState(t('Push notifications are on for this device.'));
      } else setPushState(r.status === 'denied' ? t('Notifications are blocked in your browser settings.') : r.error || t('Push notifications are not available on this device.'));
    } finally {
      setBusy(false);
    }
  };

  const openItem = async (n: NotificationItem) => {
    if (!n.read && user) {
      api.markNotificationRead(n.id).catch(() => undefined);
      setItems(list => list.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread(u => Math.max(0, u - 1));
    }
    const url = typeof n.data?.url === 'string' ? n.data.url : '';
    if (url.startsWith('/')) {
      setOpen(false);
      navigate(url);
    }
  };

  const markAll = async () => {
    if (user) await api.markAllNotificationsRead().catch(() => undefined);
    setItems(list => list.map(x => ({ ...x, read: true })));
    setUnread(0);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative w-11 h-11 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center" aria-label={t('Notifications')} data-testid="bell">
        {unread ? <BellRing className="w-5 h-5 text-amber-400" /> : <Bell className="w-5 h-5" />}
        {unread > 0 && <span className="absolute top-1.5 end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Notifications')}>
        <div className="space-y-3" data-testid="notification-center">
          {config?.features?.pushNotifications && user && !subscribed && (
            <Button variant="outline" className="w-full" loading={busy} onClick={enablePush}>
              <BellRing className="w-4 h-4" /> {t('Turn on push notifications')}
            </Button>
          )}
          {pushState && <Notice>{pushState}</Notice>}
          {!user && <Notice>{t('Sign in to get personal alerts: Dream XI results, prize wins and reminders before lineups lock.')}</Notice>}
          {items.length > 0 && unread > 0 && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={markAll}>
                <CheckCheck className="w-4 h-4" /> {t('Mark all read')}
              </Button>
            </div>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{t('No notifications yet.')}</p>
          ) : (
            <ul className="space-y-2">
              {items.map(n => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={cx('w-full text-start p-3 rounded-xl border flex gap-3', n.read ? 'bg-slate-950/40 border-slate-800' : 'bg-amber-400/5 border-amber-400/30')}>
                    <span className="text-lg leading-none mt-0.5" aria-hidden>
                      {ICON[n.category] || '🔔'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white break-words">{n.title}</span>
                      <span className="block text-xs text-slate-300 mt-0.5 break-words">{n.body}</span>
                      <span className="block text-[11px] text-slate-500 mt-1">{f.ago(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>
    </>
  );
}
