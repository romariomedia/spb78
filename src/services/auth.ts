import { AuthAccount } from '../lib/types';
import { triggerHapticNotification } from './native';
import { authReady, getFirebaseUid, signInWithCustomTokenFirebase, signOutFirebase } from './firebaseAuth';
import { vkFallbackEmail } from './vkid';
import { resetLocalProgress } from './reset';

/**
 * Authentication v2: Firebase is the identity source of truth.
 * localStorage contains only one device session mirror, never an account list.
 */
const SESSION_KEY = 'sportbuddy_session_v2';
const ACCOUNT_KEY = 'sportbuddy_account_v2';
const BIOMETRIC_KEY = 'sportbuddy_biometric_v2';
const LEGACY_ACCOUNTS_KEY = 'sportbuddy_accounts_v1';
const LEGACY_SESSION_KEY = 'sportbuddy_session_v1';

export const TRIAL_DAYS = 30;

declare global { interface Window { Capacitor?: { isNativePlatform?: () => boolean } } }

function authApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || '';
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return 'https://sportbuddy78.pro';
  return '';
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^@\s]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Пароль должен содержать минимум 6 символов';
  if (!/[a-zA-Zа-яА-Я]/.test(password)) return 'Пароль должен содержать хотя бы одну букву';
  if (!/[0-9]/.test(password)) return 'Пароль должен содержать хотя бы одну цифру';
  return null;
}

function readAccount(): AuthAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) as AuthAccount : null;
  } catch {
    return null;
  }
}

function writeAccount(account: AuthAccount): void {
  try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account)); } catch { /* ignore */ }
}

function clearLegacyAccountStore(): void {
  try {
    localStorage.removeItem(LEGACY_ACCOUNTS_KEY);
    localStorage.removeItem(LEGACY_SESSION_KEY);
  } catch { /* ignore */ }
}

