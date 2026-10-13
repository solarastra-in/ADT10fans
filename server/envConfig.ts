import { db, AppStore } from './db';

/**
 * Server settings that used to need environment variables.
 *
 * Almost all of them can now be set in Admin → Environment. Values saved there are kept in the store
 * and applied to process.env every time the store loads (on every server instance and cold start),
 * so they take effect everywhere within a second or two, with no redeploy.
 *
 * A few must stay real environment variables because the server needs them before it can read the
 * store: where the store is and the key to reach it (FIREBASE_SERVICE_ACCOUNT), plus PORT/NODE_ENV.
 */
export type EnvCategory = 'core' | 'storage' | 'auth' | 'notifications' | 'ai' | 'social' | 'cricket';

export interface EnvVariableInfo {
  key: string;
  label: string;
  category: EnvCategory;
  value: string;
  isSecret: boolean;
  isSetInEnv: boolean;
  isOverridden: boolean;
  /** True for the few settings that can only be set as environment variables. */
  envOnly: boolean;
  /** Kept for older admin screens: true only for envOnly settings (they apply on the next deploy). */
  requiresRestart: boolean;
  restartReason: string;
  /** Where the effective value comes from. */
  source: 'console' | 'environment' | 'default' | 'unset';
  description: string;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
}

type Spec = { key: string; label: string; category: EnvCategory; isSecret?: boolean; envOnly?: boolean; description: string; defaultValue?: string; type?: EnvVariableInfo['type'] };

export const ENV_SPECS: Spec[] = [
  // ---- Set once at deployment (needed before the store can be read) ----
  {
    key: 'FIREBASE_SERVICE_ACCOUNT', label: 'Firebase service account key', category: 'storage', isSecret: true, envOnly: true, type: 'secret',
    description: 'The one value to set in Vercel. Firebase console → Project settings → Service accounts → Generate new private key; paste the whole JSON. The site keeps its data in your Firestore database with it, and uses it to send push notifications.',
  },
  { key: 'STORE_BUCKET', label: 'Cloud Storage bucket (optional)', category: 'storage', envOnly: true, description: 'Only if you prefer a Cloud Storage bucket to Firestore for the data store.' },
  { key: 'DATA_DIR', label: 'Data folder (own server only)', category: 'storage', envOnly: true, description: 'Only for a single long-running server with a disk. Not used on Vercel.' },
  { key: 'NODE_ENV', label: 'Runtime mode', category: 'core', envOnly: true, description: 'Set by the host ("production" on Vercel).', defaultValue: 'development' },

  // ---- Site ----
  { key: 'APP_URL', label: 'Site address', category: 'core', description: 'Public address used in canonical links, the sitemap and invite links, e.g. https://fans.example.com. Leave empty to use the address the visitor came in on.' },
  { key: 'ADMIN_EMAILS', label: 'Extra super-admin emails', category: 'core', description: 'Comma-separated. Usually not needed: the owner account is always a super admin, and other admins are added in Admin → Admins.' },
  { key: 'CRON_SECRET', label: 'Scheduled jobs key (optional)', category: 'core', isSecret: true, type: 'secret', description: 'Optional. Scheduled jobs already run by themselves while people use the site. Set this only if an outside scheduler (Vercel Cron, GitHub Actions) should be able to force a run.' },

  // ---- Sign-in ----
  { key: 'FIREBASE_PROJECT_ID', label: 'Firebase project id', category: 'auth', description: 'Read from firebase-applet-config.json; set only to use a different project for Google sign-in.' },
  { key: 'SMTP_HOST', label: 'Email server (SMTP host)', category: 'auth', description: 'For emailing sign-in codes, e.g. smtp.gmail.com or smtp.sendgrid.net. Without email, fans sign in with Google.' },
  { key: 'SMTP_PORT', label: 'SMTP port', category: 'auth', defaultValue: '587', type: 'number', description: 'Usually 587 (or 465 for SSL).' },
  { key: 'SMTP_USER', label: 'SMTP username', category: 'auth', description: 'The email account or API user.' },
  { key: 'SMTP_PASS', label: 'SMTP password', category: 'auth', isSecret: true, type: 'secret', description: 'Password or app password for the email account.' },
  { key: 'SMTP_FROM', label: 'Sender address', category: 'auth', description: 'Shown as the sender, e.g. ADT10 Fans <no-reply@yourdomain.com>.' },
  { key: 'OTP_PEPPER', label: 'Sign-in code secret (optional)', category: 'auth', isSecret: true, type: 'secret', description: 'Extra secret mixed into stored sign-in codes. Changing it cancels codes already sent.' },

  // ---- Notifications ----
  { key: 'FCM_VAPID_KEY', label: 'Web push key (VAPID)', category: 'notifications', description: 'Firebase console → Project settings → Cloud Messaging → Web Push certificates → Key pair. Lets fans turn on push notifications.' },
  { key: 'LOCK_REMINDER_MINUTES', label: 'Dream XI lock reminder (minutes)', category: 'notifications', defaultValue: '30', type: 'number', description: 'Default only; change it in Admin → Settings.' },

  // ---- Live scores ----
  { key: 'CRICKET_API_KEY', label: 'CricketData.org API key', category: 'cricket', isSecret: true, type: 'secret', description: 'From cricketdata.org (free tier available). Turns on automatic live scores, results, scorecards and Dream XI scoring for fixtures linked in Admin → Matches → Find.' },
  { key: 'CRICKETDATA_SERIES_ID', label: 'CricketData series id', category: 'cricket', description: 'The season\'s series id on CricketData, used by Squad tools to read squads.' },
  { key: 'CRICBUZZ_SERIES_ID', label: 'Cricbuzz series number', category: 'cricket', defaultValue: '13307', description: 'Used by Squad tools\' Cricbuzz option.' },

  // ---- Feeds ----
  { key: 'FEED_SYNC_MINUTES', label: 'Feed pull interval (minutes)', category: 'social', defaultValue: '30', type: 'number', description: 'How often YouTube, X, Curator and news are pulled (minimum 5).' },
  { key: 'CURATOR_FEED_ID', label: 'Curator.io feed id', category: 'social', description: 'Also editable in Admin → Settings.' },
  { key: 'CURATOR_API_KEY', label: 'Curator.io API key', category: 'social', isSecret: true, type: 'secret', description: 'Also editable in Admin → Settings.' },

  // ---- AI ----
  { key: 'GEMINI_API_KEY', label: 'Gemini API key', category: 'ai', isSecret: true, type: 'secret', description: 'From Google AI Studio. Turns on the AI copy helper in the admin console.' },
  { key: 'GEMINI_MODEL', label: 'Gemini model', category: 'ai', defaultValue: 'gemini-3.8-flash', description: 'Model name for the AI helper.' },
];

