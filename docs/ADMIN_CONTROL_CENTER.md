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


## V2.4 Moderation Center

The Control Center now includes a dedicated moderation workspace for reports, feed posts and profiles.

### Complaints
The previous mail-client-only complaint flow is replaced by a server-backed report:
- the reporter must be authenticated;
- the reported person must be a participant in the reporter's real Firestore chat;
- the chat must contain messages;
- the server, not the client, captures the last five messages for context;
- duplicate reports for the same reporter/target/chat are limited to one per UTC day;
- report states are new, reviewing, resolved and dismissed.

### Feed moderation
Administrators can hide a post with a mandatory reason and later restore it. Hidden posts are removed from the normal app feed and server mutations reject likes/comments against a hidden post. Moderation is reversible; this release deliberately does not hard-delete user content.

### Profile moderation
The profile queue shows verification state, suspension state and report count. Existing server-authoritative verification and reversible account suspension actions are reused rather than duplicated.

Every report-status, post-hide and post-restore action is written to the admin audit trail. User report submission and all moderation mutations remain behind server endpoints; Firestore default-deny rules are unchanged.


## V2.5 Safe user lifecycle

Account deletion is intentionally implemented as a guarded lifecycle operation rather than a direct delete button.

### Dry-run first
The administrator opens a user and runs a server-side dry-run. The server checks Firebase Auth plus all currently known user-linked collections, including payments, payment requests, feed, chats, friendships, friend requests, trainings, leisure events, check-ins, stories, ratings, reports, workout credits, goals, promo codes and push devices.

The preview classifies the account as either:
- `test_candidate`: an empty, unverified, already suspended account with no blocking relationships/content;
- `review_required`: anything that needs manual review.

This classification never deletes anything automatically.

### Hard blockers
Safe deletion is refused when the account:
- is the primary administrator account;
- is verified;
- is not already suspended in both profile state and Firebase Auth;
- has payment or payment-request records;
- has chats, friendships or friend requests;
- has reports or ratings;
- created feed posts, trainings, leisure events or stories;
- participated in trainings/leisure or has check-ins;
- has goals, workout credits or promo codes;
- has a sports history;
- has avatar/portfolio media that would require a separate media-storage cleanup.

This conservative policy is deliberate: data that has legal, financial, social, moderation or cross-user effects is not erased by a generic cleanup action.

### Confirmation and race protection
A successful dry-run creates a short-lived 10-minute preview with:
- a cryptographic fingerprint of the inspected account state;
- a random confirmation code;
- the current admin session identity.

Before executing deletion, the server recalculates the full plan. If any inspected data changed, deletion is refused and a new dry-run is required. The confirmation code must match exactly.

### Deletion scope
Only an eligible empty/test account can be hard-deleted. The operation removes the profile/private/admin documents, technical notification documents, Auth identity and any remaining safe technical/user-owned documents covered by the planner. References in participant/profile arrays are also cleaned defensively.

The final action is written to `adminAuditLogs`. Hard deletion of real or historically active users is intentionally outside this workflow and requires a dedicated retention/anonymization process.


## V2.6 Weekly Product Analytics

The Control Center now has a dedicated **Аналитика** workspace designed for weekly product decisions.

### Metrics
- **Registrations 7d** — current seven Moscow calendar days, compared with the previous seven.
- **DAU** — unique non-excluded authenticated users with an analytics pulse today.
- **WAU** — unique non-excluded authenticated users active during the last seven days.
- **D7 retention** — users registered exactly seven Moscow calendar days ago who are active today, divided by that registration cohort.
- **Average active time** — total visible foreground time divided by active user-days over the last seven days.
- **Average session** — total visible foreground time divided by recorded app sessions.

The dashboard also shows a seven-day DAU/registration trend. Today's values are naturally partial until the day closes.

### Activity collection
The app sends a server-authenticated activity pulse while the authenticated application is visible. Hidden/background time is not counted. The server does not trust a client-provided duration blindly: credited seconds are capped by wall-clock time since the previous accepted pulse and by a maximum pulse size.

Only daily aggregates are stored:
- user id;
- Moscow calendar day;
- active seconds;
- session count;
- first/last activity timestamps;
- bounded per-day session sequence state for retry deduplication.

No viewed screens, message contents, GPS points or typed content are collected by this analytics module.

### Historical honesty
Registration history is computed from the authoritative user registration timestamps. Active-time history begins only when this telemetry ships. The dashboard explicitly reports its tracking start/coverage and never fabricates historical engagement time.

### Test accounts
The primary admin identity and legacy demo profiles are excluded automatically from the dashboard. Other known test accounts can be marked **excluded from product analytics** from the user detail card. This changes analytics only; it does not alter account permissions or product functionality.

The exclusion action is OTP-admin protected and written to the audit trail.
