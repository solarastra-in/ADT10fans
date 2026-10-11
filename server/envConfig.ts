import { db } from './db';

export interface EnvVariableInfo {
  key: string;
  label: string;
  category: 'core' | 'storage' | 'auth' | 'notifications' | 'ai' | 'social' | 'cricket';
  value: string;
  isSecret: boolean;
  isSetInEnv: boolean;
  isOverridden: boolean;
  requiresRestart: boolean;
  restartReason: string;
  description: string;
  defaultValue?: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
}

export const ENV_SPECS: Omit<EnvVariableInfo, 'value' | 'isSetInEnv' | 'isOverridden'>[] = [
  // Core & Server
  {
    key: 'PORT',
    label: 'Server Port',
    category: 'core',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Network socket binds to this port when Node Express starts up.',
    description: 'HTTP listening port for the application server.',
    defaultValue: '3000',
    type: 'number',
  },
  {
    key: 'NODE_ENV',
    label: 'Node Environment',
    category: 'core',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Build pipelines, Vite middleware, and caching modes are determined at process boot.',
    description: 'Server runtime mode ("production" or "development").',
    defaultValue: 'development',
    type: 'string',
  },
  {
    key: 'APP_URL',
    label: 'Public Canonical App URL',
    category: 'core',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Base URL is cached by sitemap.xml, robots.txt, and metadata routers on boot.',
    description: 'Public domain of the site (e.g. https://adt10fans.com) for SEO and OpenGraph share cards.',
    defaultValue: 'http://localhost:3000',
    type: 'string',
  },
  {
    key: 'ADMIN_EMAILS',
    label: 'Root Admin Emails',
    category: 'core',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Dynamic evaluation on each authenticated request.',
    description: 'Comma-separated emails that receive root Admin Console access (e.g. solarastra.in@gmail.com).',
    defaultValue: 'solarastra.in@gmail.com',
    type: 'string',
  },

  // Storage
  {
    key: 'DATA_DIR',
    label: 'Database Storage Directory',
    category: 'storage',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Database manager initializes store path and loads snapshot at process startup.',
    description: 'Folder where t10_store.json lives. In containers mount a persistent volume (e.g. /mnt/data).',
    defaultValue: 'data',
    type: 'string',
  },

  // Authentication & OTP
  {
    key: 'FIREBASE_PROJECT_ID',
    label: 'Firebase Project ID',
    category: 'auth',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Firebase client and server authentication tokens verify against this project ID initialized on startup.',
    description: 'Google sign-in and Firestore database project identifier.',
    defaultValue: '',
    type: 'string',
  },
  {
    key: 'OTP_PEPPER',
    label: 'OTP Cryptographic Pepper',
    category: 'auth',
    isSecret: true,
    requiresRestart: true,
    restartReason: 'Cryptographic salt is bound to OTP hashing routines during server initialization.',
    description: 'Optional server secret mixed into SHA-256 one-time sign-in code hashes.',
    defaultValue: 'adt10',
    type: 'secret',
  },
  {
    key: 'SMTP_HOST',
    label: 'SMTP Mail Server Host',
    category: 'auth',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Nodemailer transport is instantiated dynamically per send.',
    description: 'Outgoing email server for 6-digit one-time passcodes (e.g. smtp.gmail.com).',
    defaultValue: '',
    type: 'string',
  },
  {
    key: 'SMTP_PORT',
    label: 'SMTP Server Port',
    category: 'auth',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Evaluated dynamically per email transport.',
    description: 'Port for mail server (typically 587 for TLS or 465 for SSL).',
    defaultValue: '587',
    type: 'number',
  },
  {
    key: 'SMTP_USER',
    label: 'SMTP Username / Email',
    category: 'auth',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Evaluated dynamically per email transport.',
    description: 'Login account for sending transactional emails.',
    defaultValue: '',
    type: 'string',
  },
  {
    key: 'SMTP_PASS',
    label: 'SMTP Password / App Password',
    category: 'auth',
    isSecret: true,
    requiresRestart: false,
    restartReason: 'Live without restart: Evaluated dynamically per email transport.',
    description: 'App password or credentials for SMTP authentication.',
    defaultValue: '',
    type: 'secret',
  },
  {
    key: 'SMTP_FROM',
    label: 'SMTP From Address',
    category: 'auth',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Evaluated dynamically per email transport.',
    description: 'Sender email shown in verification emails (e.g. "ADT10 Fans <noreply@adt10fans.com>").',
    defaultValue: '',
    type: 'string',
  },

  // Push Notifications
  {
    key: 'FCM_VAPID_KEY',
    label: 'Web Push VAPID Key',
    category: 'notifications',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Client public application config is served to frontend service worker on server boot.',
    description: 'Public Web Push VAPID key from Firebase Console > Project Settings > Cloud Messaging.',
    defaultValue: '',
    type: 'string',
  },
  {
    key: 'FIREBASE_SERVICE_ACCOUNT',
    label: 'Firebase Service Account JSON',
    category: 'notifications',
    isSecret: true,
    requiresRestart: false,
    restartReason: 'Live without restart: Push server re-parses service account credentials on every push dispatch.',
    description: 'Raw JSON or base64 credentials with Cloud Messaging permissions for background web push.',
    defaultValue: '',
    type: 'secret',
  },

  // AI & Gemini
  {
    key: 'GEMINI_API_KEY',
    label: 'Gemini API Key',
    category: 'ai',
    isSecret: true,
    requiresRestart: false,
    restartReason: 'Live without restart: GoogleGenAI client dynamically instantiates with new key.',
    description: 'API key for Gemini models used for AI copy generation and commentary enrichment.',
    defaultValue: '',
    type: 'secret',
  },
  {
    key: 'GEMINI_MODEL',
    label: 'Gemini Model Alias',
    category: 'ai',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Model identifier passed dynamically with each generation request.',
    description: 'Gemini model identifier (recommended: "gemini-3.8-flash").',
    defaultValue: 'gemini-3.8-flash',
    type: 'string',
  },

  // Social Feeds
  {
    key: 'CURATOR_FEED_ID',
    label: 'Curator.io Feed ID',
    category: 'social',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Curator social wall embed and API re-evaluates on each feed sync.',
    description: 'Curator.io feed identifier for multi-channel social curation.',
    defaultValue: '',
    type: 'string',
  },
  {
    key: 'CURATOR_API_KEY',
    label: 'Curator.io API Key',
    category: 'social',
    isSecret: true,
    requiresRestart: false,
    restartReason: 'Live without restart: Re-evaluated whenever Curator API sync is triggered.',
    description: 'API key for querying Curator.io feed posts directly.',
    defaultValue: '',
    type: 'secret',
  },
  {
    key: 'FEED_SYNC_MINUTES',
    label: 'Background Feed Sync Interval (min)',
    category: 'social',
    isSecret: false,
    requiresRestart: true,
    restartReason: 'Background sync cron timer (setInterval) is initialized at server startup.',
    description: 'Minutes between automated background refreshes for team YouTube and sports news (0 disables).',
    defaultValue: '30',
    type: 'number',
  },

  // Cricket Data Provider
  {
    key: 'CRICBUZZ_SERIES_ID',
    label: 'Cricbuzz Official Series ID',
    category: 'cricket',
    isSecret: false,
    requiresRestart: false,
    restartReason: 'Live without restart: Used dynamically by the automated cricket data provider sync script.',
    description: 'Series ID on Cricbuzz for Abu Dhabi T10 League (default: 13307 for 2026 season).',
    defaultValue: '13307',
    type: 'string',
  },
  {
    key: 'CRICKET_API_KEY',
    label: 'Cricket Data Provider API Key',
    category: 'cricket',
    isSecret: true,
    requiresRestart: false,
    restartReason: 'Live without restart: Used dynamically by external provider API requests.',
    description: 'API Key for external CricketData.org / CricAPI services.',
    defaultValue: '',
    type: 'secret',
  },
];

