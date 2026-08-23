# Deep Linking для VK ID авторизации в Capacitor

Этот документ описывает, как настроить Android App Links, чтобы приложение перехватывало редирект от VK ID и завершал авторизацию внутри приложения вместо открытия браузера.

---

## Проблема

При нажатии кнопки авторизации VK ID в мобильном приложении (APK):
1. VK ID открывает браузер для входа.
2. Пользователь вводит пароль и подтверждает вход.
3. VK ID перенаправляет браузер на `https://sportbuddy78.pro/vk-callback` с кодом авторизации в URL.
4. **Проблема:** Браузер откры вает ваш веб-сайт, а приложение остаётся зависшим на экране авторизации.

**Решение:** Настроить Android App Links, чтобы ОС перехватывала ссылку `https://sportbuddy78.pro` и возвращала её в приложение вместо открытия браузера.

---

## Шаг 1: Добавить Intent Filter в AndroidManifest.xml

Откройте файл: `android/app/src/main/AndroidManifest.xml`

Внутри тега `<activity android:name=".MainActivity" ...>` добавьте следующий `intent-filter`:

```xml
<activity
    android:name=".MainActivity"
    android:label="@string/title_activity_main"
    android:theme="@style/AppTheme"
    android:launchMode="singleTask"
    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
    android:hardwareAccelerated="true"
    android:windowSoftInputMode="adjustResize">

    <!-- Существующий intent filter для launch -->
    <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
    </intent-filter>

    <!-- Deep Link для VK ID OAuth -->
    <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data
            android:scheme="https"
            android:host="sportbuddy78.pro"
            android:pathPrefix="/vk-callback" />
    </intent-filter>

</activity>
```

**Важные параметры:**
- `android:autoVerify="true"` — Android автоматически проверит `assetlinks.json` и будет перехватывать ссылки без диалога.
- `android:scheme="https"` — принимаем только HTTPS.
- `android:host="sportbuddy78.pro"` — ваш домен.
- `android:pathPrefix="/vk-callback"` — всё, что начинается с корня домена.

---

## Шаг 2: Создать assetlinks.json

Вам нужно скопировать и разместить файл `assetlinks.json` на вашем хостинге.

### Где найти SHA-256 отпечаток вашего ключа (keystore):

Выполните команду в терминале:
```bash
keytool -list -v -keystore android/app/sportbuddy-release.keystore -alias sportbuddy
```

Скопируйте значение **SHA-256**. Оно выглядит примерно так:
```
45:3A:5B:F2:C8:... (32 пары символов, разделённые двоеточиями)
```

**Удалите двоеточия** и замените в файле `public/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "ru.sportbuddy.mobile",
      "sha256_cert_fingerprints": [
        "453A5BF2C8..."  // <- Вставить вашу подпись БЕЗ двоеточий
      ]
    }
  }
]
```

### Загрузить на хостинг:

После развёртывания вашего веб-сайта на `https://sportbuddy78.pro`, файл должен быть доступен по адресу:
```
https://sportbuddy78.pro/.well-known/assetlinks.json
```

Проверьте в браузере (должен вернуть JSON, а не 404):
```bash
curl https://sportbuddy78.pro/.well-known/assetlinks.json
```

---

## Шаг 3: Синхронизировать изменения с Capacitor

После добавления `intent-filter` в `AndroidManifest.xml`, синхронизируйте проект:

```bash
npx cap sync
```

---

## Шаг 4: Пересобрать APK

В Android Studio:
1. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. Или через Gradle:
   ```bash
   cd android && ./gradlew app:assembleRelease
   ```

---

## Как это работает

1. Пользователь нажимает кнопку «Вход через VK» в приложении.
2. VK ID открывает браузер (Chrome, Samsung Internet, etc.).
3. Пользователь вводит пароль и подтверждает вход.
4. VK ID перенаправляет: `https://sportbuddy78.pro/vk-callback?code=xxx&device_id=yyy`
5. **Android перехватывает эту ссылку** благодаря `intent-filter`.
6. **ОС автоматически вернёт пользователя в приложение** (без диалога "Открыть с помощью").
7. **Capacitor emmit событие `appUrlOpen`** с параметрами `code` и `device_id`.
8. **AuthScreen ловит это событие** и вызывает `finishVkLogin(code, deviceId)`.
9. Токен обменивается, профиль загружается, пользователь авторизуется **прямо внутри приложения**.

---

## Тестирование

### Локальное тестирование (перед релизом):

Если вы хотите протестировать Deep Linking локально:

```bash
adb shell am start -W -a android.intent.action.VIEW -d "https://sportbuddy78.pro/?code=test&device_id=123" ru.sportbuddy.mobile
```

Приложение должно запуститься и попытаться обработать параметры.

---

## Возможные ошибки

### ❌ **assetlinks.json возвращает 404**
- Убедитесь, что файл находится в папке `public/.well-known/` вашего проекта.
- После `npm run build`, проверьте, что файл скопировался в `dist/.well-known/assetlinks.json`.
- На хостинге файл должен быть доступен по пути: `https://sportbuddy78.pro/.well-known/assetlinks.json`.

### ❌ **Android всё ещё открывает браузер вместо приложения**
- Проверьте, что `android:autoVerify="true"` установлен в `intent-filter`.
- Переустановите приложение полностью (не обновляйте, а удалите и заново установите APK).
- Android кэширует проверку `assetlinks.json`, кэш обновляется не мгновенно.

### ❌ **Приложение открылось, но авторизация не завершилась**
- Проверьте console логи (в Android Studio Logcat или через `adb logcat`).
- Убедитесь, что `AppUrlOpen` событие обрабатывается в `setupDeepLinkListener`.

---

## Дополнительно

После успешной настройки Deep Linking вы также можете зарегистрировать приложение в Google Search Console и Request App Indexing, чтобы ссылки `https://sportbuddy78.pro` открывались в приложении для пользователей, которые его установили, даже если они просто кликнут ссылку с веб-сайта или из письма.