/** Compatibility helper: there is intentionally only one local account mirror. */
export function removeLocalAccount(accountId: string): void {
  const account = readAccount();
  if (!account || account.id === accountId) {
    try {
      localStorage.removeItem(ACCOUNT_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }
}

export function accountExists(email: string): boolean {
  return readAccount()?.email?.toLowerCase() === email.trim().toLowerCase();
}

export function hasAnyAccount(): boolean { return readAccount() !== null; }
export function getLastAccount(): AuthAccount | null { return readAccount(); }

export interface AuthResult {
  ok: boolean;
  error?: string;
  account?: AuthAccount;
  isNewAccount?: boolean;
}

function makeAccount(uid: string, email: string, name: string, extra: Partial<AuthAccount> = {}): AuthAccount {
  return {
    id: uid,
    name: name.trim() || 'Спортсмен',
    email: email.trim().toLowerCase(),
    passwordHash: '',
    salt: '',
    createdAt: new Date().toISOString(),
    biometricEnabled: false,
    firebaseUid: uid,
    ...extra
  };
}

function saveSession(account: AuthAccount): void {
  writeAccount(account);
  try { localStorage.setItem(SESSION_KEY, account.id); } catch { /* ignore */ }
  clearLegacyAccountStore();
}

/**
 * VK ID is verified by /api/vk-login. The API resolves the canonical Firebase
 * UID by VK ID or e-mail and returns a Firebase custom token. This is the key
 * anti-duplication rule: VK never creates a second local account by vkId.
 */
export async function loginWithVK(
  vkId: string,
  email: string,
  fullName: string,
  avatar: string,
  vkAccessToken?: string
): Promise<AuthResult & { avatar?: string }> {
  if (!vkAccessToken || !vkId) {
    return { ok: false, error: 'VK не передал действительный токен авторизации' };
  }

  try {
    const response = await fetch(`${authApiBase()}/api/vk-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: vkAccessToken,
        vkUserId: vkId,
        email: email || vkFallbackEmail(vkId),
        name: fullName,
        avatar
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.customToken || !payload.uid) {
      return { ok: false, error: payload.error || 'Не удалось подтвердить VK ID на сервере' };
    }

    const firebase = await signInWithCustomTokenFirebase(payload.customToken);
    if (!firebase.ok || !firebase.uid) {
      return { ok: false, error: firebase.error || 'Не удалось открыть защищённую сессию' };
    }

    const account = makeAccount(firebase.uid, payload.email || email || vkFallbackEmail(vkId), payload.name || fullName, {
      vkId: String(payload.vkId || vkId),
      provider: 'vk',
      biometricEnabled: readAccount()?.biometricEnabled ?? false,
      firebaseUid: firebase.uid
    });

    saveSession(account);
    if (payload.isNewAccount) resetLocalProgress();
    triggerHapticNotification('success');
    return { ok: true, account, isNewAccount: Boolean(payload.isNewAccount), avatar: payload.avatar || avatar };
  } catch {
    return { ok: false, error: 'Нет соединения с сервером авторизации' };
  }
}

export async function registerAccount(
  name: string,
  email: string,
  password: string,
  gender?: 'male' | 'female'
): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (name.trim().length < 2) return { ok: false, error: 'Введите имя и фамилию' };
  if (!validateEmail(cleanEmail)) return { ok: false, error: 'Некорректный e-mail адрес' };
  const pwdError = validatePassword(password);
  if (pwdError) return { ok: false, error: pwdError };
  if (gender !== 'male' && gender !== 'female') return { ok: false, error: 'Выберите пол — он определяет подбор напарников' };

  const { registerFirebaseAccount } = await import('./firebaseAuth');
  const firebase = await registerFirebaseAccount(cleanEmail, password, name.trim());
  if (!firebase.ok || !firebase.uid) return { ok: false, error: firebase.error || 'Не удалось создать аккаунт' };

  const account = makeAccount(firebase.uid, cleanEmail, name, { gender, firebaseUid: firebase.uid });
  saveSession(account);
  resetLocalProgress();
  triggerHapticNotification('success');
  return { ok: true, account, isNewAccount: true };
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const { loginFirebaseAccount, isAccountGoneError } = await import('./firebaseAuth');
  const firebase = await loginFirebaseAccount(cleanEmail, password);
  if (!firebase.ok || !firebase.uid) {
    if (isAccountGoneError(firebase.error)) removeLocalAccount(readAccount()?.id || '');
    return { ok: false, error: firebase.error || 'Не удалось войти' };
  }

  const old = readAccount();
  const account = makeAccount(firebase.uid, cleanEmail, old?.email === cleanEmail ? old.name : cleanEmail.split('@')[0] || 'Спортсмен', {
    ...(old && old.id === firebase.uid ? old : {}),
    id: firebase.uid,
    email: cleanEmail,
    firebaseUid: firebase.uid
  });
  saveSession(account);
  triggerHapticNotification('success');
  return { ok: true, account };
}

export async function requestPasswordRecovery(email: string): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!validateEmail(cleanEmail)) return { ok: false, error: 'Введите корректный e-mail' };
  const { requestFirebasePasswordReset } = await import('./firebaseAuth');
  const result = await requestFirebasePasswordReset(cleanEmail);
  return result.ok ? { ok: true } : { ok: false, error: result.error || 'Не удалось отправить письмо' };
}

export function setSession(accountId: string): void {
  const account = readAccount();
  if (account && account.id === accountId) {
    try { localStorage.setItem(SESSION_KEY, accountId); } catch { /* ignore */ }
  }
}

export function getSessionAccount(): AuthAccount | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    const account = readAccount();
    if (id && account?.id === id) return account;
    // One-time migration: old multi-account storage is deliberately not reused.
    if (!id) return null;
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch { return null; }
}

export function logout(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(BIOMETRIC_KEY);
  } catch { /* ignore */ }
  void signOutFirebase();
}

export function isBiometricEnabled(): boolean { return localStorage.getItem(BIOMETRIC_KEY) !== null; }
export function getBiometricAccountId(): string | null { return localStorage.getItem(BIOMETRIC_KEY); }

export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function enrollBiometric(account: AuthAccount): Promise<{ ok: boolean; error?: string }> {
  try {
    if (await isBiometricSupported()) {
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(account.id);
      await navigator.credentials.create({
        publicKey: {
          challenge, rp: { name: 'SportBuddy СПб' },
          user: { id: userId, name: account.email, displayName: account.name },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60000, attestation: 'none'
        }
      });
    }
    localStorage.setItem(BIOMETRIC_KEY, account.id);
    writeAccount({ ...account, biometricEnabled: true });
    triggerHapticNotification('success');
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: (err as DOMException)?.name === 'NotAllowedError' ? 'Сканирование отменено' : 'Биометрия недоступна на этом устройстве' };
  }
}

export async function authenticateBiometric(): Promise<AuthResult> {
  const accountId = getBiometricAccountId();
  const account = readAccount();
  if (!accountId || !account || account.id !== accountId) return { ok: false, error: 'Вход по отпечатку не настроен' };
  try {
    await authReady;
    if (getFirebaseUid() !== account.id) return { ok: false, error: 'Защищённая Firebase-сессия не восстановлена. Войдите по паролю или VK.' };
    if (await isBiometricSupported()) {
      const challenge = new Uint8Array(32); crypto.getRandomValues(challenge);
      await navigator.credentials.get({ publicKey: { challenge, userVerification: 'required', timeout: 60000 } });
    }
    setSession(account.id); triggerHapticNotification('success'); return { ok: true, account };
  } catch (err: unknown) {
    return { ok: false, error: (err as DOMException)?.name === 'NotAllowedError' ? 'Отпечаток не распознан или отменён' : 'Не удалось выполнить биометрический вход' };
  }
}

export function disableBiometric(): void { localStorage.removeItem(BIOMETRIC_KEY); }
