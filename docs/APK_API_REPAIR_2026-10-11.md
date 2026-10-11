# APK API routing repair — 2026-10-11

## Findings

The bundled Capacitor app used `server.hostname: sportbuddy78.pro`, the same
host as the production API. Capacitor's local asset server intercepts requests
to its own host. Consequently `/api/*` could resolve locally instead of reaching
the VPS. Several services also used relative fetch URLs, which only work when
the UI is actually served by the VPS.

`callServer` swallowed JSON parsing failures and accepted `{}` on an HTTP 200
HTML fallback. Public profile loading then failed; its partial-data fallback
could leave only the signed-in athlete visible. This is a code-level explanation
for the reported list discrepancy, not a production account count verification.

The “Нужно обновить SportBuddy78” screen was the generic React error boundary,
not a minimum-version enforcement mechanism. The exact original Profile/Feed
render exception requires its error detail or a device reproduction.

## Changes

- Bundled origin is now `https://localhost`; native API base remains
  `https://sportbuddy78.pro` (or an explicit build-time API override).
- All formerly relative service API fetches use the same native-aware helper.
- API transport rejects non-JSON responses. Shared authenticated calls also
  reject malformed JSON, null and array envelopes.
- Public profile response shape is checked; loaded legacy profile array fields
  and medal tiers are normalized for rendering without writing changes to users.
- Error UI describes a failed screen instead of demanding an app update.
- Public passport URLs and email verification continuation URLs remain real
  website URLs inside the native app.

## Delivery and acceptance

Build a **new** `RuStore signed APK` workflow run from updated `main`, not
“Re-run jobs” on an old commit. Choose versionCode greater than the installed
APK. Use the existing signing key and install the resulting APK as an update.
A server-only deployment does not replace JavaScript bundled in an installed APK.

Origin change creates a new WebView storage namespace: sign in once again with
the same account. Server profiles, friends and medals are preserved. Offline-only
unsynced actions in the old origin are not migrated; synchronize the old app
before updating if it contains pending actions.

Device acceptance: use the same account and filters as the website; compare
athlete lists; open Feed and Profile; open Sport ID; restart APK and check the
session persists. If a screen still fails, record its SB78 code, error detail
and component trace. Never send authentication tokens.

Local verification: 249 automated tests passed, TypeScript/Vite production build
passed, Capacitor Android sync passed and generated config has hostname localhost.
A signed Android binary and physical-device behavior are not validated locally.
