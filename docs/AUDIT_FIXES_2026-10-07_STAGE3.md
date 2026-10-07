# Training reliability — audit stage 3

## Changes
- New clients send a persisted request ID when creating a training. Its server ID is scoped to the authenticated owner. Retrying returns the existing training, chat and notification rather than creating duplicates; changing the payload under an existing ID returns 409.
- Request IDs survive network errors and page reloads; disabled browser storage falls back to memory. Concurrent identical submissions share one request. A different draft cannot silently reuse a pending operation.
- New clients explicitly request membership true/false. Retrying a join or leave is a no-op when that state already exists and does not enqueue a duplicate notification.
- New training time must be in the future in Moscow time. Missing/coerced coordinates are rejected. Signup after start is closed, but participants can still leave an unfinished training.
- Signup checks both profiles, organizer suspension and blocks in either direction inside the membership transaction. Existing gender and capacity checks remain in force.
- A successful creation retry can be recovered even if Premium expires before the retry; creation of a new training still requires access.

## Verification
207 automated tests passed; TypeScript and Vite production build passed. New tests cover creation replay and conflicting payloads, account isolation, explicit join/leave repeats, shared chat membership, blocked signup, past starts, missing coordinates, reloads, unavailable storage and concurrent client clicks. Tests do not contact live Firebase or send real notifications.

## Deployment
Normal prepare-release/activate-release flow; no environment variables or Firestore rule changes. Health remains 37 routes. Refresh browser clients and rebuild APKs for retry protection. Legacy create requests without requestId and legacy toggleJoinTraining are retained for compatibility; they cannot provide the new client retry guarantees. Removing these legacy operations is a later coordinated client migration.

## Remaining
This does not close the full audit. Chat-send idempotency, notification scheduling, wider suspension rules, moderation visibility, signed media ownership and lifecycle cleanup remain separate work.
