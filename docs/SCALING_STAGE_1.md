# Directory read reduction — stage 1

The app currently loads the whole public directory for discovery, friends,
chat names, organizers, maps and leaderboard totals. Limiting it to one page
would silently break those features. This release preserves that contract.

The VPS shares public projected pages for up to 30 seconds. Concurrent requests
for one page share its read. Authentication, revocation and caller suspension
are checked on every request. Private fields never enter the cache; HTTP
caching remains disabled. Failed reads are not retained.

The cache retains up to 64 pages / 16 MiB serialized payload per Firestore
instance (actual JS heap is larger). Oversized pages are served without being
retained. Restart clears the cache. Successful profile/identity/bootstrap,
verification, deletion and admin user operations invalidate this VPS cache
before the JSON response. External writes/other processes and medal changes
become visible after expiry. The current user's profile is loaded separately.

100 requests for one page in a cache window now require one page query rather
than 100; caller status checks still run 100 times. Cold reads and invalidation
cost normal Firestore reads. This is not a guaranteed capacity or Spark quota
claim. The first reader still scans the entire catalogue; network payload size
is unchanged.

## Remaining scaling work

- Separate bounded discovery from the shared identity directory.
- Load friend/chat/activity participant profiles by IDs.
- Compute leaderboard totals/rankings separately.
- Apply server filters and visible-page loading to discovery/feed/activities.
- Measure reads/day, media traffic, API p95 and test isolated synthetic load.

## Deployment

Use prepare-release.sh and activate-release.sh. Server-only improvement:
existing APKs benefit without rebuilding. No rules change or database migration.
Previous release is the rollback. Tests cover concurrency, expiry, errors,
memory bounds, in-flight invalidation and access checks with warm cache.
