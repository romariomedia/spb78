/** Native assets live at https://localhost; API requests must reach the VPS. */
const PRODUCTION_API = 'https://sportbuddy78.pro';

declare global {
  interface Window { Capacitor?: { isNativePlatform?: () => boolean } }
}

export function apiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) return PRODUCTION_API;
  return '';
}

/** URLs sent to other people must never contain the local WebView origin. */
export function publicSiteOrigin(): string {
  if (typeof window === 'undefined' || window.Capacitor?.isNativePlatform?.()) return PRODUCTION_API;
  return window.location.origin;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!path.startsWith('/api/')) throw new Error('Invalid API path');
  const response = await fetch(`${apiBase()}${path}`, init);
  // A WebView asset fallback or reverse-proxy error page is not API data.
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error(`Сервер вернул некорректный ответ (HTTP ${response.status}). Повторите загрузку.`);
  }
  return response;
}

export async function readApiJson(response: Response): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Сервер вернул некорректные данные. Повторите загрузку.');
  }
  return payload as Record<string, unknown>;
}
