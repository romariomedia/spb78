# Миграция на Cloudinary — что сделано

Дата: 2026-08-05. Сборка проверена: `tsc --noEmit` без ошибок, `vite build` успешен.

## 1. Почему Yandex Object Storage не «починить», а надо было заменить

Presigned-PUT из браузера падал по двум независимым причинам:

1. **CORS.** Браузер на `PUT` с `Content-Type: image/jpeg` отправляет preflight
   `OPTIONS`. Если в CORS-правилах бакета нет `PUT` + вашего origin +
   нужных `AllowedHeaders`, Yandex отвечает `403` вообще без заголовка
   `Access-Control-Allow-Origin` — запрос умирает до отправки байтов.
2. **Подпись.** `SignatureDoesNotMatch` возникает, когда canonical request
   не совпадает побайтово: порядок и URL-кодирование query-параметров
   (пробел = `%20`, не `+`), регистр signed headers, payload hash.
   Классический симптом — `curl` работает, а fetch из браузера нет.

Cloudinary unsigned upload снимает оба класса ошибок: endpoint изначально
принимает cross-origin `POST multipart/form-data`, подпись не нужна вовсе —
вместо неё unsigned upload preset.

## 2. Удалено

| Файл | Причина |
|---|---|
| `src/services/storage.ts` | S3-презайн + PUT |
| `src/services/feedMedia.ts` | обёртка над `uploadFile` |
| `src/services/profileMedia.ts` | обёртка над `uploadFile` |
| `src/services/eventMedia.ts` | обёртка над `uploadFile` (admin-гвард перенесён в AdminPanel) |
| `api/upload-file.js` | серверный прокси загрузки |
| `YANDEX_STORAGE_SETUP.md` | неактуальная инструкция |

Зависимости: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `formidable`.
Переменные `YANDEX_*` и `VITE_YANDEX_*` вычищены из `.env.example`.

**Не забудьте удалить их из панели Vercel/Netlify и из локальных `.env`,
`.env.local`, `.env.production`.**

## 3. Добавлено

### `src/services/cloudinary.ts`
- `uploadToCloudinary(file, options?) → Promise<string>` — основная функция, отдаёт `secure_url`
- `uploadMedia(file, options?)` — полный ответ, включая `publicId` (нужен для удаления ассета)
- `uploadRemoteUrl(url, options?)` — перекладывает внешнюю картинку на наш CDN
- `cldUrl / avatarUrl / photoUrl / cldSrcSet / cldPlaceholder / videoPoster` — оптимизация доставки

Особенности реализации:
- **Видео уходит на `/video/upload`**, изображения на `/image/upload`.
  Если перепутать — Cloudinary отвечает `Invalid image file`.
- **XHR, а не fetch** — только он даёт `upload.onprogress`.
- `AbortSignal` для отмены, retry с exponential backoff (только `429`/`5xx`;
  `4xx` не повторяется, потому что неверный preset/формат повтором не лечится).
- Валидация до отправки: изображения ≤ 10 МБ, видео ≤ 100 МБ.
- `cldUrl` не трогает не-Cloudinary адреса (Unsplash, VK-аватары) —
  безопасно вызывать на любом `avatar`/`mediaUrl`.

### `src/services/media.ts`
Конвертация Capacitor Camera → `File`. **Здесь была корневая причина сбоев:**
- `CameraResultType.Base64` возвращает чистый base64 **без** префикса `data:`;
- в браузере `photo.path` пустой — есть только blob-`webPath`;
- браузер может отдать PNG там, где ожидался JPEG (поэтому MIME берётся
  из самого Data URL, а не угадывается).

`photoToFile()` закрывает все четыре варианта (`dataUrl` → `base64String` →
`webPath` → `path`). Плюс `compressImage()` — сжатие перед отправкой
(снимок с телефона это 4-6 МБ; экономит трафик пользователя и квоту Cloudinary).

## 4. Изменено

**`src/services/native.ts`** — `takeAvatarPhoto()` теперь возвращает
`File | null` вместо строки. Именно из-за строкового результата в UI
появлялись костыли вида `prompt('Введите URL вашей аватарки')`.
Добавлен `pickPhotoFromGallery()`.

**`src/App.tsx`**
- `handleUpdateAvatar` — Cloudinary + прогресс + отмена.
  **Исправлен баг:** раньше обновлялся только `currentUser`, а `allUsers` нет —
  аватар оставался старым в списках чатов и лидеров.
- `handleGalleryUpload` — `window.prompt` для подписи заменён на модалку
  с предпросмотром, счётчиком размера и прогресс-баром
  (в iOS WebView и PWA `prompt` блокируется или выглядит чужеродно).
- Все 6 `alert()` заменены на неблокирующий toast с `role="status"`.
- Поле «URL фото к посту» теперь перекладывает медиа на наш CDN
  через `uploadRemoteUrl`, а не публикует чужую ссылку.
- Удалён мёртвый блок `LEGACY_FEED_BLOCK` — **133 строки**, которые ехали
  в бандл (`className="hidden"` не мешает бандлеру: замыкания на
  `toggleLikePost`/`setFeedPosts` не позволяли Rollup их вытрясти).
- Внешний Unsplash-фолбэк аватара заменён на локальный
  `/avatar-placeholder.svg` — внешний не работал офлайн.
