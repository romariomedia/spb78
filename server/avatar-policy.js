/**
 * Old APKs send this marker when automatically importing a VK photo on login.
 * Explicit photo uploads send only avatar. Ignore the legacy automatic write:
 * bootstrap remains responsible for the first provider photo.
 */
export function withoutLegacyLoginAvatar(updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return updates;
  const result = { ...updates };
  if (result.hasRealPhoto === true) delete result.avatar;
  return result;
}
