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
