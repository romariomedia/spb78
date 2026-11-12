# Route start and native saving regression checks

Reported on Huawei Mate 50 Pro: a route could start from another town; starting
recording and saving PNG could close the app. Confirming the precise exception
on that device still requires its crash log or retest.

Changes:
- New runs acquire a fresh (maximum 15 seconds old), accurate (maximum 50 m)
  location before creating the draft. Named routes require being within 100 m
  of `route.start`; free runs have no route-distance restriction. Resume keeps
  the existing track and does not require returning to its start.
- Permission requests and document picker launch on Android's main thread;
  Capacitor executes plugin methods on its worker thread by default.
- An initial native draft remains `pendingStart` until the foreground service
  has registered GPS updates and acquired its wake lock. Failure or recovery
  discards only an uncommitted start, preserving established runs.
- Before the file picker opens, PNG data is staged privately in cache and removed
  from plugin call options. Only a short generated filename enters Activity state.
  Saving streams the file to the chosen content URI on a worker and cleans it on
  completion/cancellation. This avoids putting megabytes of base64 into Binder
  saved state. Concurrent save requests are rejected until the first completes.

Automated coverage includes Peterhof vs Neva start checks, stale/inaccurate fixes,
and Android instrumentation for native start/pause/resume/finish, a 2 MiB PNG
export with compact saved options, cancellation and pending-start recovery.
The Android lifecycle suite runs on an API 30 emulator in CI. It is not a substitute
for the Huawei vendor's document provider and power-management behavior.

Device acceptance: install a signed APK over the previous version; deny and then
grant location, attempt a distant route, start a free run, lock/unlock the screen,
pause/resume/finish, save a photo card to Downloads, cancel then retry saving,
and verify the saved PNG opens. Never erase an existing real track for testing.
