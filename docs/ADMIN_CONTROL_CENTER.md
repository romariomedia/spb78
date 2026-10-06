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
