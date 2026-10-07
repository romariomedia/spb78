import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['api/report.js'],bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'fake-admin',setup(b){
  b.onResolve({filter:/^firebase-admin\//},a=>({path:a.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:{
   'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
   'firebase-admin/auth':'export const getAuth=()=>({verifyIdToken:async token=>{if(token!=="valid")throw Object.assign(new Error("Invalid token"),{code:"auth/invalid-id-token"});return {uid:"a"}}});',
   'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__reportDb;'
  }[a.path]}));
 }}]});
const handler=(await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'))).default;
function fixture({kind='direct',deleted=false}={}){
 const rows=new Map([
  ['users/a',{name:'Анна'}],['users/b',{name:'Роман'}],
  ['chats/c',{kind,participantIds:['a','b'],messageStorageVersion:2,recentMessages:[]}],
  ['chats/c/messages/m',{id:'m',senderId:'b',timestamp:100,text:deleted?'Сообщение удалено':'Обычный текст',...(deleted?{deletedAt:200,moderationText:'Исходный текст'}:{})}]
 ]);
 function validate(x){if(x===undefined)throw Error('Firestore rejects undefined');if(x&&typeof x==='object')Object.values(x).forEach(validate)}
 const db={collection(name){
  const q={orderBy:()=>q,limit:()=>q,get:async()=>({docs:[...rows].filter(([p])=>p.startsWith(name+'/')&&p.slice(name.length+1).indexOf('/')<0).map(([p,v])=>({id:p.split('/').at(-1),data:()=>structuredClone(v)}))})};
  return {...q,doc(id){const path=name+'/'+id;const ref={path,collection:sub=>db.collection(path+'/'+sub),get:async()=>({exists:rows.has(path),ref,data:()=>structuredClone(rows.get(path))}),create:async value=>{validate(value);if(rows.has(path))throw Object.assign(Error('exists'),{code:6});rows.set(path,structuredClone(value));}};return ref;}};
 }};
 globalThis.__reportDb=db;
 async function request(extra={},token='valid'){
  const response={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
  await handler({method:'POST',headers:{authorization:token?'Bearer '+token:''},body:{targetUserId:'b',chatId:'c',reason:'spam',details:'Проверка',...extra}},response);return response;
 }
 return {rows,request};
}
test('ordinary chat complaint persists without undefined fields',async()=>{
 const f=fixture(),r=await f.request();assert.equal(r.statusCode,200);
 const report=f.rows.get('reports/'+r.body.reportId);
 assert.equal(report.excerpt[0].text,'Обычный текст');assert.equal(Object.hasOwn(report.excerpt[0],'deletedAt'),false);
});
test('group complaint retains deleted message evidence only in moderation report',async()=>{
 const f=fixture({kind:'training',deleted:true}),r=await f.request();assert.equal(r.statusCode,200);
 assert.deepEqual(f.rows.get('reports/'+r.body.reportId).excerpt[0],{senderId:'b',text:'Исходный текст',timestamp:100,deletedAt:200});
});
test('concurrent duplicate complaints produce one document and an explicit conflict',async()=>{
 const f=fixture();const responses=await Promise.all([f.request(),f.request()]);
 assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);
 assert.equal([...f.rows.keys()].filter(p=>p.startsWith('reports/')).length,1);
});
test('complaint rejects missing auth, invalid auth, self and non-participants',async()=>{
 const f=fixture();
 assert.equal((await f.request({},'')).statusCode,401);assert.equal((await f.request({},'invalid')).statusCode,401);
 assert.equal((await f.request({targetUserId:'a'})).statusCode,400);
 assert.equal((await f.request({targetUserId:'outsider'})).statusCode,403);
 assert.equal([...f.rows.keys()].filter(p=>p.startsWith('reports/')).length,0);
});
