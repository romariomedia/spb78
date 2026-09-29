// Vercel Serverless: verify VK ID access token and issue the canonical Firebase UID.
// This endpoint replaces the old firebase-functions vkLogin dependency.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeVkEmail, resolveVkIdentity } from '../server/vk-identity.js';

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

    const providerEmail = normalizeVkEmail(vkUser.email);
    const name = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || suppliedName || 'Спортсмен VK';
    const avatar = String(vkUser.avatar || vkUser.photo_200 || suppliedAvatar || '');

    const identityRef = db.collection('vkIdentities').doc(verifiedVkId);
    const mapping = await identityRef.get();
    const vkProfiles = mapping.exists ? [] : await findProfileByVkId(verifiedVkId);
    const { user: firebaseUser, isNewAccount } = await resolveVkIdentity({
      auth: adminAuth, vkId: verifiedVkId,
      mappedUid: mapping.exists ? mapping.data().uid : null,
      profileUids: vkProfiles.map(profile => profile.id), name, avatar
    });
    const email = normalizeVkEmail(firebaseUser.email) || providerEmail;
    const token = await adminAuth.createCustomToken(firebaseUser.uid,{vkId:verifiedVkId,vkVerified:true});
    // Preserve existing private fields; an absent VK email must not erase them.
    await db.collection('usersPrivate').doc(firebaseUser.uid).set({
      uid: firebaseUser.uid, ...(email ? { email } : {})
    }, { merge: true });
    await identityRef.set({uid:firebaseUser.uid,updatedAt:new Date().toISOString()},{merge:true});
    // Never delete profiles or Auth users as a side effect of signing in.

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
