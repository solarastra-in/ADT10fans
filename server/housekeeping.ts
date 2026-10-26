import type { AppStore } from './db';

/**
 * Keeps collections that grow on their own within bounds. Runs with the scheduled jobs (every few
 * minutes), not on every request: removing records rewrites the shards they were in, so it is done
 * in batches.
 */
export const LIMITS = {
  sessionsPerUser: 10,
  fcmTokens: 60_000,
  decidedApprovals: 2_000,
  closedReports: 5_000,
};

export function housekeeping(store: AppStore, now = Date.now()) {
  const out: Record<string, number> = {};

  // Sessions: drop expired ones and keep each fan's newest few.
  const live = store.sessions.filter(s => +new Date(s.expiresAt) > now);
  const perUser = new Map<string, number>();
  const keep = [...live]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .filter(s => {
      const n = (perUser.get(s.userId) || 0) + 1;
      perUser.set(s.userId, n);
      return n <= LIMITS.sessionsPerUser;
    });
  if (keep.length !== store.sessions.length) {
    const ids = new Set(keep.map(s => s.id));
    out.sessions = store.sessions.length - keep.length;
    store.sessions = store.sessions.filter(s => ids.has(s.id));
  }

  // Sign-in codes: used or expired.
  const codes = store.otpCodes.filter(o => !o.used && +new Date(o.expiresAt) > now);
  if (codes.length !== store.otpCodes.length) {
    out.otpCodes = store.otpCodes.length - codes.length;
    store.otpCodes = codes;
  }

  // Push tokens: anyone can register one, so drop the oldest disabled, then oldest anonymous, over the cap.
  if (store.fcmTokens.length > LIMITS.fcmTokens) {
    const over = store.fcmTokens.length - LIMITS.fcmTokens;
    const victims = [...store.fcmTokens]
      .sort((a, b) => Number(a.enabled) - Number(b.enabled) || Number(Boolean(a.userId)) - Number(Boolean(b.userId)) || a.updatedAt.localeCompare(b.updatedAt))
      .slice(0, over);
    const drop = new Set(victims.map(t => t.token));
    store.fcmTokens = store.fcmTokens.filter(t => !drop.has(t.token));
    out.fcmTokens = over;
  }

  // Decided approvals and closed forum reports are history; keep the newest.
  const decided = store.approvals.filter(a => a.status !== 'pending');
  if (decided.length > LIMITS.decidedApprovals) {
    const drop = new Set(decided.sort((a, b) => (a.decidedAt || a.createdAt).localeCompare(b.decidedAt || b.createdAt)).slice(0, decided.length - LIMITS.decidedApprovals).map(a => a.id));
    store.approvals = store.approvals.filter(a => !drop.has(a.id));
    out.approvals = drop.size;
  }
  const closed = store.forumReports.filter(r => r.status !== 'open');
  if (closed.length > LIMITS.closedReports) {
    const drop = new Set(closed.slice(0, closed.length - LIMITS.closedReports).map(r => r.id));
    store.forumReports = store.forumReports.filter(r => !drop.has(r.id));
    out.forumReports = drop.size;
  }
  return out;
}
