# Firebase Functions — SportBuddy78 Admin OTP

Этот каталог содержит серверную часть двухэтапного входа в админку.

## Что делает функция

1. Проверяет Firebase Auth e-mail `support@sportbuddy78.ru`.
2. Генерирует криптографически безопасный 4-значный OTP.
3. Хранит только SHA-256 hash кода на 10 минут, не сам код.
4. Отправляет код по SMTP на `support@sportbuddy78.ru`.
5. Ограничивает отправку: один код в минуту, максимум 5 попыток проверки.
6. После успешной проверки создаёт Firestore-сессию администратора на 8 часов.

Дополнительно Functions обслуживают защиту верификации:

| Function | Назначение |
|---|---|
| `verifyMyProfile` | Серверно подтверждает профиль после личного аватара и минимум одного фото в портфолио; только она может выставить `isVerified=true` |
| `cleanupExpiredUnverifiedUsers` | Запускается каждые 15 минут, удаляет анкеты без верификации старше 24 часов, связанные чаты, check-in, цели, публикации, связи и сам Firebase Auth аккаунт |
| `deleteMyExpiredUnverifiedAccount` | Вызывается самим приложением при следующем открытии после истечения 24 часов: удаляет просроченную непроверенную учётную запись сразу, не дожидаясь расписания |

## Развёртывание

Инициализируйте Functions один раз в Firebase CLI (Node.js 20, TypeScript):

```bash
firebase init functions
# source directory: functions
# language: TypeScript
# region: europe-west1
```

Содержимое `functions/src/index.ts` уже подготовлено. Установите зависимости
в Functions workspace:

```bash
cd functions
npm install firebase-admin firebase-functions nodemailer
npm install -D @types/nodemailer typescript
```

Задайте секреты (значения никогда не попадают в клиентское приложение):

```bash
firebase functions:secrets:set ADMIN_OTP_PEPPER
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
firebase functions:secrets:set SMTP_FROM
firebase deploy --only functions
```

> Scheduled cleanup functions требуют включённого биллинга Firebase (Blaze),
> так как Firebase Scheduler использует Cloud Scheduler. Для production это
> необходимо, чтобы правило удаления через 24 часа исполнялось гарантированно.

Для Яндекс 360 / SMTP обычно используются SMTP_HOST `smtp.yandex.ru`,
SMTP_PORT `465`, `SMTP_FROM` `support@sportbuddy78.ru`. Используйте пароль
приложения, а не основной пароль почты.

> После регистрации Android App Check (Play Integrity) включите
> `enforceAppCheck: true` в `functions/src/index.ts` и повторно задеплойте
> Functions. На первом запуске OTP уже защищён Firebase Auth e-mail,
> одноразовым hash-кодом, TTL, лимитом повторных отправок и лимитом попыток.