const SPEC = new Map(ENV_SPECS.map(s => [s.key, s]));
export const CONSOLE_KEYS = ENV_SPECS.filter(s => !s.envOnly).map(s => s.key);

// Values the real environment had before any console value was applied, so clearing a console value restores them.
const original: Record<string, string | undefined> = {};
const applied = new Set<string>();

function overridesOf(store: AppStore): Record<string, string> {
  const s = store.settings as any;
  if (!s.envOverrides || typeof s.envOverrides !== 'object') s.envOverrides = {};
  return s.envOverrides;
}

/** Puts the console values into process.env. Runs on every store load (see db.onLoad below). */
export function applyEnvOverrides(store: AppStore) {
  const overrides = overridesOf(store);
  for (const key of CONSOLE_KEYS) {
    if (!(key in original)) original[key] = process.env[key];
    const v = overrides[key];
    if (typeof v === 'string' && v.trim() !== '') {
      process.env[key] = v.trim();
      applied.add(key);
    } else if (applied.has(key)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
      applied.delete(key);
    }
  }
  return false; // never changes the store itself
}
db.onLoad(applyEnvOverrides);

function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 6) return '••••••';
  return val.slice(0, 3) + '••••••••' + val.slice(-3);
}

export function getAllEnvVariables(): EnvVariableInfo[] {
  const overrides = overridesOf(db.get());
  return ENV_SPECS.map(spec => {
    const fromConsole = !spec.envOnly && typeof overrides[spec.key] === 'string' && overrides[spec.key] !== '';
    const envVal = spec.envOnly ? process.env[spec.key] : original[spec.key] ?? (applied.has(spec.key) ? undefined : process.env[spec.key]);
    const isSetInEnv = envVal !== undefined && envVal !== '';
    const raw = fromConsole ? overrides[spec.key] : isSetInEnv ? envVal! : spec.defaultValue || '';
    const source: EnvVariableInfo['source'] = fromConsole ? 'console' : isSetInEnv ? 'environment' : spec.defaultValue ? 'default' : 'unset';
    let value = spec.isSecret ? maskSecret(raw) : raw;
    if (spec.key === 'FIREBASE_SERVICE_ACCOUNT' && raw) {
      try {
        const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf-8');
        value = `${JSON.parse(json).client_email || 'service account'} (set)`;
      } catch {
        value = 'set, but not valid JSON';
      }
    }
    return {
      key: spec.key,
      label: spec.label,
      category: spec.category,
      value,
      isSecret: Boolean(spec.isSecret),
      isSetInEnv,
      isOverridden: fromConsole,
      envOnly: Boolean(spec.envOnly),
      requiresRestart: Boolean(spec.envOnly),
      restartReason: spec.envOnly ? 'Set in your host\'s environment variables (Vercel → Settings → Environment Variables), then redeploy.' : 'Saved here; applies on every server within seconds.',
      source,
      description: spec.description,
      defaultValue: spec.defaultValue,
      type: spec.type || 'string',
    };
  });
}

