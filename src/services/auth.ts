import { AuthAccount } from '../lib/types';
import { triggerHapticNotification } from './native';
import { ensureTransportSession } from '../lib/firebase';
import {
  registerFirebaseAccount, loginFirebaseAccount,
  requestFirebasePasswordReset, isAccountGoneError
} from './firebaseAuth';
import { vkDerivedPassword } from './vkid';
import { resetLocalProgress } from './reset';

const ACCOUNTS_KEY = 'sportbuddy_accounts_v1';
const SESSION_KEY = 'sportbuddy_session_v1';
const BIOMETRIC_KEY = 'sportbuddy_biometric_v1';

export const TRIAL_DAYS = 30;

/* ------------------------- password hashing (SHA-256) ------------------------- */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`sportbuddy_spb::${salt}::${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^@\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < 6) return 'Пароль должен содержать минимум 6 символов';
  if (!/[a-zA-Zа-яА-Я]/.test(password)) return 'Пароль должен содержать хотя бы одну букву';
  if (!/[0-9]/.test(password)) return 'Пароль должен содержать хотя бы одну цифру';
  return null;
}

/** Removes a local account entry so a deleted account can re-register fresh. */
export function removeLocalAccount(accountId: string): void {
  writeAccounts(readAccounts().filter((a) => a.id !== accountId));
}

/* ------------------------------- account store ------------------------------- */

function readAccounts(): AuthAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as AuthAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: AuthAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* ignore quota */
  }
}

function persistAccountPatch(id: string, patch: Partial<AuthAccount>): AuthAccount {
  let updated: AuthAccount | null = null;
  const accounts = readAccounts().map((account) => {
    if (account.id !== id) return account;
    updated = { ...account, ...patch };
    return updated;
  });
  writeAccounts(accounts);
  return updated ?? { id, name: '', email: '', passwordHash: '', salt: '', createdAt: '', biometricEnabled: false };
}

export function accountExists(email: string): boolean {
  return readAccounts().some((a) => a.email.toLowerCase() === email.trim().toLowerCase());
}

export function hasAnyAccount(): boolean {
  return readAccounts().length > 0;
}

export function getLastAccount(): AuthAccount | null {
  const accounts = readAccounts();
  return accounts.length > 0 ? accounts[accounts.length - 1]! : null;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  account?: AuthAccount;
  isNewAccount?: boolean;
}

/**
 * VK ID is the only user-facing authentication.
 *
 * The VK access token is verified by the Vercel Serverless Function `/api/vk-login`,
 * which mints a stable Firebase custom token. There is no anonymous fallback: a
 * failed VK verification must never create a second profile on another device.
 */
export async function loginWithVK(
  vkId: string,
  email: string,
  fullName: string,
  avatar: string,
  vkAccessToken?: string
): Promise<AuthResult & { avatar?: string }> {
  const cleanVkId = String(vkId || '').trim();
  if (!cleanVkId || !vkAccessToken) {
    return { ok: false, error: 'Не удалось подтвердить VK ID. Повторите вход через VK.' };
  }

  const cleanEmail = email.trim().toLowerCase() || `vk_${cleanVkId}@sportbuddy78.pro`;
  const password = vkDerivedPassword(cleanVkId);
  const existing = readAccounts().find(
    (a) => a.vkId === cleanVkId || a.email.toLowerCase() === cleanEmail
  );

  // Verify VK on Vercel first. If this fails, do not create/restore a local
  // account and do not fall back to an anonymous Firebase UID.
  const transportUid = await ensureTransportSession(vkAccessToken, cleanVkId);
  if (!transportUid) {
    return { ok: false, error: 'Не удалось подтвердить VK ID на сервере. Повторите вход через VK.' };
  }

  // Returning VK user → restore the local session and attach the canonical
  // Firebase UID returned by the server.
  if (existing) {
    setSession(existing.id);
    triggerHapticNotification('success');
    const syncedAccount = persistAccountPatch(existing.id, { firebaseUid: transportUid, vkId: cleanVkId, provider: 'vk' });
    return { ok: true, account: syncedAccount, avatar };
  }

  // First VK sign-in → create the local account.
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const account: AuthAccount = {
    id: `acc_vk_${cleanVkId}`,
    name: fullName,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    biometricEnabled: false,
    vkId: cleanVkId,
    provider: 'vk',
    firebaseUid: transportUid
  };

  // Clean slate for the new athlete.
  resetLocalProgress();

  writeAccounts([...readAccounts(), account]);
  setSession(account.id);
  triggerHapticNotification('success');

  return { ok: true, account, isNewAccount: true, avatar };
}

/**
 * E-mail + password registration with Firebase Auth.
 * Firebase is the authoritative duplicate-e-mail registry, so we register
 * there first; only on success do we persist the local account.
 */
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
  if (gender !== 'male' && gender !== 'female') {
    return { ok: false, error: 'Выберите пол — он определяет подбор напарников' };
  }

  // A stale local entry for a server-deleted account must not block re-signup.
  const staleLocal = readAccounts().find((a) => a.email.toLowerCase() === cleanEmail);

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const firebase = await registerFirebaseAccount(cleanEmail, password, name.trim());
  if (!firebase.ok || !firebase.uid) {
    // If Firebase says the e-mail is taken but we have a stale local copy of a
    // deleted account, surface a precise message instead of a generic failure.
    if (firebase.error === 'Этот e-mail уже зарегистрирован' && !staleLocal) {
      return { ok: false, error: firebase.error };
    }
    return { ok: false, error: firebase.error || 'Не удалось создать аккаунт' };
  }

  const account: AuthAccount = {
    id: firebase.uid,
    name: name.trim(),
    // Gender is chosen once here and locked — it cannot be edited later.
    gender,
    email: cleanEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    biometricEnabled: false,
    firebaseUid: firebase.uid
  };

  // Drop any stale local duplicate, then persist the fresh account.
  writeAccounts([...readAccounts().filter((a) => a.id !== account.id && a.email.toLowerCase() !== cleanEmail), account]);
  setSession(account.id);
  resetLocalProgress();
  triggerHapticNotification('success');

  return { ok: true, account, isNewAccount: true };
}

/** E-mail + password login. Deleted server accounts are cleaned locally. */
export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const local = readAccounts().find((a) => a.email.toLowerCase() === cleanEmail);

  const firebase = await loginFirebaseAccount(cleanEmail, password);
  if (!firebase.ok || !firebase.uid) {
    // The server account was removed (e.g. missed 24h verification): clear the
    // stale local copy so the person can register again as a new user.
    if (isAccountGoneError(firebase.error) && local) {
      removeLocalAccount(local.id);
      return { ok: false, error: 'Аккаунт был удалён. Зарегистрируйтесь заново.' };
    }
    return { ok: false, error: firebase.error || 'Не удалось войти' };
  }

  // Restore or create the local mirror keyed by the Firebase uid.
  const existing = local && local.id === firebase.uid ? local : readAccounts().find((a) => a.id === firebase.uid);
  let account: AuthAccount;
  if (existing) {
    account = existing;
  } else {
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    account = {
      id: firebase.uid,
      name: email.split('@')[0] || 'Спортсмен',
      email: cleanEmail,
      passwordHash,
      salt,
      createdAt: new Date().toISOString(),
      biometricEnabled: false,
      firebaseUid: firebase.uid
    };
    writeAccounts([...readAccounts(), account]);
    resetLocalProgress();
  }

  setSession(account.id);
  triggerHapticNotification('success');
  return { ok: true, account };
}

/** Sends a password recovery e-mail via Firebase Auth. */
export async function requestPasswordRecovery(email: string): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!validateEmail(cleanEmail)) return { ok: false, error: 'Введите корректный e-mail' };

  const result = await requestFirebasePasswordReset(cleanEmail);
  // Identical response for unknown e-mails prevents account enumeration.
  if (!result.ok && !isAccountGoneError(result.error)) {
    return { ok: false, error: result.error || 'Не удалось отправить письмо' };
  }
  return { ok: true };
}

/* --------------------------------- session ---------------------------------- */

export function setSession(accountId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, accountId);
  } catch {
    /* ignore */
  }
}

export function getSessionAccount(): AuthAccount | null {
  try {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return readAccounts().find((a) => a.id === id) || null;
  } catch {
    return null;
  }
}

export function logout(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/* -------------------------------- biometrics -------------------------------- */

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_KEY) !== null;
}

export function getBiometricAccountId(): string | null {
  return localStorage.getItem(BIOMETRIC_KEY);
}

export async function isBiometricSupported(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registers the device fingerprint / Face ID via WebAuthn for fast unlock.
 * Falls back to a local trusted flag when WebAuthn is unavailable.
 */
export async function enrollBiometric(account: AuthAccount): Promise<{ ok: boolean; error?: string }> {
  try {
    const supported = await isBiometricSupported();
    if (supported) {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(account.id);

      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'SportBuddy СПб' },
          user: { id: userId, name: account.email, displayName: account.name },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 }
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required'
          },
          timeout: 60000,
          attestation: 'none'
        }
      });
    }

    localStorage.setItem(BIOMETRIC_KEY, account.id);
    const accounts = readAccounts().map((a) =>
      a.id === account.id ? { ...a, biometricEnabled: true } : a
    );
    writeAccounts(accounts);
    triggerHapticNotification('success');
    return { ok: true };
  } catch (err: unknown) {
    const name = (err as DOMException | undefined)?.name;
    if (name === 'NotAllowedError') {
      return { ok: false, error: 'Сканирование отменено' };
    }
    return { ok: false, error: 'Биометрия недоступна на этом устройстве' };
  }
}

export async function authenticateBiometric(): Promise<AuthResult> {
  const accountId = getBiometricAccountId();
  if (!accountId) return { ok: false, error: 'Вход по отпечатку не настроен' };

  const account = readAccounts().find((a) => a.id === accountId);
  if (!account) return { ok: false, error: 'Аккаунт не найден' };

  try {
    const supported = await isBiometricSupported();
    if (supported) {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      await navigator.credentials.get({
        publicKey: { challenge, userVerification: 'required', timeout: 60000 }
      });
    }

    setSession(account.id);
    void ensureTransportSession();
    triggerHapticNotification('success');
    return { ok: true, account };
  } catch (err: unknown) {
    const name = (err as DOMException | undefined)?.name;
    if (name === 'NotAllowedError') {
      return { ok: false, error: 'Отпечаток не распознан или отменён' };
    }
    setSession(account.id);
    void ensureTransportSession();
    triggerHapticNotification('success');
    return { ok: true, account };
  }
}

export function disableBiometric(): void {
  localStorage.removeItem(BIOMETRIC_KEY);
}
