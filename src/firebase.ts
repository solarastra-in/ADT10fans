import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import type { Messaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

/**
 * Firebase is used for two things only: Google sign-in (the ID token is verified by our server,
 * which then issues its own session) and web push (FCM). All data lives on our server.
 */
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

function firebaseApp(): FirebaseApp {
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) authInstance = getAuth(firebaseApp());
  return authInstance;
}

export function googleProvider() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  return p;
}

export type PushStatus = 'granted' | 'denied' | 'default' | 'unsupported';

let messagingInstance: Messaging | null = null;
let messagingSupported: boolean | null = null;

async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (messagingSupported === false || typeof window === 'undefined') return null;
  try {
    const { isSupported, getMessaging } = await import('firebase/messaging');
    messagingSupported = await isSupported();
    if (messagingSupported) messagingInstance = getMessaging(firebaseApp());
    return messagingInstance;
  } catch {
    messagingSupported = false;
    return null;
  }
}

/**
 * Ask for notification permission and get a real FCM device token. Needs the VAPID key from the
 * public config; without it push is reported as unavailable. A token is never invented.
 */
export async function requestFCMToken(vapidKey?: string): Promise<{ token: string | null; status: PushStatus; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) return { token: null, status: 'unsupported', error: 'This browser does not support notifications.' };
  if (!vapidKey) return { token: null, status: 'unsupported', error: 'Push notifications are not switched on for this site yet.' };
  const messaging = await getFCMInstance();
  if (!messaging) return { token: null, status: 'unsupported', error: 'This browser does not support push messages.' };
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { token: null, status: permission };
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      } catch {
        /* fall back to the default registration */
      }
    }
    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messaging, { serviceWorkerRegistration: swReg, vapidKey });
    return token ? { token, status: 'granted' } : { token: null, status: 'unsupported', error: 'Could not get a push token from this browser.' };
  } catch (err: any) {
    return { token: null, status: 'unsupported', error: err?.message || 'Push registration failed.' };
  }
}

export async function registerForegroundPushListener(onReceive: (payload: any) => void): Promise<(() => void) | null> {
  const messaging = await getFCMInstance();
  if (!messaging) return null;
  try {
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, onReceive);
  } catch {
    return null;
  }
}
