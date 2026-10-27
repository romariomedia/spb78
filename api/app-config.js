import {androidUpdatePolicy} from '../shared/android-update.js';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {effectiveOperations} from '../shared/operational-policy.js';
import { DEFAULT_APP_CONFIG } from './admin-config.js';
import {publicApkRelease} from '../server/apk-release.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}

export default async function handler(req,res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','private, no-store');
  try {
    const db=getFirestore();
    const [snap,apkSnap]=await Promise.all([
      db.collection('appConfig').doc('main').get(),
      db.collection('apkConfig').doc('main').get()
    ]);
    const data = snap.exists ? snap.data() || {} : {};
    const androidDownload=apkSnap.exists
      ? publicApkRelease({id:apkSnap.data()?.activeReleaseId,...apkSnap.data()})
      : {id:'',versionName:'31',versionCode:0,fileName:'sportbuddy78-rustore-v31.apk',fileSize:20811542,sha256:'',releaseNotes:'',createdAt:'',createdBy:'',publishedAt:'',publishedBy:''};
    return res.json({
      ...effectiveOperations(data),
      product:{...DEFAULT_APP_CONFIG.product, ...(data.product || {}),premiumFreeUntil:'2026-12-31',boxLaunchAt:'2027-01-01',...androidUpdatePolicy(data.product)},
      androidDownload
    });
  } catch {
    return res.status(503).json({error:'Configuration unavailable.'});
  }
}
