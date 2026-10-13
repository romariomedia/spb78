# Android network and VK repair (2026-10-13)

## Evidence and limits

User reports: screens now render, but APK shows only own athlete, partial-load
warning, stories request abort, city-event participation does not visibly complete,
and VK browser page fails. The displayed abort is in Stories, not proof that the
city-event handler threw the same error.

Confirmed code defects:
- Public profile loader gave up at 7 seconds while API transport allowed 15;
  late successful results were discarded.
- API requests from https://localhost used WebView cross-origin fetch.
  Native transport removes this dependency; actual production preflight failure
  was not confirmed (the inspection environment could not reach the VPS).
- City event action silently swallowed errors and toggled participation again on
  an identical retry; returned event identity could depend on stored `id`.
- Native VK popup depended on local origin/cookies, callback forwarded only code
  and device_id, and PKCE/state did not survive a cold restart reliably.

## Changes

JSON API services use explicit CapacitorHttp on Android, browser fetch on web.
Firebase, file uploads and notification streams are not globally monkey-patched.
Abort signals settle JS callers; native requests may still finish on the server,
so mutations are not blindly retried. API timeout is 30 seconds and initial data
loader waits 35 seconds. Warning identifies the failing sections; incomplete
athlete data no longer produces a misleading community rank/count.

City-event client sends explicit `registered` boolean. Server keeps legacy toggle
behavior for old clients but new repeated requests do not reverse participation.
Returned event includes its Firestore document ID. Failures display locally.

Native VK uses system browser authorization-code flow with S256 PKCE, persistent
transaction and exact callback origin/path/state/expiry checks. Code exchange uses
native HTTP, with token-response state validation. Website VK login is preserved.
`/vk-callback` has a fixed-package intent button if automatic App Links fail.

Reference implementations consulted:
- https://github.com/VKCOM/vkid-web-sdk/blob/master/src/auth/auth.ts
- Capacitor Android Bridge.launchIntent and CapacitorHttp sources installed in repo dependencies.

## Deployment order

1. Deploy this commit using ops/prepare-release.sh + ops/activate-release.sh.
   Required for explicit event attendance and browser callback page.
2. In VK ID **web application 54699979**, confirm allowed redirect URL is exactly
   `https://sportbuddy78.pro/vk-callback` (no trailing slash). Do not substitute
   Android SDK app 54714060 or add localhost as the production redirect.
3. Run a new RuStore signed APK workflow from main, with increased versionCode.
   Re-running an old workflow does not build new sources.
4. Compare APK signing certificate SHA-256 printed by apksigner in workflow logs
   with `public/.well-known/assetlinks.json` served at
   `https://sportbuddy78.pro/.well-known/assetlinks.json`.
   If signing key changed, update the file with the real release fingerprint and
   deploy it; never substitute an arbitrary/debug certificate for release.
5. Install over previous APK with the same signing key.

## Device acceptance before store submission

- Same account on website and APK: compare athlete lists and leaderboard.
- Refresh: all five sections load, warning clears after successful refresh.
- Stories: list loads or shows an actionable error.
- City event: join, restart APK, verify membership; leave; retry after timeout
  must not unexpectedly reverse the intended registration.
- VK: start from APK, authenticate in browser, return warm and after Android
  recreates the app; same Firebase account is reused. Test cancel/retry too.
- Verify direct app return and browser fallback button.

254 automated tests and production build passed locally. Capacitor sync checked.
Actual signed APK and physical device flows remain acceptance gates; no claim of
RuStore readiness until these checks pass. No production account data was edited.
