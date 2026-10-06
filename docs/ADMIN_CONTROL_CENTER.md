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
