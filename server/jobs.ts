import crypto from 'crypto';
import { db, requestContext } from './db';
import { ConflictError } from './storage';
import { syncAllFeeds } from './feeds';
import { syncLiveScores } from './liveScores';
import { runReminders } from './reminders';
import { runScoresAgent, runSocialHarvesterAgent } from './agents';

/**
 * Scheduled work:
 *   reminders  Dream XI lock reminders, contest auto-lock             (every run)
 *   scores     CricketData live scores for linked matches              (every run, when configured)
 *   feeds      YouTube / X / Curator / news pulls                      (at most every FEED_SYNC_MINUTES)
 *   checks     flag fixtures past their start time that are not live    (every run)
 *
 * Runs from /api/cron/run (Vercel Cron, GitHub Actions) or, on a long-running server, a timer.
 */
const feedMinutes = () => Math.max(5, Number(process.env.FEED_SYNC_MINUTES) || 30);

export function lastJobRun(): string | null {
  return db.get().jobLog['jobs:last-run'] || null;
}

export async function runScheduledJobs(opts: { only?: string[]; force?: boolean } = {}) {
  const want = (name: string) => !opts.only || opts.only.includes(name);
  const store = db.get();
  const out: Record<string, any> = {};
  const started = Date.now();

  if (want('reminders')) {
    try {
      out.reminders = await runReminders();
    } catch (e: any) {
      out.reminders = { error: e?.message || String(e) };
    }
  }
  if (want('scores')) {
    try {
      // Imported lazily to avoid a cycle (routes/matches imports this module's caller).
      const { onMatchCompleted } = await import('./routes/matches');
      out.scores = await syncLiveScores(id => onMatchCompleted(id));
    } catch (e: any) {
      out.scores = { error: e?.message || String(e) };
    }
  }
  const last = store.jobLog['jobs:feeds'];
  const due = Boolean(opts.force || opts.only?.includes('feeds') || !last || Date.now() - +new Date(last) >= feedMinutes() * 60_000);
  if (want('feeds')) {
    if (due) {
      try {
        const r = await syncAllFeeds();
        db.get().jobLog['jobs:feeds'] = new Date().toISOString();
        db.save();
        out.feeds = { summary: r.summary, added: r.added, errors: r.errors.length };
      } catch (e: any) {
        out.feeds = { error: e?.message || String(e) };
      }
    } else {
      out.feeds = { skipped: `next pull after ${new Date(+new Date(last) + feedMinutes() * 60_000).toISOString()}` };
    }
  }
  const lastHarvest = store.jobLog['jobs:harvest'];
  const harvestDue = Boolean(opts.force || opts.only?.includes('harvest') || !lastHarvest || Date.now() - +new Date(lastHarvest) >= 6 * 3600_000);
  if (want('harvest') && harvestDue) {
    try {
      const h = await runSocialHarvesterAgent();
      db.get().jobLog['jobs:harvest'] = new Date().toISOString();
      db.save();
      out.harvest = { summary: h.summary, added: h.items };
    } catch (e: any) {
      out.harvest = { error: e?.message || String(e) };
    }
  }
  if (want('checks') && (due || opts.only?.includes('checks'))) {
    try {
      const r = await runScoresAgent();
      out.checks = { status: r.status, summary: r.summary };
    } catch (e: any) {
      out.checks = { error: e?.message || String(e) };
    }
  }
  db.get().jobLog['jobs:last-run'] = new Date().toISOString();
  db.save();
  return { tookMs: Date.now() - started, jobs: out };
}

/** Minimum time between automatic runs. */
export const JOB_INTERVAL_MS = 4 * 60_000;
const LEASE_MS = 3 * 60_000;
let runningHere = false;
let lastLocalCheck = 0;

export const jobsMode = () => (process.env.SCHEDULED_JOBS || '').trim().toLowerCase(); // '' | 'off' | 'traffic'

export function jobsDue(now = Date.now()) {
  const last = lastJobRun();
  return !last || now - +new Date(last) >= JOB_INTERVAL_MS;
}

/**
 * Runs the scheduled jobs once, unless they ran recently or another instance is running them.
 * A lease in the store (claimed with a conditional write) makes sure only one instance runs at a time.
 * `force` skips the "ran recently" check (used by an authorised cron call or a super admin).
 */
export async function runJobsOnce(opts: { force?: boolean } = {}): Promise<{ ran: boolean; reason?: string; result?: any }> {
  if (runningHere) return { ran: false, reason: 'already running' };
  runningHere = true;
  try {
    if (!db.shared) {
      if (!opts.force && !jobsDue()) return { ran: false, reason: 'ran recently' };
      return { ran: true, result: await runScheduledJobs() };
    }
    return await db.exclusive(() =>
      requestContext.run({ id: crypto.randomUUID() }, async () => {
        await db.refreshIfStale();
        const log = db.get().jobLog;
        if (!opts.force && !jobsDue()) return { ran: false, reason: 'ran recently' };
        const lease = log['jobs:lease'];
        if (lease && Date.now() - +new Date(lease) < LEASE_MS) return { ran: false, reason: 'running on another instance' };
        log['jobs:lease'] = new Date().toISOString();
        db.save();
        try {
          await db.commit();
        } catch (e) {
          if (e instanceof ConflictError) {
            await db.discardAndReload();
            return { ran: false, reason: 'another instance started first' };
          }
          throw e;
        }
        const result = await runScheduledJobs(opts);
        delete db.get().jobLog['jobs:lease'];
        db.save();
        try {
          await db.commit();
        } catch (e) {
          if (e instanceof ConflictError) await db.discardAndReload();
          else throw e;
        }
        return { ran: true, result };
      }),
    );
  } finally {
    runningHere = false;
  }
}

/** For long-running servers (the timer). */
export async function runJobsInBackground() {
  return runJobsOnce();
}

/**
 * Traffic-driven jobs: after a response is sent, run the jobs if they are due. On Vercel the function
 * is kept alive for them with waitUntil. Checked at most every 30 seconds per instance, so it costs
 * nothing on most requests. SCHEDULED_JOBS=off turns it off.
 */
export function jobsOnTraffic(req: { path: string; method: string }, res: { once: (e: string, f: () => void) => void }) {
  if (jobsMode() === 'off') return;
  if (req.path.startsWith('/api/cron') || req.path.startsWith('/assets/') || req.method === 'OPTIONS') return;
  const now = Date.now();
  if (runningHere || now - lastLocalCheck < 30_000 || !jobsDue(now)) return;
  lastLocalCheck = now;
  const work = new Promise<void>(resolve => res.once('finish', resolve))
    .then(() => runJobsOnce())
    .catch(() => undefined);
  if (process.env.VERCEL) {
    import('@vercel/functions').then(m => m.waitUntil(work)).catch(() => undefined);
  }
}

let timer: NodeJS.Timeout | null = null;
export function startJobTimer() {
  if (timer || process.env.VERCEL || jobsMode() === 'off' || jobsMode() === 'traffic') return;
  const tick = () => runJobsInBackground().catch(() => undefined);
  setTimeout(tick, 15_000).unref();
  timer = setInterval(tick, 60_000);
  timer.unref();
}
