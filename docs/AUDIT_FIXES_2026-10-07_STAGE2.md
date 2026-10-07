# Audit fixes, stage 2 — profile data and deletion safety

## Changes
- Profile updates and new profiles validate primitive types, lengths, age, calendar birth dates, arrays, HTTPS photo URL syntax and portfolio size. Birthday derives age; activity/consent timestamps use server time.
- Photo presence verification rejects malformed URLs. This is NOT proof that a photo belongs to the user; signed, ownership-bound uploads remain a separate task.
- Automatic expired-account deletion is retired without deleting any documents or Auth accounts. Expired accounts still cannot enter the application and are directed to support. Shared chats and histories are preserved. The client only says an account was deleted after an affirmative server result.
- Authenticated `/api/public-profiles` returns an explicit public-field allowlist in pages of 200, rejects suspended callers and excludes suspended/demo targets. Social graph, reward codes, private contacts and Sport ID drafts are excluded.
- The client reads its own raw document only; community profiles use the API. Own-profile updates stay realtime; other profiles refresh every two minutes while the page is visible. The old community cache is removed.
- Repository Firestore rules restrict `/users/{userId}` reads to that user. Admin SDK operations continue to work.

## Deployment order (required)
1. Prepare and activate the code release normally. Health should report 37 routes.
2. Refresh the website and confirm the community list and own profile load.
3. In Firebase Console > Firestore Database > Rules, change ONLY the users block to:

```
match /users/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update, delete: if false;
}
```

Publish. Keep other production rules intact. Check no broader wildcard grants reads to users; overlapping Firestore allows are ORed. Until this rule is published, direct access to other users' documents remains possible under the old rule. VPS activation does not deploy Firestore rules.

4. Reload and test own profile, discovery, friends, chat and profile edit. Older APKs need rebuilding; old clients that query the raw users collection will no longer load the community after rule publication.
5. A rollback to pre-stage2 frontend is incompatible with the new read restriction. Prefer a forward fix; do not silently reopen private document access.

## Verification
- Full automated suite: 198 passed; TypeScript and production Vite build passed.
- API tests cover non-revoked auth, suspended callers, allowlist privacy and paging over hidden profiles.
- Loader tests reject raw user collection reads, preserve independent loading failures and remove old cache.
- Firestore emulator check passed: own document readable; foreign document, collection listing and direct writes denied. Reproduce with `npx firebase-tools@14.22.0 emulators:exec --only firestore --project demo-sportbuddy-rules "node scripts/check-profile-rules.mjs"` (local emulator only).

## Remaining work
Current production Firestore rules must be published/verified by the operator. Other audit items remain open: hidden-feed access, comprehensive suspension rules, ownership-bound media, full lifecycle/anonymization (including admin workflow race protection), API pagination/cost optimization, retry-safe trainings, notification queue and native packaging. No real user data was deleted or migrated by these changes.
