# Official calendar integration: four-club onboarding

Existing production module: shared/official-ticket-policy.js, server/official-fixture-import.js and ops/sync-official-fixtures.mjs.

This catalog identifies official club sites for human review and trusted ticket navigation; it does not imply a working automatic schedule feed.

| ID | Club | Official site | Ticket site | Feed state |
| --- | --- | --- | --- | --- |
| fc-zenit | FC Zenit | https://fc-zenit.ru/ | https://tickets.fc-zenit.ru/ | not connected |
| bc-zenit | BC Zenit | https://bc-zenit.com/ | https://bc-zenit.com/tickets | not connected |
| ska | SKA | https://www.ska.ru/ | https://tickets.ska.ru/ | not connected |
| dragons | Shanghai Dragons | https://hc-dragons.com/calendar/ | https://tickets.hc-dragons.com/ | not connected |

Action for each club:
1. Obtain a written permission or official published conditions for an RSS/ICS/JSON/XML or partner API feed. Obtain schema docs, access credentials (if needed), usage limits and legal terms. Never add a guessed endpoint.
2. Confirm home fixtures within St Petersburg, stable external fixture IDs, Moscow-local kickoff date/time, arena and cancellation updates.
3. If feed format is not JSON, write a reviewed adapter to normalized JSON with documented rights and test fixtures. Do not run HTML scraping without permission.
4. Verify official ticket landing pages and redirects, and keep the ticket-domain allowlist exact. Use official ticket landing page if an event-specific official URL is unavailable; do not assert tickets are already for sale.
5. Add the feed to /etc/sportbuddy/official-feeds.json on the VPS. Never commit credentials or internal feed URLs.
6. Run importer under a limited service account with an initial manual supervised sync, check output and Firestore for duplicates and preserved participant IDs.
7. Enable 6-hour recurring sync only after all checks pass. One failed feed should produce an actionable alert; never invent fixtures.
8. Keep mediacompetitions as organizer-info links only, with no ticket sales label.

Engineering follow-up before general release:
- Admin view of sync diagnostics (per source, last successful sync, failures, upcoming count).
- Disable/enable each importer independently via admin-owned config.
- Verify source venue location before publication.
- Improve cancellation/archival semantics and rollback support.
- Direct official match URL should be visible separately from the authorized ticket URL.
