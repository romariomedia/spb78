import test from 'node:test';
import assert from 'node:assert/strict';
import { COORD_DECIMALS, isValidCoords, protectedCoords } from '../shared/geo-privacy.js';

/** Расстояние между точками в метрах — как в API при проверке отметки о прибытии. */
function distanceMeters(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

const SPB = { lat: 59.9430123, lng: 30.3160456 };

test('защищённая точка стабильна для одного пользователя', () => {
  assert.deepEqual(protectedCoords(SPB.lat, SPB.lng, 'uid-1'), protectedCoords(SPB.lat, SPB.lng, 'uid-1'));
});

test('разные пользователи в одной точке не совпадают', () => {
  const first = protectedCoords(SPB.lat, SPB.lng, 'uid-1');
  const second = protectedCoords(SPB.lat, SPB.lng, 'uid-2');
  assert.notDeepEqual(first, second);
});

test('хранимая точка рядом, но не совпадает с реальной', () => {
  const safe = protectedCoords(SPB.lat, SPB.lng, 'uid-1');
  const shift = distanceMeters(SPB, safe);
  assert.ok(shift > 10, `смещение должно быть заметным, получено ${shift} м`);
  assert.ok(shift < 350, `смещение не должно уводить далеко, получено ${shift} м`);
});

test('точность хранимых координат не выше заданной', () => {
  const safe = protectedCoords(SPB.lat, SPB.lng, 'uid-1');
  for (const value of [safe.lat, safe.lng]) {
    const decimals = (String(value).split('.')[1] || '').length;
    assert.ok(decimals <= COORD_DECIMALS, `слишком много знаков после запятой: ${value}`);
  }
});

test('некорректные координаты отвергаются', () => {
  const broken = [[100, 30], [59, 200], [null, 30], ['59', 30], [Number.NaN, 30], [59, undefined]];
  for (const [lat, lng] of broken) {
    assert.equal(isValidCoords(lat, lng), false, `должно быть отвергнуто: ${lat}, ${lng}`);
    assert.equal(protectedCoords(lat, lng, 'uid'), null);
  }
});

test('повторная защита не сдвигает точку (идемпотентность миграции)', () => {
  const once = protectedCoords(SPB.lat, SPB.lng, 'uid-1');
  const twice = protectedCoords(once.lat, once.lng, 'uid-1');
  assert.deepEqual(twice, once);
});

test('значение на сетке остаётся как есть', () => {
  const grid = { lat: 59.937, lng: 30.315 };
  assert.deepEqual(protectedCoords(grid.lat, grid.lng, 'uid-1'), grid);
});
