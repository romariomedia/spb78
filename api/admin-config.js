import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {effectiveOperations} from '../shared/operational-policy.js';
import {invalidateOperationalConfig} from '../server/operational-config.js';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export const DEFAULT_APP_CONFIG = {
  featureFlags: {
    activeLeisureEnabled: true,
    datingEnabled: true,
    pushEnabled: true,
    storiesEnabled: true,
    sportPassportEnabled: true,
    boxEnabled: true
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
function sanitizeProduct(value = {}) {
  return {
    freeMatches:integer(value.freeMatches, 0, 100, DEFAULT_APP_CONFIG.product.freeMatches),
    matchWindowDays:integer(value.matchWindowDays, 1, 365, DEFAULT_APP_CONFIG.product.matchWindowDays),
    premiumFreeUntil:DEFAULT_APP_CONFIG.product.premiumFreeUntil,
    boxLaunchAt:DEFAULT_APP_CONFIG.product.boxLaunchAt,
    minimumAndroidVersion:'',
    ruStoreUrl:'',
    maintenanceMode:bool(value.maintenanceMode),
    maintenanceMessage:text(value.maintenanceMessage, 300) || DEFAULT_APP_CONFIG.product.maintenanceMessage
  };
}
function mergeConfig(data = {}) {
  return {
    featureFlags:effectiveOperations(data).featureFlags,
    product:{...DEFAULT_APP_CONFIG.product, ...(data.product || {}), premiumFreeUntil:'2026-12-31',boxLaunchAt:'2027-01-01',minimumAndroidVersion:'',ruStoreUrl:'',maintenanceMode:effectiveOperations(data).maintenanceMode}
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

    if(!['saveFeatureFlags','saveProductSettings'].includes(operation))return res.status(400).json({error:'Unknown operation.'});
    const next=await db.runTransaction(async batch=>{
    const fresh=await batch.get(ref);
    const current=mergeConfig(fresh.exists?fresh.data():{});
    let next;
    if (operation === 'saveFeatureFlags') {
      next = { ...current, featureFlags:sanitizeFeatureFlags(body.featureFlags || {}) };
    } else if (operation === 'saveProductSettings') {
      next = { ...current, product:sanitizeProduct(body.product || {}) };
    } else {
      return res.status(400).json({error:'Unknown operation.'});
    }

    const after = { ...next, operationsVersion:1, updatedAt:new Date().toISOString(), updatedBy:String(session.email || 'admin') };
    batch.set(ref,after,{merge:false});
    await writeAdminAudit(db, session, {
      action:operation === 'saveFeatureFlags' ? 'config.flags.update' : 'config.product.update',
      entityType:'appConfig',
      entityId:'main',
      before:current,
      after:next,
      requestId:String(body.requestId || '')
    },batch);
    return next;
    });
    invalidateOperationalConfig();
    return res.json({ ok:true, config:next });
  } catch (error) {
    const status = Number(error?.status || 500);
    if (status === 500) console.error('[admin-config]', error);
    return res.status(status).json({error:status === 500 ? 'Configuration update failed.' : error.message});
  }
}
