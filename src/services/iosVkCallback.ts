/** HTTPS stays the VK redirect URI; the landing page hands only OAuth fields to iOS.
 * PKCE + stored state remain mandatory in exchangeNativeVkCallback.
 */
export function iosVkReturnUrl(url: URL): string {
  if (url.origin !== 'https://sportbuddy78.pro' || url.pathname !== '/vk-callback') return '';
  if (!url.searchParams.get('state') || !(url.searchParams.get('code') || url.searchParams.get('error'))) return '';
  const result = new URL('sportbuddy78://vk-callback');
  for (const key of ['code', 'device_id', 'state', 'error']) {
    const value = url.searchParams.get(key);
    if (value) result.searchParams.set(key, value);
  }
  return result.href;
}

export function normalizeIosVkCallback(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'sportbuddy78:') return raw;
  if (url.hostname !== 'vk-callback' || url.username || url.password || url.port ||
      (url.pathname !== '' && url.pathname !== '/') || url.hash) throw new Error('Invalid iOS callback');
  const result = new URL('https://sportbuddy78.pro/vk-callback');
  for (const key of ['code', 'device_id', 'state', 'error']) {
    const values = url.searchParams.getAll(key);
    if (values.length > 1) throw new Error('Duplicate callback parameter');
    if (values[0]) result.searchParams.set(key, values[0]);
  }
  return result.href;
}