/**
 * Mask secret values for safe display to administrators
 */
function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 6) return '••••••';
  return val.slice(0, 3) + '••••••••' + val.slice(-3);
}

/**
 * Get all environment variables with detailed metadata and restart requirements
 */
export function getAllEnvVariables(): EnvVariableInfo[] {
  const store = db.get();
  const overrides: Record<string, string> = (store.settings as any).envOverrides || {};

  return ENV_SPECS.map(spec => {
    const envVal = process.env[spec.key];
    const isSetInEnv = envVal !== undefined && envVal !== '';
    const hasOverride = overrides[spec.key] !== undefined && overrides[spec.key] !== '';
    
    // Effective value: DB override takes priority for dynamic vars, or env var, or default
    let rawVal = hasOverride ? overrides[spec.key] : (isSetInEnv ? (envVal || '') : (spec.defaultValue || ''));

    // Special integrations mapping from system settings
    if (!hasOverride && !isSetInEnv) {
      if (spec.key === 'ADMIN_EMAILS' && store.settings.adminEmails?.length) {
        rawVal = store.settings.adminEmails.join(', ');
      } else if (spec.key === 'SMTP_HOST' && store.settings.smtp?.host) {
        rawVal = store.settings.smtp.host;
      } else if (spec.key === 'SMTP_PORT' && store.settings.smtp?.port) {
        rawVal = String(store.settings.smtp.port);
      } else if (spec.key === 'SMTP_USER' && store.settings.smtp?.user) {
        rawVal = store.settings.smtp.user;
      } else if (spec.key === 'SMTP_FROM' && store.settings.smtp?.from) {
        rawVal = store.settings.smtp.from;
      } else if (spec.key === 'CURATOR_FEED_ID' && store.settings.curatorFeedId) {
        rawVal = store.settings.curatorFeedId;
      } else if (spec.key === 'CURATOR_API_KEY' && store.settings.curatorApiKey) {
        rawVal = store.settings.curatorApiKey;
      }
    }

    const displayedValue = spec.isSecret ? maskSecret(rawVal) : rawVal;

    return {
      ...spec,
      value: displayedValue,
      isSetInEnv,
      isOverridden: hasOverride,
    };
  });
}

