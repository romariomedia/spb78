/**
 * Работа с датами публикаций: единый формат подписей и корректная сортировка.
 *
 * Проблема, которую решает модуль: сервер пишет createdAt как ISO-строку
 * (`new Date().toISOString()`), а старые демо-записи содержали человеческие
 * строки вида «2 часа назад» и «Вчера». Сортировка по строковому id давала
 * произвольный порядок, а подпись показывалась сырым ISO.
 */

/**
 * Ключ сортировки для записей с датой.
 *
 * Разбираемые даты (ISO и всё, что понимает Date.parse) сравниваются по
 * времени. Нераспознанные значения — «Вчера», «2 часа назад» из старых данных —
 * считаются самыми старыми, чтобы не занимать верх ленты.
 * Есть запасной путь: числовое поле createdAt (секунды/миллисекунды).
 */
export function timestampValue(createdAt?: string | number | null): number {
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;
  if (typeof createdAt !== 'string' || !createdAt) return 0;
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Подпись под постом или комментарием: «только что», «12 мин назад»,
 * «3 ч назад», «вчера», «5 дн. назад», а дальше — обычная дата.
 * Строки, которые не являются датой, возвращаются как есть.
 */
export function relativeTimeLabel(createdAt?: string | number | null, now: number = Date.now()): string {
  if (typeof createdAt === 'string' && createdAt && !Number.isFinite(Date.parse(createdAt))) {
    return createdAt;
  }

  const time = timestampValue(createdAt);
  if (!time) return '';

  const diff = now - time;
  if (diff < 60_000) return 'только что';

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} мин назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн. назад`;

  return new Date(time).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    ...(new Date(time).getFullYear() === new Date(now).getFullYear() ? {} : { year: 'numeric' })
  });
}
