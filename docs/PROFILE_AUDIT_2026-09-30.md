# Profile and rewards review — 30 September 2026

## Implemented

- Automatic daily medal on authenticated profile load, visible-tab return and
  calendar rollover. Moscow calendar days, server-authoritative transaction.
- Repeat claim returns the saved result without another medal or promo.
- Removed local-cache mutations, local demotion and local workout recount from
  the medal display. Stats and cabinet now use the same profile progress.
- Activity level: 1 + floor(lifetime medals / 7), shown consistently in stats
  and cabinet. Lifetime progress survives a missed calendar day.
- Kept existing server reward economics: bronze 7 days / 5 Premium days;
  silver 7 days plus 3 workouts / 7 Premium days; gold 7 days plus 5 workouts /
  30 Premium days. Bronze promotion also requires at least one workout.
- Missed day resets the cycle, not lifetime collection or unlocked rank.
  Removed contradictory UI claims about rolling 24-hour demotion.
- Earned medal tier comes from the pre-promotion tier; promotion no longer
  shows the wrong medal. Promo identifiers use crypto random UUID entropy.
- Promo inventory is fetched from the server for the authenticated owner.
- Portfolio deletion renders the profile returned by the server.
- Removed hidden legacy daily-reward UI with obsolete rules.
- Metallic medal cabinet, ribbon relief, short entrance and light-sweep effects;
  reduced-motion support, labelled progress and expandable rules.

## Verification

51 automated tests pass. Production build passes. Added handler coverage for
claim retries, forged reward values, cycle promotion, workout requirements,
missed days and owner-scoped promo inventory. Tests use a mocked Firestore
adapter, not production Firebase or a concurrency emulator.

Browser preview at 390px: no horizontal overflow, rules open correctly,
reduced-motion disables medal animations. profile-medals-mobile.png is an
isolated rendering of the actual component with explicitly fictional data.

## Remaining checks and limitations

This is not a claim that every Profile function has passed a live test.
Real Firebase login across devices, Cloudinary uploads, device biometrics,
Premium payment and promo redemption need end-to-end tests with configured
services. Existing tests cover parts of these flows with mocks.

SportBuddy BOX includes named physical prizes in code. Actual partner stock
and prize fulfillment are not established by this audit; code execution alone
cannot confirm availability. Existing 24-hour unverified-profile deletion
policy also remains unchanged and needs a product decision before launch.

Changes are in the working GitHub branch, not deployed to the VPS.
