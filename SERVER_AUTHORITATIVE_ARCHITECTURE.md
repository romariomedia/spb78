# SportBuddy — server-authoritative stabilization

## Source of truth

Firebase Authentication is the identity source of truth. Firestore is the source of truth for account state and business state. Vercel Serverless functions are the only layer allowed to perform protected business mutations.

`localStorage` is a cache only. It may contain UI preferences, rendered-data caches and short-lived device state. It must never be trusted for Premium, matches, training credits, verification, ratings, BOX/rewards or account identity.

## Protected mutations

- `/api/vk-login` — canonical VK → Firebase UID resolution, duplicate-profile consolidation and first-account Premium grant.
- `/api/create-payment` + `/api/payment-webhook` — Premium purchase lifecycle.
- `/api/verify-profile` — authoritative verification and one-time welcome trial.
- `/api/delete-expired-profile` — deletes only the authenticated caller's expired unverified account.
- `/api/sportbuddy-mutation` — transactional matches, training creation/join/leave, GPS check-in, training completion, workout credit, daily medals, BOX rewards, promo redemption and ratings.
- `/api/feed-create` — authoritative Premium + verification gate for feed publication.

## Firestore rules

Client writes to protected user progress fields, workout credits, ratings and participant/check-in training state are denied. The Admin SDK used by Vercel functions bypasses these rules for trusted mutations.

## Migration behavior

Legacy local offline mutation queues are discarded rather than replayed. Replaying an old queue would bypass the server transaction layer. Local workout/check-in/rating journals are refreshed from Firestore and remain rendering caches.
