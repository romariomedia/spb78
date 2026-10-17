# Stage 5 — feed and leisure identity loading

Opening Feed no longer completes the public profile directory. PostCard uses
its post/comment author snapshots; Stories, partner and city-event components
use their own APIs. Initial application hydration remains unchanged.

Opening Active Leisure also no longer completes the directory. Only opening a
meeting loads its missing organizer/participant profiles through the existing
authenticated public-profiles IDs API (batches of up to 50). Already known profiles
are reused while this section remains mounted. The current account comes from
its authoritative profile. Names remain clickable when available.

The stable identity key ignores participant ordering/meeting text changes.
Closing or switching meetings cancels result application; unmount/account changes
cannot apply a previous request. The parent keys LeisureSection by account ID.
Failures have a local error and retry; deleted/hidden profiles keep an anonymous
placeholder without automatic retry loops. Reopening the section may reload
profiles; this is intentionally not a persistent cross-account cache.

## Verification

- Unit regression for closed meeting, self/invalid IDs, deduplication, stable
  identity key and new participant.
- Existing repository identity-loading/account-isolation and API privacy tests.
- Full test suite and TypeScript/production build.
- Device acceptance after rebuilding APK: open Feed; open a leisure meeting
  whose members are outside initial discovery page; open member profiles;
  join/leave; navigate away during load; retry a failed identity request.

## Limits

Map/nearby discovery still completes the directory. Feed/activity collection
pagination and cold ranking scans are unchanged. This reduces unnecessary profile
traffic, not media sizes or the number of post requests. No measured capacity
claim or production load-test result is implied.

Deploy the normal isolated release and rebuild signed APK from main with a
higher version_code. Old installed APKs keep their old client loading behavior.
