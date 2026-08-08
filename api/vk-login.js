// Vercel Serverless Function: VK ID -> Firebase Auth.
// Firebase Cloud Functions are NOT used.
// The VK access token is verified server-side with VK ID user_info, then a
// stable Firebase custom token is minted for the existing/new SportBuddy user.

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const VK_USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not configured');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function email(value) {
  const v = text(value, 254).toLowerCase();
  return /^[^\s@]+@[^@\s]+\.[^\s@]{2,}$/.test(v) ? v : '';
}

function fallbackEmail(vkId) {
  return `vk_${vkId}@sportbuddy78.pro`;
}

function canonicalUid(vkId) {
  return `vk_${String(vkId).replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 120);
}

function profileScore(data = {}) {
  const fields = ['bio', 'birthDate', 'locationName', 'avatar', 'photoPortfolio', 'sports',
    'friendIds', 'friendRequestsSent', 'friendRequestsReceived', 'matchIds',
    'totalWorkouts', 'totalDailyMedals', 'rewardItems', 'premiumUntil'];
  return fields.reduce((score, key) => {
    const value = data[key];
    if (Array.isArray(value)) return score + Math.min(value.length, 10);
    if (typeof value === 'string') return score + (value.trim() ? 2 : 0);
    if (typeof value === 'number') return score + (value > 0 ? 2 : 0);
    return score + (value ? 1 : 0);
  }, 0);
}

function mergeProfiles(items) {
  const sorted = [...items].sort((a, b) => profileScore(b.data) - profileScore(a.data));
  const base = { ...(sorted[0]?.data || {}) };
  for (const item of sorted.slice(1)) {
    for (const [key, value] of Object.entries(item.data || {})) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        const current = Array.isArray(base[key]) ? base[key] : [];
        base[key] = [...new Set([...current, ...value])];
      } else if (base[key] === undefined || base[key] === null || base[key] === '') {
        base[key] = value;
      }
    }
  }
  return base;
}

async function migrateReferences(db, oldIds, newId) {
  if (!oldIds.length) return;
  const oldSet = new Set(oldIds);
  const collections = [
    ['trainings', ['participantIds', 'checkedInUserIds', 'ratedParticipantIds', 'organizerRatedByParticipantIds']],
    ['friendRequests', ['fromId', 'toId']],
    ['friendships', ['participantIds']],
    ['chats', ['participantIds']],
    ['feed', ['likes', 'authorId']],
    ['checkins', ['userId']],
    ['goals', ['ownerId']],
    ['ratings', ['organizerId', 'participantId', 'reviewerId', 'targetUserId']],
    ['payments', ['userId']]
  ];

  for (const [collectionName, fields] of collections) {
    const snap = await db.collection(collectionName).limit(500).get();
    if (snap.empty) continue;
    const batch = db.batch();
    let changed = false;
    for (const doc of snap.docs) {
      const data = doc.data();
      const patch = {};
      for (const field of fields) {
        const value = data[field];
        if (typeof value === 'string' && oldSet.has(value)) {
          patch[field] = newId;
        } else if (Array.isArray(value) && value.some((v) => oldSet.has(v))) {
          patch[field] = [...new Set(value.map((v) => oldSet.has(v) ? newId : v))];
        }
      }
      if (Object.keys(patch).length) {
        batch.update(doc.ref, patch);
        changed = true;
      }
    }
    if (changed) await batch.commit();
  }
}

function cors(req, res) {
  const origin = text(req.headers.origin, 300);
  const allowed = new Set([
    'https://sportbuddy78.pro',
    'https://www.sportbuddy78.pro',
    'http://localhost',
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost'
  ]);
  if (allowed.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SportBuddy-Client');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });

  const accessToken = text(req.body?.accessToken, 4096);
  const requestedVkId = text(req.body?.vkUserId, 128);
  if (!accessToken) return res.status(400).json({ error: 'Отсутствует VK access token.' });

  try {
    adminApp();

    // IMPORTANT: VK ID user_info expects client_id + access_token in an
    // x-www-form-urlencoded POST body. Sending the token as a GET header is
    // what caused the recurring "access_token is missing or invalid" error.
    const vkResponse = await fetch(VK_USER_INFO_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: text(process.env.VK_APP_ID || '54699979', 50),
        access_token: accessToken
      }).toString(),
      cache: 'no-store'
    });

    const vkPayload = await vkResponse.json().catch(() => null);
    const vkUser = vkPayload?.user;
    const verifiedVkId = text(vkUser?.user_id ?? vkUser?.id, 128);

    if (!vkResponse.ok || !verifiedVkId) {
      console.error('[vk-login] VK user_info rejected token', {
        status: vkResponse.status,
        payload: vkPayload
      });
      return res.status(401).json({
        error: vkPayload?.error_description || vkPayload?.error || 'VK ID не подтвердил авторизацию. Повторите вход через VK.'
      });
    }

    if (requestedVkId && requestedVkId !== verifiedVkId) {
      return res.status(403).json({ error: 'VK ID пользователя не совпадает с подтверждённым пользователем.' });
    }

    const verifiedEmail = email(vkUser.email) || fallbackEmail(verifiedVkId);
    const verifiedName = `${text(vkUser.first_name, 80)} ${text(vkUser.last_name, 80)}`.trim() || 'Спортсмен VK';
    const verifiedAvatar = text(vkUser.avatar || vkUser.photo_200 || vkUser.photo_100, 2000);

    const db = getFirestore();
    const users = db.collection('users');
    const [vkSnap, emailSnap] = await Promise.all([
      users.where('vkId', '==', verifiedVkId).limit(20).get(),
      users.where('email', '==', verifiedEmail).limit(20).get()
    ]);

    const candidates = new Map();
    [...vkSnap.docs, ...emailSnap.docs].forEach((doc) => {
      candidates.set(doc.id, { ref: doc.ref, data: doc.data() });
    });

    const profileId = candidates.size
      ? [...candidates.values()].sort((a, b) => profileScore(b.data) - profileScore(a.data))[0].ref.id
      : canonicalUid(verifiedVkId);

    const oldIds = [...candidates.keys()].filter((id) => id !== profileId);
    const merged = mergeProfiles([...candidates.values()]);
    const profileRef = users.doc(profileId);
    const profileSnap = await profileRef.get();
    const existed = profileSnap.exists || candidates.size > 0;

    const nextProfile = {
      ...merged,
      id: profileId,
      vkId: verifiedVkId,
      email: verifiedEmail,
      name: merged.name || verifiedName,
      avatar: merged.avatar || verifiedAvatar || '',
      provider: merged.provider === 'email' ? 'email' : 'vk'
    };

    await profileRef.set(nextProfile, { merge: true });

    if (oldIds.length) {
      await migrateReferences(db, oldIds, profileId);
      const batch = db.batch();
      oldIds.forEach((id) => batch.delete(users.doc(id)));
      await batch.commit();
    }

    const firebaseAuth = getAuth();
    try {
      await firebaseAuth.getUser(profileId);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') {
        await firebaseAuth.createUser({
          uid: profileId,
          displayName: verifiedName
        });
      } else {
        throw error;
      }
    }

    const customToken = await firebaseAuth.createCustomToken(profileId, {
      provider: 'vk',
      vkId: verifiedVkId
    });

    return res.status(200).json({
      ok: true,
      customToken,
      uid: profileId,
      vkId: verifiedVkId,
      email: verifiedEmail,
      name: nextProfile.name,
      avatar: nextProfile.avatar,
      isNewAccount: !existed
    });
  } catch (error) {
    console.error('[vk-login] server error', error);
    return res.status(500).json({ error: 'Не удалось завершить авторизацию VK ID на сервере.' });
  }
}
