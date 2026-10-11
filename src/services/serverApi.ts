import { auth } from './firebaseAuth';

import { apiFetch, readApiJson } from './apiEndpoint';
export { apiBase } from './apiEndpoint';
const REQUEST_TIMEOUT_MS = 15_000;

export async function callServer<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Требуется авторизация');
  const token = await user.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await apiFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await readApiJson(response);
    if (!response.ok) {
      const error = new Error(String(payload.error || `HTTP ${response.status}`));
      (error as Error & { status?: number; code?: string }).status = response.status;
      (error as Error & { status?: number; code?: string }).code = typeof payload.code === 'string' ? payload.code : undefined;
      throw error;
    }
    return payload as T;
  } finally {
    window.clearTimeout(timer);
  }
}
