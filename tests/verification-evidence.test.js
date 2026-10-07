import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {normalizeEvidence,saveEvidence,downloadEvidence,requireOwnedEvidence,MAX_EVIDENCE_BYTES} from '../server/verification-evidence.js';

function fixture(){
 const records=new Map();
 const db={collection:name=>({doc:id=>{
  const path=name+'/'+id;
  return {path,get:async()=>({exists:records.has(path),data:()=>records.get(path)}),update:async patch=>records.set(path,{...records.get(path),...patch})};
 }}),runTransaction:async cb=>cb({get:ref=>ref.get(),set:(ref,value)=>records.set(ref.path,value),create:(ref,value)=>records.set(ref.path,value),delete:ref=>records.delete(ref.path)})};
 return {db,records};
}
const pdf={base64:Buffer.from('%PDF-1.7\nverification fixture').toString('base64')};

test('evidence is stored outside release and only its owner can retrieve it',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sb-evidence-'));
 const old=process.env.SB_PRIVATE_MEDIA_DIR;process.env.SB_PRIVATE_MEDIA_DIR=dir;
 t.after(async()=>{if(old===undefined)delete process.env.SB_PRIVATE_MEDIA_DIR;else process.env.SB_PRIVATE_MEDIA_DIR=old;await rm(dir,{recursive:true,force:true});});
 const f=fixture();const saved=await saveEvidence(f.db,'alice',pdf);
 assert.equal((await stat(join(dir,saved.id))).mode&0o777,0o600);
 assert.equal((await downloadEvidence(f.db,saved.id,'alice')).base64,pdf.base64);
 await assert.rejects(downloadEvidence(f.db,saved.id,'bob'),e=>e.status===404);
 await assert.rejects(requireOwnedEvidence(f.db,'../../secret','alice'),e=>e.status===404);
 const row=f.records.get('sportVerificationEvidence/'+saved.id);
 row.state='uploading';await assert.rejects(downloadEvidence(f.db,saved.id,'alice'),e=>e.status===404);row.state='ready';
 for(let i=1;i<10;i++)await saveEvidence(f.db,'alice',pdf);
 await assert.rejects(saveEvidence(f.db,'alice',pdf),e=>e.status===429);
 assert.equal(f.records.get('sportEvidenceQuotas/alice').count,10);
});

test('upload normalizes images and rejects HTML, SVG, invalid base64 and oversized input',async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:'red'}}).png().toBuffer();
 const result=await normalizeEvidence({base64:png.toString('base64')});
 assert.equal(result.mime,'image/jpeg');assert.equal((await sharp(result.bytes).metadata()).exif,undefined);
 for(const input of ['%%%%',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64'),Buffer.from('<html>secret</html>').toString('base64'),Buffer.alloc(MAX_EVIDENCE_BYTES+1).toString('base64')]){
  await assert.rejects(normalizeEvidence({base64:input}),e=>e.status===400);
 }
});
