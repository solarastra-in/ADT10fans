import type { IncomingMessage, ServerResponse } from 'http';
import { app, initialize, mountFrontend } from '../server/app';

/**
 * Vercel serverless entry. vercel.json rewrites every request that is not a static file here,
 * so API calls and server-rendered pages (SEO) both go through Express.
 */
let ready: Promise<void> | null = null;
function boot() {
  if (!ready) {
    ready = (async () => {
      await initialize();
      await mountFrontend();
    })().catch(e => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // Rewrites keep the original path in the x-forwarded / matched-path headers on some runtimes.
  const original = (req.headers['x-vercel-original-path'] as string) || (req.headers['x-matched-path'] as string);
  if (original && (req.url === '/api' || req.url?.startsWith('/api/index') || req.url?.startsWith('/api?'))) {
    const q = req.url.indexOf('?');
    req.url = original + (q >= 0 && !original.includes('?') ? req.url.slice(q) : '');
  }
  try {
    await boot();
  } catch (e: any) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'The site is starting up or storage is not reachable. Please try again.' }));
    console.error('[BOOT]', e);
    return;
  }
  return (app as any)(req, res);
}
