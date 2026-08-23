# SportBuddy Android VK ID callback

This patch intentionally leaves the working browser VK flow unchanged.

## Redirects

- Web: `https://sportbuddy78.pro`
- Android: `https://sportbuddy78.pro/vk-callback` (same Web VK ID app, intercepted by the Android App Link)

The Android redirect is handled as an Android App Link. The callback URL contains VK ID's `code` and `device_id`; Capacitor receives it through `appUrlOpen`, stores it briefly in `sessionStorage`, and dispatches `vk-oauth-callback` to `AuthScreen`.

## After adding/syncing Android

From the project root:

```bat
npm install
npm run build
npx cap add android
npx cap sync android
```

If `android/` already exists, do **not** add it again; just run `npx cap sync android`.

## AndroidManifest.xml

In `android/app/src/main/AndroidManifest.xml`, on the `MainActivity` add:

```xml
android:launchMode="singleTask"
```

and inside that activity add this intent filter:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data
        android:scheme="https"
        android:host="sportbuddy78.pro"
        android:pathPrefix="/vk-callback" />
</intent-filter>
```

Do not replace the normal Capacitor launcher intent filter.

## VK ID application

The project currently uses the **VK ID Web SDK** (`@vkid/sdk`) inside the Capacitor WebView, so the authorization client must be the Web VK ID app:

- Web app: **54699979** → browser redirect `https://sportbuddy78.pro`
- Android callback: `https://sportbuddy78.pro/vk-callback` → handled by Android App Links

The separate Android VK ID app **54714060** is not passed to the Web SDK. VK's native Android SDK uses a different integration and callback scheme. Mixing the Android app ID into the Web SDK causes the VK page to fail to load (the observed `id.vk.ru` "Ошибка загрузки").

In the VK ID settings for app **54699979**, add this exact trusted redirect URL:

```text
https://sportbuddy78.pro/vk-callback
```

## Android App Links fingerprint

`public/.well-known/assetlinks.json` is configured for the current Debug signing certificate:

```text
E3:92:11:AD:F7:09:27:D8:15:C4:B1:77:9C:CF:1C:CF:D2:5D:0B:2D:4E:B9:BE:1A:96:DE:71:90:B2:27:6D:CE
```

This is the SHA-256 for the current Debug keystore. For a different signing certificate, replace/add its fingerprint. To inspect the configured variants, run:

```bat
cd android
gradlew.bat signingReport
```

Copy the SHA-256 from the `debug` variant into `public/.well-known/assetlinks.json` (without changing the package name `ru.sportbuddy.mobile`).

For a Release APK, the release signing certificate SHA-256 must also be published in `assetlinks.json` if the release certificate differs from debug. Multiple fingerprints may be listed in the same array.

After changing `assetlinks.json`, redeploy the web project so this URL is publicly reachable:

`https://sportbuddy78.pro/.well-known/assetlinks.json`

## Important

Do not move VK verification to Firebase Cloud Functions as part of this callback fix. The browser application remains the source of truth; this change is only the Android/Capacitor callback bridge.
