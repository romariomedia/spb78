import { randomUUID } from 'node:crypto';

export async function requireAdminSession(db, sessionId) {
  if (!sessionId) throw Object.assign(new Error('Session required.'), { status: 401 });
  const ref = db.doc(`adminSessions/${sessionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw Object.assign(new Error('Session not found.'), { status: 401 });
  const data = snap.data() || {};
  const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
  if (expiresAt <= Date.now()) {
    await ref.delete().catch(() => undefined);
    throw Object.assign(new Error('Session expired.'), { status: 401 });
  }
  return { sessionId, ref, ...data, expiresAt };
}

function compactSnapshot(value) {
  if (!value || typeof value !== 'object') return null;
  const json = JSON.stringify(value);
  if (json.length <= 12000) return value;
  return { truncated: true, bytes: json.length };
}

export async function writeAdminAudit(db, session, {
  action, entityType, entityId = '', before = null, after = null, requestId = ''
}) {
  const id = randomUUID();
  await db.collection('adminAuditLogs').doc(id).set({
    id,
    adminEmail: String(session?.email || 'admin'),
    adminKey: String(session?.adminKey || ''),
    action: String(action || 'unknown').slice(0, 120),
    entityType: String(entityType || 'unknown').slice(0, 80),
    entityId: String(entityId || '').slice(0, 180),
    before: compactSnapshot(before),
    after: compactSnapshot(after),
    requestId: String(requestId || '').slice(0, 180),
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now()
  });
}

export function requireProductionAdminSecrets() {
  if (!process.env.ADMIN_ACCESS_PASSWORD) {
    throw Object.assign(new Error('Admin access is not configured.'), { status: 503 });
  }
  if (!process.env.ADMIN_OTP_PEPPER || process.env.ADMIN_OTP_PEPPER === 'dev-pepper') {
    throw Object.assign(new Error('Admin OTP security is not configured.'), { status: 503 });
  }
}
