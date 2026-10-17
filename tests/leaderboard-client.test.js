import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/services/leaderboard.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'fake-io',setup(b){
 b.onResolve({filter:/^\.\/(repository|serverApi)$/},a=>({path:a.path,namespace:'fake'}));
 b.onLoad({filter:/.*/,namespace:'fake'},a=>({loader:'js',contents:a.path==='./repository'
 ? `export let CURRENT_USER_ID='me';globalThis.__switchRankUser=id=>{CURRENT_USER_ID=id;};`
 : `export const callServer=(path,body)=>globalThis.__rankCall(path,body);`}));
}}]});
const {loadLeaderboard}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const page={metric:'workouts',version:'snapshot',stats:{athletes:45},entries:[],nextOffset:20};
test('ranking client requests bounded server pages and rejects legacy incompatible responses',async()=>{
 globalThis.__switchRankUser('me');
 globalThis.__rankCall=async(path,body)=>{assert.equal(path,'/api/public-profiles');assert.deepEqual(body,{action:'leaderboard',metric:'workouts',offset:0});return page;};
 assert.equal((await loadLeaderboard('workouts')).stats.athletes,45);
 globalThis.__rankCall=async()=>({profiles:[],nextCursor:null});
 await assert.rejects(loadLeaderboard('workouts'),/рейтинг/);
 globalThis.__rankCall=async()=>({...page,nextOffset:0});
 await assert.rejects(loadLeaderboard('workouts'),/рейтинг/);
});
test('a late server ranking cannot become the next account ranking',async()=>{
 globalThis.__switchRankUser('me');
 globalThis.__rankCall=async()=>{globalThis.__switchRankUser('other');return page;};
 await assert.rejects(loadLeaderboard('workouts'),/Аккаунт изменился/);
});
