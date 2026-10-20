# Admin follow-up

## Changes
- Official training edits enqueue participant notifications atomically with the training and audit record. Changes of date, time, venue, description and participation conditions, hiding, cancellation and completion are covered. Identical saves do not create another notification. Existing worker preferences and delivery retries apply; no live messages were sent during testing.
- Partners, announcements, massage services and Sport ID requests load 50 records per page with a document snapshot cursor and a Load more button. Deleted cursors prompt a refresh. Editing the list during pagination may change its ordering; refresh retrieves the latest first page.
- Create requests for partners, announcements, massage services and official trainings reuse a request key after transport errors. Server transaction receipts return the original result on retry and reject changed payloads using the same key. Older clients without keys remain compatible but lack duplicate protection.
- Receipt documents remain server-only under the default-deny Firestore rules. Receipts are retained; no automatic expiry is configured.

## Validation
- Full pre-existing suite plus API integration checks for duplicate retries and audit failure rollback.
- Pagination test with 105 records sharing the same ordering timestamp, invalid/deleted cursors.
- Notification lifecycle and no-op checks; queue and business transaction rollback checked together.
- Client lost-response retry test with storage unavailable.
- Production TypeScript/Vite build.

## Deployment and acceptance
Deploy through ops/prepare-release.sh and ops/activate-release.sh. New admin UI and client retry changes require a new APK when using bundled assets. Server notification changes apply to existing clients.
After deployment verify admin lists, create/edit a draft, and inspect the audit log. Check participant delivery using a consenting test account and the running notification worker. No live delivery, device rendering or VPS configuration was verified by this change.

## Remaining scope
Account deletion across Firestore and Firebase Auth still needs resumable job processing. Pagination here covers four panels, not every administrative collection. Notification outbox delivery is asynchronous; earlier queued edits are not coalesced when a later edit is made.
