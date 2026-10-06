# SportBuddy78 Control Center

## V1 scope

The first Control Center release keeps the existing OTP-protected admin entry point and adds a server-backed dashboard, revocable admin sessions and an audit trail for admin mutations. Existing Events and Places editors remain available while their server contracts are hardened.

### Security
- Production requires ADMIN_ACCESS_PASSWORD and ADMIN_OTP_PEPPER. There is no development-pepper fallback in production handlers.
- Admin sessions live in Firestore and may be revoked explicitly.
- Mutations validate the server-side session, not only client state.
- Administrative changes are appended to adminAuditLogs.

### Dashboard
POST /api/admin-dashboard requires an admin session and returns aggregate counts plus a small recent-registration list. It does not return private user fields.

### Next modules
V2: users, verification and moderation.
V3: notifications, Premium/promos, feature flags and system health.


## V2 management foundation

The Control Center now includes a separate **Управление** workspace.

### Users
- Lists up to 150 current accounts with name, UID/email, district, verification and Premium expiry.
- Admin can confirm or revoke profile verification.
- Admin can set or clear `premiumUntil`.
- Every change is server-authoritative and written to `adminAuditLogs`.

### Feature flags
The central `appConfig/main` document now stores flags for Active Leisure, Dating, Push, Stories, Sport Passport and SportBuddy BOX. Current released features keep their existing behavior unless explicitly wired to a flag; future modules should read this config rather than introduce new hard-coded switches.

### Product settings
The admin can edit the Free dating limit and rolling-window duration. These two values are already enforced by `/api/sportbuddy-mutation`, so changing them in Control Center does not require a deploy.

The same config also stores the end of the free-Premium campaign, BOX launch date, minimum Android version, RuStore URL and maintenance metadata. These values are exposed through `GET /api/app-config` for progressive wiring into client surfaces without changing the storage contract.

### Safety
- Existing Overview, Places, Active Leisure, Events and Audit modules are unchanged.
- New admin writes require the existing revocable OTP session.
- No client gets direct write access to `users` or `appConfig`.
- Configuration and user mutations are audited.


## V2.1 user moderation

User administration now has a read-only detail view plus reversible account suspension.

### Detail view
The admin can inspect operational profile facts needed for support and moderation: verification, registration, last activity, district, sports, workouts, medals, friends, matches and public bio. Exact location, phone and birth date are intentionally not exposed in the Control Center view.

### Suspension
Suspension is intentionally reversible and requires a reason. It:
- disables the Firebase Auth account;
- marks the public profile as suspended and removes it from discovery;
- sets activeLooking=false while remembering the prior value for restoration;
- blocks server-side mutations, feed publishing, Active Leisure, Stories, notifications, verification and payment creation;
- shows the suspended user a dedicated support screen if an already-issued session is still active;
- writes the action, actor and reason to the existing admin audit trail.

Hard deletion is deliberately not part of this release. Deletion touches authentication, chats, friendships, posts, trainings and other linked records and should ship as a separate lifecycle module with explicit eligibility checks and a dry-run preview rather than as a one-click admin action.


## V2.2 Push Center

The Control Center now has a dedicated Push workspace built on the existing durable Firestore notification queue and FCM worker.

### Safe campaign workflow
1. Compose title, body and an internal SportBuddy hash route.
2. Select an audience: all eligible profiles, exact UID, district, sport, verified users and/or users active in the last 30 days.
3. Run a server-side audience preview. Suspended accounts are always excluded.
4. Review exact recipient count and a small sample.
5. Confirm using the short-lived preview token. A preview can be consumed only once.
6. The server creates a durable campaign and queue job. Optional scheduling is supported up to 30 days ahead.

User notification preferences and quiet hours remain authoritative. Push Center does not bypass them.

### History and scheduling
Campaign history stores creator, audience, planned time, processed recipient count and state: scheduled, queued, processing, retrying, completed, failed, expired or cancelled. A future scheduled campaign can be cancelled before processing begins.

The UI deliberately says "processed", not "delivered": an FCM provider acceptance is not proof that an operating system displayed a notification.

### Safety limits
- external URLs are rejected; campaigns may open only internal hash routes;
- title/body use the same server size limits as the notification queue;
- audience preview is capped at 10,000 scanned profiles and asks the administrator to narrow filters beyond that point;
- campaign confirmation expires after 10 minutes;
- account suspension always excludes the user from new admin campaigns;
- every send/cancel action is recorded in the admin audit log.


## V2.3 Desktop Control Center and announcements

The administrator workspace is now adaptive rather than mobile-width-first. The regular application modal sizes are unchanged; only the Control Center uses the new wide admin modal (up to 1480px) with larger desktop working space. Navigation stays horizontally scrollable on phones and becomes an eight-column control bar on large screens. Dashboard metrics, user cards and push history expand into desktop grids, while mobile layouts remain single-column where appropriate.

### Banners and system announcements
A dedicated **Объявления** workspace manages in-app communication without a deploy:
- title and message;
- optional image uploaded through the existing media pipeline;
- optional internal action button;
- placement: global, Dating, Trainings, Active Leisure, Feed or Profile;
- audience: everyone, verified profiles, one district or one sport;
- start/end schedule;
- priority;
- active/inactive status;
- dismissible/non-dismissible behavior;
- responsive live preview.

Only internal SportBuddy hash destinations are accepted. District audience values are validated against the shared district dictionary. Every create, update and delete is OTP-session protected and appended to the admin audit log.

The user endpoint requires a valid Firebase identity and filters active announcements server-side against the user's actual verification, district and sports fields. Direct Firestore access to the announcements collection remains denied by the existing default-deny rules.
