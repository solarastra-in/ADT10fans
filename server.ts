import { app, initialize, mountFrontend } from './server/app';
import { db } from './server/db';
import { startJobTimer } from './server/jobs';
import { ephemeralDiskWarning } from './server/storage';

export { app, initialize };
export default app;

process.on('unhandledRejection', (reason: any) => {
  console.warn('[SERVER] Caught unhandled rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err: any) => {
  console.warn('[SERVER] Caught uncaught exception:', err?.message || err);
});

const cliPort = (() => {
  const idx = process.argv.indexOf('--port');
  return idx >= 0 && process.argv[idx + 1] ? Number(process.argv[idx + 1]) : null;
})();
const PORT = cliPort || Number((process.env.PORT && process.env.PORT !== '8080') ? process.env.PORT : (process.env.APP_PORT || process.env.DEFAULT_APP_PORT || 3000)) || 3000;

async function start() {
  await initialize().catch(err => {
    console.warn('[SERVER] DB initialize warning (continuing with cached store):', err?.message || err);
  });
  await mountFrontend();
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ADT10 Fans running on http://0.0.0.0:${PORT} (${process.env.NODE_ENV === 'production' ? 'production' : 'development'}, store: ${db.backend.describe()})`);
    const warning = ephemeralDiskWarning(db.backend);
    if (warning) console.warn(`[STORE] ${warning}`);
    if (!process.env.ADMIN_EMAILS) console.warn('[SETUP] ADMIN_EMAILS is empty: only the built-in owner account can open the Admin Console.');
  });
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[SERVER] Port ${PORT} already active, reusing existing listener`);
    } else {
      console.error('[SERVER] Server listener error:', err);
    }
  });
  try {
    startJobTimer();
  } catch (e: any) {
    console.warn('[SERVER] Scheduled job timer warning:', e?.message || e);
  }
}

if (!process.env.VERCEL) {
  start().catch(err => {
    console.error('Failed to start server:', err);
  });
}
