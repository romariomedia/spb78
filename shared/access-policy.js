// One policy shared by Node and Vite. End is exclusive: Moscow midnight.
export const BETA_START = Date.parse('2026-09-30T00:00:00+03:00');
export const BETA_END = Date.parse('2027-01-01T00:00:00+03:00');
export const isBetaActive = (now = Date.now()) => now >= BETA_START && now < BETA_END;
export function hasPremiumAccess(user, now = Date.now()) {
  if (!user) return false;
  if (isBetaActive(now)) return true;
  const raw = user.premiumUntil;
  const expiry = raw?.toDate ? raw.toDate().getTime() : Date.parse(String(raw || ''));
  return Number.isFinite(expiry) && expiry > now;
}
