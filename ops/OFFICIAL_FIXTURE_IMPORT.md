# Official fixture importer — deployment gate

Only connect permissioned machine-readable JSON feeds supplied by clubs/organizers. An official public webpage does not automatically constitute a permitted API feed. DO NOT install cron before feed access is confirmed.

Config: /etc/sportbuddy/official-feeds.json (outside git).

Example (PLACEHOLDER URL, DOES NOT EXIST):
```json
[{"id":"bc-zenit","clubId":"bc-zenit","url":"https://bc-zenit.com/REPLACE_WITH_PERMITTED_JSON_FEED"}]
```

Each configured endpoint must return application/json with events array (max 300):
```json
{"events":[{"id":"stable-fixture-id","title":"Match","venue":"Arena","address":"Saint Petersburg","lat":59.9,"lng":30.2,"start":"2026-11-01T19:30:00+03:00","sourceUrl":"https://bc-zenit.com/match/123","ticketUrl":"https://bc-zenit.com/tickets/games/123"}]}
```

Media sources need kind=media and allowedHosts restricted to the verified organizer hostname. Media fixtures supply organizerUrl, not ticketUrl. Unknown redirects are blocked. Missing feeds cause sync failure, not fabricated matches.

Run after verification: node ops/sync-official-fixtures.mjs with FIREBASE_SERVICE_ACCOUNT_KEY and SB_OFFICIAL_FEEDS_FILE in its environment (never print secrets).

After successful supervised tests only, install 6-hourly cron via a protected wrapper run by a least-privilege service account.

IDs are stable by feed id + fixture id; participant IDs survive update. adminHidden=true remains draft. Missing feed records are retained; cancelled=true marks one fixture finished.

Ticket landing pages are official club pages, not a promise that tickets for a particular fixture are on sale.

Do not activate production release until npm test, npm run build, and a dry-run with authorized live feeds are verified.