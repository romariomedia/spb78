import { beginVkRedirect, consumeVkRedirect, type VkAuthFlowContext } from './vkRedirect';
import { VKID_WEB_APP_ID, VKID_ANDROID_REDIRECT_URL } from './vkid';
import { nativeHttp } from './nativeHttp';

export async function nativeVkAuthorizeUrl(
  storage: Storage,
  flow: Partial<VkAuthFlowContext> = {}
): Promise<string> {
  const tx = beginVkRedirect(storage, VKID_ANDROID_REDIRECT_URL, flow);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tx.codeVerifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const url = new URL('https://id.vk.ru/authorize');
  url.search = new URLSearchParams({client_id:String(VKID_WEB_APP_ID), redirect_uri:tx.redirectUrl,
    response_type:'code', scope:'email', state:tx.state, code_challenge:challenge, code_challenge_method:'S256'}).toString();
  return url.href;
}

export async function exchangeNativeVkCallback(
  storage: Storage,
  rawUrl: string
): Promise<{access_token:string;user_id:string;flow:VkAuthFlowContext}> {
  const url = new URL(rawUrl);
  let tx: ReturnType<typeof consumeVkRedirect>;
  try { tx = consumeVkRedirect(storage, url); }
  catch { throw new Error('Сессия ВК истекла или не совпадает (VK-SESSION). Начните вход заново.'); }
  if (url.searchParams.has('error')) throw new Error('Вход ВК отменён (VK-CANCELLED).');
  const code = url.searchParams.get('code'), deviceId = url.searchParams.get('device_id');
  if (!code || !deviceId) throw new Error('Неполный ответ VK ID (VK-CALLBACK).');
  const response = await nativeHttp('https://id.vk.ru/oauth2/auth', {method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'authorization_code', client_id:String(VKID_WEB_APP_ID),
      redirect_uri:tx.redirectUrl, code_verifier:tx.codeVerifier, state:tx.state, device_id:deviceId, code}).toString()});
  const data = await response.json();
  if (!response.ok || data.error || !data.access_token || !data.user_id || data.state !== tx.state) {
    throw new Error('Не удалось подтвердить ответ VK ID (VK-EXCHANGE). Начните вход заново.');
  }
  return {access_token:data.access_token, user_id:String(data.user_id), flow:tx.flow};
}

/** Fixed destination/package, no caller-controlled intent extras or fallback URL. */
export function nativeVkReturnIntent(url: URL): string {
  if (url.origin !== 'https://sportbuddy78.pro' || url.pathname.replace(/\/$/, '') !== '/vk-callback') return '';
  if (!url.searchParams.get('state') || !(url.searchParams.get('code') || url.searchParams.get('error'))) return '';
  const query = new URLSearchParams();
  for (const key of ['code','device_id','state','error']) {
    const value = url.searchParams.get(key);
    if (value) query.set(key, value);
  }
  return `intent://sportbuddy78.pro/vk-callback?${query}#Intent;scheme=https;package=ru.sportbuddy.mobile;end`;
}
