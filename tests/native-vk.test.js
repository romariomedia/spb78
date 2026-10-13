import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const result=await build({entryPoints:['src/services/nativeVk.ts'],bundle:true,write:false,platform:'node',format:'esm',
 plugins:[{name:'native',setup(b){b.onResolve({filter:/\.\/nativeHttp$/},()=>({path:'http',namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const nativeHttp=(...args)=>globalThis.__vkHttp(...args);'}));}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n//# sourceURL=native-vk-fixture.js').toString('base64'));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const callback=url=>`${url.searchParams.get('redirect_uri')}?code=one-use&device_id=test-device&state=${url.searchParams.get('state')}`;
test('native VK uses system-browser redirect with PKCE and survives a fresh exchange instance',async()=>{
 const s=storage(),url=new URL(await api.nativeVkAuthorizeUrl(s));
 assert.equal(url.origin,'https://id.vk.ru');assert.equal(url.searchParams.get('client_id'),'54699979');
 assert.equal(url.searchParams.get('redirect_uri'),'https://sportbuddy78.pro/vk-callback');
 assert.equal(url.searchParams.get('origin'),null);assert.equal(url.searchParams.get('code_challenge_method'),'S256');
 let count=0;
 globalThis.__vkHttp=async(endpoint,init)=>{
  count++;assert.equal(endpoint,'https://id.vk.ru/oauth2/auth');
  const form=new URLSearchParams(init.body);
  assert.equal(createHash('sha256').update(form.get('code_verifier')).digest('base64url'),url.searchParams.get('code_challenge'));
  assert.equal(form.get('state'),url.searchParams.get('state'));
  assert.equal(form.get('device_id'),'test-device');
  return Response.json({access_token:'test-token',user_id:42,state:form.get('state')});
 };
 assert.deepEqual(await api.exchangeNativeVkCallback(s,callback(url)),{access_token:'test-token',user_id:'42'});
 await assert.rejects(api.exchangeNativeVkCallback(s,callback(url)),/VK-SESSION/);assert.equal(count,1);
});
test('native VK rejects forged callback origin, path, state and token-response state',async()=>{
 globalThis.__vkHttp=async()=>{throw Error('must not exchange forged callback')};
 for(const change of [u=>u.hostname='evil.example',u=>u.pathname='/other',u=>u.searchParams.set('state','forged')]){
  const s=storage(),url=new URL(await api.nativeVkAuthorizeUrl(s)),back=new URL(callback(url));change(back);
  await assert.rejects(api.exchangeNativeVkCallback(s,back.href),/VK-SESSION/);
 }
 const s=storage(),url=new URL(await api.nativeVkAuthorizeUrl(s));
 globalThis.__vkHttp=async()=>Response.json({access_token:'test-token',user_id:42,state:'wrong'});
 await assert.rejects(api.exchangeNativeVkCallback(s,callback(url)),/VK-EXCHANGE/);
});

test('browser return has a fixed Android package and cannot inject intent extras',()=>{
 const url=new URL('https://sportbuddy78.pro/vk-callback?code=one%23Intent%3Bpackage%3Devil&state=nonce&device_id=d&browser_fallback_url=https://evil.example');
 const intent=api.nativeVkReturnIntent(url);
 assert.ok(intent.endsWith('#Intent;scheme=https;package=ru.sportbuddy.mobile;end'));
 assert.equal(intent.split('#Intent').length,2);assert.ok(!intent.includes('browser_fallback_url'));
 assert.equal(api.nativeVkReturnIntent(new URL('https://evil.example/vk-callback?code=x&state=y')),'');
});
