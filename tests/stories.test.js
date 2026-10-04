import test from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import sharp from 'sharp';
import {createStory,readStory,deleteStory,cleanupStories,requireStoryPublisher,prepareStoryImage,STORY_TTL} from '../server/stories.js';
const now=Date.parse('2026-10-04T12:00:00Z');
const image='data:image/jpeg;base64,'+(await sharp({create:{width:2400,height:1200,channels:3,background:'#79af33'}}).jpeg().toBuffer()).toString('base64');
function fixture(){
 const data=new Map([['users/a',{name:'A',isVerified:true}],['users/b',{name:'B',isVerified:true}]]);
 const snap=ref=>({id:ref.id,ref,exists:data.has(ref.path),data:()=>data.get(ref.path)});
 const db={
  collection(name){return {
   doc(id){const ref={id,path:name+'/'+id,get:async()=>snap(ref),delete:async()=>data.delete(ref.path)};return ref;},
   where(_f,_op,n){return {limit(){return {get:async()=>({docs:[...data.keys()].filter(k=>k.startsWith('stories/')&&data.get(k).expiresAt<=n).map(k=>snap(db.collection('stories').doc(k.split('/')[1])))})};}};}
  };},
  async runTransaction(fn){const writes=[];const result=await fn({get:async r=>snap(r),set:(r,v)=>writes.push(()=>data.set(r.path,v)),create:(r,v)=>writes.push(()=>{if(data.has(r.path))throw Error('duplicate');data.set(r.path,v);})});writes.forEach(f=>f());return result;}
 };
 return {db,data};
}
test('story Premium transition and verification are enforced by server',()=>{
 requireStoryPublisher({isVerified:true},now);
 assert.throws(()=>requireStoryPublisher({isVerified:false},now));
 assert.throws(()=>requireStoryPublisher({isVerified:true},Date.parse('2026-12-31T21:00:00Z')));
 requireStoryPublisher({isVerified:true,premiumUntil:'2027-02-01T00:00:00Z'},Date.parse('2027-01-01T00:00:00Z'));
});
test('stories decode real photos, resize and reject malformed data',async()=>{
 const output=await prepareStoryImage(image),meta=await sharp(output).metadata();assert.equal(meta.width,1080);assert.equal(meta.format,'jpeg');assert.equal(meta.exif,undefined);
 await assert.rejects(prepareStoryImage('data:image/jpeg;base64,YmFk'));
 await assert.rejects(prepareStoryImage('https://example.com/photo.jpg'));
});
test('story lifetime, ownership, quota, file cleanup and path traversal',async t=>{
 const {db}=fixture(),dir=await mkdtemp(join(tmpdir(),'sb-stories-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const first=await createStory(db,'a',{caption:'Петербург',image,requestId:'12345678-1234-4234-8234-123456789abc'},{dir,now});
 assert.equal(first.expiresAt,now+STORY_TTL);
 assert.equal((await createStory(db,'a',{caption:'Петербург',image,requestId:first.id},{dir,now})).id,first.id);
 assert.match((await readStory(db,first.id,{dir,now})).image,/^data:image\/jpeg;base64,/);
 await assert.rejects(readStory(db,first.id,{dir,now:now+STORY_TTL}),{status:410});
 await assert.rejects(deleteStory(db,'b',first.id,{dir}),{status:403});
 await assert.rejects(readStory(db,'../../.env',{dir,now}),{status:404});
 for(let i=1;i<5;i++)await createStory(db,'a',{caption:'',image,requestId:randomUUID()},{dir,now:now+i});
 await assert.rejects(createStory(db,'a',{caption:'',image,requestId:randomUUID()},{dir,now:now+10}),{status:429});
 assert.ok((await readFile(join(dir,first.id+'.jpg'))).length);
 await cleanupStories(db,{dir,now:now+STORY_TTL+100});
 await assert.rejects(stat(join(dir,first.id+'.jpg')),{code:'ENOENT'});
});
