import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getAnalytics, isSupported as analyticsSupported, Analytics } from 'firebase/analytics';
import {
  getAuth, signInWithCustomToken,
  Auth, User as FirebaseUser
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';

/**
 * SportBuddy78 — Firebase configuration (project: sportbuddy-spb).
 *
 * These values are public client identifiers by design: they only tell the SDK
 * which project to talk to. Actual data protection is enforced by Firestore
 * Security Rules (see firestore.rules) — never rely on hiding this config.
 *
 * Values can be overridden per-environment through Vite env vars.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAFdPSHxHAXYGSPxVSrXJx3d_TQiV45ZNc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sportbuddy-spb.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sportbuddy-spb',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID || '513842673754',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:513842673754:web:4178f60dee76b229104063',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-KKP48V692X'
};

const app: FirebaseApp = initializeApp(firebaseConfig);

/**
 * Firestore with persistent IndexedDB cache.
 * Critical for a mobile app: reads are served instantly from disk, writes are
 * queued while offline and replayed automatically once the network returns.
 */
let db: Firestore;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    // Falls back to long-polling on restrictive mobile networks / proxies
    experimentalAutoDetectLongPolling: true
  });
} catch {
  // initializeFirestore throws if called twice (HMR) — reuse the existing one
  db = getFirestore(app);
}

/** Google Analytics — only in browsers that support it, never blocks startup */
let analytics: Analytics | null = null;
void analyticsSupported()
  .then((ok) => {
    if (ok && firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }
  })
  .catch(() => {
    /* analytics unavailable (WebView / privacy mode) — ignore */
  });

export function getAnalyticsInstance(): Analytics | null {
  return analytics;
}

/** True when a real project is configured (not the offline demo fallback) */
export const isFirebaseConfigured = firebaseConfig.projectId === 'sportbuddy-spb';

/* ---------------------------------------------------------------------------
 * Transport identity for Firestore Security Rules.
 *
 * VK ID is verified by the Vercel Serverless Function `/api/vk-login`.
 * Firebase Cloud Functions are deliberately not used: the project is deployed
 * on the free Vercel Serverless Functions path. The server returns a stable
 * Firebase custom token, so the same VK account keeps the same Firestore UID
 * on every device. There is NO anonymous fallback because that was the source
 * of duplicate VK profiles.
 * ------------------------------------------------------------------------- */

const auth: Auth = getAuth(app);
let transportUid: string | null = auth.currentUser?.uid ?? null;

auth.onAuthStateChanged((user: FirebaseUser | null) => {
  transportUid = user?.uid ?? null;
});

export function getTransportUid(): string | null {
  return transportUid;
}

function apiBase(): string {
  // Capacitor's WebView has a local/native origin, so it must call the public
  // HTTPS deployment. Browser builds stay same-origin so cookies/CORS are not
  // involved and the Vercel route is used directly.
  return Capacitor.isNativePlatform() ? 'https://sportbuddy78.pro' : '';
}

/**
 * Establish the real Firebase transport identity after VK ID login.
 * The access token is verified by Vercel and exchanged for a Firebase custom
 * token. A failed server verification is a hard failure — never silently
 * create an anonymous UID.
 */
export async function ensureTransportSession(
  vkAccessToken?: string,
  vkUserId?: string
): Promise<string | null> {
  if (!vkAccessToken || !vkUserId) {
    return transportUid;
  }

  try {
    // Always re-authenticate when a VK token is supplied. This prevents a
    // previous Firebase session from being reused for another VK account.
    if (auth.currentUser) {
      await auth.signOut();
    }

    const response = await fetch(`${apiBase()}/api/vk-login`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-SportBuddy-Client': Capacitor.isNativePlatform() ? 'android' : 'web'
      },
      body: JSON.stringify({ accessToken: vkAccessToken, vkUserId })
    });

    const payload = await response.json().catch(() => null) as {
      customToken?: string;
      uid?: string;
      vkId?: string;
      error?: string;
    } | null;

    if (!response.ok || !payload?.customToken || !payload.uid || !payload.vkId) {
      throw new Error(payload?.error || `VK server login failed (${response.status})`);
    }

    const cred = await signInWithCustomToken(auth, payload.customToken);
    transportUid = cred.user.uid;
    return transportUid;
  } catch (error) {
    console.error('[VK] Server authentication failed:', error);
    transportUid = null;
    return null;
  }
}

/** Transport sign-out. Never throws — logout must always finish. */
export async function signOutTransport(): Promise<void> {
  try {
    await auth.signOut();
  } catch {
    /* ignore */
  }
  transportUid = null;
}

export { app, db };
