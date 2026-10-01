# Mobile profile summary

The avatar/name area no longer contains a non-wrapping row of pills. Full-width statistics use four equal minmax(0,1fr) columns, switching to two below 351 px. Rating, workouts, friends and matches are shown explicitly; a separate row gives medal tier and total daily medals. Premium is an inline badge, so it cannot overlap the name. Long names and locations wrap. Camera action, birthday privacy text, bio and portfolio remain available.

Validation: production TypeScript/Vite build; browser checks at 320/360/390/430/768 px with normal and long names / large counters; no statistic overflow; camera callback works. Screenshot profile-summary-mobile.png uses illustrative counts and a placeholder avatar, not live account data. No business rules or reward values were changed.
