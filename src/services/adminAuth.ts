const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const SESSION_KEY = 'sportbuddy_admin_session';
const LEGACY_TOKEN_KEY = 'admin_session_token';
const LEGACY_EXPIRY_KEY = 'admin_session_expiry';

export interface AdminSession {
  sessionId: string;
  email: string;
  expiresAt: string;
}

export interface AdminOTP {
  id: string;
  email: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  isUsed: boolean;
}

function saveSession(session: AdminSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Keep the old keys for compatibility with older UI code.
  sessionStorage.setItem(LEGACY_TOKEN_KEY, session.sessionId);
  sessionStorage.setItem(LEGACY_EXPIRY_KEY, session.expiresAt);
}

export function getAdminSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const session = JSON.parse(raw) as AdminSession;
      if (session.sessionId && session.expiresAt) return session;
    }
  } catch {
    /* ignore malformed session */
  }

  const sessionId = sessionStorage.getItem(LEGACY_TOKEN_KEY);
  const expiresAt = sessionStorage.getItem(LEGACY_EXPIRY_KEY);
  if (!sessionId || !expiresAt) return null;
  return { sessionId, email: ADMIN_EMAIL, expiresAt };
}

export function hasAdminSession(): boolean {
  const session = getAdminSession();
  if (!session) return false;
  if (Date.now() >= new Date(session.expiresAt).getTime()) {
    clearAdminSession();
    return false;
  }
  return true;
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_EXPIRY_KEY);
}

export function logoutAdmin(): void {
  clearAdminSession();
}

export function isAdminSessionValid(): boolean {
  return hasAdminSession();
}

export function getAdminSessionTimeRemaining(): number {
  const session = getAdminSession();
  if (!session || !hasAdminSession()) return 0;
  return Math.ceil(Math.max(0, new Date(session.expiresAt).getTime() - Date.now()) / 60000);
}

export function getAdminToken(): string | null {
  return getAdminSession()?.sessionId ?? null;
}

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
  return data;
}

/** Vercel replacement for the old Firebase Function requestAdminOtp. */
export async function requestAdminOtp(email: string, password: string): Promise<{ expiresAt: string; retryAfterSeconds: number }> {
  return apiPost('/api/admin-request-otp', { email, password });
}

/** Vercel replacement for the old Firebase Function verifyAdminOtp. */
export async function verifyAdminOtp(email: string, code: string): Promise<AdminSession> {
  const session = await apiPost<AdminSession>('/api/admin-verify-otp', { email, code });
  saveSession({ sessionId: session.sessionId, email, expiresAt: session.expiresAt });
  return session;
}

/** Compatibility API used by the newer OTP modal. */
export async function sendAdminOTP(): Promise<{ success: boolean; message: string }> {
  const password = typeof window !== 'undefined' ? window.prompt('Введите пароль администратора') : null;
  if (password === null) return { success: false, message: 'Ввод отменён' };
  try {
    await requestAdminOtp(ADMIN_EMAIL, password);
    return { success: true, message: `Код отправлен на ${ADMIN_EMAIL}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Не удалось отправить код' };
  }
}

/** Compatibility API used by the older OTP modal. */
export async function verifyAdminOTP(code: string): Promise<{ success: boolean; token?: string; message: string }> {
  try {
    const result = await verifyAdminOtp(ADMIN_EMAIL, code);
    return { success: true, token: result.sessionId, message: 'Авторизация успешна' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Ошибка проверки кода' };
  }
}

export async function adminMutateEvent(payload: {
  sessionId: string;
  operation: 'create' | 'update' | 'delete';
  eventId: string;
  event?: Record<string, unknown>;
  patch?: Record<string, unknown>;
}): Promise<void> {
  await apiPost('/api/admin-mutate-event', payload);
}
