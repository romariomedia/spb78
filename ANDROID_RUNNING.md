# Android running recorder

User-started Android location foreground service, registered as a local Capacitor plugin (`RunningRecorder`). Requires a new APK; a website-only update cannot add native recording to an installed APK. Older APKs and browsers keep the foreground-only recorder and its screen-on notice.

- Start requests precise location. Android 13+ may request notification permission; denying notifications does not prevent Android from running the foreground service, but notification controls may not be visible.
- `RunningService` collects GPS independently of WebView timers. A bounded partial wake lock keeps processing available while the screen is off. The service must be started from the visible activity, never at boot or by a background job. No ACCESS_BACKGROUND_LOCATION permission is requested.
- Pause/finish controls exist in the app and in the ongoing notification. Resume is an explicit action in the app. Finish records elapsed wall time including pauses. Starting a different account's run stops the previous active service; panel unmount on sign-out pauses the current account's service.
- Private drafts use AtomicFile in noBackupFilesDir, separate hashed filenames per account. No cloud raw-track retention. UI polls the native snapshot when its JS is active; GPS collection does not rely on this polling.
- Process termination/force-stop is not promised to be survivable. Service is START_NOT_STICKY; the persisted draft restores paused. Resume increments the segment so the missing interval cannot be used for ranking. Android/OEM battery restrictions still need device testing.
- Bounds: six hours, 12000 accepted points, accuracy <=50 m, at least two seconds between accepted points. A stationary GPS drift/urban accuracy check remains necessary.

## Early finish and result card

A run may end at any point, including before the first GPS fix. Server stores actual measured distance and full time; with no accepted points, distance is zero and the reason explicitly says GPS was unavailable. Such results cannot rank. A partial route is a personal result only. Full-route ranking still requires matching version, verified/dense route, ordered checkpoints, start/finish, distance tolerance, and no gaps or implausible jumps. Catalogue routes remain unverified until field validation.

The 1080×1350 result card contains distance, full time, pace, route, date and ranking status. It can be reopened from history. Before saving it is marked unsaved. Android shares PNG via a private cache file and temporary read permission; browsers use Web Share or a download fallback. No reference map is drawn as though a partial runner had covered the whole route. `docs/running-result-preview.png` is a synthetic 100 m example, not a real user's result.

## Checks

- Web production build and full JS suite must pass.
- Android debug build and instrumentation compilation: `.github/workflows/running-android-check.yml`. APK is debug-signed, for internal testing, not RuStore publication.
- RunStore instrumentation test checks persistence, completion and per-account isolation; it requires a device/emulator to execute.
- UI flow can be exercised with a simulated native bridge: start, pause, resume, notification finish, restore snapshot, save partial result, generate/share PNG. Simulation does not prove Android location behaviour.

## Required device acceptance

1. Fresh install: precise/approximate location choices, denied permission, notification permission denied/allowed. Old APK fallback.
2. Walk 10–15 minutes with screen locked; compare distance and timestamps against foreground recording. Repeat with another app open and without internet.
3. Pause from notification, move, resume in app: distance must not bridge the pause; full time includes it, ranking remains excluded.
4. Finish early from notification: GPS and wake lock stop, recorded portion restores, personal summary saves, ranking remains excluded.
5. Force-stop and restart: previous points restore paused. Account switch/sign-out pauses collection and does not expose the previous account's draft.
6. Complete a field-verified reference route, then test reverse direction, shortcut and GPS dropout. All three catalogue routes currently have ranking disabled.
7. Save offline then retry online; share PNG, reopen card from history, cancel the share sheet. Check Android 13+ and an OEM device with battery restrictions.
