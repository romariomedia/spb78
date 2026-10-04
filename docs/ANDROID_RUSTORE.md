# Android / RuStore build

Use a fresh clone, Node.js 22+, Android Studio Otter 2025.2.1 or newer, Android SDK 36 and Gradle JDK 21. Keep applicationId ru.sportbuddy.mobile. Backend continues to run on the VPS; Android packages dist locally and uses https://sportbuddy78.pro for API.

Windows PowerShell:

```powershell
git clone https://github.com/romariomedia/spb78.git C:\SportBuddy-Android
cd C:\SportBuddy-Android
npm ci
npm run android:prepare
npm run android:open
```

Checkout the reviewed Android preparation commit/branch before npm ci if not merged into main. Do not copy the VPS .env: service-account, SMTP and payment secrets must never be bundled. Client Firebase configuration is already in source; API base defaults to production on native. If overriding VITE_* values, only public configuration belongs there.

In Android Studio: Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK: 21. Install SDK Platform Android 16/API 36 and SDK Build-Tools requested by Gradle in SDK Manager. Wait for Gradle sync.

Debug APK: Build > Build App Bundle(s) / APK(s) > Build APK(s), or from Android Studio terminal: `cd android` then `.\gradlew.bat assembleDebug`. Output: android/app/build/outputs/apk/debug/app-debug.apk. Debug is for device tests, not publication.

Release: Build > Generate Signed App Bundle or APK > APK > app. Use the EXISTING release keystore/alias if this package has been distributed; do not replace it. If this is the first release and no key exists, create one outside the repository using the wizard. Back up keystore and passwords securely; never commit or paste them in chat. Select release. Verify the generated signed APK with SDK apksigner (`apksigner verify --verbose --print-certs PATH`). The wizard shows the selected destination.

Current checked-in versionCode is 5/versionName 1.0. Before publication set versionCode strictly above the highest previously uploaded value in android/app/build.gradle; do not guess it. Keep the same applicationId and signing key for updates.

Before every Android rebuild run npm run android:prepare. Updating the VPS does NOT replace JavaScript already packaged in installed APKs. Release new APK versions for client changes.

Acceptance on a real phone: email login, VK external login and app return (assetlinks.json must match release certificate SHA-256), API/profile loading, avatar/camera/gallery, precise/approximate/denied location, training signup, chat, editor, Stories, Android Back and system-bar insets. Test release signing, not just debug. Native background push is NOT implemented by current web FCM code; in-app notification history remains available. Decide/implement native push before promising it in the listing. Firebase free plan does not prevent local APK compilation.

RuStore: register developer account, upload signed APK, complete description, screenshots/icon, support contact, privacy URL, data/permission declarations and moderator access. Review current store requirements before submission. APK assembly and device acceptance have not been run in the development container (no Android SDK/JDK21). Web build and cap sync do not prove a working APK.
