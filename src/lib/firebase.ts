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
  getAuth,
  Auth, User as FirebaseUser
} from 'firebase/auth';

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
 * Firebase Auth is intentionally NOT a user-facing auth system: people sign in
 * only with VK ID. Firestore rules still require `request.auth != null`, so we
 * keep a silent transport session — a stable Firebase custom token issued by
 * the server after it verifies the VK access token, with an anonymous
 * fallback when the server exchange is unavailable or offline.
 * ------------------------------------------------------------------------- */

const auth: Auth = getAuth(app);
let transportUid: string | null = auth.currentUser?.uid ?? null;

auth.onAuthStateChanged((user: FirebaseUser | null) => {
  transportUid = user?.uid ?? null;
});

export function getTransportUid(): string | null {
  return transportUid;
}

/**
 * Establishes the Firestore transport identity after a VK ID login.
 * Real user authentication is performed by Firebase Auth. No anonymous fallback is created because anonymous UIDs split profiles across devices.
 */
export async function ensureTransportSession(
  _vkAccessToken?: string,
  _vkUserId?: string
): Promise<string | null> {
  // Never create anonymous identities for real users. Anonymous Firebase UIDs
  // were a major source of duplicate profiles and cross-device data splits.
  return transportUid;
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
