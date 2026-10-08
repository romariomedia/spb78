# Welcome guide redesign — 2026-10-08

Replaces the existing WelcomeGuide without changing its App integration or API.

- Ten chapters: getting started, discovery, training, active leisure, venues, official events, chats/friends/notifications, feed/stories/partners, profile/Sport ID, rewards/Premium.
- Uses the owner's six supplied promotional posters, encoded as WebP (about 1.3 MB combined); only the current chapter artwork is mounted.
- Navy/lime visual design, readable instruction cards, direct chapter navigation, persistent footer, mobile safe areas and reduced-motion support.
- Dialog locks background scrolling, traps keyboard focus, handles Escape and restores prior focus. Final action falls back to closing when onStart is absent.
- Local seen key is versioned to v2 so returning users receive the updated guide once. Existing manual reopen control remains available.
- Beta content follows shared Moscow-time policy: free Premium through 2026, no BOX awards during beta, earned promo codes accumulate for use from 2027. Normal-mode text switches at the policy boundary.
- Explains that active leisure does not count as a workout for rewards and that venue rental is confirmed directly with the venue.

Validation: 224 Node tests passed, including artwork/content integrity and year-boundary policy coverage; production TypeScript/Vite build passed. Browser visual and interaction verification remains pending: local Chromium launch is blocked by the environment and the remote browser cannot reach the local preview. Check mobile scrolling, artwork crop, chapter navigation, keyboard focus and closing on the deployed site before declaring visual acceptance.

Integrated on top of main commit 36274ce, preserving the official starter training feature.

No Firestore rules or environment changes are required for this guide.
