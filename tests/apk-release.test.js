import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {
  APK_CHUNK_BYTES,appendApkChunk,createApkUpload,finalizeApkUpload,
  publicApkRelease,safeApkStorageName,storedApkPath,validateApkReleaseInput
} from '../server/apk-release.js';

test('APK release metadata is strict and public metadata hides storage internals',()=>{
  const input=validateApkReleaseInput({
    versionName:'1.0.32',versionCode:32,fileName:'SportBuddy78.apk',
    fileSize:1024,sha256:'a'.repeat(64),releaseNotes:'Исправления'
  });
  assert.equal(input.versionName,'1.0.32');
  assert.equal(input.versionCode,32);
  assert.throws(()=>validateApkReleaseInput({...input,versionCode:0}),{code:'APK_VERSION_CODE_INVALID'});
  assert.throws(()=>validateApkReleaseInput({...input,fileName:'bad.exe'}),{code:'APK_FILE_INVALID'});
  assert.equal(safeApkStorageName('../evil.apk'),'');
  const pub=publicApkRelease({id:'r1',...input,storageName:'secret.apk'});
  assert.equal('storageName' in pub,false);
});

test('chunked APK upload preserves bytes and verifies SHA-256 before finalizing',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sb78-apk-'));
  try{
    const payload=Buffer.concat([
      Buffer.from([0x50,0x4b,0x03,0x04]),
      Buffer.alloc(APK_CHUNK_BYTES+1234,7)
    ]);
    const sha256=createHash('sha256').update(payload).digest('hex');
    const upload=await createApkUpload({
      versionName:'1.0.33',versionCode:33,fileName:'sportbuddy78.apk',
      fileSize:payload.length,sha256,releaseNotes:'Тест'
    },'admin@example.ru',root);
    let index=0;
    for(let offset=0;offset<payload.length;offset+=APK_CHUNK_BYTES){
      const chunk=payload.subarray(offset,Math.min(offset+APK_CHUNK_BYTES,payload.length));
      const result=await appendApkChunk(upload.id,index++,chunk.toString('base64'),'admin@example.ru',root);
      assert.ok(result.bytesReceived<=payload.length);
    }
    const finalized=await finalizeApkUpload(upload.id,'admin@example.ru',root);
    assert.equal(finalized.sha256,sha256);
    const stored=await readFile(storedApkPath(finalized.storageName,root));
    assert.deepEqual(stored,payload);
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});

test('APK finalize rejects a non-ZIP payload even with a matching hash',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sb78-apk-bad-'));
  try{
    const payload=Buffer.alloc(2048,1),sha256=createHash('sha256').update(payload).digest('hex');
    const upload=await createApkUpload({
      versionName:'2.0.0',versionCode:200,fileName:'bad.apk',
      fileSize:payload.length,sha256,releaseNotes:''
    },'admin@example.ru',root);
    await appendApkChunk(upload.id,0,payload.toString('base64'),'admin@example.ru',root);
    await assert.rejects(()=>finalizeApkUpload(upload.id,'admin@example.ru',root),{code:'APK_FORMAT_INVALID'});
  }finally{
    await rm(root,{recursive:true,force:true});
  }
});
