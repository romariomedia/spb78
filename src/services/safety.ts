import { UNSAFE_KEYWORDS, UNSAFE_SUGGESTION_WARNING } from '../legal/terms';

/**
 * Normalises text for keyword matching: lowercase, ё→е, punctuation → spaces.
 * Handles the way people actually type in chats ("Реcторан!!!", "кафе?").
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns true when a message suggests meeting somewhere unrelated to sport
 * (restaurant, cafe, bar, date, "not at the training", etc.).
 */
export function checkMessageForUnsafeSuggestion(text: string): boolean {
  if (!text || text.trim().length < 3) return false;
  const normalized = normalize(text);
  return UNSAFE_KEYWORDS.some((keyword) => normalized.includes(normalize(keyword)));
}

/** Which keywords were matched — useful for moderation reports */
export function getMatchedUnsafeKeywords(text: string): string[] {
  if (!text) return [];
  const normalized = normalize(text);
  return UNSAFE_KEYWORDS.filter((keyword) => normalized.includes(normalize(keyword)));
}

export function getUnsafeWarningText(): string {
  return UNSAFE_SUGGESTION_WARNING;
}

/** Auto-dismiss delay for the chat safety banner */
export const SAFETY_BANNER_TIMEOUT_MS = 10_000;
