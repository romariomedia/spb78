import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePushDestination} from '../shared/native-push.js';
test('native push navigation only accepts internal routes for the current account',()=>{
 for(const link of ['#chat=a__b','#training=t','#event=e','#leisure=l','#profile-friends','#events','#notifications']){
  assert.equal(nativePushDestination({recipient:'a',link},'a'),link);
  assert.equal(nativePushDestination({recipient:'a',link},'b'),'');
  assert.equal(nativePushDestination({recipient:'a',link},''),'');
 }
 for(const link of ['https://evil.test','javascript:alert(1)','#chat=../x','#unknown'])assert.equal(nativePushDestination({recipient:'a',link},'a'),'');
});

import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/services/nativePush.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'native-fakes',setup(b){
 b.onResolve({filter:/^@capacitor\/|\/firebaseAuth$|\/apiEndpoint$/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:a.path==='@capacitor/core'?'export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android"};':a.path==='@capacitor/push-notifications'?'export const PushNotifications=globalThis.__push.plugin;':a.path.endsWith('firebaseAuth')?'export const auth=globalThis.__push.auth,authReady=Promise.resolve();':'export const apiFetch=(...args)=>globalThis.__push.fetch(...args);',loader:'js'}));
}}]});
let sequence=0;
async function setup(){
 const storage=new Map(),listeners=new Map(),requests=[];
 const f={prompts:0,deleted:0,permission:'granted',switchOnRegister:false,offline:false};
 globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 f.auth={currentUser:{uid:'a',getIdToken:async()=> 'token-a'}};
 f.plugin={checkPermissions:async()=>({receive:f.permission}),requestPermissions:async()=>{f.prompts++;return {receive:f.permission}},createChannel:async()=>{},addListener:async(name,fn)=>{listeners.set(name,fn);return {remove:async()=>listeners.delete(name)}},register:async()=>{if(f.switchOnRegister)f.auth.currentUser={uid:'b'};listeners.get('registration')({value:'native-token'});},removeAllDeliveredNotifications:async()=>{},unregister:async()=>{f.deleted++;}};
 f.fetch=async(_url,options)=>{requests.push(JSON.parse(options.body));if(f.offline)throw Error('offline');return {ok:true}};
 globalThis.__push=f;
 const module=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text+'\n// '+sequence++).toString('base64'));
 return {f,module,requests,storage,listeners};
}
test('native registration binds platform to account and cleans transient listeners',async()=>{
 const {module,requests,listeners}=await setup();await module.enableNativePush();
 assert.deepEqual(requests,[{action:'register',token:'native-token',platform:'android'}]);
 assert.equal(module.nativePushToken(),'native-token');assert.equal(listeners.size,0);
});
test('native restore never prompts and account switch cannot bind late token',async()=>{
 let x=await setup();x.f.permission='denied';await assert.rejects(x.module.enableNativePush(false));assert.equal(x.f.prompts,0);assert.equal(x.requests.length,0);
 x=await setup();x.f.switchOnRegister=true;await x.module.enableNativePush();assert.equal(x.requests.length,0);assert.equal(x.module.nativePushToken(),'');
});
test('native disable clears local state and deletes native token even when offline',async()=>{
 const {f,module}=await setup();await module.enableNativePush();f.offline=true;
 await assert.rejects(module.disableNativePush());assert.equal(module.nativePushToken(),'');assert.equal(f.deleted,1);
});
