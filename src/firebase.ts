import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type PushStatus = 'granted' | 'denied' | 'default' | 'unsupported';

let messagingInstance: Messaging | null = null;
let messagingSupported: boolean | null = null;

async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (messagingSupported === false) return null;
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    messagingSupported = supported;
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[FCM] isSupported check failed:', err);
    messagingSupported = false;
  }
  return null;
}

/**
 * Request notification permission and obtain a real FCM device token.
 * The VAPID key comes from the public config (`config.fcmVapidKey`). When it is
 * missing, or the browser can't produce a token, push is reported as unsupported —
 * we never invent a token.
 */
export async function requestFCMToken(
  vapidKey?: string
): Promise<{ token: string | null; status: PushStatus; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { token: null, status: 'unsupported', error: 'This browser does not support web notifications.' };
  }
  if (!vapidKey) {
    return { token: null, status: 'unsupported', error: 'Push notifications are not enabled for this site yet.' };
  }

  const messaging = await getFCMInstance();
  if (!messaging) {
    return { token: null, status: 'unsupported', error: 'Push messaging is not supported in this browser.' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { token: null, status: permission };
    }

    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM] Service worker registration failed:', swErr);
      }
    }

    const token = await getToken(messaging, { serviceWorkerRegistration: swReg, vapidKey });
    if (token) return { token, status: 'granted' };
    return { token: null, status: 'unsupported', error: 'Could not obtain a push token from this browser.' };
  } catch (err: any) {
    return { token: null, status: 'unsupported', error: err?.message || 'Push registration failed.' };
  }
}

/** Register a foreground FCM message listener. Returns an unsubscribe function or null. */
export async function registerForegroundPushListener(
  onReceive: (payload: any) => void
): Promise<(() => void) | null> {
  const messaging = await getFCMInstance();
  if (!messaging) return null;

  try {
    return onMessage(messaging, onReceive);
  } catch (err) {
    console.warn('[FCM] Could not attach foreground listener:', err);
    return null;
  }
}