- `min-h-screen` → `min-h-[100svh]` (на iOS Safari адресная строка обрезала контент).

**`src/components/ProfileEditor.tsx`** — аватар и портфолио на Cloudinary,
прогресс в процентах на кнопках, `prompt` убран.

**`src/components/AdminPanel.tsx`** — обложки и видео мероприятий на Cloudinary.
Admin-гвард (`hasAdminSession`) перенесён из удалённого `eventMedia.ts`
непосредственно в обработчик.

## 5. Производительность

**Главная находка:** в `vite.config.ts` стоял `viteSingleFile()`, который
инлайнил весь JS и CSS в один `index.html`. Code splitting физически
не работал — мобильный клиент грузил карту, админку и Firebase
до первого кадра.

| | До | После |
|---|---|---|
| Файлов на выходе | 1 (`index.html` 1.86 МБ) | 17 чанков |
| Карта Leaflet | в стартовой загрузке | отдельный чанк, по требованию |
| Админка | в стартовой загрузке | отдельный чанк (4.9 КБ gzip) |
| Студия эфира | в стартовой загрузке | отдельный чанк (2.5 КБ gzip) |
| Конфетти | в стартовой загрузке | отдельный чанк |

Сделано:
- `viteSingleFile` убран, настроены `manualChunks`
  (`node_modules` проверяется **последним** — иначе всё схлопывается в один `vendor`).
- `React.lazy` + `Suspense` для `LeafletMap`, `AdminPanel`,
  `AdminAccessModal`, `LiveBroadcast`. У карты — скелетон вместо
  прыжка layout.
- Все изображения через `f_auto,q_auto,dpr_auto`: Cloudinary сам отдаёт
  WebP/AVIF по возможностям браузера и подбирает сжатие по содержимому.
- Ко всем `<img>` добавлены `width`/`height`/`loading="lazy"`/`decoding="async"` —
  убирает CLS-скачки при подгрузке аватарок.
- Видео получили `poster` (первый кадр) и `preload="metadata"`.
- `sw.js`: cache-first для `res.cloudinary.com` в отдельном кэше
  `sportbuddy78-media-v1` (URL иммутабельны — в них версия и трансформация);
  `api.cloudinary.com` (загрузка) из кэша исключён. Версия кэша поднята
  до `v2`, чтобы старый SW не отдавал устаревший бандл.
- Адаптив: контейнеры `max-w-md` получили `lg:max-w-5xl` —
  на десктопе больше не колонка 448 px по центру.

## 6. ОБЯЗАТЕЛЬНО сделать в консоли Cloudinary

Без этого загрузка вернёт `400 Upload preset not found`, каким бы
правильным ни был код.

**Settings → Upload → Upload presets → `sportbuddy_unsigned`:**

| Параметр | Значение | Зачем |
|---|---|---|
| Signing Mode | **Unsigned** | без этого загрузка невозможна |
| Allowed formats | `jpg, png, webp, heic, mp4, mov` | отсекает произвольные файлы |
| Max file size | `10485760` (10 МБ) | лимит на стороне сервера |
| Unique filename | **on** | нет перезаписи чужих ассетов |
| Disallow public_id | **on** | клиент не выбирает путь |
| Incoming transformation | `c_limit,w_2000` | нормализация размера |

Имя пресета видно в исходниках клиента — это by design. Но ограничения
задаются **в самом пресете**, и в unsigned-режиме клиент их переопределить
не может: значения пресета имеют приоритет над параметрами запроса.

## 7. Что стоит доделать (не входило в задачу)

1. **Удаление ассетов.** Unsigned-загрузка не позволяет удалять из клиента.
   Сохраняйте `publicId` (уже возвращается из `uploadMedia`) в Firestore
   рядом с URL и удаляйте серверной функцией через Admin API — иначе
   при удалении постов аккаунт зарастёт осиротевшими файлами.
2. **Модерация UGC.** Для приложения знакомств включите автомодерацию
   в пресете — дешевле, чем ручной разбор жалоб.
3. **🔴 Админ-доступ виден всем.** В `OfficialEvents` стоит `isAdminUser={true}`,
   а в профиле кнопка «Кабинет администратора» отрисована под `{true && (...)}`.
   Модалка проверяет OTP, но сама кнопка у каждого пользователя —
   приглашение к брутфорсу. Замените на `isAdminUser`.
4. **Stale closure.** `subscribeAppInvalidation` в `useEffect` захватывает
   `fetchAllData` с первого рендера. Оберните в `useCallback([account?.id])`.
5. **Демо-уведомления в продакшене.** `generateDemoNotifications()`
   вызывается в инициализаторе `useState` и в `handleLogout`.
   Заверните в `import.meta.env.DEV ? ... : []`.
6. **`swipedIds` не персистится** — после перезапуска все просмотренные
   анкеты возвращаются. Сохраняйте в `localStorage` с TTL 24 ч.
7. **Реминдеры теряются при закрытии приложения** — `setInterval` живёт
   только пока приложение активно. Для native нужен
   `@capacitor/local-notifications` с `schedule.at`.

## 8. Команды

```bash
npm install
npm run typecheck     # tsc --noEmit
npm run build         # typecheck + vite build
npm run preview
npx cap sync && npx cap run android
```
