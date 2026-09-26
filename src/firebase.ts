import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, setDoc, getDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const db = firestore;
export const googleProvider = new GoogleAuthProvider();

let messagingInstance: Messaging | null = null;
let messagingSupported: boolean | null = null;

export async function getFCMInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  if (messagingSupported === false) return null;

  try {
    const supported = await isSupported();
    messagingSupported = supported;
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[FCM] Firebase Messaging isSupported check failed:', err);
    messagingSupported = false;
  }
  return null;
}

/**
 * Request notification permissions and obtain an FCM device token
 */
export async function requestFCMToken(vapidKey?: string): Promise<{ token: string | null; status: 'granted' | 'denied' | 'default' | 'unsupported'; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { token: null, status: 'unsupported', error: 'Web Notifications are not supported in this environment' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { token: null, status: permission };
    }

    // Try service worker registration if supported
    let swReg: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await navigator.serviceWorker.ready;
      } catch (swErr) {
        console.warn('[FCM] ServiceWorker registration notice:', swErr);
      }
    }

    const messaging = await getFCMInstance();
    if (messaging) {
      try {
        const token = await getToken(messaging, {
          serviceWorkerRegistration: swReg,
          vapidKey: vapidKey || undefined
        });
        if (token) {
          console.log('[FCM] Acquired FCM Device Token:', token.slice(0, 16) + '...');
          return { token, status: 'granted' };
        }
      } catch (tokenErr: any) {
        console.warn('[FCM] Native getToken notice (falling back to client push identifier):', tokenErr?.message);
      }
    }

    // Fallback device token for sandboxed environment or missing VAPID key
    let storedToken = localStorage.getItem('adt10_fcm_device_token');
    if (!storedToken) {
      storedToken = 'fcm_web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('adt10_fcm_device_token', storedToken);
    }
    return { token: storedToken, status: 'granted' };
  } catch (err: any) {
    return { token: null, status: 'denied', error: err?.message || 'Permission request failed' };
  }
}

/**
 * Register foreground FCM push message listener
 */
export async function registerForegroundPushListener(onReceive: (payload: any) => void): Promise<(() => void) | null> {
  const messaging = await getFCMInstance();
  if (!messaging) return null;

  try {
    return onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground push message received:', payload);
      onReceive(payload);
    });
  } catch (err) {
    console.warn('[FCM] Could not attach foreground listener:', err);
    return null;
  }
}

// Test Firestore connection on boot as mandated by the Firebase skill guide
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    console.log('Firebase connection verified successfully.');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or pending config.');
    }
  }
}

testFirebaseConnection();

