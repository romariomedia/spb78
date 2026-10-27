import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';

const fields=[{fieldPath:'ownerUserId',order:'ASCENDING'},{fieldPath:'createdAt',order:'DESCENDING'},{fieldPath:'__name__',order:'DESCENDING'}];
test('index preparation is idempotent, creates only required index and fails closed on denied permissions',async()=>{
 const result=await build({entryPoints:['ops/prepare-privacy-index.mjs'],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'fake',setup(b){
  b.onResolve({filter:/^(node:fs\/promises|dotenv|firebase-admin\/app)$/},a=>({path:a.path,namespace:'fake'}));
  b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
   'node:fs/promises':'export const readFile=async()=>"";',
   'dotenv':'export const parse=()=>({FIREBASE_SERVICE_ACCOUNT_KEY:JSON.stringify({project_id:"test",client_email:"secret",private_key:"secret"})});',
   'firebase-admin/app':'export const cert=()=>({getAccessToken:async()=>({access_token:"secret"})});'
  }[a.path],loader:'js'}));
 }}]});
 for(const scenario of ['existing','create','denied']){
  const prelude=`const scenario=${JSON.stringify(scenario)},expectedFields=${JSON.stringify(fields)};let calls=0;globalThis.fetch=async(url,options)=>{calls++;if(scenario==='denied')return {ok:false,status:403};if(options.method==='POST'){if(scenario!=='create')throw Error('unexpected mutation');const b=JSON.parse(options.body);if(JSON.stringify(b.fields)!==JSON.stringify(expectedFields))throw Error('wrong fields');return {ok:true,json:async()=>({done:true,response:{state:'READY'}})};}return {ok:true,json:async()=>({indexes:scenario==='existing'?[{queryScope:'COLLECTION',fields:expectedFields,state:'READY'}]:[]})};};`;
  try{const output=execFileSync(process.execPath,['--input-type=module','-e',prelude+result.outputFiles[0].text],{encoding:'utf8',stdio:['ignore','pipe','pipe']});assert.notEqual(scenario,'denied');assert.match(output,/index READY/);assert.doesNotMatch(output,/secret/);}
  catch(error){if(scenario!=='denied')throw error;assert.equal(error.status,1);assert.match(error.stderr,/HTTP 403/);assert.doesNotMatch(error.stderr,/secret/);}
 }
});
