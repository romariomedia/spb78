# Feed photo publication fix

## Root cause
The feed UI validated the current React user, but `createPost()` performed a second Premium/verification check against the stale `localStorage` repository cache. A newly granted 30-day Premium session could therefore pass the UI gate and still be rejected by `createPost()` as free.

## Fix
`createPost()` now accepts the authoritative `UserProfile` from the authenticated React session and uses it for the publication gate. Text posts, completed broadcasts, and gallery photo/video posts pass `currentUser` into `createPost()`.

No Firebase rules, subscription dates, or verification requirements were weakened. A user still needs active Premium and `isVerified === true` to publish.