/**
 * Save environment variable overrides to the persistent database settings
 */
export function saveEnvOverrides(newOverrides: Record<string, string>) {
  const store = db.get();
  if (!(store.settings as any).envOverrides) {
    (store.settings as any).envOverrides = {};
  }

  const overrides = (store.settings as any).envOverrides;
  const updatedKeys: string[] = [];
  const requiresRestartKeys: string[] = [];

  for (const [key, value] of Object.entries(newOverrides)) {
    const spec = ENV_SPECS.find(s => s.key === key);
    if (!spec) continue;

    // Do not overwrite secret if client submitted masked dots
    if (spec.isSecret && (value.includes('••••') || value === '')) {
      continue;
    }

    overrides[key] = value.trim();
    updatedKeys.push(key);

    if (spec.requiresRestart) {
      requiresRestartKeys.push(key);
    }

    // Apply live dynamic updates immediately to process.env and store settings
    if (!spec.requiresRestart) {
      process.env[key] = value.trim();

      if (key === 'ADMIN_EMAILS') {
        const emails = value.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        store.settings.adminEmails = emails;
      } else if (key === 'SMTP_HOST') {
        store.settings.smtp.host = value.trim();
      } else if (key === 'SMTP_PORT') {
        store.settings.smtp.port = parseInt(value, 10) || 587;
      } else if (key === 'SMTP_USER') {
        store.settings.smtp.user = value.trim();
      } else if (key === 'SMTP_PASS' && value) {
        store.settings.smtp.pass = value.trim();
      } else if (key === 'SMTP_FROM') {
        store.settings.smtp.from = value.trim();
      } else if (key === 'CURATOR_FEED_ID') {
        store.settings.curatorFeedId = value.trim();
      } else if (key === 'CURATOR_API_KEY') {
        store.settings.curatorApiKey = value.trim();
      }
    }
  }

  db.save();

  return {
    success: true,
    updatedKeys,
    requiresRestartKeys,
    hasRestartRequired: requiresRestartKeys.length > 0,
    message: requiresRestartKeys.length > 0
      ? `Updated ${updatedKeys.length} variable(s). Note: ${requiresRestartKeys.join(', ')} require(s) server restart to take effect.`
      : `Updated ${updatedKeys.length} variable(s) successfully. Live variables applied immediately without restart.`,
  };
}
