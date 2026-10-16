# Directory loading — stage 2

## Changes

Startup loads one discovery page (40 raw documents) instead of walking the
entire public directory. Hidden/demo records are excluded; an empty visible
page with a cursor is not the end of the directory. Discovery retains the
existing sport, gender, photo, active-looking, block and swipe filters.
The next-page button preserves these filters and deduplicates IDs.

Friends, matches and incoming/outgoing requests outside that first page are
hydrated by ID, in batches of at most 50. The same public field allowlist,
caller authentication/revocation/suspension checks and visibility exclusions
apply to ID lookups. Private fields are not returned. Cache namespaces separate
ID batches and pages of different sizes. Legacy APK requests still default to
200 documents and use the existing pagination contract.

The existing map, nearby, training, leisure, chat and profile views still share
the directory. Navigating away from discovery cards completes it on demand
(using 200-document continuation pages). The leaderboard remains unavailable
until all pages load, rather than presenting a partial community total as final.
The leaderboard memo comparator now also observes its incomplete flag.

Failed continuation preserves loaded profiles and the cursor for retry; it does
not automatically retry forever. A refresh/logout invalidates in-flight page
results so they cannot overwrite a newer load/account. Startup friends have
same-account cached fallback and their own stale warning.

## Boundaries

This is an incremental startup optimization, not the final large-city design.
Opening other sections still loads the complete directory. All activity and
feed pages are still loaded. Discovery filters remain client-side, so a user
may need another page to find matches. Related profiles count additionally to
the 40 discovery records. No capacity/MAU guarantee or production load test is
implied. Subsequent discovery pages are held in memory; the startup offline
snapshot retains its first page and related identities.

Next: separate server leaderboard aggregates, ID hydration for group/activity
participants, geographic queries, then bounded feeds/activity queries. Existing
public projection omits private reward inventory/social graphs; do not expose
these to implement leaderboard aggregates.

## Deploy and verify

Deploy server + web with prepare-release.sh then activate-release.sh. No rules
change, data migration, deletion or new environment secret. Rebuild the signed
APK from the same revision with a versionCode higher than the installed one to
use client pagination; old APKs remain API-compatible.

Checks covered in automated tests: 200-document legacy behavior, 40-document
pages, independent cache keys, hidden records, auth with warm cache, 50-ID bound,
friend outside first page, chunking/deduplication, account change rejection and
same-account friend fallback on network failure. Existing regression suite and
production TypeScript/Vite build remain required.

Device acceptance: open discovery; with >40 raw profiles, load more using the
button; change sport filters; open friends/chats, map and training leaderboard;
compare totals after completion with the web version. Interrupt connectivity
while loading more, reconnect and retry. Log out during loading, then sign in
with another account and check that the old results do not appear. Do not seed
synthetic users into production just to exercise pagination.
