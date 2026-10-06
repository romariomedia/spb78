import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DEFAULT_APP_CONFIG } from './admin-config.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  try {
    const snap = await getFirestore().collection('appConfig').doc('main').get();
    const data = snap.exists ? snap.data() || {} : {};
    return res.json({
      featureFlags:{...DEFAULT_APP_CONFIG.featureFlags, ...(data.featureFlags || {})},
      product:{...DEFAULT_APP_CONFIG.product, ...(data.product || {})}
    });
  } catch {
    return res.json(DEFAULT_APP_CONFIG);
  }
}
