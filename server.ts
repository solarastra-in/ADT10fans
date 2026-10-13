import { app, initialize, mountFrontend } from './server/app';
import { db } from './server/db';
import { startJobTimer } from './server/jobs';
import { ephemeralDiskWarning } from './server/storage';

export { app, initialize };
export default app;

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  await initialize();
  await mountFrontend();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ADT10 Fans running on http://0.0.0.0:${PORT} (${process.env.NODE_ENV === 'production' ? 'production' : 'development'}, store: ${db.backend.describe()})`);
    const warning = ephemeralDiskWarning(db.backend);
    if (warning) console.warn(`[STORE] ${warning}`);
    if (!process.env.ADMIN_EMAILS) console.warn('[SETUP] ADMIN_EMAILS is empty: only the built-in owner account can open the Admin Console.');
  });
  startJobTimer();
}

if (!process.env.VERCEL) {
  start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
