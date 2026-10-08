import { Match } from '../types';

export interface MatchReminder {
  matchId: string;
  matchNo: number;
  stage: string;
  teamAId: string;
  teamBId: string;
  teamAName: string;
  teamBName: string;
  venue: string;
  startsAt: string;
  scheduledAt: string;
  notified?: boolean;
}

const activeTimers = new Map<string, any>();

function getStorageKey(userId?: string | null): string {
  return `adt10_match_reminders_${userId || 'guest'}`;
}

/**
 * Retrieve all scheduled match reminders for the given user.
 */
export function getScheduledReminders(userId?: string | null): MatchReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse match reminders:', err);
    return [];
  }
}

/**
 * Check if a specific match is currently set for reminder.
 */
export function isMatchReminded(matchId: string, userId?: string | null): boolean {
  const reminders = getScheduledReminders(userId);
  return reminders.some(r => r.matchId === matchId && !r.notified);
}

/**
 * Save reminders list to localStorage.
 */
function saveReminders(reminders: MatchReminder[], userId?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(reminders));
  } catch (err) {
    console.error('Failed to save match reminders:', err);
  }
}

/**
 * Request browser notification permission if available.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch (err) {
    console.error('Notification permission request error:', err);
    return 'denied';
  }
}

/**
 * Send an immediate browser notification if permitted.
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notif = new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
    return true;
  } catch (err) {
    console.warn('Could not display local notification:', err);
    return false;
  }
}

/**
 * Cancel any in-memory timer for this match.
 */
function clearMatchTimer(matchId: string): void {
  const timer = activeTimers.get(matchId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(matchId);
  }
}

/**
 * Schedule a timer for match start.
 */
function scheduleTimer(
  reminder: MatchReminder,
  userId?: string | null,
  onNotify?: (reminder: MatchReminder) => void
): void {
  clearMatchTimer(reminder.matchId);

  const startTime = new Date(reminder.startsAt).getTime();
  const now = Date.now();
  const delay = startTime - now;

  // Max 32-bit signed int for setTimeout (~24.8 days)
  const MAX_TIMEOUT = 2147483647;

  if (delay > 0 && delay < MAX_TIMEOUT) {
    const timer = setTimeout(() => {
      triggerReminderNotification(reminder, userId, onNotify);
    }, delay);
    activeTimers.set(reminder.matchId, timer);
  }
}

/**
 * Fire the notification when the match time arrives.
 */
function triggerReminderNotification(
  reminder: MatchReminder,
  userId?: string | null,
  onNotify?: (reminder: MatchReminder) => void
): void {
  // Fire browser push notification
  const title = `🏏 MATCH STARTING: ${reminder.teamAName} vs ${reminder.teamBName}`;
  const body = `Match #${reminder.matchNo} (${reminder.stage}) is starting now at ${reminder.venue}! Follow the live scorecard.`;
  sendBrowserNotification(title, {
    body,
    tag: `match-start-${reminder.matchId}`,
  });

  // Mark as notified in storage
  const list = getScheduledReminders(userId);
  const updated = list.map(r => r.matchId === reminder.matchId ? { ...r, notified: true } : r);
  saveReminders(updated, userId);
  clearMatchTimer(reminder.matchId);

  // Invoke callback for in-app toast / sound
  if (onNotify) {
    onNotify(reminder);
  }
}

/**
 * Toggle reminder for an upcoming match.
 */
export async function toggleMatchReminder(
  match: Match,
  teamAName: string,
  teamBName: string,
  userId?: string | null,
  onNotify?: (reminder: MatchReminder) => void
): Promise<{ active: boolean; message: string; permissionGranted: boolean }> {
  const reminders = getScheduledReminders(userId);
  const existingIdx = reminders.findIndex(r => r.matchId === match.id);

  if (existingIdx >= 0) {
    // Remove / toggle off
    clearMatchTimer(match.id);
    const updated = reminders.filter(r => r.matchId !== match.id);
    saveReminders(updated, userId);
    return {
      active: false,
      message: `Reminder removed for Match #${match.matchNo} (${teamAName} vs ${teamBName}).`,
      permissionGranted: typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
    };
  }

  // Request browser permission if not yet decided
  let permission: NotificationPermission = 'default';
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      permission = await requestNotificationPermission();
    } else {
      permission = Notification.permission;
    }
  }

  const newReminder: MatchReminder = {
    matchId: match.id,
    matchNo: match.matchNo,
    stage: match.stage,
    teamAId: match.teamA,
    teamBId: match.teamB,
    teamAName,
    teamBName,
    venue: match.venue,
    startsAt: match.startsAt,
    scheduledAt: new Date().toISOString(),
    notified: false,
  };

  const updated = [newReminder, ...reminders];
  saveReminders(updated, userId);

  // Schedule timer
  scheduleTimer(newReminder, userId, onNotify);

  // Send an immediate preview confirmation push if granted
  if (permission === 'granted') {
    sendBrowserNotification(`🔔 Reminder Set · Match #${match.matchNo}`, {
      body: `You'll get a push alert when ${teamAName} vs ${teamBName} kicks off at ${match.venue}!`,
      tag: `schedule-confirm-${match.id}`,
    });
  }

  const startTimeStr = new Date(match.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const message = permission === 'granted'
    ? `🔔 Push alert scheduled for Match #${match.matchNo} at ${startTimeStr}!`
    : permission === 'denied'
    ? `⚠️ Reminder saved, but browser notifications are blocked. Please enable notifications in your browser settings to receive push alerts.`
    : `🔔 Reminder saved for Match #${match.matchNo} at ${startTimeStr}!`;

  return {
    active: true,
    message,
    permissionGranted: permission === 'granted',
  };
}

/**
 * Initialize all existing scheduled reminders on app boot or user switch.
 */
export function initMatchReminders(
  userId?: string | null,
  onNotify?: (reminder: MatchReminder) => void
): () => void {
  const reminders = getScheduledReminders(userId);
  const now = Date.now();

  reminders.forEach(reminder => {
    if (reminder.notified) return;

    const startTime = new Date(reminder.startsAt).getTime();
    if (startTime <= now) {
      // If it started within the last 15 minutes and hasn't notified yet
      if (now - startTime < 15 * 60 * 1000) {
        triggerReminderNotification(reminder, userId, onNotify);
      } else {
        // Expired
        reminder.notified = true;
      }
    } else {
      scheduleTimer(reminder, userId, onNotify);
    }
  });

  saveReminders(reminders, userId);

  // Periodic interval check every 30 seconds for background safety
  const interval = setInterval(() => {
    const currentList = getScheduledReminders(userId);
    const currentTime = Date.now();
    currentList.forEach(r => {
      if (!r.notified) {
        const start = new Date(r.startsAt).getTime();
        if (start <= currentTime && currentTime - start < 15 * 60 * 1000) {
          triggerReminderNotification(r, userId, onNotify);
        }
      }
    });
  }, 30000);

  return () => {
    clearInterval(interval);
    activeTimers.forEach((timer) => clearTimeout(timer));
    activeTimers.clear();
  };
}
