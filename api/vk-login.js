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

async function findProfileByEmail(email) {
  if (!email) return [];
  const snap = await db.collection('usersPrivate').where('email', '==', email).get();
  return snap.docs;
}

async function findProfileByVkId(vkId) {
  if (!vkId) return [];
  const snap = await db.collection('users').where('vkId', '==', vkId).limit(10).get();
  return snap.docs;
}

async function mergeDuplicates(email, canonicalUid) {
  const docs = await findProfileByEmail(email);
  const duplicates = docs.filter(d => d.id !== canonicalUid);
  if (!duplicates.length) return;
  const canonicalRef = db.collection('users').doc(canonicalUid);
  const canonicalPrivateRef = db.collection('usersPrivate').doc(canonicalUid);
  const canonicalSnap = await canonicalRef.get();
  const canonical = canonicalSnap.exists ? canonicalSnap.data() : {};
  const merged = { ...canonical };
  const privateKeys = new Set(['email','phone','birthDate','hideBirthDate','hidePhone','deviceId']);
  for (const duplicate of duplicates) {
    const data = duplicate.data();
    for (const [key, value] of Object.entries(data)) {
      if (privateKeys.has(key)) continue;
      if (merged[key] === undefined || merged[key] === '' || merged[key] === null || (Array.isArray(merged[key]) && merged[key].length === 0)) merged[key] = value;
    }
    const duplicateUserRef = db.collection('users').doc(duplicate.id);
    const duplicatePrivateRef = db.collection('usersPrivate').doc(duplicate.id);
    await duplicateUserRef.delete().catch(() => {});
    await duplicatePrivateRef.delete().catch(() => {});
    await duplicate.ref.delete().catch(() => {});
    await adminAuth.deleteUser(duplicate.id).catch(() => {});
  }
  await canonicalRef.set(merged, { merge: true });
  await canonicalPrivateRef.set({uid:canonicalUid,email},{merge:true});
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { accessToken, vkUserId, email: suppliedEmail, name: suppliedName, avatar: suppliedAvatar } = req.body || {};
    if (!accessToken) return res.status(400).json({ error: 'VK access token is required' });

    const vkUser = await verifyVK(accessToken);
    const verifiedVkId = String(vkUser.user_id || vkUser.id || '');
    if (!verifiedVkId || (vkUserId && String(vkUserId) !== verifiedVkId)) return res.status(401).json({ error: 'VK ID не совпадает с подтверждённым пользователем' });

    const email = String(vkUser.email || suppliedEmail || `vk_${verifiedVkId}@sportbuddy78.pro`).trim().toLowerCase();
    const name = `${vkUser.first_name || ''} ${vkUser.last_name || ''}`.trim() || suppliedName || 'Спортсмен VK';
    const avatar = String(vkUser.avatar || vkUser.photo_200 || suppliedAvatar || '');

    const vkProfiles = await findProfileByVkId(verifiedVkId);
    let firebaseUser = vkProfiles[0] ? await adminAuth.getUser(vkProfiles[0].id).catch(() => null) : null;
    if (!firebaseUser) firebaseUser = await findUserByEmail(email);
    let isNewAccount = false;
    if (!firebaseUser) {
      try { firebaseUser = await adminAuth.getUser(`vk_${verifiedVkId}`); }
      catch { firebaseUser = await adminAuth.createUser({ uid:`vk_${verifiedVkId}`, email, displayName:name, photoURL:avatar||undefined, emailVerified:true }); isNewAccount = true; }
    }
    const token = await adminAuth.createCustomToken(firebaseUser.uid,{vkId:verifiedVkId,vkVerified:true});
    await db.collection('usersPrivate').doc(firebaseUser.uid).set({uid:firebaseUser.uid,email},{merge:true});
    await db.collection('vkIdentities').doc(verifiedVkId).set({uid:firebaseUser.uid,updatedAt:new Date().toISOString()},{merge:true});
    await mergeDuplicates(email,firebaseUser.uid);
    for (const duplicate of vkProfiles) if (duplicate.id !== firebaseUser.uid) await duplicate.ref.delete();

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
