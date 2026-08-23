import { UserProfile, MAX_PORTFOLIO_PHOTOS, AVATAR_GRACE_PERIOD_HOURS } from '../lib/types';

const HOUR_MS = 60 * 60 * 1000;

/** Placeholder avatars that do NOT count as a real personal photo */
const PLACEHOLDER_MARKERS = ['ui-avatars', 'placeholder', 'dicebear', 'gravatar.com/avatar/00000'];

export function hasPersonalPhoto(user: UserProfile): boolean {
  if (user.hasRealPhoto) return true;
  const avatar = (user.avatar || '').trim();
  if (!avatar) return false;
  if (PLACEHOLDER_MARKERS.some((m) => avatar.includes(m))) return false;
  return avatar.startsWith('data:image') || avatar.startsWith('http');
}

/** Hours left before an account without a photo is removed (anti-fraud policy) */
export function hoursUntilDeletion(user: UserProfile): number {
  if (!user.registeredAt) return AVATAR_GRACE_PERIOD_HOURS;
  const registered = new Date(user.registeredAt).getTime();
  if (isNaN(registered)) return AVATAR_GRACE_PERIOD_HOURS;
  const deadline = registered + AVATAR_GRACE_PERIOD_HOURS * HOUR_MS;
  const left = deadline - Date.now();
  return left <= 0 ? 0 : Math.max(1, Math.ceil(left / HOUR_MS));
}

export function calculateAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 0 && age < 120 ? age : null;
}

export function formatBirthDate(iso?: string): string {
  if (!iso) return 'не указана';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? 'не указана' : d.toLocaleDateString('ru-RU');
}

/** Federal Law 436-ФЗ: the service is 18+ */
export function validateBirthDate(iso: string): string | null {
  if (!iso) return null;
  const age = calculateAge(iso);
  if (age === null) return 'Некорректная дата рождения';
  if (age < 18) return 'Сервис доступен только пользователям старше 18 лет (436-ФЗ)';
  if (age > 100) return 'Проверьте корректность даты рождения';
  return null;
}

export function canAddPhoto(user: UserProfile): boolean {
  return (user.photoPortfolio?.length || 0) < MAX_PORTFOLIO_PHOTOS;
}

export function addPortfolioPhoto(user: UserProfile, url: string): UserProfile {
  const current = user.photoPortfolio || [];
  if (current.length >= MAX_PORTFOLIO_PHOTOS) return user;
  return { ...user, photoPortfolio: [...current, url] };
}

export function removePortfolioPhoto(user: UserProfile, index: number): UserProfile {
  const current = user.photoPortfolio || [];
  return { ...user, photoPortfolio: current.filter((_, i) => i !== index) };
}

/** Profile completeness meter shown in the editor */
export function profileCompleteness(user: UserProfile): number {
  let score = 0;
  if (hasPersonalPhoto(user)) score += 30;
  if ((user.bio || '').trim().length >= 30) score += 20;
  if ((user.sports || []).length > 0) score += 15;
  if (user.birthDate) score += 15;
  if ((user.photoPortfolio?.length || 0) > 0) score += 20;
  return Math.min(100, score);
}

/**
 * Discovery intentionally prefers portfolio imagery: it is uploaded by the
 * athlete specifically for sport discovery and is usually higher resolution
 * than the small VK ID avatar. The avatar remains only a safe fallback.
 */
export function getDiscoveryPhoto(user: UserProfile): string {
  const portfolio = user.photoPortfolio || [];
  const highQuality = portfolio.find((url) => typeof url === 'string' && url.trim().length > 0);
  return highQuality || user.avatar || '';
}

/** Explains the portfolio quality requirement next to the uploader. */
export const PORTFOLIO_QUALITY_NOTE =
  'Загружайте спортивные фото в высоком качестве: первое фото из портфолио ' +
  'показывается в разделе «Знакомства», а аватар остаётся только для профиля.';
