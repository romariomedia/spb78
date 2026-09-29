import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['api/feed-create.js'], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'fake-admin', setup(b) {
    b.onResolve({ filter: /^firebase-admin\// }, args=>({path:args.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'}, args=>({contents: {
      'firebase-admin/app': 'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};',
      'firebase-admin/auth': 'export const getAuth=()=>({verifyIdToken:async()=>({uid:"athlete"})});',
      'firebase-admin/firestore': 'export const getFirestore=()=>globalThis.__feedDb;'
    }[args.path],loader:'js'}));
  }}] });
const {default:handler}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text+'\n//# sourceURL=feed-permissions-fixture.js').toString('base64')}`);
async function request(profile, body) {
  let saved;
  globalThis.__feedDb={collection:name=>({doc:()=> name==='users'
    ? {get:async()=>({exists:true,data:()=>profile})}
    : {create:async post=>{ assert.equal(Object.values(post).includes(undefined),false); saved=post; }} })};
  const response={statusCode:200,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};
  await handler({method:'POST',headers:{authorization:'Bearer test'},body},response);
  return {response,saved};
}
const valid={name:'Athlete',isVerified:true,premiumUntil:new Date(Date.now()+86400000).toISOString()};
test('verified active Premium user can publish media',async()=>{
  const {response,saved}=await request(valid,{mediaUrl:'https://example.com/photo.jpg'});
  assert.equal(response.statusCode,200);assert.equal(saved.authorId,'athlete');assert.equal(saved.mediaType,'image');
});
test('verification and Premium denials have distinct reasons',async()=>{
  assert.equal((await request({...valid,isVerified:false},{content:'post'})).response.body.code,'VERIFICATION_REQUIRED');
  assert.equal((await request({...valid,premiumUntil:'2020-01-01'},{content:'post'})).response.body.code,'PREMIUM_REQUIRED');
});
test('text-only post has no undefined Firestore fields',async()=>{
  const {response,saved}=await request(valid,{content:'post'});assert.equal(response.statusCode,200);assert.equal('mediaUrl' in saved,false);
});
