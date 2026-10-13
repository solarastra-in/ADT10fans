import fs from 'fs';
import path from 'path';

/**
 * The Firebase web config in firebase-applet-config.json (safe to publish: it identifies the
 * project, it does not grant access). The server uses it for the project id (Google sign-in) and
 * for the Firestore database that holds the store.
 */
export interface FirebaseAppConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  apiKey?: string;
}

let cached: FirebaseAppConfig | null = null;
export function firebaseAppConfig(): FirebaseAppConfig {
  if (cached) return cached;
  // The Vercel bundle carries the config inside it (see server/vercelHandler.ts).
  const embedded = (globalThis as any).__ADT10_FIREBASE__ as FirebaseAppConfig | undefined;
  if (embedded) return (cached = embedded);
  try {
    cached = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
  } catch {
    cached = {};
  }
  return cached!;
}

/** Project id for verifying Google sign-in: FIREBASE_PROJECT_ID (env or Admin console) or the config file. */
export function firebaseProjectId(): string {
  return (process.env.FIREBASE_PROJECT_ID || firebaseAppConfig().projectId || '').trim();
}
