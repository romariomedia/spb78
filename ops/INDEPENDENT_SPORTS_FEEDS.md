# SportBuddy78: independent sports calendars — evidence-based decision (2026-10-10)

## TheSportsDB
Official terms: https://www.thesportsdb.com/docs_terms_of_use.php
Last updated 2026-09-17. The free API is for development, and publishing an app in an app store requires a paid subscription. Paid plans still require attribution and do not grant third-party image rights. Do not run the free key in the released SportBuddy Android application as if that right were granted.

Coverage and data freshness for KHL, Russian Premier League, VTB League and the renamed Shanghai Dragons need testing with live responses; no IDs may be guessed. API v1 free search is heavily restricted and next events may return a single entry. API v2 requires premium.

Run locally for diagnostics (read-only, no Firestore writes):
    node ops/probe-sportsdb.mjs
Use a paid key only after a paid licence is in place:
    SPORTSDB_API_KEY=<set-in-environment> node ops/probe-sportsdb.mjs

This prints match metadata but will not publish because fixtures may lack verified Petersburg venue, exact Moscow-local start, and club matching. Never use imagery from provider without rights review.

## football-data.org
Free competition coverage: https://www.football-data.org/coverage
Its free tier does not list the Russian Premier League. It does not solve the hockey or basketball calendar requirement.

## Publication requirements
Before enabling import from any third-party source:
1. Confirm licence allows use in a Russian commercial web and Android app.
2. Confirm live coverage of the four target clubs and required leagues, with actual scheduled games.
3. Independently verify home fixture venue in Saint Petersburg, start time and fixture identity.
4. Map to exact official-club ticket allowlist; media leagues use organizer-only info.
5. Keep existing group and participant IDs on sync; do not delete on a missing upstream event.
6. Gate on structured fixtures and server-side validation; avoid public-site scraping without permission.

This branch implements only the safe, read-only coverage probe. No scheduled ingestion is turned on.
