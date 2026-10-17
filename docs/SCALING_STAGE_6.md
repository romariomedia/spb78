# Stage 6 — deferred feed refresh

Application hydration and training deep links call loadAppData({deferFeed:true}).
They retain same-account cached posts but make no feed-list request and do not
report a feed failure for a deliberately deferred section.

useDeferredFeed loads when the Feed tab is ready, online and visible. Changes
received while offscreen only advance a local invalidation counter. Opening the
tab or returning to the visible document fetches authoritative posts. A 300ms
window collapses bursts before starting a request. Existing in-flight transport
requests are not aborted; their UI results are ignored after cleanup/account change.

Strict feed refresh errors are displayed locally with Retry. Existing posts stay
visible on failure; an empty-list invitation is suppressed during loading/failure.
Full refresh continues to refresh other app sections and invalidates Feed separately.

## Verification

- Controlled hook lifecycle: offscreen burst, foreground return, cancelled late
  response, error preservation and retry.
- Repository regression: deferred startup makes zero feed API calls; strict errors
  are not silently converted into a successful empty feed.
- Full tests, TypeScript and production build; GitHub quality gate.
- Manual device checks: start in Profile/Discover, open Feed, change tabs during
  loading, return after another account posts, retry after network loss.

## Scope and remaining work

This is deferred loading, NOT chronological pagination. Existing feed-list uses
ID order for legacy compatibility; the client still retrieves all pages and sorts
by createdAt when Feed is opened. Simple first-page truncation would hide newer
posts. A subsequent change needs a canonical sortable date, legacy migration and
stable cursor before client history can be paginated safely.

No capacity/load-test claims. Server API remains compatible with older APKs.
Rebuild the signed APK with a higher version_code to enable this client change.
