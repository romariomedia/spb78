import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundled=await build({
  entryPoints:['api/admin-official-trainings.js'],bundle:true,format:'esm',platform:'node',write:false,
  plugins:[{name:'fake-admin',setup(b){
    b.onResolve({filter:/^firebase-admin\//},args=>({path:args.path,namespace:'fake'}));
    b.onLoad({filter:/.*/,namespace:'fake'},args=>({contents:{
      'firebase-admin/app':'export const getApps=()=>[{}],initializeApp=()=>{},cert=x=>x;',
      'firebase-admin/firestore':'export const getFirestore=()=>globalThis.__officialDb;'
    }[args.path],loader:'js'}));
  }}]
});
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));

function fixture(initial={}){
  const rows=new Map(Object.entries(initial));
  const snap=ref=>({id:ref.id,exists:rows.has(ref.path),data:()=>rows.get(ref.path)});
  const ref=path=>({id:path.split('/').at(-1),path,get:async()=>snap({id:path.split('/').at(-1),path}),create:async v=>rows.set(path,structuredClone(v)),set:async(v)=>rows.set(path,structuredClone(v)),delete:async()=>rows.delete(path)});
  const db={
    doc:path=>ref(path),
    collection(name){
      const query=(filters=[])=>({
        where:(field,op,value)=>{assert.equal(op,'==');return query([...filters,[field,value]])},
        async get(){const docs=[...rows].filter(([path,value])=>path.startsWith(name+'/')&&filters.every(([field,val])=>value[field]===val)).map(([path])=>snap({id:path.slice(name.length+1),path}));return {docs};},
        doc:id=>ref(name+'/'+id)
      });
      return query();
    },
    async runTransaction(callback){
      const tx={get:async r=>r.get(),set:(r,v)=>rows.set(r.path,structuredClone(v))};
      return callback(tx);
    }
  };
  globalThis.__officialDb=db;
  const request=async(body)=>{
    const res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=v;return this}};
    const old=console.error;console.error=()=>{};
    try{await handler({method:'POST',body},res);}finally{console.error=old;}
    return res;
  };
  return {rows,request};
}

const liveSession={email:'admin@example.invalid',expiresAt:{toMillis:()=>Date.now()+60_000}};
const draft={
  title:'Лёгкая пробежка 5 км',sport:'Бег',dateKey:'2027-01-10',dateLabel:'10 января',time:'18:00',
  districtId:'spb-petrogradsky',locationName:'Тестовая площадка',address:'Санкт-Петербург',
  lat:59.95,lng:30.28,level:'amateur',participantsMax:12,participantGender:'any',
  description:'Официальная тестовая тренировка SportBuddy78',officialStatus:'published'
};

test('official training admin creates transparent platform-owned activity without fake participants',async()=>{
  const f=fixture({'adminSessions/live':liveSession});
  const created=await f.request({operation:'create',sessionId:'live',training:draft,requestId:'request_123'});
  assert.equal(created.statusCode,200);
  assert.equal(created.body.training.isOfficial,true);
  assert.equal(created.body.training.createdBy,'sportbuddy78-official');
  assert.equal(created.body.training.officialOrganizerName,'SportBuddy78');
  assert.deepEqual(created.body.training.participantIds,[]);
  assert.equal(created.body.training.officialStatus,'published');
  const list=await f.request({operation:'list',sessionId:'live'});
  assert.equal(list.body.trainings.length,1);
});

test('official training admin cannot delete an activity that already has participants',async()=>{
  const f=fixture({
    'adminSessions/live':liveSession,
    'trainings/t':{...draft,id:'t',isOfficial:true,createdBy:'sportbuddy78-official',participantIds:['real-user'],createdAt:new Date().toISOString()}
  });
  const result=await f.request({operation:'delete',sessionId:'live',id:'t',requestId:'request_456'});
  assert.equal(result.statusCode,409);
  assert.equal(f.rows.has('trainings/t'),true);
});

test('official training admin cannot mutate a normal user training',async()=>{
  const f=fixture({
    'adminSessions/live':liveSession,
    'trainings/t':{...draft,id:'t',isOfficial:false,createdBy:'user-a',participantIds:['user-a']}
  });
  const result=await f.request({operation:'update',sessionId:'live',id:'t',training:draft,requestId:'request_789'});
  assert.equal(result.statusCode,403);
});

test('official training accepts independent start point and rejects missing or invalid coordinates',async()=>{
  const f=fixture({'adminSessions/live':liveSession});
  const created=await f.request({operation:'create',sessionId:'live',training:{...draft,venueId:'',venueName:'',locationName:'Вход в парк',lat:59.97,lng:30.32}});
  assert.equal(created.statusCode,200);
  assert.equal(created.body.training.lat,59.97);
  assert.equal(created.body.training.venueId,'');
  for(const coordinates of [{lat:null,lng:null},{lat:'',lng:''},{lat:'60',lng:'30'},{lat:91,lng:30},{lat:60,lng:181}]){
    assert.equal((await f.request({operation:'create',sessionId:'live',training:{...draft,...coordinates}})).statusCode,400);
  }
  const updated=await f.request({operation:'update',sessionId:'live',id:created.body.training.id,training:{...draft,venueId:'some-venue',venueName:'Площадка',lat:60.01,lng:30.01}});
  assert.equal(updated.statusCode,200);
  assert.equal(updated.body.training.lat,60.01);
  assert.equal(updated.body.training.venueId,'some-venue');
});
