# Stage 3: server ranking and training identities

## Behavior

`POST /api/public-profiles` now accepts `action: leaderboard`, `metric`
(workouts/streak/medals/boxes), and optionally `offset` plus snapshot `version`.
The existing bearer-token, revoked-token and suspension checks run before every
request, including warm-cache hits. Legacy public-profile requests are unchanged.

The server returns full community totals, the caller's own rank (even outside
the page), and at most 20 compact rows. A row contains only ID, display name,
avatar, location label, medal tier, rank and the selected numeric score.
No private profile fields, social graph, box inventory or promo codes are sent.
Suspended, demo and legacy sample IDs are excluded. Ties use rating then UID.

The snapshot reads selected user fields in 500-document chunks and shares the
existing bounded 30-second cache. Failed scans are not cached. Profile/admin
invalidation also invalidates rankings. Score changes can take up to 30 seconds
to appear on the next request. The UI has an explicit refresh button.
A continuation against an expired/invalidated snapshot returns 409 and offers
restart; it never silently appends rows from a different ordering.

The workouts and medals rules remain unchanged. Streak is the stored current
cycle count (`dailyMedalStreak`), not a newly calculated lifetime streak.
BOX uses the length of `claimedBoxTiers`; no BOX is awarded by this read path.
This fixes missing streak/BOX scores caused by computing from public profiles
that intentionally did not expose those protected fields.

Opening Trainings no longer completes the whole public directory. Missing
organizer/participant identities are fetched in batches of at most 50, including
an individually opened archived training. Account changes, refreshes and view
changes discard obsolete identity results. Missing/deleted users do not cause
an automatic retry loop. Opening a ranking profile fetches its public details
on demand.

## Limits and next work

A cold ranking snapshot still scans every user document. Field projection saves
payload, not billed document reads. This is NOT a persisted Firestore aggregate
or a proven server capacity increase. Concurrent callers share the cached scan;
very large snapshots over the cache byte budget are not retained. Sorting is
server-side per request. Before large-scale traffic, replace this with maintained
aggregate/ranking records and measure real Firestore reads and API latency.

Maps, nearby, chats, leisure and profile still have full-directory dependencies.
Feeds and activities still load all pages. This release removes the dependency
from the training leaderboard only; do not claim pagination is complete everywhere.

## Verification and rollout

Tests cover >500 rows, correct totals/own rank beyond the first 20, all metrics,
stable ties, hidden/demo exclusions, privacy, auth/suspension with warm cache,
invalid/expired cursors, malformed legacy values and account-change rejection.
Run the full existing suite and production build.

Deploy VPS/web first with the existing release scripts. No database migration,
Firestore rules edit or new secret is needed. Rebuild the signed APK from this
revision with an increased versionCode for the client changes. Previous APKs
remain API-compatible. Never deploy a new client against an older server.

On a device: compare athlete totals between web and APK; switch all four metrics;
open another person's profile; check training organizer/participant names and
photos; refresh after an earned medal; test a failed request and retry. If more
than 20 athletes exist, expand and continue the ranking; after snapshot expiry,
use the offered restart. Device checks are distinct from automated tests.