/**
 * Saves console values. An empty string clears the console value (the environment or default applies
 * again). Masked secrets sent back unchanged are ignored.
 */
export function saveEnvOverrides(newOverrides: Record<string, string>) {
  const store = db.get();
  const overrides = overridesOf(store);
  const updatedKeys: string[] = [];
  const refused: string[] = [];
  for (const [key, rawValue] of Object.entries(newOverrides || {})) {
    const spec = SPEC.get(key);
    if (!spec) continue;
    if (spec.envOnly) {
      refused.push(key);
      continue;
    }
    const value = String(rawValue ?? '').trim();
    if (spec.isSecret && value.includes('••••')) continue;
    if (spec.type === 'number' && value && !Number.isFinite(Number(value))) {
      return { success: false, error: `${spec.label} must be a number`, updatedKeys: [], requiresRestartKeys: [], hasRestartRequired: false, message: `${spec.label} must be a number` };
    }
    if (key === 'APP_URL' && value && !/^https?:\/\/[^\s/]+/.test(value)) {
      return { success: false, error: 'Site address must start with https://', updatedKeys: [], requiresRestartKeys: [], hasRestartRequired: false, message: 'Site address must start with https://' };
    }
    if (value) overrides[key] = value;
    else delete overrides[key];
    updatedKeys.push(key);
    // Keep the matching Settings fields in step.
    if (key === 'SMTP_HOST') store.settings.smtp.host = value;
    else if (key === 'SMTP_PORT') store.settings.smtp.port = parseInt(value, 10) || 587;
    else if (key === 'SMTP_USER') store.settings.smtp.user = value;
    else if (key === 'SMTP_PASS' && value) store.settings.smtp.pass = value;
    else if (key === 'SMTP_FROM') store.settings.smtp.from = value;
    else if (key === 'CURATOR_FEED_ID') store.settings.curatorFeedId = value;
    else if (key === 'CURATOR_API_KEY') store.settings.curatorApiKey = value;
    else if (key === 'LOCK_REMINDER_MINUTES' && value) store.settings.lockReminderMinutes = Math.min(240, Math.max(5, Math.round(Number(value))));
  }
  if ((updatedKeys.some(k => k.startsWith('SMTP_'))) && store.settings.smtp.host) store.settings.smtp.enabled = true;
  applyEnvOverrides(store);
  db.save();
  return {
    success: true,
    updatedKeys,
    refusedKeys: refused,
    requiresRestartKeys: [] as string[],
    hasRestartRequired: false,
    message: `Saved ${updatedKeys.length} setting(s); they apply on every server within seconds.${refused.length ? ` ${refused.join(', ')} can only be set in your host's environment variables.` : ''}`,
  };
}
