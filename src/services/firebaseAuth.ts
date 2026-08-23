import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { app } from '../lib/firebase';

/**
 * Firebase Auth — user identity layer.
 *
 * Users may sign in with e-mail + password (created here) or with VK ID
 * (which mints a custom token server-side). Both produce a stable Firebase
 * uid that Firestore Security Rules rely on.
 */

const auth: Auth = getAuth(app);
const SIGN_IN_TIMEOUT_MS = 8000;

let currentUser: FirebaseUser | null = null;
let readyResolve: ((u: FirebaseUser | null) => void) | null = null;

/** Resolves once the initial auth state is known (never hangs the UI). */
export const authReady: Promise<FirebaseUser | null> = new Promise((resolve) => {
  readyResolve = resolve;
  setTimeout(() => resolve(currentUser), SIGN_IN_TIMEOUT_MS);
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (readyResolve) {
    readyResolve(user);
    readyResolve = null;
  }
});

export function getFirebaseUid(): string | null {
  return currentUser?.uid ?? null;
}

export function isAuthenticated(): boolean {
  return currentUser !== null;
}

export interface FirebaseAuthResult {
  ok: boolean;
  uid?: string;
  error?: string;
}

/** Creates a Firebase e-mail account during registration. */
export async function registerFirebaseAccount(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseAuthResult> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateFirebaseProfile(cred.user, { displayName });
    currentUser = cred.user;
    return { ok: true, uid: cred.user.uid };
  } catch (err: unknown) {
    return { ok: false, error: mapAuthError((err as { code?: string })?.code) };
  }
}

export async function signInWithCustomTokenFirebase(customToken: string): Promise<FirebaseAuthResult> {
  try {
    const cred = await signInWithCustomToken(auth, customToken);
    currentUser = cred.user;
    return { ok: true, uid: cred.user.uid };
  } catch (err: unknown) {
    return { ok: false, error: mapAuthError((err as { code?: string })?.code) };
  }
}

export async function loginFirebaseAccount(
  email: string,
  password: string
): Promise<FirebaseAuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    return { ok: true, uid: cred.user.uid };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    return { ok: false, error: mapAuthError(code), uid: undefined };
  }
}

/** Sends a password recovery e-mail. Never reveals whether the e-mail exists. */
export async function requestFirebasePasswordReset(email: string): Promise<FirebaseAuthResult> {
  try {
    await sendPasswordResetEmail(auth, email, {
      url: 'https://sportbuddy78.pro',
      handleCodeInApp: false
    });
    return { ok: true };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    return { ok: false, error: mapAuthError(code) };
  }
}

export async function signOutFirebase(): Promise<void> {
  try {
    await auth.signOut();
    currentUser = null;
  } catch {
    /* ignore */
  }
}

/** True when the error means the Firebase account no longer exists. */
export function isAccountGoneError(error?: string): boolean {
  return error === 'Аккаунт не найден' || error === 'Неверный e-mail или пароль';
}

function mapAuthError(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Этот e-mail уже зарегистрирован';
    case 'auth/invalid-email':
      return 'Некорректный e-mail';
    case 'auth/weak-password':
      return 'Пароль слишком простой (минимум 6 символов)';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Неверный e-mail или пароль';
    case 'auth/user-not-found':
      return 'Аккаунт не найден';
    case 'auth/too-many-requests':
      return 'Слишком много попыток, повторите позже';
    case 'auth/network-request-failed':
      return 'Нет соединения с сервером';
    default:
      return 'Не удалось выполнить вход';
  }
}

export { auth };
