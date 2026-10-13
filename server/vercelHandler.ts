import type { IncomingMessage, ServerResponse } from 'http';
// Must be the first import: it sets the embedded template and Firebase config before the rest of
// the server loads (imports run in order, and the store picks Firestore from that config on load).
import './vercelEmbed';
import { app, initialize, mountFrontend } from './app';

/**
 * Vercel request handler. Bundled into one file (dist-server/vercel.mjs) at build time and loaded by
 * api/index.ts, because Vercel compiles api/ files one by one and Node cannot load this project's
 * extension-less ESM imports that way. vercel.json rewrites every non-static request here, so API
 * calls and server-rendered pages both go through Express.
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
    // Storage errors carry no secrets (HTTP status and Google's error code), and they tell the owner what to fix.
    const detail = /Firestore|GCS|OAuth|service account/i.test(String(e?.message)) ? ` (${String(e.message).slice(0, 300)})` : '';
    res.end(JSON.stringify({ error: `The site could not reach its database${detail}. If FIREBASE_SERVICE_ACCOUNT was just set, check that it is the full JSON key of a service account in this Firebase project.` }));
    console.error('[BOOT]', e);
    return;
  }
  return (app as any)(req, res);
}
