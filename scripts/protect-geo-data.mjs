#!/usr/bin/env node
/**
 * SportBuddy78 — перевод уже сохранённых координат в защищённый вид.
 *
 * Что делает:
 *   • в users/{uid} заменяет точные lat/lng на защищённые (округление до ~110 м
 *     + стабильное смещение, см. shared/geo-privacy.js);
 *   • в checkins удаляет поля lat/lng, оставляя distanceMeters и время прибытия —
 *     отметка подтверждает факт и дистанцию, а не местонахождение человека.
 *
 * Безопасность:
 *   • без --apply скрипт только показывает план;
 *   • --backup <файл> сохраняет копию изменяемых документов до записи;
 *   • после записи выполняется проверка, что точных координат не осталось.
 *
 * Запуск (ключ берётся из FIREBASE_SERVICE_ACCOUNT_KEY, .env рядом или /opt/sportbuddy-api/.env):
 *   node scripts/protect-geo-data.mjs
 *   node scripts/protect-geo-data.mjs --apply --backup /root/geo-backup.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { COORD_DECIMALS, isValidCoords, protectedCoords } from '../shared/geo-privacy.js';

const APPLY = process.argv.includes('--apply');

function readArgument(name) {
  const index = process.argv.findIndex((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (index < 0) return null;
  const arg = process.argv[index];
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : process.argv[index + 1];
  return value ? String(value) : null;
}

/** Ключ сервисного аккаунта: из --key, из окружения или из .env. */
function loadServiceAccount() {
  const keyPath = readArgument('key');
  if (keyPath) {
    const text = readFileSync(keyPath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.stringify(JSON.parse(text));
  }
  const fromEnv = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (fromEnv.startsWith('{')) return fromEnv;
  for (const file of [resolve(process.cwd(), '.env'), '/opt/sportbuddy-api/.env']) {
    try {
      const line = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
      if (line) return line.slice('FIREBASE_SERVICE_ACCOUNT_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
    } catch {
      /* следующего кандидата */
    }
  }
  return null;
}

const decimals = (value) => {
  const text = String(Number(value));
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
};

const rawKey = loadServiceAccount();
if (!rawKey) {
  console.error('Не найден FIREBASE_SERVICE_ACCOUNT_KEY ни в окружении, ни в .env.');
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(rawKey)) });
const db = getFirestore();

const users = [];
const checkins = [];

for (const doc of (await db.collection('users').get()).docs) {
  const data = doc.data() || {};
  if (!isValidCoords(data.lat, data.lng)) continue;
  const safe = protectedCoords(data.lat, data.lng, doc.id);
  if (!safe) continue;
  if (safe.lat !== data.lat || safe.lng !== data.lng) {
    users.push({ id: doc.id, from: { lat: data.lat, lng: data.lng }, to: safe, beforeDecimals: Math.max(decimals(data.lat), decimals(data.lng)) });
  }
}

for (const doc of (await db.collection('checkins').get()).docs) {
  const data = doc.data() || {};
  const fields = ['lat', 'lng'].filter((field) => field in data);
  if (fields.length) checkins.push({ id: doc.id, fields, distanceMeters: data.distanceMeters });
}

console.log(`Профилей к защите: ${users.length}`);
for (const item of users) {
  console.log(`  • ${item.id}: ${item.from.lat}, ${item.from.lng} (${item.beforeDecimals} знаков) → ${item.to.lat}, ${item.to.lng}`);
}
console.log(`\nОтметок о прибытии, где нужно убрать координаты: ${checkins.length}`);
for (const item of checkins) {
  console.log(`  • ${item.id}: убрать ${item.fields.join(', ')}${item.distanceMeters === undefined ? '' : `, дистанция сохраняется (${item.distanceMeters} м)`}`);
}

if (users.length === 0 && checkins.length === 0) {
  console.log('\nТочных координат в клиентских коллекциях нет — миграция не требуется.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nЭто предпросмотр: ничего не изменено.');
  console.log('Чтобы применить:  node scripts/protect-geo-data.mjs --apply --backup /root/geo-backup.json');
  process.exit(0);
}

const backupPath = readArgument('backup');
if (backupPath) {
  const dump = {
    exportedAt: new Date().toISOString(),
    project: 'sportbuddy-spb',
    purpose: 'protect-geo-data',
    users: [],
    checkins: []
  };
  for (const item of users) {
    const snap = await db.collection('users').doc(item.id).get();
    dump.users.push({ id: item.id, data: snap.data() ?? null, protected: item.to });
  }
  for (const item of checkins) {
    const snap = await db.collection('checkins').doc(item.id).get();
    dump.checkins.push({ id: item.id, data: snap.data() ?? null });
  }
  writeFileSync(backupPath, JSON.stringify(dump, null, 2), { mode: 0o600 });
  console.log(`\nРезервная копия: ${backupPath} (${dump.users.length + dump.checkins.length} документов)`);
}

for (const item of users) {
  await db.collection('users').doc(item.id).update({ lat: item.to.lat, lng: item.to.lng });
}
console.log(`\nОбновлено профилей: ${users.length}`);

for (const item of checkins) {
  await db.collection('checkins').doc(item.id).update({ lat: FieldValue.delete(), lng: FieldValue.delete() });
}
console.log(`Очищено отметок о прибытии: ${checkins.length}`);

// Проверка результата.
const leftovers = { users: [], checkins: [] };
for (const doc of (await db.collection('users').get()).docs) {
  const data = doc.data() || {};
  if (!isValidCoords(data.lat, data.lng)) continue;
  if (decimals(data.lat) > COORD_DECIMALS || decimals(data.lng) > COORD_DECIMALS) leftovers.users.push(doc.id);
}
for (const doc of (await db.collection('checkins').get()).docs) {
  const data = doc.data() || {};
  if ('lat' in data || 'lng' in data) leftovers.checkins.push(doc.id);
}
const clean = leftovers.users.length === 0 && leftovers.checkins.length === 0;
console.log(clean
  ? `Проверка: точных координат не осталось (профили — не точнее ${COORD_DECIMALS} знаков, в отметках координат нет).`
  : `ВНИМАНИЕ, остались: профили ${leftovers.users.join(', ') || '—'}; отметки ${leftovers.checkins.join(', ') || '—'}`);
