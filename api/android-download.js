import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {apkStorageRoot,publicApkRelease,safeApkStorageName,storedApkPath} from '../server/apk-release.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}
const FALLBACK='/downloads/sportbuddy78-rustore-v31.apk';

export default async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','private, no-store');
  try{
    const snap=await getFirestore().collection('apkConfig').doc('main').get();
    if(!snap.exists)return res.redirect(302,FALLBACK);
    const value=snap.data()||{},storageName=safeApkStorageName(value.storageName);
    if(!storageName)return res.redirect(302,FALLBACK);
    const path=storedApkPath(storageName,apkStorageRoot());
    const info=await stat(path);
    if(!info.isFile()||info.size!==Number(value.fileSize||0))return res.redirect(302,FALLBACK);

    const meta=publicApkRelease({id:value.activeReleaseId,...value});
    res.setHeader('Content-Type','application/vnd.android.package-archive');
    res.setHeader('Content-Length',String(info.size));
    res.setHeader('Content-Disposition',`attachment; filename="${meta.fileName.replace(/[^a-zA-Z0-9._-]/g,'_')||'sportbuddy78.apk'}"`);
    res.setHeader('X-SportBuddy-Apk-Version',meta.versionName||'');
    res.setHeader('X-SportBuddy-Apk-Version-Code',String(meta.versionCode||''));
    if(meta.sha256)res.setHeader('ETag',`"${meta.sha256}"`);
    if(req.method==='HEAD')return res.status(200).end();
    const stream=createReadStream(path);
    stream.on('error',error=>{
      console.error('[android-download] stream failed',error?.message||'stream error');
      if(!res.headersSent)res.status(503).end();
      else res.destroy(error);
    });
    return stream.pipe(res);
  }catch(error){
    if(error?.code==='ENOENT')return res.redirect(302,FALLBACK);
    console.error('[android-download]',error?.message||error);
    return res.redirect(302,FALLBACK);
  }
}
