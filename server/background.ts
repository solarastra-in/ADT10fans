import { requestContext } from './db';

/**
 * Runs slow work (sending push notifications, for example) after the response, outside the request
 * that started it. It leaves the request's context, so its store changes are written as their own
 * short transactions instead of waiting for a request that has already finished. On Vercel the
 * function is kept alive until the work ends.
 */
export function runInBackground(label: string, work: () => Promise<unknown>): Promise<void> {
  const p = requestContext.exit(() =>
    Promise.resolve()
      .then(work)
      .then(
        () => undefined,
        e => console.error(`[BACKGROUND] ${label} failed:`, (e as Error)?.message || e),
      ),
  );
  if (process.env.VERCEL) {
    import('@vercel/functions').then(m => m.waitUntil(p)).catch(() => undefined);
  }
  return p;
}

/** Runs `fn` over `items` with at most `limit` running at once. */
export async function inParallel<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
