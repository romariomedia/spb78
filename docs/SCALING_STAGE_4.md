# Stage 4: social identities without a full directory

Chats and Profile no longer trigger full-directory pagination. Startup still
hydrates friends/matches/requests through the stage-2 bounded ID API. A stable
sorted identity key now also reacts to new incoming/outgoing requests,
friendships, direct companions and latest group-message authors.

Opening a group hydrates participant IDs, visible-history authors (including
former members) and typing identities. The complaint flow hydrates reportable
group participants. Repeated messages from the same authors do not change the
key, so they do not repeatedly request profiles. Existing profiles are reused;
missing ones are requested in batches of at most 50. Explicit retry, reconnect
and full refresh can recover from a failed lookup. Results from superseded
loads/accounts are discarded. Deleted/unavailable profiles do not trigger an
automatic retry loop.

Training identity lookup also covers rating dialogs and archived selected
trainings, since these may be opened from Profile rather than Trainings.

Local thread reconstruction now starts from relationship IDs, not the loaded
profile list. A missing avatar/name cannot erase a conversation. Missing direct
profiles show a disabled placeholder row until their identity loads. Server
relationship and Premium checks for sending remain unchanged.

A separate fix preserves all chat categories and live unread/history metadata
when the identity list changes, including when localStorage fails. Previously
the local refresh rebuilt only friends/matches and could hide group counters.
No new server writes or local authorization decisions are introduced.

## Remaining dependencies

Map/nearby, Leisure and Feed still trigger full-directory completion. Feed and
activity lists still fetch all pages. The stage-3 ranking cold read still scans
users server-side. This stage does not claim a tested user-capacity increase.

## Rollout and acceptance

Deploy with the existing VPS release scripts, then rebuild the signed APK with
a higher versionCode. No new API, rules, migration or environment secret.
Earlier clients keep working. Tests cover identity selection, stable keys,
foreign-account exclusion, storage failure, missing profiles and preserved group
metadata. Run the complete suite and production build.

Device checks: a new friend request while Profile is open; accept and open the
chat; open a training/event group and its history; check names, avatars, search,
typing and unread counts; open rating dialogs from Profile; interrupt/retry a
profile request; logout while loading and sign into another account. Automated
checks are not a replacement for this real-device acceptance.
