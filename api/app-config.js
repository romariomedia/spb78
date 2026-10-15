import {androidUpdatePolicy} from '../shared/android-update.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {effectiveOperations} from '../shared/operational-policy.js';
import { DEFAULT_APP_CONFIG } from './admin-config.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','private, no-store');
  try {
    const snap = await getFirestore().collection('appConfig').doc('main').get();
    const data = snap.exists ? snap.data() || {} : {};
    return res.json({
      ...effectiveOperations(data),
      product:{...DEFAULT_APP_CONFIG.product, ...(data.product || {}),premiumFreeUntil:'2026-12-31',boxLaunchAt:'2027-01-01',...androidUpdatePolicy(data.product)}
    });
  } catch {
    return res.status(503).json({error:'Configuration unavailable.'});
  }
}
