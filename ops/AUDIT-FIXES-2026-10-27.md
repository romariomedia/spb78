# Audit fixes — 27 October 2026

- Legal acceptance transactions read all documents before writing. Tests enforce Firestore read-before-write semantics.
- Product mutations validate current terms/personal-data acceptance server-side. Login, bootstrap, reading, privacy requests, consent revocation, admin recovery and payment webhooks remain reachable. HTTP 428 LEGAL_ACCEPTANCE_REQUIRED opens the current client's acceptance dialog; older clients show a website/update instruction. Public feed/Sport ID consent still requires explicit per-action confirmation, never inferred from general acceptance.
- Business pause and promotion are evaluated in authenticated and anonymous catalogs during beta. Guest cache can retain its previous response for up to 30 seconds. Payment enablement/date checks are unchanged.
- Admin/user privacy requests use createdAt descending and document ID descending cursors, with 50 records per page. UI can load all pages and no longer silently slices the list. Open count explicitly describes loaded records.

## Deployment

Prepare the pinned release normally. Before activation, from its directory run:

```bash
node ops/prepare-privacy-index.mjs /opt/sportbuddy-api/.env
```

This creates only the privacyRequests collection index (ownerUserId ASC, createdAt DESC, document ID DESC), using the existing service account. It waits for READY and exits nonzero on errors. It never deletes indexes or changes security rules. If permission is denied, create the same composite index via Firebase Console → Firestore → Indexes and rerun. Do not activate until READY. The index is also recorded in firestore.indexes.json for future CLI deployments.

Rebuild Android from this commit to include the new dialog handling and pagination. Existing APKs do not acquire new UI from a VPS deployment; users can confirm general documents in the website under the same account. For per-publication consent use current APK or web.

Verification: unit/integration tests with strict Firestore mocks, full typecheck/build. No production writes, live acceptance, paid payments or physical-device testing performed by the audit/fix process.
