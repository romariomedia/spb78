# SportBuddy stabilization audit — 2026-08-23

## Critical findings addressed

1. **Duplicate identities** — VK login now resolves by verified VK ID first, then e-mail, and records a canonical `vkIdentities/{vkId}` mapping. Duplicate Firestore profiles are merged before the session token is returned.
2. **Premium authority** — verification, payment, VK first-login trial and promo redemption are server-side. The client cannot grant Premium by editing localStorage.
3. **Matches** — mutual matches and the free-plan 5-match/7-day limit are enforced inside a Firestore transaction on the server.
4. **Training membership** — create/join/leave is server-side and capacity checked transactionally.
5. **Workout archive/progress** — credits are stored in `workoutCredits/{uid}_{dayKey}` and `totalWorkouts` is incremented in the same transaction. A duplicate request cannot award a second daily credit.
6. **GPS check-in** — check-in and `checkedInUserIds` are written atomically by the server after a 300 m distance check.
7. **Training completion and ratings** — completion and rating aggregates are server mutations; rating documents and user rating counters are updated atomically.
8. **BOX/rewards/medals** — BOX claims and daily medal progress are server mutations. Client storage only mirrors the returned state.
9. **Verification** — `verify-profile` authenticates the caller from the Firebase ID token and grants the 30-day welcome trial only once.
10. **Feed publication** — `/api/feed-create` verifies Firebase identity, Premium and verification directly from Firestore before creating the post.

## Remaining non-critical client caches

Theme, calendar view, UI collapse state, discovery cache, local rendering cache and similar presentation state remain in localStorage. These are not used to authorize business operations.

## Validation performed in this environment

- All TypeScript/TSX source files: parser diagnostics = 0 (89 files scanned).
- All Vercel API JavaScript files: `node --check` passed.
- A full `npm run build` could not be executed in the audit container because the package registry/cache was unavailable; the source archive's existing build script intentionally invokes TypeScript/Vite through `node` to avoid the Vercel `.bin/tsc` permission problem previously observed.

## Deployment checklist

1. Set `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel.
2. Set `VK_WEB_APP_ID=54699979` for the current VK ID Web SDK flow.
3. Set `DEDUPLICATION_SECRET` and run `/api/dedupe-users` once against the production database before launch.
4. Deploy Firestore rules.
5. Deploy Vercel and run the browser regression suite first.
6. Only after browser regression is clean, rebuild Android and test the VK App Link separately.
