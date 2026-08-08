const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const SESSION_KEY = 'sportbuddy_admin_session_v2';

export interface AdminSession {
  sessionId: string;
  email: string;
  expiresAt: string;
}

function saveSession(session: AdminSession): void {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}

function readSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (!session.sessionId || !session.expiresAt || Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function hasAdminSession(): boolean {
  return readSession() !== null;
}

export function isAdminSessionValid(): boolean {
  return hasAdminSession();
}

export function getAdminSession(): AdminSession | null {
  return readSession();
}

export function clearAdminSession(): void {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export function logoutAdmin(): void {
  clearAdminSession();
}

export function getAdminSessionTimeRemaining(): number {
  const session = readSession();
  if (!session) return 0;
  return Math.ceil(Math.max(0, Date.parse(session.expiresAt) - Date.now()) / 60000);
}

export async function requestAdminOtp(email: string, password: string): Promise<{ retryAfterSeconds?: number }> {
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail !== ADMIN_EMAIL) throw new Error('Недопустимый e-mail администратора');
  if (!password) throw new Error('Введите пароль администратора');

  const response = await fetch('/api/admin-request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cleanEmail, password })
  });
  const payload = await response.json().catch(() => null) as { retryAfterSeconds?: number; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || 'Не удалось отправить код');
  return { retryAfterSeconds: Number(payload?.retryAfterSeconds || 60) };
}

export async function verifyAdminOtp(email: string, code: string): Promise<AdminSession> {
  const response = await fetch('/api/admin-verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim() })
  });
  const payload = await response.json().catch(() => null) as {
    sessionId?: string;
    expiresAt?: string;
    error?: string;
  } | null;
  if (!response.ok || !payload?.sessionId || !payload.expiresAt) {
    throw new Error(payload?.error || 'Неверный или истёкший код');
  }
  const session: AdminSession = {
    sessionId: payload.sessionId,
    email: email.trim().toLowerCase(),
    expiresAt: payload.expiresAt
  };
  saveSession(session);
  return session;
}

/* Compatibility API used by the older OTP modal. */
export async function sendAdminOTP(): Promise<{ success: boolean; message: string }> {
  try {
    await requestAdminOtp(ADMIN_EMAIL, '');
    return { success: true, message: `Код отправлен на ${ADMIN_EMAIL}` };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Не удалось отправить код' };
  }
}

export async function verifyAdminOTP(code: string): Promise<{ success: boolean; token?: string; message: string }> {
  try {
    const session = await verifyAdminOtp(ADMIN_EMAIL, code);
    return { success: true, token: session.sessionId, message: 'Авторизация успешна' };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Ошибка проверки кода' };
  }
}

export { ADMIN_EMAIL };

export async function adminMutateEvent(payload: {
  sessionId: string;
  operation: 'create' | 'update' | 'delete';
  eventId: string;
  event?: Record<string, unknown>;
  patch?: Record<string, unknown>;
}): Promise<void> {
  const response = await fetch('/api/admin-mutate-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || 'Не удалось изменить событие');
}
