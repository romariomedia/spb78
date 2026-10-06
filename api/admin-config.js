import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export const DEFAULT_APP_CONFIG = {
  featureFlags: {
    activeLeisureEnabled: true,
    datingEnabled: true,
    pushEnabled: true,
    storiesEnabled: false,
    sportPassportEnabled: false,
    boxEnabled: false
  },
  product: {
    freeMatches: 5,
    matchWindowDays: 7,
    premiumFreeUntil: '2026-12-31',
    boxLaunchAt: '2027-01-01',
    minimumAndroidVersion: '',
    ruStoreUrl: '',
    maintenanceMode: false,
    maintenanceMessage: 'SportBuddy78 временно на техническом обслуживании.'
  }
};

const bool = value => value === true;
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const integer = (value, min, max, fallback) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
function sanitizeFeatureFlags(value = {}) {
  return {
    activeLeisureEnabled:bool(value.activeLeisureEnabled),
    datingEnabled:bool(value.datingEnabled),
    pushEnabled:bool(value.pushEnabled),
    storiesEnabled:bool(value.storiesEnabled),
    sportPassportEnabled:bool(value.sportPassportEnabled),
    boxEnabled:bool(value.boxEnabled)
  };
}
function dateOnly(value, fallback) {
  const v = text(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback;
}
function sanitizeProduct(value = {}) {
  return {
    freeMatches:integer(value.freeMatches, 0, 100, DEFAULT_APP_CONFIG.product.freeMatches),
    matchWindowDays:integer(value.matchWindowDays, 1, 365, DEFAULT_APP_CONFIG.product.matchWindowDays),
    premiumFreeUntil:dateOnly(value.premiumFreeUntil, DEFAULT_APP_CONFIG.product.premiumFreeUntil),
    boxLaunchAt:dateOnly(value.boxLaunchAt, DEFAULT_APP_CONFIG.product.boxLaunchAt),
    minimumAndroidVersion:text(value.minimumAndroidVersion, 40),
    ruStoreUrl:text(value.ruStoreUrl, 1000),
    maintenanceMode:bool(value.maintenanceMode),
    maintenanceMessage:text(value.maintenanceMessage, 300) || DEFAULT_APP_CONFIG.product.maintenanceMessage
  };
}
function mergeConfig(data = {}) {
  return {
    featureFlags:{...DEFAULT_APP_CONFIG.featureFlags, ...(data.featureFlags || {})},
    product:{...DEFAULT_APP_CONFIG.product, ...(data.product || {})}
  };
}

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const db = getFirestore();
  const body = req.body || {};
  try {
    const session = await requireAdminSession(db, body.sessionId);
    const ref = db.collection('appConfig').doc('main');
    const snap = await ref.get();
    const current = mergeConfig(snap.exists ? snap.data() : {});
    const operation = String(body.operation || 'get');
    if (operation === 'get') return res.json({ config:current });

    let next;
    if (operation === 'saveFeatureFlags') {
      next = { ...current, featureFlags:sanitizeFeatureFlags(body.featureFlags || {}) };
    } else if (operation === 'saveProductSettings') {
      next = { ...current, product:sanitizeProduct(body.product || {}) };
    } else {
      return res.status(400).json({error:'Unknown operation.'});
    }

    const after = { ...next, updatedAt:new Date().toISOString(), updatedBy:String(session.email || 'admin') };
    await ref.set(after, { merge:false });
    await writeAdminAudit(db, session, {
      action:operation === 'saveFeatureFlags' ? 'config.flags.update' : 'config.product.update',
      entityType:'appConfig',
      entityId:'main',
      before:current,
      after:next,
      requestId:String(body.requestId || '')
    });
    return res.json({ ok:true, config:next });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status === 500) console.error('[admin-config]', error);
    return res.status(status).json({error:status === 500 ? 'Configuration update failed.' : error.message});
  }
}
