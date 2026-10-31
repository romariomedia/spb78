import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  assertApkIdentity,assertTrustedApkSigning,inspectApkFile,trustedAndroidSigningFingerprints
} from '../server/apk-inspection.js';

async function currentSignedApk(){
  const root=await mkdtemp(join(tmpdir(),'sb78-real-apk-'));
  const path=join(root,'sportbuddy78-v31.apk');
  const parts=await Promise.all([
    readFile(new URL('../distribution/android/v31.apk.part-1',import.meta.url)),
    readFile(new URL('../distribution/android/v31.apk.part-2',import.meta.url))
  ]);
  await writeFile(path,Buffer.concat(parts));
  return {root,path};
}

test('deep APK inspector reads the real signed v31 package, manifest version and certificate',async()=>{
  const {root,path}=await currentSignedApk();
  try{
    const inspection=await inspectApkFile(path);
    assert.equal(inspection.packageName,'ru.sportbuddy.mobile');
    assert.equal(inspection.versionName,'1.0');
    assert.equal(inspection.versionCode,31);
    assert.match(inspection.signatureScheme,/^v(?:2|3|3\.1)$/);
    assert.match(inspection.signingCertSha256,/^[a-f0-9]{64}$/);
    assert.doesNotThrow(()=>assertApkIdentity(inspection,{versionName:'1.0',versionCode:31}));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('APK identity validation rejects wrong package, versionName and versionCode',()=>{
  const good={packageName:'ru.sportbuddy.mobile',versionName:'1.0',versionCode:31,signingCertSha256:'a'.repeat(64)};
  assert.throws(()=>assertApkIdentity({...good,packageName:'evil.example'},good),{code:'APK_PACKAGE_MISMATCH'});
  assert.throws(()=>assertApkIdentity({...good,versionName:'2.0'},{versionName:'1.0',versionCode:31}),{code:'APK_VERSION_NAME_MISMATCH'});
  assert.throws(()=>assertApkIdentity({...good,versionCode:32},{versionName:'1.0',versionCode:31}),{code:'APK_VERSION_CODE_MISMATCH'});
});

test('trusted signing certificate falls back to the verified reference APK and rejects another cert',async()=>{
  const {root,path}=await currentSignedApk();
  try{
    const env={SB_ANDROID_TRUSTED_APK_PATH:path};
    const inspection=await inspectApkFile(path);
    const trusted=await trustedAndroidSigningFingerprints(env);
    assert.deepEqual(trusted,[inspection.signingCertSha256]);
    await assert.doesNotReject(()=>assertTrustedApkSigning(inspection,env));
    await assert.rejects(
      ()=>assertTrustedApkSigning({...inspection,signingCertSha256:'b'.repeat(64)},env),
      error=>error?.code==='APK_SIGNING_CERT_MISMATCH'
    );
  }finally{await rm(root,{recursive:true,force:true});}
});
