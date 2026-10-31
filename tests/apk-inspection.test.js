import test from 'node:test';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  assertApkIdentity,assertTrustedApkSigning,inspectApkFile,trustedAndroidSigningFingerprints,verifyApkSignature,parseVerifiedApkSigner
} from '../server/apk-inspection.js';

const hasVerifier=spawnSync(process.env.SB_APKSIGNER_PATH||'apksigner',['version']).status===0;
if(process.env.SB_REQUIRE_APK_VERIFIER==='1'&&!hasVerifier)throw new Error('apksigner required for release verification');
const realApkTest=(name,fn)=>test(name,{skip:!hasVerifier},fn);

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

realApkTest('deep APK inspector reads the real signed v31 package, manifest version and certificate',async()=>{
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

realApkTest('trusted signing certificate falls back to the verified reference APK and rejects another cert',async()=>{
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

realApkTest('changing a signature byte is rejected despite keeping the original certificate',async()=>{
 const {root,path}=await currentSignedApk();
 try{
  const bytes=await readFile(path);
  const end=bytes.indexOf(Buffer.from('APK Sig Block 42'));
  const start=end+16-Number(bytes.readBigUInt64LE(end-8))-8;
  const value=start+8+12,signer=value+8;
  const signatures=signer+4+bytes.readUInt32LE(signer);
  bytes[signatures+4+bytes.readUInt32LE(signatures)-1]^=1;
  await writeFile(path,bytes);
  await assert.rejects(()=>inspectApkFile(path),{code:'APK_SIGNATURE_INVALID'});
 }finally{await rm(root,{recursive:true,force:true});}
});

test('missing verifier fails closed with actionable service error',async()=>{
 await assert.rejects(()=>verifyApkSignature('/tmp/nonexistent.apk',{SB_APKSIGNER_PATH:'/nonexistent/apksigner'}),{code:'APK_VERIFIER_UNAVAILABLE',status:503});
});

realApkTest('website app links include the certificate of the shipped APK',async()=>{
 const {root,path}=await currentSignedApk();
 try{
  const inspected=await inspectApkFile(path);
  const links=JSON.parse(await readFile(new URL('../public/.well-known/assetlinks.json',import.meta.url)));
  const entry=links.find(x=>x.target.package_name===inspected.packageName);
  assert.ok(entry.target.sha256_cert_fingerprints.some(x=>x.replaceAll(':','').toLowerCase()===inspected.signingCertSha256));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('apksigner parser accepts distro and SDK 36 formats with the same certificate',()=>{
 const cert='1b1da30e9fd7a535e7c685e24e9e0f4ba0ec6d8caf7b7183aedf934e23e6cdf5';
 for(const prefix of ['Signer #1','V2 Signer:','V3 Signer:','V3.1 Signer:','V3.2 Signer:']){
  const output=`Verifies\nNumber of signers: 1\n${prefix} certificate SHA-256 digest: ${cert}\n`;
  assert.equal(parseVerifiedApkSigner(output),cert);
  assert.equal(parseVerifiedApkSigner(output.replaceAll('\n','\r\n')),cert);
 }
 assert.equal(parseVerifiedApkSigner(`Number of signers: 1\nV2 Signer: certificate SHA-256 digest: ${cert}\nV3 Signer: certificate SHA-256 digest: ${cert}\n`),cert);
});

test('apksigner parser rejects missing, multiple, conflicting or malformed signers',()=>{
 const a='a'.repeat(64),b='b'.repeat(64);
 for(const output of [
  `Signer #1 certificate SHA-256 digest: ${a}\n`,
  `Number of signers: 2\nSigner #1 certificate SHA-256 digest: ${a}\nSigner #2 certificate SHA-256 digest: ${a}\n`,
  `Number of signers: 1\nV2 Signer: certificate SHA-256 digest: ${a}\nV3 Signer: certificate SHA-256 digest: ${b}\n`,
  'Number of signers: 1\nV2 Signer: certificate SHA-256 digest: abcd\n',
  'Number of signers: 1\n'
 ])assert.throws(()=>parseVerifiedApkSigner(output),{code:'APK_SIGNATURE_INVALID'});
});
