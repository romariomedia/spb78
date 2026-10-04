import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
async function source(path){const r=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(r.outputFiles[0].text).toString('base64'));}
const {cropRect,defaultEdits}=await source('src/services/photoEditor.ts');
const {avatarSources}=await source('src/services/avatarSources.ts');
test('crop stays inside image for all supported ratios and zoom positions',()=>{
 for(const aspect of ['original','square','portrait','story'])for(const zoom of [1,2,3])for(const x of [0,50,100])for(const y of [0,50,100]){
  const r=cropRect(1200,800,{...defaultEdits,aspect,zoom,x,y});assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=1200.001&&r.y+r.h<=800.001);assert.ok(r.w>0&&r.h>0);
 }
});
test('avatar falls back to original CDN upload without modifying external/signed sources',()=>{
 const src='https://res.cloudinary.com/test/image/upload/f_auto,q_auto,w_96,h_96,c_thumb,g_face,r_max,dpr_auto/v12/avatar.jpg';
 assert.deepEqual(avatarSources(src),[src,'https://res.cloudinary.com/test/image/upload/v12/avatar.jpg','/avatar-placeholder.svg']);
 const signed='https://res.cloudinary.com/test/image/upload/s--abc--/v12/avatar.jpg';assert.deepEqual(avatarSources(signed),[signed,'/avatar-placeholder.svg']);
 assert.deepEqual(avatarSources('https://vk.example/avatar.jpg'),['https://vk.example/avatar.jpg','/avatar-placeholder.svg']);
});
