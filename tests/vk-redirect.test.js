import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const built = await build({entryPoints:['src/services/vkRedirect.ts'],bundle:true,format:'esm',platform:'node',write:false});
const api = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const storage = () => { const m = new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
const callback = tx => new URL(`${tx.redirectUrl}/?code=one-use&device_id=device&state=${tx.state}`);
test('redirect retains PKCE and state across page reload and consumes transaction once',()=>{
 const s=storage(), tx=api.beginVkRedirect(s,'https://sportbuddy78.pro');
 assert.match(tx.codeVerifier,/^[a-f0-9]{64}$/); assert.notEqual(tx.state,tx.codeVerifier);
 assert.deepEqual(api.consumeVkRedirect(s,callback(tx)),tx);
 assert.throws(()=>api.consumeVkRedirect(s,callback(tx)));
});
test('redirect rejects mismatched state, foreign origin, expiry and absent storage',t=>{
 for(const change of [u=>u.searchParams.set('state','forged'),u=>u.hostname='other.example']){
  const s=storage(),tx=api.beginVkRedirect(s,'https://sportbuddy78.pro'),u=callback(tx);change(u);
  assert.throws(()=>api.consumeVkRedirect(s,u));
 }
 const s=storage(),tx=api.beginVkRedirect(s,'https://sportbuddy78.pro');
 t.mock.method(Date,'now',()=>tx.createdAt+16*60*1000);
 assert.throws(()=>api.consumeVkRedirect(s,callback(tx)));
 assert.throws(()=>api.beginVkRedirect({setItem(){throw Error('blocked');}},'https://sportbuddy78.pro'));
});
test('OAuth secrets leave address bar while unrelated navigation is preserved',()=>{
 assert.equal(api.cleanVkCallback(new URL('https://sportbuddy78.pro/?code=secret&state=secret&device_id=d&campaign=run#profile')),'/?campaign=run#profile');
});
