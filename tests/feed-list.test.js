import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {publicFeedPost} from '../server/public-feed.js';
const result=await build({entryPoints:['api/feed-list.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake',setup(b){
 b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
 'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
 'firebase-admin/auth':`export const getAuth=()=>({verifyIdToken:async(t,revoked)=>{if(t!=='valid'||!revoked)throw {code:'auth/invalid-token'};return {uid:'me'}}});`,
 'firebase-admin/firestore':`export const getFirestore=()=>globalThis.__feedListDb;export const FieldPath={documentId:()=> '__name__'};`
 }[a.path],loader:'js'}));
}}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
function fixture(posts, user={}){
 globalThis.__feedListDb={collection(name){let cursor='',limit=0;return {
 doc:()=>({get:async()=>({exists:true,data:()=>user})}),
 orderBy(){return this},limit(n){limit=n;return this},startAfter(id){cursor=id;return this},
 async get(){assert.equal(name,'feed');return {docs:Object.keys(posts).sort().filter(id=>id>cursor).slice(0,limit).map(id=>({id,data:()=>posts[id]}))}}
 }}};
 return async(body={},token='valid')=>{const r={code:200,status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}};await handler({method:'POST',body,headers:{authorization:token?'Bearer '+token:''}},r);return r};
}
test('feed projection excludes hidden posts and internal fields even after restoration',()=>{
 assert.equal(publicFeedPost('a',{isHidden:true,content:'hidden'}),null);
 const post=publicFeedPost('a',{isHidden:false,content:'visible',hiddenReason:'internal',hiddenBy:'email',futureSecret:'secret',comments:[{id:'c',content:'hi',internal:'private'}]});
 assert.deepEqual(post,{id:'a',content:'visible',comments:[{id:'c',content:'hi'}]});
});
test('feed advances through entirely hidden pages and preserves visible legacy posts',async()=>{
 const posts=Object.fromEntries(Array.from({length:100},(_,i)=>['p'+String(i).padStart(3,'0'),{isHidden:true,content:'hidden'}]));
 posts.z={content:'legacy',hiddenBy:'admin'};
 const request=fixture(posts),first=await request();
 assert.deepEqual(first.body.posts,[]);assert.equal(first.body.nextCursor,'p099');
 const second=await request({cursor:first.body.nextCursor});
 assert.deepEqual(second.body.posts,[{id:'z',content:'legacy',comments:[]}]);assert.equal(second.body.nextCursor,null);
});
test('feed requires valid authentication, active account and valid cursor',async()=>{
 let request=fixture({});
 assert.equal((await request({},'')).code,401);assert.equal((await request({},'invalid')).code,401);
 assert.equal((await request({cursor:'a/b'})).code,400);
 request=fixture({},{isSuspended:true});assert.equal((await request()).code,403);
});
