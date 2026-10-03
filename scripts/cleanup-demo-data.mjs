#!/usr/bin/env node
/**
 * SportBuddy78 — уборка демонстрационных данных из Firestore (проект sportbuddy-spb).
 *
 * Зачем: в боевой базе оказались служебные профили из кода
 * (user-anna, user-elena, user-maria, user-ekatery, user-daria, user-veronika,
 * старый общий user-me-1) и созданный ими контент: посты feed post-1…post-3
 * с датами-строками («2 часа назад», «Вчера») и тренировки tr-101…tr-108.
 * Именно они висят в ленте и ломают её порядок.
 *
 * Безопасность:
 *   • без флага скрипт ТОЛЬКО печатает план и не меняет базу;
 *   • в коллекции users удаляются лишь известные демо-id и документы с isDemo === true;
 *   • в остальных коллекциях — только документы, ссылающиеся на демо-id;
 *   • реальные аккаунты (vk_*, авто-id) не затрагиваются.
 *
 * Запуск (на сервере, где ключ уже лежит в /opt/sportbuddy-api/.env):
 *   cd /opt/sportbuddy-api
 *   node scripts/cleanup-demo-data.mjs            # предпросмотр
 *   node scripts/cleanup-demo-data.mjs --apply    # удалить найденное
 *
 * Запуск без доступа к серверу — с ключом сервисного аккаунта из Firebase Console
 * (Project settings → Service accounts → Generate new private key):
 *   node scripts/cleanup-demo-data.mjs --key C:\path\to\serviceAccount.json
 * Содержимое ключа скрипт читает сам, в чат или логи он его не печатает.
 *
 * Перед удалением полезно сохранить копию — тогда уборка обратима:
 *   node scripts/cleanup-demo-data.mjs --apply --backup /root/demo-backup.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');

/** Служебные профили, созданные демо-режимом (см. src/services/repository.ts). */
const DEMO_USER_IDS = new Set([
  'user-me-1',
  'user-anna',
  'user-elena',
  'user-maria',
  'user-ekatery',
  'user-daria',
  'user-veronika'
]);

/** Известные демо-документы, которые надо убрать даже без ссылок на профили. */
const DEMO_DOC_IDS = {
  feed: new Set(['post-1', 'post-2', 'post-3']),
  trainings: new Set(['tr-101', 'tr-102', 'tr-103', 'tr-104', 'tr-105', 'tr-106', 'tr-107', 'tr-108'])
};

/** Путь к JSON-ключу из аргумента --key <путь> или --key=<путь>. */
function readKeyArgument() {
  const index = process.argv.findIndex((arg) => arg === '--key' || arg.startsWith('--key='));
  if (index < 0) return null;
  const arg = process.argv[index];
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : process.argv[index + 1];
  return value ? String(value) : null;
}

/** Путь к резервной копии из аргумента --backup <путь> или --backup=<путь>. */
function readBackupArgument() {
  const index = process.argv.findIndex((arg) => arg === '--backup' || arg.startsWith('--backup='));
  if (index < 0) return null;
  const arg = process.argv[index];
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : process.argv[index + 1];
  return value ? String(value) : null;
}

/** Ключ сервисного аккаунта: из --key, из окружения или из .env рядом с проектом. */
function loadServiceAccount() {
  const keyPath = readKeyArgument();
  if (keyPath) {
    try {
      // Снимаем BOM: ключ, отредактированный в Блокноте, иначе не разберётся.
      const text = readFileSync(keyPath, 'utf8').replace(/^\uFEFF/, '');
      return JSON.stringify(JSON.parse(text));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`Не удалось прочитать ключ сервисного аккаунта (${keyPath}): ${reason}`);
      process.exit(1);
    }
  }

  const fromEnv = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (fromEnv.startsWith('{')) return fromEnv;

  const candidates = [resolve(process.cwd(), '.env'), '/opt/sportbuddy-api/.env'];
  for (const file of candidates) {
    try {
      const text = readFileSync(file, 'utf8');
      const line = text.split(/\r?\n/).find((l) => l.startsWith('FIREBASE_SERVICE_ACCOUNT_KEY='));
      if (line) {
        return line
          .slice('FIREBASE_SERVICE_ACCOUNT_KEY='.length)
          .trim()
          .replace(/^['"]|['"]$/g, '');
      }
    } catch {
      /* файла нет — пробуем следующий */
    }
  }
  return null;
}

/** true, если где-то в документе (включая вложенные массивы/объекты) есть демо-id. */
function referencesDemoId(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return false;
  if (typeof value === 'string') return DEMO_USER_IDS.has(value);
  if (Array.isArray(value)) return value.some((item) => referencesDemoId(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value).some((item) => referencesDemoId(item, depth + 1));
  }
  return false;
}

/** Короткая подпись документа для отчёта. */
function describe(collection, data) {
  if (collection === 'users') return String(data.name || '');
  if (collection === 'feed') return `${data.authorName || ''} • ${data.createdAt || ''}`;
  if (collection === 'trainings') return String(data.title || '');
  const owner = data.userId || data.ownerId || data.authorId || data.createdBy || '';
  return owner ? String(owner) : '';
}

const rawKey = loadServiceAccount();
if (!rawKey) {
  console.error('Не найден FIREBASE_SERVICE_ACCOUNT_KEY ни в окружении, ни в .env.');
  process.exit(1);
}
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(rawKey)) });
}
const db = getFirestore();

