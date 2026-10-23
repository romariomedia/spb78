import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/services/iosVkCallback.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {iosVkReturnUrl,normalizeIosVkCallback}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('iOS handoff preserves only OAuth parameters and the trusted HTTPS callback',()=>{
 const url=new URL('https://sportbuddy78.pro/vk-callback?code=one%23two&state=nonce&device_id=d&next=https://evil.example');
 const handoff=iosVkReturnUrl(url);
 assert.ok(handoff.startsWith('sportbuddy78://vk-callback?'));
 const back=new URL(normalizeIosVkCallback(handoff));
 assert.equal(back.origin,'https://sportbuddy78.pro');assert.equal(back.pathname,'/vk-callback');
 assert.equal(back.searchParams.get('code'),'one#two');assert.equal(back.searchParams.get('state'),'nonce');
 assert.equal(back.searchParams.get('device_id'),'d');assert.equal(back.searchParams.get('next'),null);
});
test('iOS callback rejects alternate hosts, credentials, paths and duplicate state',()=>{
 for(const value of ['sportbuddy78://evil','sportbuddy78://user@vk-callback','sportbuddy78://vk-callback/evil','sportbuddy78://vk-callback?state=1&state=2'])assert.throws(()=>normalizeIosVkCallback(value));
 assert.equal(iosVkReturnUrl(new URL('https://evil.example/vk-callback?code=x&state=y')),'');
 assert.equal(iosVkReturnUrl(new URL('https://sportbuddy78.pro/vk-callback?code=x')),'');
 const web='https://sportbuddy78.pro/vk-callback?code=x&state=y';assert.equal(normalizeIosVkCallback(web),web);
});
