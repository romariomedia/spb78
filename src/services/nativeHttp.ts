/** Only JSON/form API calls use the bridge; Firestore, media and streams retain their transports. */
export function isNativeRuntime(): boolean {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}
export async function nativeHttp(url: string, init: RequestInit = {}): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const { CapacitorHttp } = await import('@capacitor/core');
  if (init.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  if (init.body != null && typeof init.body !== 'string') throw new Error('Unsupported native request body');
  let data: unknown = init.body;
  if (typeof data === 'string' && headers['content-type']?.includes('application/json')) data = JSON.parse(data);
  let stop: (() => void) | undefined;
  try {
    const request = CapacitorHttp.request({url, method: init.method || 'GET', headers,
      ...(data == null ? {} : {data}), responseType: 'text', connectTimeout: 15000, readTimeout: 30000});
    const result = await Promise.race([request, new Promise<never>((_, reject) => {
      stop = () => reject(new DOMException('Request cancelled', 'AbortError'));
      init.signal?.addEventListener('abort', stop, {once: true});
      if (init.signal?.aborted) stop();
    })]);
    return new Response(result.status === 204 ? null : typeof result.data === 'string' ? result.data : JSON.stringify(result.data),
      {status: result.status, headers: result.headers});
  } finally { if (stop) init.signal?.removeEventListener('abort', stop); }
}
