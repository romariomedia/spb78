import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/services/guest.ts'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'api',setup(b){b.onResolve({filter:/apiEndpoint$/},()=>({path:'api',namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:'export const apiFetch=()=>{}',loader:'js'}));}}]});
const {needsAuthScreen}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
test('guest landing preserves web VK, cold Android return and pending callback',()=>{
 assert.equal(needsAuthScreen('https://sportbuddy78.pro/'),false);
 assert.equal(needsAuthScreen('https://sportbuddy78.pro/?code=x&state=y'),true);
 assert.equal(needsAuthScreen('https://sportbuddy78.pro/?error=denied'),true);
 assert.equal(needsAuthScreen('https://sportbuddy78.pro/vk-callback?code=x'),true);
 assert.equal(needsAuthScreen('https://localhost/',{getItem:()=>'{"code":"x"}'}),true);
 assert.equal(needsAuthScreen('https://localhost/',{getItem:()=>null}),false);
});
