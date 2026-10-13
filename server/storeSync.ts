import crypto from 'crypto';
import type { Express, NextFunction, Request, Response } from 'express';
import { db, requestContext } from './db';
import { ConflictError } from './storage';

const MAX_ATTEMPTS = 8;
const READ_FRESHNESS_MS = 1000;

/**
 * Keeps the in-memory store in step with storage.
 *
 * File backend (one server): only waits for the first load.
 *
 * Shared backend (Cloud Storage, several instances):
 *  - Requests that change data run one at a time per instance. Each starts from the latest stored
 *    version, and the response is held until the change is written. If another instance wrote first
 *    (conditional write fails), the store is reloaded and the request is run again from the start,
 *    so no instance ever overwrites another's changes.
 *  - Reads refresh the store when another instance has written (checked at most once a second).
 */
export function installStoreSync(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    db.ready().then(() => {
      if (!db.shared) return requestContext.run({ id: crypto.randomUUID() }, () => next());
      if ((req as any).__storeSyncReplay) return requestContext.run({ id: crypto.randomUUID() }, () => next());
      const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/api/cron/');
      if (!mutating) return handleRead(req, res, next);
      db.exclusive(() => handleWrite(app, req, res, next)).catch(next);
    }, next);
  });
}

async function handleRead(req: Request, res: Response, next: NextFunction) {
  try {
    if (!db.busy) await db.refreshIfStale(READ_FRESHNESS_MS);
  } catch (e) {
    console.warn('[STORE] refresh failed:', (e as Error)?.message);
  }
  const before = db.epoch;
  res.on('finish', () => {
    // Small side effects of reads (view counters, auto-locking contests) are written when nothing else is.
    if (db.epoch === before || db.busy) return;
    db.exclusive(async () => {
      try {
        await db.commit();
      } catch (e) {
        if (e instanceof ConflictError) await db.discardAndReload();
      }
    }).catch(() => undefined);
  });
  requestContext.run({ id: crypto.randomUUID() }, () => next());
}

function handleWrite(app: Express, req: Request, res: Response, next: NextFunction): Promise<void> {
  return new Promise<void>(resolve => {
    const headerSnapshot = new Set(res.getHeaderNames());
    const origEnd = res.end.bind(res) as (...args: any[]) => Response;
    let attempt = 0;
    // If the client goes away before a response is sent, let the next write proceed.
    res.on('close', () => setTimeout(resolve, 0));

    const finish = (...args: any[]) => {
      res.end = origEnd as any;
      origEnd(...args);
      resolve();
    };

    const run = async () => {
      try {
        await db.refreshIfStale();
      } catch (e) {
        res.status(503).setHeader('Content-Type', 'application/json');
        return finish(JSON.stringify({ error: 'Storage is not reachable right now. Please try again.' }));
      }
      const before = db.epoch;
      res.end = ((...args: any[]) => {
        if (db.epoch === before) {
          finish(...args);
          return res;
        }
        db.commit().then(
          () => finish(...args),
          async err => {
            if (err instanceof ConflictError && attempt < MAX_ATTEMPTS - 1) {
              attempt++;
              await db.discardAndReload().catch(() => undefined);
              await new Promise(r => setTimeout(r, 30 * attempt + Math.random() * 70));
              for (const h of res.getHeaderNames()) if (!headerSnapshot.has(h)) res.removeHeader(h);
              res.statusCode = 200;
              req.url = req.originalUrl;
              (req as any).__storeSyncReplay = true;
              void run();
              return;
            }
            console.error('[STORE] write failed:', err?.message || err);
            await db.discardAndReload().catch(() => undefined);
            for (const h of res.getHeaderNames()) if (!headerSnapshot.has(h)) res.removeHeader(h);
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            finish(JSON.stringify({ error: 'The site is busy saving other changes. Please try again.' }));
          },
        );
        return res;
      }) as any;

      const ctx = { id: crypto.randomUUID() };
      if (attempt === 0) {
        requestContext.run(ctx, () => next());
      } else {
        requestContext.run(ctx, () =>
          (app as any).handle(req, res, (err: any) => {
            if (err) {
              res.statusCode = err.status || 500;
              res.setHeader('Content-Type', 'application/json');
              finish(JSON.stringify({ error: 'Something went wrong' }));
            }
          }),
        );
      }
    };
    void run();
  });
}
