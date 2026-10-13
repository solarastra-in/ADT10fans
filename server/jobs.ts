import crypto from 'crypto';
import { db, requestContext } from './db';
import { ConflictError } from './storage';
import { syncAllFeeds } from './feeds';
import { syncLiveScores } from './liveScores';
import { runReminders } from './reminders';
import { runScoresAgent } from './agents';

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

/** For long-running servers: runs the jobs as if they were one request, so shared storage stays consistent. */
export async function runJobsInBackground() {
  if (!db.shared) return runScheduledJobs();
  return db.exclusive(() =>
    requestContext.run({ id: crypto.randomUUID() }, async () => {
      await db.refreshIfStale();
      const r = await runScheduledJobs();
      try {
        await db.commit();
      } catch (e) {
        if (e instanceof ConflictError) await db.discardAndReload();
        else throw e;
      }
      return r;
    }),
  );
}

let timer: NodeJS.Timeout | null = null;
export function startJobTimer() {
  if (timer || process.env.VERCEL || process.env.SCHEDULED_JOBS === 'off') return;
  const tick = () => runJobsInBackground().catch(e => console.warn('[JOBS] failed:', e?.message || e));
  setTimeout(tick, 15_000).unref();
  timer = setInterval(tick, 60_000);
  timer.unref();
}
