# SportBuddy78 — migration-ready Russian Data Platform

Статус: подготовлено, **не подключено к production**.  
Цель: позволить перенести персональные данные и пользовательское медиа в российский контур позже, когда проект сможет оплачивать инфраструктуру, без повторной разработки продукта.

## 1. Текущее состояние

Production продолжает работать как сейчас:
- API/Node.js — текущий VPS;
- основная пользовательская БД/авторизация — Firebase;
- пользовательское медиа — Cloudinary;
- push — FCM.

Никакой PostgreSQL/S3 сервис для работы текущего production этой подготовкой не требуется.

## 2. Принцип миграции

Миграция не выполняется переключателем «всё сразу».

Этапы:

1. `legacy` — только текущие Firestore/Cloudinary. Это значение по умолчанию.
2. `shadow` — Firestore остаётся authoritative, выбранные серверные мутации дополнительно зеркалируются в PostgreSQL.
3. Сверка — количества документов, hashes, foreign references, media URLs.
4. `russian_primary` — PostgreSQL становится authoritative; Firestore временно остаётся fallback/read-only.
5. После периода наблюдения legacy storage удаляется из пользовательского data path.
6. Cloudinary мигрируется аналогично: новые файлы → российский S3, старые URL продолжают читаться до фонового переноса.
7. Firebase Auth переносится **последним**.

## 3. Стабильный пользовательский ID

Ключевое решение: существующий Firebase UID не меняется при миграции.

Он становится обычным внутренним `users.id` SportBuddy78.

Пример:

```text
Firebase сейчас:
users/0fR...8Bx

PostgreSQL позже:
users.id = "0fR...8Bx"
```

После отказа от Firebase Authentication этот ID продолжает жить внутри SportBuddy78.

Новые auth providers связываются таблицей `user_identities`:

```text
user_id       provider      provider_user_id
0fR...8Bx     firebase      0fR...8Bx
0fR...8Bx     email         user@example.ru
0fR...8Bx     vk            123456789
```

Поэтому миграция auth не должна менять:
- друзей;
- чаты;
- тренировки;
- сообщения;
- Sport ID;
- рейтинг;
- договоры;
- платежи.

## 4. Feature flags

Подготовлены ENV:

```text
SB_DATA_PLATFORM_MODE=legacy
SB_DATA_SHADOW_WRITES_ENABLED=false
SB_DATA_RUSSIAN_PRIMARY_ENABLED=false

SB_MEDIA_STORAGE_MODE=cloudinary
SB_MEDIA_RUSSIAN_PRIMARY_ENABLED=false
```

Опасные режимы требуют одновременно конфигурацию будущего сервиса и отдельный enable-флаг.

Например одного:

```text
SB_DATA_PLATFORM_MODE=russian_primary
```

недостаточно. Сервер откажется считать режим валидным без PostgreSQL config и:

```text
SB_DATA_RUSSIAN_PRIMARY_ENABLED=true
```

Это защита от случайного переключения production.

## 5. Будущая PostgreSQL schema

Файл:

```text
database/postgres/001_sportbuddy_core.sql
```

Сейчас он не исполняется автоматически.

Он заранее покрывает:
- users;
- external identities;
- отдельные юридические согласия;
- media registry;
- friends;
- trainings / participants;
- feed / comments;
- chats / members / messages;
- business legal profiles;
- business contracts;
- billing ledger;
- privacy requests;
- admin audit;
- migration bookkeeping.

Для legacy/raw данных предусмотрены JSONB snapshots там, где они полезны для безопасного поэтапного переноса.

## 6. Media migration

Cloudinary не отключается сейчас.

Будущая модель:

```text
client
  ↓
SportBuddy API
  ↓
signed upload / controlled upload
  ↓
Russian S3
```

В таблице `media_assets` предусмотрены:
- provider;
- provider key;
- public URL;
- owner;
- type;
- MIME;
- size;
- dimensions;
- hash;
- original legacy URL.

Это позволяет переносить старые Cloudinary assets постепенно:

```text
Cloudinary URL
   ↓ download
sha256
   ↓
Russian S3
   ↓
media_assets.migrated_from_url
```

Пока asset не перенесён, существующий Cloudinary URL продолжает работать.

## 7. Data migration bookkeeping

Таблица `migration_records` нужна для идемпотентной миграции.

Для каждого source document сохраняются:
- source;
- collection;
- source ID;
- target table;
- target ID;
- source updatedAt;
- hash;
- migratedAt;
- verifiedAt;
- status/error.

Поэтому миграционный скрипт можно безопасно перезапускать и продолжать после ошибки.

## 8. Что нельзя делать до появления российского контура

Не устанавливать:

```text
SB_DATA_PLATFORM_MODE=shadow
SB_DATA_PLATFORM_MODE=russian_primary
SB_MEDIA_STORAGE_MODE=russian_s3
```

пока соответствующие сервисы не созданы и не проверены.

Не переносить только часть персональных данных без карты зависимостей.

Не менять существующие user IDs.

Не переписывать auth первым этапом.

Не удалять Firestore/Cloudinary сразу после первого успешного импорта.

## 9. Рекомендуемый порядок будущего переноса

### Волна 1 — Media
Новые upload → Russian S3.  
Legacy Cloudinary → background migration.

### Волна 2 — low-coupling data
- legalAcceptances;
- public consents;
- privacy requests;
- business contracts;
- billing ledger;
- admin audit.

### Волна 3 — profiles and social graph
- users;
- identities;
- friends;
- matches;
- trainer profiles.

### Волна 4 — product content
- trainings;
- participants;
- feed;
- comments;
- stories.

### Волна 5 — chats
Чаты переносятся отдельно после окончательного решения по режиму ОРИ и требованиям хранения.

### Волна 6 — Auth
После того как PostgreSQL authoritative и все relation IDs проверены:
- собственные server sessions;
- email auth;
- VK identity;
- Firebase identity становится legacy mapping.

## 10. Проверки перед cutover

До каждого переключения:
- source count == imported count с учётом documented exclusions;
- orphan FK = 0;
- duplicate identities = 0;
- duplicate billing records = 0;
- missing contracts = 0;
- media hash mismatch = 0;
- выборочная сверка реальных аккаунтов;
- backup создан и проверен;
- rollback path протестирован;
- feature flag переключается без нового APK.

## 11. Расходы сейчас

Эта подготовка **не требует нового платного сервиса**.

Все новые файлы — schema, feature flags, tests и documentation.  
Production продолжает использовать уже существующую инфраструктуру до отдельного решения владельца.
