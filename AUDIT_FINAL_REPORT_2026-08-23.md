# SportBuddy — Server-Authoritative Audit / Stabilization

Date: 2026-08-23

## Status

This build is **not pushed to GitHub and must not be deployed yet**.

TypeScript check: PASS (`tsc --noEmit`).
All Vercel API JavaScript files: PASS (`node --check`).
Vercel API count: **11**.
Firebase Cloud Functions production folder/config: removed.

The Vite production build could not be executed in this Linux audit container because the supplied node_modules tree is missing Rollup's platform optional package `@rollup/rollup-linux-x64-gnu`. This is an environment/dependency-install issue, not a TypeScript error. The Windows project must run `npm install` and `npm run build` before deployment.

## Blockers addressed in source

1. **Unified account bootstrap + welcome Premium**
   - New profiles are created transactionally by `/api/sportbuddy-mutation`.
   - The server derives Firebase UID from the verified ID token.
   - Welcome Premium is granted once for 30 days.
   - Registration date comes from Firebase Auth metadata, not client input.
   - VK verification is based on a server-issued `vkVerified` custom-token claim; the client cannot self-assert VK verification.

2. **No client creation of authoritative `users/{uid}`**
   - `persistFreshProfile()` calls the server bootstrap.
   - Direct client `setDoc(users/{uid})` was removed.
   - Firestore rules deny client create/update/delete on `users`.

3. **Server-authoritative protected mutations**
   - Trainings: server transaction for create/join/leave/complete/check-in/credits.
   - Events: server transaction for participant registration; Firestore client writes denied.
   - Feed likes/comments: server transaction; Firestore client writes denied.
   - Friends/friend requests/friendships: server transaction; direct client writes denied.
   - Chats: server transaction; direct client writes denied.

4. **localStorage is cache, not authority**
   - Friend state is hydrated from the authoritative user document; localStorage mirrors it.
   - Workout credits are refreshed from Firestore and localStorage is retained only as a cache.
   - Chat local storage is a cache; message creation is server-authoritative.
   - Event UI refreshes from Firestore and localStorage is only the fallback cache.
   - Premium is calculated from the server-provided `premiumUntil`; no local grant function remains.

5. **Privacy separation**
   - New private fields are stored in `usersPrivate/{uid}`.
   - `usersPrivate` is readable only by the owner; client writes are denied.
   - Public `users/{uid}` no longer receives email/phone/birthDate/deviceId on new bootstrap.
   - A one-time maintenance migration script is included for existing profiles.

6. **Firebase Cloud Functions removed from production path**
   - `functions/` removed.
   - Firebase `functions` deployment block removed from `firebase.json`.
   - Direct `firebase-functions` dependency removed from package.json/package-lock root dependency graph.
   - Vercel `/api` remains the production business backend.

7. **Vercel function count**
   - `/api` contains exactly **11** JavaScript functions.
   - `send-admin-otp.js` removed because the current admin flow uses request/verify OTP endpoints.
   - `dedupe-users.js` moved to `scripts/maintenance/`.

8. **Regression prerequisites**
   - Static checks have passed.
   - Real web regression is intentionally still pending until the Windows build succeeds and this version is deployed to a staging/current Vercel environment.

## One-time production migration before public launch

Run from the project root with `FIREBASE_SERVICE_ACCOUNT_KEY` configured:

```text
node scripts/maintenance/migrate-private-user-fields.js
```

This moves existing public `users.email`, `phone`, `birthDate`, `hideBirthDate`, `hidePhone`, and `deviceId` fields into `usersPrivate/{uid}` and deletes them from the public user document.

Do this once before treating the privacy rules as fully effective for legacy accounts.

## Remaining launch gates

- Windows `npm install` + `npm run build` must pass.
- Deploy to Vercel and confirm 11-function deployment.
- Run the full regression matrix: email registration, VK, second-device login, Premium, match limit 5/6, training create/join/check-in/complete, workout credit, BOX, rating, verification, feed, chat, friends, search, YooKassa.
- Test direct Firestore bypasses against the deployed rules.
- Verify existing-user privacy migration completed successfully.
- Only after WEB regression passes should APK work begin.
