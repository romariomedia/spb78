import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

async function load(){
  const result=await build({
    entryPoints:['api/legal-acceptance.js'],bundle:true,format:'esm',platform:'node',write:false,
    plugins:[{name:'fake-admin',setup(b){
      b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'fake'}));
      b.onLoad({filter:/.*/,namespace:'fake'},a=>({contents:{
        'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
        'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async()=>({uid:"u1",email:"user@example.ru"})});',
        'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__legalDb;'
      }[a.path],loader:'js'}));
    }}]
  });
  return await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const module=await load(),handler=module.default,VERSION=module.USER_LEGAL_VERSION;

function fixture(){
  const rows=new Map();
  const snap=path=>({exists:rows.has(path),data:()=>structuredClone(rows.get(path))});
  const ref=path=>({path,get:async()=>snap(path)});
  globalThis.__legalDb={
    collection(name){return {doc:id=>ref(name+'/'+id)};},
    async runTransaction(fn){
      const writes=[];
      const tx={
        get:async r=>{if(writes.length)throw new Error('Firestore transactions require all reads before writes');return snap(r.path);},
        create(r,v){writes.push(()=>{if(rows.has(r.path))throw new Error('exists');rows.set(r.path,structuredClone(v));});}
      };
      const value=await fn(tx);writes.forEach(write=>write());return value;
    }
  };
  async function request(body){
    const res={statusCode:200,status(code){this.statusCode=code;return this},json(value){this.body=value;return this},setHeader(){}};
    await handler({method:'POST',headers:{authorization:'Bearer token'},body},res);
    return res;
  }
  return {rows,request};
}

test('legacy account reports both current legal acceptances missing',async()=>{
  const f=fixture(),res=await f.request({operation:'status'});
  assert.equal(res.statusCode,200);
  assert.equal(res.body.version,VERSION);
  assert.equal(res.body.complete,false);
  assert.deepEqual(res.body.missing,['terms','personal_data']);
});

test('current terms and personal-data consent become complete and retry is idempotent',async()=>{
  const f=fixture();
  const body={operation:'accept',version:VERSION,source:'legal_reacceptance',authProvider:'existing',acceptances:['terms','personal_data']};
  assert.equal((await f.request(body)).statusCode,200);
  assert.equal(f.rows.size,2);
  const status=await f.request({operation:'status'});
  assert.equal(status.body.complete,true);
  assert.deepEqual(status.body.missing,[]);
  assert.equal((await f.request(body)).statusCode,200);
  assert.equal(f.rows.size,2);
});

test('outdated legal document version cannot be accepted',async()=>{
  const f=fixture(),res=await f.request({
    operation:'accept',version:'old',source:'legal_reacceptance',authProvider:'existing',acceptances:['terms','personal_data']
  });
  assert.equal(res.statusCode,409);
  assert.equal(f.rows.size,0);
});
