// Vercel Serverless: verify VK ID access token and issue the canonical Firebase UID.
// This endpoint replaces the old firebase-functions vkLogin dependency.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

const db = getFirestore();
const adminAuth = getAuth();
const VK_WEB_APP_ID = Number(process.env.VK_WEB_APP_ID || 54699979);

async function verifyVK(accessToken) {
  const response = await fetch('https://id.vk.ru/oauth2/user_info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken, client_id: String(VK_WEB_APP_ID) })
  });
  if (!response.ok) throw new Error('VK user_info failed');
  const data = await response.json();
  const user = data.user || data;
  const id = String(user.user_id || user.id || '');
  if (!id) throw new Error('VK user id missing');
  return user;
}

async function findUserByEmail(email) {
  if (!email) return null;
  try { return await adminAuth.getUserByEmail(email); } catch { return null; }
}

async function findProfileByVkId(vkId) {
  if (!vkId) return [];
  const snap = await db.collection('users').where('vkId', '==', vkId).limit(10).get();
  return snap.docs;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { accessToken, vkUserId, name: suppliedName, avatar: suppliedAvatar } = req.body || {};
    if (!accessToken) return res.status(400).json({ error: 'VK access token is required' });

    const vkUser = await verifyVK(accessToken);
    const verifiedVkId = String(vkUser.user_id || vkUser.id || '');
    if (!verifiedVkId || (vkUserId && String(vkUserId) !== verifiedVkId)) return res.status(401).json({ error: 'VK ID не совпадает с подтверждённым пользователем' });

    // Only VK's verified user ID can establish identity. Client-provided
    // email is display-only and must never select another Firebase account.
    const emailFromVk = String(vkUser.email || '').trim().toLowerCase();
    const fallbackEmail = `vk_${verifiedVkId}@sportbuddy78.pro`;
    const name = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || suppliedName || 'Спортсмен VK';
    const avatar = String(vkUser.avatar || vkUser.photo_200 || suppliedAvatar || '');

    const identityRef = db.collection('vkIdentities').doc(verifiedVkId);
    const identitySnap = await identityRef.get();
    const vkProfiles = await findProfileByVkId(verifiedVkId);
    let firebaseUser = identitySnap.exists
      ? await adminAuth.getUser(String(identitySnap.data()?.uid || '')).catch(() => null)
      : null;
    if (!firebaseUser && vkProfiles.length) {
      firebaseUser = await adminAuth.getUser(vkProfiles[0].id).catch(() => null);
    }
    let isNewAccount = false;
    if (!firebaseUser) {
      try {
        firebaseUser = await adminAuth.getUser(`vk_${verifiedVkId}`);
      } catch {
        // Never attach a VK login to an unrelated email/password account.
        // Existing email accounts need an explicit authenticated linking flow.
        let safeEmail = fallbackEmail;
        if (emailFromVk) {
          const existing = await findUserByEmail(emailFromVk);
          if (!existing) safeEmail = emailFromVk;
        }
        firebaseUser = await adminAuth.createUser({
          uid: `vk_${verifiedVkId}`,
          email: safeEmail,
          displayName: name,
          photoURL: avatar || undefined,
          emailVerified: Boolean(emailFromVk && safeEmail === emailFromVk)
        });
        isNewAccount = true;
      }
    }
    const email = String(firebaseUser.email || fallbackEmail);
    const token = await adminAuth.createCustomToken(firebaseUser.uid, {vkId:verifiedVkId,vkVerified:true});
    await db.collection('usersPrivate').doc(firebaseUser.uid).set({uid:firebaseUser.uid,email},{merge:true});
    await identityRef.set({uid:firebaseUser.uid,updatedAt:new Date().toISOString()},{merge:true});
    // Do not delete or merge other accounts during login. Account linking
    // must require explicit proof of control over both identities.

    return res.status(200).json({
      ok: true,
      customToken: token,
      uid: firebaseUser.uid,
      vkId: verifiedVkId,
      email,
      name,
      avatar,
      isNewAccount
    });
  } catch (error) {
    console.error('[vk-login]', error);
    return res.status(401).json({ error: 'Не удалось подтвердить VK ID на сервере' });
  }
}
