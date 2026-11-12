# Android authentication keyboard compatibility

Reported on Huawei P20 Pro / EMUI 12: focusing the email input in the APK
shows a white screen with the keyboard; Back restores an empty form. The same
website works in Chrome. The underlying Android/WebView/keyboard versions and
the exact cause have not yet been captured.

This compatibility patch explicitly requests `adjustResize` for MainActivity
and removes the authentication card's backdrop blur and entrance transform in
native apps. Native inputs stay mounted with their existing controlled state;
there is no keyboard-triggered navigation, reload or focus reassignment. Browser
styling is unchanged. This is a mitigation pending validation on the device,
not a confirmed diagnosis of an EMUI bug.

## Release validation

Build the updated `feature/running-routes` branch with the existing signing key
and a versionCode greater than the installed APK. Install over the existing app.
Do not clear application storage as part of this test.

On the affected Huawei and one other Android device, test registration and login:

1. Focus name, email and password in portrait; the field must remain visible.
2. Type an email and paste an email. Hide and reopen the keyboard; text must persist.
3. Switch email/password focus, toggle password visibility and scroll to consent
   controls without losing input. Repeat in landscape.
4. Background and resume with the keyboard open; the form must remain usable.
5. Check a browser session still renders and accepts input normally.

If the white screen persists, collect Android version, Android System WebView
version and keyboard name/version. Use the existing signed diagnostic build
locally to inspect WebView focus, viewport size and console errors; never log
or share entered passwords, tokens or personal registration data. A Chromium
browser test alone does not validate Huawei's IME or WebView compositor.
