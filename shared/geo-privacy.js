/**
 * Политика координат SportBuddy.
 *
 * Точное местоположение человека не хранится ни в одной клиентской коллекции.
 * Клиент присылает точные координаты при регистрации присутствия и при отметке
 * о прибытии — сервер использует их только для вычислений в момент запроса,
 * а в базу пишет «защищённые» значения: округление до ~110 м плюс стабильное
 * смещение ±150 м. Восстановить реальную точку по хранилищу нельзя, при этом
 * расстояния, «рядом» и радиус отметки продолжают работать.
 *
 * Модуль общий для Node (API) и, при необходимости, для фронтенда.
 */

/** Знаков после запятой у хранимых координат: 3 ≈ 110 м. */
export const COORD_DECIMALS = 3;

/** Границы стабильного смещения в километрах: маскирует точное место. */
export const MIN_OFFSET_KM = 0.1;
export const MAX_OFFSET_KM = 0.25;

/** Корректны ли координаты как числа в допустимых пределах. */
export function isValidCoords(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number'
    && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * FNV-1a: соседние строки (uid-1 и uid-2) дают далёкие друг от друга значения,
 * иначе у пользователей из одного дома совпадало бы направление смещения.
 */
function hashSeed(seed) {
  const text = String(seed ?? '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const round = (value) => Number(value.toFixed(COORD_DECIMALS));

/**
 * Координаты для записи в базу: округление до сетки ≈110 м плюс стабильное
 * смещение 100–250 м. Восстановить точное место по хранилищу нельзя, а
 * расстояния и радиус отметки (300 м) остаются рабочими.
 *
 * @param lat точная широта
 * @param lng точная долгота
 * @param seed стабильный идентификатор (uid) — от него зависит направление и радиус
 * @returns защищённые координаты либо null, если входные данные некорректны
 */
export function protectedCoords(lat, lng, seed = '') {
  if (!isValidCoords(lat, lng)) return null;

  const hash = hashSeed(seed);
  const angle = (hash % 360) * (Math.PI / 180);
  const steps = 11; // 0.10 … 0.25 км с шагом 0.015
  const offsetKm = MIN_OFFSET_KM + ((hash >>> 9) % steps) * ((MAX_OFFSET_KM - MIN_OFFSET_KM) / (steps - 1));

  const dLat = (offsetKm / 111) * Math.cos(angle);
  const cosLat = Math.cos((lat * Math.PI) / 180);
  // У полюсов долгота «сжимается» — там смещение по долготе пропускаем.
  const dLng = Math.abs(cosLat) < 0.01 ? 0 : (offsetKm / (111 * cosLat)) * Math.sin(angle);

  return { lat: round(lat + dLat), lng: round(lng + dLng) };
}
