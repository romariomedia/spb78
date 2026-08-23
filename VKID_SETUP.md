# VK ID — интеграция в SportBuddy78

Авторизация через VK ID подключена к приложению **54699979**. Для APK используется тот же Web SDK, но отдельный callback URL `/vk-callback`, который Android перехватывает через App Link.

| Параметр | Значение |
|---|---|
| App ID | `54699979` |
| Redirect URL | `https://sportbuddy78.pro` |
| Response mode | `Callback` |
| Scope | `email` |
| Доп. провайдер | Mail.ru |

---

## Как это работает

```
Пользователь нажимает VK ID One Tap
        ↓
VK возвращает code + device_id
        ↓
VKID.Auth.exchangeCode() → access_token + профиль
        ↓
loginWithVK() создаёт/восстанавливает локальный аккаунт
        ↓
Firebase Auth (e-mail + производный пароль) → Firestore авторизован
        ↓
Аватар из VK подставляется в профиль (hasRealPhoto = true)
```

SDK **загружается по требованию** при открытии экрана входа — он не
участвует в сборке и не влияет на время первого рендера. Пока скрипт
грузится, показывается скелетон; при ошибке пользователь видит подсказку
войти по e-mail, приложение остаётся полностью рабочим.

---

## Настройка в кабинете VK

Откройте [id.vk.com/business](https://id.vk.com/business) → приложение 54699979.

### 1. Доверенные Redirect URL

Добавьте все домены, откуда возможен вход:

```
https://sportbuddy78.pro
https://sportbuddy78.pro/vk-callback
https://sportbuddy-spb.web.app
http://localhost:5173
```

> Без точного совпадения VK вернёт `invalid_request`.

### 2. Права доступа (scope)

Включите **email** — иначе VK не вернёт почту, и приложение сгенерирует
технический адрес вида `vk<id>@vk.sportbuddy78.pro`.

### 3. Android APK (Capacitor)

Текущая версия проекта использует `@vkid/sdk` (Web SDK) внутри Capacitor WebView, поэтому для APK используется **Web-приложение 54699979**, а не отдельный Android App ID 54714060.

Для возврата в APK используется Android App Link:

```text
https://sportbuddy78.pro/vk-callback
```

В VK ID для приложения **54699979** добавьте этот URL в доверенные Redirect URL.

Отдельное Android-приложение **54714060** можно оставить созданным, но оно не используется этим Web SDK. Полная нативная интеграция через VK ID Android SDK — отдельная задача.

### 4. Мобильное приложение (нативная VK ID интеграция)

Для Android укажите в настройках VK ID:
- Package name: `ru.sportbuddy.mobile`
- SHA-256 отпечаток релизного keystore:

```bash
keytool -list -v -keystore release.keystore -alias sportbuddy78 | grep SHA256
```

---

## Content Security Policy

Если включаете CSP, разрешите домены VK:

```
script-src  'self' https://unpkg.com https://*.vk.com https://*.vkid.ru;
connect-src 'self' https://*.vk.com https://*.vkid.ru https://*.googleapis.com;
frame-src   https://*.vk.com https://*.vkid.ru;
img-src     'self' data: https://*.vk.com https://*.userapi.com;
```

---

## Что даёт VK-вход пользователю

| Преимущество | Детали |
|---|---|
| Вход за один тап | Без пароля и подтверждения почты |
| Готовое фото | Аватар из VK автоматически проходит проверку «личное фото» |
| Реальное имя | Имя и фамилия подставляются в анкету |
| Связка аккаунтов | Если e-mail уже был зарегистрирован, VK привязывается к нему |
| Firebase-сессия | Создаётся автоматически, Firestore принимает записи |

Пароль для VK-аккаунтов вычисляется детерминированно (`vkid_<id>_sb78`)
и никогда не показывается пользователю — он нужен только для внутренней
Firebase-сессии.

---

## Проверка

```bash
npm run dev
```

1. На экране входа под формой появляется кнопка **VK ID**
2. Нажатие открывает окно VK → после подтверждения происходит вход
3. В профиле подставлены имя и аватар из VK
4. Шаг верификации «Личная фотография» отмечен ✅
5. В DevTools → Application → Local Storage запись `sportbuddy_accounts_v1`
   содержит `provider: "vk"` и `vkId`

> Локальная разработка на `localhost:5173` требует добавления этого адреса
> в доверенные Redirect URL в кабинете VK.
