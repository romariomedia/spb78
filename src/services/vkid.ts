/**
 * VK ID helpers for SportBuddy78.
 *
 * The widget itself is rendered in `components/AuthScreen.tsx` using the
 * official npm package `@vkid/sdk` (no CDN script, no extra requests).
 * This module keeps only the shared constants and pure helpers.
 */

export const VKID_WEB_APP_ID = 54699979;
export const VKID_ANDROID_APP_ID = 54714060;
export const VKID_WEB_REDIRECT_URL = 'https://sportbuddy78.pro';
export const VKID_ANDROID_REDIRECT_URL = 'https://sportbuddy78.pro/vk-callback';

/**
 * Deterministic password for VK accounts.
 *
 * VK users never type a password, but a Firebase Auth session is still
 * required — otherwise Firestore Security Rules reject every write.
 * Deriving it from the VK user id lets the same person sign back in
 * on any device without storing a secret.
 */
export function vkDerivedPassword(vkId: string): string {
  return `vkid_${vkId}_sb78`;
}

/** Fallback e-mail when the user did not grant the `email` scope */
export function vkFallbackEmail(vkId: string): string {
  return `vk_${vkId}@sportbuddy78.pro`;
}

/**
 * VK userInfo may return a low-resolution `photo_50`/`photo_100` URL.
 * Request the largest conventional VK size when the URL exposes a size token;
 * otherwise preserve the original CDN URL without degrading it locally.
 */
export function getHighQualityVKAvatar(url: string | undefined): string {
  if (!url) return '';
  let out = url
    // modern userapi URLs: ?size=100x100 → ask for a large square crop
    .replace(/([?&]size=)\d+x\d+/i, '$1512x512')
    // legacy path sizes
    .replace(/photo_(50|100|200)(?=\.[a-z]+(?:[?#]|$))/i, 'photo_400')
    .replace(/\/s_\d+(?=\.[a-z]+(?:[?#]|$))/i, '/s_400');
  // Some VK replies carry no size token at all but still honour a crop hint.
  if (out === url && /userapi\.com/i.test(out) && !/[?&]size=/.test(out)) {
    out += (out.includes('?') ? '&' : '?') + 'size=512x512';
  }
  return out;
}

/** VK ID accounts are trusted: VK already verified identity + real photo. */
export const VK_VERIFIED_BY_PROVIDER = true;
