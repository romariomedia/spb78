# SportBuddy stabilization pass

Source: `SportBuddy-VK-Android-FIX-54714060-websdk-BUILDFIX.zip`

## Stage 1 — identity/Firebase
- Replaced multi-account local store with a single account/session mirror.
- Old `sportbuddy_accounts_v1` is no longer read.
- Email authentication uses Firebase Auth UID.
- VK authentication uses Vercel `/api/vk-login` + Firebase custom token.
- Existing Firebase email UID wins when VK returns the same email.
- Removed anonymous Firebase fallback for real users.
- Added `/api/dedupe-users` for one-time Firestore duplicate cleanup.
- Added safe profile-default merge for partial identity documents.

## Stage 2 — Feed/media
- Feed publication waits for Firestore acknowledgement.
- Failed publication is retained in the offline queue.
- Offline queue now retains only operations that really failed.
- Feed image cards use Cloudinary responsive URLs and a fixed aspect ratio to reduce layout jumps.
- Feed query order changed to newest-first.

## Stage 3 — Trainings
- Main training data is filtered by calendar date: today + future.
- Finished previous-day trainings disappear from the active list automatically.
- Upcoming countdowns only show future starts.

## Stage 4 — Free/Premium
- Free users: maximum 5 new mutual matches in a rolling 7-day period.
- Premium users: no weekly mutual-match limit.
- Legacy match data is migrated into the rolling match history on first use.

## Stage 5 — onboarding
- Existing first-login welcome modal was kept and clarified with the BOX value proposition and the 5-match Free/Premium difference.

## Stage 6 — VK Android
- Existing Android App Link remains `/vk-callback`.
- Debug SHA-256 in assetlinks is the certificate supplied during the previous build.
- VK server verification is now Vercel-based instead of a Firebase Cloud Function dependency.

## Important deployment values
- VK Web SDK app: `54699979`
- Android applicationId: `ru.sportbuddy.mobile`
- Debug SHA-256:
  `E3:92:11:AD:F7:09:27:D8:15:C4:B1:77:9C:CF:1C:CF:D2:5D:0B:2D:4E:B9:BE:1A:96:DE:71:90:B2:27:6D:CE`

## Before APK build
Run:
1. `npm install`
2. `npm run build`
3. `npx cap sync android`
4. `cd android`
5. `gradlew.bat clean assembleDebug`

For a release APK, replace the debug SHA-256 in `public/.well-known/assetlinks.json` with the release certificate fingerprint before deploying the website.
