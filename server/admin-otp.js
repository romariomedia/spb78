import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

export const ADMIN_EMAIL = 'support@sportbuddy78.ru';
const OTP_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const keyFor = pepper => createHash('sha256').update(`${ADMIN_EMAIL}:${pepper}`).digest('hex').slice(0,32);
const hashCode = (key,code,pepper) => createHash('sha256').update(`${key}:${code}:${pepper}`).digest('hex');
const millis = value => value?.toMillis?.() ?? 0;
const reply = (status,error) => ({status,payload:{error}});
function sameSecret(a,b) {
  const digest = value => createHash('sha256').update(String(value ?? '')).digest();
  return timingSafeEqual(digest(a),digest(b));
}

export async function reserveAdminOtp(db,{email,password,expectedPassword,pepper},now=Date.now()) {
  const valid = typeof password === 'string' && String(email || '').trim().toLowerCase() === ADMIN_EMAIL
    && Boolean(expectedPassword) && sameSecret(password,expectedPassword);
  // One administrator: an account-level limiter cannot be evaded by spoofing
  // x-forwarded-for or rotating client IP addresses. A valid password may recover
  // access despite a hostile bad-password lockout, but still observes OTP cooldown.
  const limiterRef = db.doc('adminOtpRateLimits/credentials');
  const key = keyFor(pepper), challengeRef = db.doc(`adminOtpChallenges/${key}`);
  const code = String(randomInt(0,10000)).padStart(4,'0');
  const challengeId = randomUUID(), codeHash = hashCode(key,code,pepper);
  return db.runTransaction(async tx => {
    const limiterSnap = await tx.get(limiterRef);
    const limiter = limiterSnap.data() || {};
    if (!valid) {
      if (millis(limiter.lockedUntil)>now) return reply(429,'Too many failed attempts. Try again later.');
      const start = millis(limiter.windowStartedAt);
      const attempts = now-start<WINDOW_MS ? Number(limiter.attempts || 0) : 0;
      const next = attempts+1;
      tx.set(limiterRef,{
        attempts:next,windowStartedAt:Timestamp.fromMillis(attempts ? start : now),
        lockedUntil:Timestamp.fromMillis(next>=MAX_ATTEMPTS ? now+WINDOW_MS : 0),
        updatedAt:Timestamp.fromMillis(now)
      });
      return reply(next>=MAX_ATTEMPTS ? 429 : 403,'Invalid admin credentials or too many attempts.');
    }
    const existing = await tx.get(challengeRef);
    if (existing.exists && now-millis(existing.data().sentAt)<COOLDOWN_MS) {
      return reply(429,'Wait before requesting a new code.');
    }
    const expiresAt = now+OTP_TTL_MS;
    if (limiterSnap.exists) tx.delete(limiterRef);
    tx.set(challengeRef,{
      challengeId,codeHash,attempts:0,sentAt:Timestamp.fromMillis(now),expiresAt:Timestamp.fromMillis(expiresAt)
    });
    // code is returned only to the server mail sender, never to an HTTP client.
    return {status:200,code,key,challengeId,payload:{expiresAt:new Date(expiresAt).toISOString(),retryAfterSeconds:60}};
  });
}

export async function discardFailedOtp(db,key,challengeId) {
  const ref = db.doc(`adminOtpChallenges/${key}`);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    // A delayed mail failure must never remove a newer challenge.
    if (snap.exists && snap.data().challengeId === challengeId) tx.delete(ref);
  });
}

export async function consumeAdminOtp(db,{email,code,pepper},now=Date.now()) {
  if (String(email || '').trim().toLowerCase() !== ADMIN_EMAIL) return reply(403,'Invalid admin credentials.');
  if (!/^\d{4}$/.test(String(code || ''))) return reply(400,'Four digit code required.');
  const key=keyFor(pepper),challengeRef=db.doc(`adminOtpChallenges/${key}`);
  const expected=hashCode(key,code,pepper),sessionId=randomUUID();
  return db.runTransaction(async tx => {
    const snap = await tx.get(challengeRef);
    if (!snap.exists) return reply(404,'Challenge not found.');
    const data=snap.data() || {},attempts=Number(data.attempts || 0);
    if (millis(data.expiresAt)<=now) {
      tx.delete(challengeRef);
      return reply(410,'Challenge expired.');
    }
    if (attempts>=MAX_ATTEMPTS) return reply(429,'Too many attempts. Request a new code.');
    if (!sameSecret(data.codeHash,expected)) {
      tx.update(challengeRef,{attempts:attempts+1});
      // Return, rather than throw: throwing would roll back the attempt counter.
      return reply(attempts+1>=MAX_ATTEMPTS ? 429 : 403,'Invalid code or too many attempts.');
    }
    const sessionExpires=now+SESSION_TTL_MS;
    tx.delete(challengeRef);
    tx.create(db.doc(`adminSessions/${sessionId}`),{
      adminKey:key,email:ADMIN_EMAIL,issuedAt:Timestamp.fromMillis(now),expiresAt:Timestamp.fromMillis(sessionExpires)
    });
    return {status:200,payload:{sessionId,expiresAt:new Date(sessionExpires).toISOString()}};
  });
}
