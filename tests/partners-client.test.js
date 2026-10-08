import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function load(entry){const result=await build({entryPoints:[entry],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.VITE_API_BASE_URL':'""'},plugins:[{name:'auth',setup(b){
 b.onResolve({filter:/\.\/(firebaseAuth|adminAuth)$/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path.endsWith('adminAuth')?'export const getAdminSession=()=>globalThis.__partnerSession;':'export const auth={currentUser:{getIdToken:async()=>"firebase-token"}};',loader:'js'}));
}}]});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}
const feed=await load('src/services/partners.ts'),admin=await load('src/services/adminPartners.ts');
test('partner clients use production API on Capacitor and same origin on web',async()=>{
 globalThis.__partnerSession={sessionId:'otp-session'};
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({visible:false,partners:[]})}};
 globalThis.window={Capacitor:{isNativePlatform:()=>true}};
 await feed.loadFeedPartners();await admin.loadAdminPartners();
 assert.equal(calls[0].url,'https://sportbuddy78.pro/api/partners');assert.equal(calls[0].options.headers.Authorization,'Bearer firebase-token');
 assert.equal(calls[1].url,'https://sportbuddy78.pro/api/admin-partners');assert.equal(JSON.parse(calls[1].options.body).sessionId,'otp-session');
 globalThis.window={};await feed.loadFeedPartners();assert.equal(calls[2].url,'/api/partners');
});
test('admin partner calls cannot be issued without an OTP session',async()=>{
 globalThis.__partnerSession=null;globalThis.fetch=()=>{throw Error('unexpected network')};
 await assert.rejects(admin.createAdminPartner({}),/admin-otp-required/);
});
