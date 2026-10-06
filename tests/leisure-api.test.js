import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['api/leisure.js'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'fake',setup(b){b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{'firebase-admin/app':'export const getApps=()=>[{}],cert=x=>x,initializeApp=()=>{};','firebase-admin/auth':"export const getAuth=()=>({verifyIdToken:async token=>{if(token!=='valid')throw Object.assign(new Error('bad token'),{code:'auth/invalid-id-token'});return {uid:'real-user'};}});",'firebase-admin/firestore':'export const getFirestore=()=>({});'}[args.path],loader:'js'}));}}]});
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
async function request(method,token,body={}){const res={code:200,setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handler({method,headers:{authorization:token?'Bearer '+token:''},body},res);return res;}
test('leisure endpoint requires POST and verified identity, never trusts supplied owner',async()=>{
 assert.equal((await request('GET','')).code,405);
 assert.equal((await request('POST','',{action:'list',uid:'owner'})).code,401);
 assert.equal((await request('POST','forged',{action:'list'})).code,401);
 assert.equal((await request('POST','valid',{action:'unknown'})).code,400);
});