const plan = [];
for (const collection of await db.listCollections()) {
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    let reason = null;

    if (collection.id === 'users') {
      if (DEMO_USER_IDS.has(doc.id)) reason = 'служебный демо-профиль';
      else if (data.isDemo === true) reason = 'isDemo = true';
    } else if (DEMO_DOC_IDS[collection.id]?.has(doc.id)) {
      reason = 'известный демо-документ';
    } else if (referencesDemoId(data)) {
      reason = 'ссылается на демо-профиль';
    }

    if (reason) {
      plan.push({ collection: collection.id, id: doc.id, reason, summary: describe(collection.id, data) });
    }
  }
}

if (plan.length === 0) {
  console.log('Демо-данных не найдено — база чистая.');
  process.exit(0);
}

const byCollection = new Map();
for (const item of plan) {
  if (!byCollection.has(item.collection)) byCollection.set(item.collection, []);
  byCollection.get(item.collection).push(item);
}

console.log(`Найдено демо-документов: ${plan.length}\n`);
for (const [collection, items] of byCollection) {
  console.log(`${collection}: ${items.length}`);
  for (const item of items) {
    console.log(`  • ${item.id}${item.summary ? ' — ' + item.summary : ''}  [${item.reason}]`);
  }
  console.log('');
}

if (!APPLY) {
  console.log('Это предпросмотр: ничего не удалено.');
  console.log('Чтобы удалить найденное, запустите:  node scripts/cleanup-demo-data.mjs --apply');
  process.exit(0);
}

// Копия удаляемого: уборка остаётся обратимой, если что-то понадобится вернуть.
const backupPath = readBackupArgument();
if (backupPath) {
  const dump = {
    exportedAt: new Date().toISOString(),
    project: 'sportbuddy-spb',
    documentCount: plan.length,
    documents: []
  };
  for (const item of plan) {
    const snapshot = await db.collection(item.collection).doc(item.id).get();
    dump.documents.push({ collection: item.collection, id: item.id, reason: item.reason, data: snapshot.data() ?? null });
  }
  writeFileSync(backupPath, JSON.stringify(dump, null, 2), { mode: 0o600 });
  console.log(`Резервная копия удаляемого: ${backupPath} (${dump.documents.length} документов)\n`);
}

let deleted = 0;
for (const item of plan) {
  await db.collection(item.collection).doc(item.id).delete();
  deleted += 1;
  if (deleted % 20 === 0) console.log(`удалено ${deleted}/${plan.length}...`);
}

console.log(`\nУдалено документов: ${deleted}.`);

const leftovers = [];
for (const collection of await db.listCollections()) {
  const snapshot = await collection.get();
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const isDemoUser = collection.id === 'users' && (DEMO_USER_IDS.has(doc.id) || data.isDemo === true);
    if (isDemoUser || (collection.id !== 'users' && referencesDemoId(data))) leftovers.push(`${collection.id}/${doc.id}`);
  }
}
console.log(leftovers.length === 0 ? 'Проверка: демо-данных в базе не осталось.' : `Остались: ${leftovers.join(', ')}`);
console.log('\nНе забудьте очистить локальный кэш клиентов (иначе старые посты останутся в браузере):');
console.log("  localStorage.removeItem('sportbuddy_offline_cache_v4')");
