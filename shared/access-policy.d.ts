export const BETA_START: number;
export const BETA_END: number;
export function isBetaActive(now?: number): boolean;
export function hasPremiumAccess(user: {premiumUntil?: unknown} | null | undefined, now?: number): boolean;
