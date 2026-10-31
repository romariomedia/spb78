import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {rm} from 'node:fs/promises';
import {
  assertApkIdentity,assertTrustedApkSigning,inspectApkFile,sha256File
} from '../server/apk-inspection.js';
import {
  APK_CHUNK_BYTES,appendApkChunk,apkStorageRoot,cleanupOldApkStaging,createApkUpload,
  finalizeApkUpload,publicApkRelease,safeApkStorageName,storedApkPath,validateApkReleaseInput,verifyStoredApk
} from '../server/apk-release.js';
import {requireAdminSession,writeAdminAudit} from '../server/admin-control.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}
const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const adminRelease=value=>({
  ...publicApkRelease(value),
  packageName:clean(value.packageName,180),
  manifestVersionName:clean(value.manifestVersionName,60),
  manifestVersionCode:Number(value.manifestVersionCode||0),
  signatureScheme:clean(value.signatureScheme,30),
  signingCertSha256:clean(value.signingCertSha256,64),
  signatureTrusted:value.signatureTrusted===true
});

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'get');

    if(operation==='get'){
      await cleanupOldApkStaging().catch(()=>{});
      const [releasesSnap,configSnap]=await Promise.all([
        db.collection('apkReleases').limit(100).get(),
        db.collection('apkConfig').doc('main').get()
      ]);
      const activeId=configSnap.exists?String(configSnap.data()?.activeReleaseId||''):'';
      const releases=releasesSnap.docs.map(doc=>{
        const value=doc.data()||{};
        return {...adminRelease({id:doc.id,...value}),active:doc.id===activeId};
      }).sort((a,b)=>Date.parse(b.createdAt||'')-Date.parse(a.createdAt||''));
      const active=releases.find(item=>item.active)||null;
      return res.json({active,releases,chunkSize:APK_CHUNK_BYTES,storageRootConfigured:Boolean(process.env.SB_APK_STORAGE_ROOT)});
    }

    if(operation==='initUpload'){
      const input=validateApkReleaseInput({
        versionName:body.versionName,versionCode:body.versionCode,fileName:body.fileName,
        fileSize:body.fileSize,sha256:body.sha256,releaseNotes:body.releaseNotes
      });
      const duplicate=await db.collection('apkReleases').where('versionCode','==',input.versionCode).limit(1).get();
      if(!duplicate.empty)return res.status(409).json({code:'APK_VERSION_CODE_EXISTS',error:'Этот Android versionCode уже загружен. Для новой сборки используйте новый versionCode.'});
      const upload=await createApkUpload(input,session.email||'admin');
      return res.json({ok:true,uploadId:upload.id,chunkSize:APK_CHUNK_BYTES});
    }

    if(operation==='uploadChunk'){
      const result=await appendApkChunk(
        String(body.uploadId||''),Number(body.index),String(body.data||''),session.email||'admin'
      );
      return res.json({ok:true,...result});
    }

    if(operation==='finalizeUpload'){
      const finalized=await finalizeApkUpload(String(body.uploadId||''),session.email||'admin');
      const releaseId=finalized.id;
      let inspection;
      try{
        inspection=await inspectApkFile(storedApkPath(finalized.storageName,apkStorageRoot()));
        assertApkIdentity(inspection,finalized);
      }catch(error){
        await rm(storedApkPath(finalized.storageName,apkStorageRoot()),{force:true}).catch(()=>{});
        throw error;
      }
      const release={
        versionName:finalized.versionName,versionCode:finalized.versionCode,
        fileName:`sportbuddy78-v${finalized.versionName}.apk`,
        fileSize:finalized.fileSize,sha256:finalized.sha256,releaseNotes:finalized.releaseNotes,
        storageName:finalized.storageName,createdAt:finalized.createdAt,createdBy:finalized.createdBy,
        finalizedAt:finalized.finalizedAt,
        packageName:inspection.packageName,
        manifestVersionName:inspection.versionName,
        manifestVersionCode:inspection.versionCode,
        signatureScheme:inspection.signatureScheme,
        signingCertSha256:inspection.signingCertSha256
      };
      try{
        await db.runTransaction(async tx=>{
          const ref=db.collection('apkReleases').doc(releaseId);
          const snap=await tx.get(ref);
          if(snap.exists)throw Object.assign(new Error('Такая APK-версия уже сохранена.'),{status:409});
          tx.create(ref,release);
          await writeAdminAudit(db,session,{
            action:'apk.release.upload',entityType:'apkRelease',entityId:releaseId,before:null,after:publicApkRelease({id:releaseId,...release}),
            requestId:String(body.requestId||'')
          },tx);
        });
      }catch(error){
        await rm(storedApkPath(release.storageName,apkStorageRoot()),{force:true}).catch(()=>{});
        throw error;
      }
      return res.json({ok:true,release:{...adminRelease({id:releaseId,...release}),active:false}});
    }

    if(operation==='publish'){
      const releaseId=clean(body.releaseId,120);
      if(!releaseId||releaseId.includes('/'))return res.status(400).json({error:'Некорректный релиз'});
      const releaseRef=db.collection('apkReleases').doc(releaseId);
      const releaseSnap=await releaseRef.get();
      if(!releaseSnap.exists)return res.status(404).json({error:'APK-релиз не найден'});
      const release=releaseSnap.data()||{};
      if(!safeApkStorageName(release.storageName)||!await verifyStoredApk(release.storageName,release.fileSize))
        return res.status(409).json({code:'APK_FILE_MISSING',error:'Файл APK отсутствует или повреждён. Опубликовать его нельзя.'});
      const apkPath=storedApkPath(release.storageName,apkStorageRoot());
      const actualSha256=await sha256File(apkPath);
      if(actualSha256!==String(release.sha256||'').toLowerCase())
        return res.status(409).json({code:'APK_HASH_MISMATCH',error:'SHA-256 сохранённого APK изменился. Публикация заблокирована.'});
      const inspection=await inspectApkFile(apkPath);
      assertApkIdentity(inspection,release);
      await assertTrustedApkSigning(inspection);
      const now=new Date().toISOString(),configRef=db.collection('apkConfig').doc('main');
      let active;
      await db.runTransaction(async tx=>{
        const current=await tx.get(configRef);
        const before=current.exists?current.data()||{}:{};
        active={
          activeReleaseId:releaseId,
          versionName:String(release.versionName||''),
          versionCode:Number(release.versionCode||0),
          fileName:String(release.fileName||'sportbuddy78.apk'),
          fileSize:Number(release.fileSize||0),
          sha256:String(release.sha256||''),
          releaseNotes:String(release.releaseNotes||''),
          storageName:String(release.storageName||''),
          publishedAt:now,
          publishedBy:String(session.email||'admin')
        };
        tx.set(configRef,active,{merge:false});
        tx.set(releaseRef,{
          publishedAt:now,publishedBy:String(session.email||'admin'),
          packageName:inspection.packageName,manifestVersionName:inspection.versionName,
          manifestVersionCode:inspection.versionCode,signatureScheme:inspection.signatureScheme,
          signingCertSha256:inspection.signingCertSha256,signatureTrusted:true
        },{merge:true});
        await writeAdminAudit(db,session,{
          action:'apk.release.publish',entityType:'apkRelease',entityId:releaseId,
          before:before.activeReleaseId?{activeReleaseId:before.activeReleaseId,versionName:before.versionName,versionCode:before.versionCode}:null,
          after:publicApkRelease({id:releaseId,...release,...active}),requestId:String(body.requestId||'')
        },tx);
      });
      return res.json({ok:true,active:adminRelease({id:releaseId,...release,...active,...inspection,manifestVersionName:inspection.versionName,manifestVersionCode:inspection.versionCode,signatureTrusted:true})});
    }

    if(operation==='delete'){
      const releaseId=clean(body.releaseId,120);
      if(!releaseId||releaseId.includes('/'))return res.status(400).json({error:'Некорректный релиз'});
      const releaseRef=db.collection('apkReleases').doc(releaseId),configRef=db.collection('apkConfig').doc('main');
      let storageName='';
      await db.runTransaction(async tx=>{
        const [releaseSnap,configSnap]=await Promise.all([tx.get(releaseRef),tx.get(configRef)]);
        if(!releaseSnap.exists)throw Object.assign(new Error('APK-релиз не найден'),{status:404});
        if(configSnap.exists&&String(configSnap.data()?.activeReleaseId||'')===releaseId)
          throw Object.assign(new Error('Нельзя удалить активную APK-версию. Сначала опубликуйте другую.'),{status:409});
        const value=releaseSnap.data()||{};storageName=safeApkStorageName(value.storageName);
        tx.delete(releaseRef);
        await writeAdminAudit(db,session,{
          action:'apk.release.delete',entityType:'apkRelease',entityId:releaseId,
          before:publicApkRelease({id:releaseId,...value}),after:null,requestId:String(body.requestId||'')
        },tx);
      });
      if(storageName)await rm(storedApkPath(storageName,apkStorageRoot()),{force:true}).catch(()=>{});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-apk]',error);
    return res.status(status).json({
      ...(error?.code?{code:String(error.code)}:{}),
      error:status===500?'Не удалось обработать APK-релиз.':error.message
    });
  }
}
