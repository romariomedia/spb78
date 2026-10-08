# Partners integration review — 2026-10-08

Reviewed the partner feature added after audit stage 3, including feed placement, administrator session checks, publication windows, media controls and browser/native API routing. No production partner records or media were created, modified or deleted during the review.

## Confirmed
- Partner management is available inside the admin panel; every API operation requires a nonexpired OTP session.
- With no configuration the feed section is hidden. With visibility enabled but no published cards the component renders nothing.
- Partner changes generate administrator audit records. Public responses project offer fields without administrator metadata.
- Logo, cover and photo/video upload paths use the existing Cloudinary integration.

## Fixed
- Feed and administrator clients use apiBase(), including the production API host inside Capacitor APKs.
- Hidden sections return before reading the partner catalog. Responses disable caching so a previously visible section is not reused after hiding it.
- Active records are filtered by publication dates and sorted by priority before the 20-card display limit; future/expired records cannot crowd out published offers at the previous arbitrary 50-record limit.
- Suspended/revoked accounts cannot fetch partner content. Invalid publication dates fail closed; credential-bearing URLs are rejected; empty media URLs normalize to mediaType none.
- Cards without media no longer create an empty img element. Decorative overlays do not intercept video controls.
- Saving, closing, switching and deleting a draft are disabled while a file upload is pending. File selection is reset so the same file can be retried.
- Feed content refreshes every minute while visible and on returning to the tab. Requests are bounded by a 15-second timeout and obsolete responses cannot update an unmounted section. Switching accounts remounts it.

## Verification
217 automated tests passed; TypeScript and production build passed. Added tests use isolated Firebase fixtures: authenticated/unauthenticated access, expired admin session, create/update/hide/delete, audit output, empty/hidden state, deadlines and priority. Native client tests confirm the actual request URL and correct authorization mechanism.

Real OTP login, Cloudinary credentials/preset, device playback and physical APK operation still require a manual check with the owner's account. Signed media ownership and idempotent/atomic administration writes remain broader audit tasks; this review does not claim those are solved. The active catalog read currently scans active partners before selecting 20; revisit pagination when the catalog grows.

## Deployment
Normal prepare-release/activate-release flow. This includes the existing stage 3 training fixes and the original partners feature. Health reports 39 routes. No new environment settings or Firestore rules are required: partner records are served and managed through Admin SDK APIs. Keep the section hidden until the first actual partner is ready. Never create a fake public partner merely to test the feature.
