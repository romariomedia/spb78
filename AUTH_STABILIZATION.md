# SportBuddy — этап 1: стабилизация авторизации и Firebase

## Что изменено
- Firebase UID стал единственным идентификатором аккаунта.
- В браузере/APK хранится только один локальный session mirror, а не массив аккаунтов.
- Старый `sportbuddy_accounts_v1` больше не используется.
- VK ID подтверждается сервером `/api/vk-login`, который выдаёт Firebase custom token.
- Если e-mail уже существует в Firebase Auth, VK привязывается к существующему UID.
- Анонимные Firebase-сессии для реальных пользователей отключены.
- Дубликаты Firestore-профилей можно объединить через защищённый `/api/dedupe-users`.
- Публикация фото в ленту теперь подтверждается записью в Firestore; при сбое она попадает в offline queue.
- Очередь не удаляет неуспешные операции.
- Прошедшие тренировки исключаются из активного списка.
- Free-план ограничен 5 взаимными мэтчами за скользящие 7 дней; Premium не ограничен.

## Vercel variables
Обязательны:
- `FIREBASE_SERVICE_ACCOUNT_KEY`
- `VK_WEB_APP_ID=54699979`

Для разовой очистки дублей:
- `DEDUPLICATION_SECRET=<случайный секрет>`

После деплоя один раз отправить POST `/api/dedupe-users` с заголовком
`x-dedupe-secret`. После успешного запуска секрет можно удалить.

## APK
Для Debug App Links используется SHA-256:
`E3:92:11:AD:F7:09:27:D8:15:C4:B1:77:9C:CF:1C:CF:D2:5D:0B:2D:4E:B9:BE:1A:96:DE:71:90:B2:27:6D:CE`

Для Release APK необходимо заменить fingerprint в `public/.well-known/assetlinks.json`
на fingerprint release-сертификата.
