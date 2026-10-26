import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessDayKey,recordBusinessMetric,sanitizeBusinessEvent,summarizeBusinessMetrics
} from '../server/business-insights.js';

function fixture(){
  const data=new Map();
  const ref=path=>({
    path,
    collection(name){return {doc:id=>ref(path+'/'+name+'/'+id)};}
  });
  const snapshot=path=>({exists:data.has(path),data:()=>structuredClone(data.get(path))});
  let queue=Promise.resolve();
  const db={
    collection(name){return {doc:id=>ref(name+'/'+id)};},
    runTransaction(callback){
      const run=queue.then(async()=>{
        let wrote=false;const writes=[];
        const tx={
          get:async r=>{if(wrote)throw new Error('Read after write');return snapshot(r.path);},
          set(r,v){wrote=true;writes.push(()=>data.set(r.path,structuredClone(v)));},
          create(r,v){wrote=true;writes.push(()=>{if(data.has(r.path))throw new Error('already exists');data.set(r.path,structuredClone(v));});}
        };
        const value=await callback(tx);writes.forEach(fn=>fn());return value;
      });
      queue=run.catch(()=>{});return run;
    }
  };
  return {db,data};
}

test('business day uses Moscow calendar date',()=>{
  assert.equal(businessDayKey(Date.parse('2027-01-01T20:59:59Z')),'2027-01-01');
  assert.equal(businessDayKey(Date.parse('2027-01-01T21:00:00Z')),'2027-01-02');
});

test('business event validation accepts only known commercial interactions',()=>{
  assert.deepEqual(sanitizeBusinessEvent({subjectType:'trainer',subjectId:'u',eventType:'view',target:'profile'}),{
    subjectType:'trainer',subjectId:'u',eventType:'view',target:'profile'
  });
  assert.throws(()=>sanitizeBusinessEvent({subjectType:'bad',subjectId:'u',eventType:'view',target:'profile'}));
  assert.throws(()=>sanitizeBusinessEvent({subjectType:'trainer',subjectId:'u',eventType:'hack',target:'profile'}));
});

test('daily metrics deduplicate the same user action but count different users',async()=>{
  const f=fixture(),now=Date.parse('2027-03-04T10:00:00Z');
  const base={subjectType:'trainer',subjectId:'coach',eventType:'view',target:'profile',now};
  assert.equal((await recordBusinessMetric(f.db,{...base,actorId:'a'})).counted,true);
  assert.equal((await recordBusinessMetric(f.db,{...base,actorId:'a'})).counted,false);
  assert.equal((await recordBusinessMetric(f.db,{...base,actorId:'b'})).counted,true);
  await recordBusinessMetric(f.db,{subjectType:'trainer',subjectId:'coach',eventType:'click',target:'booking',actorId:'a',now});
  const day=businessDayKey(now);
  assert.deepEqual(f.data.get('businessMetrics/trainer:coach/days/'+day),{
    day,eventTypeVersion:1,subjectType:'trainer',subjectId:'coach',views:2,clicks:1,leads:0,
    updatedAt:f.data.get('businessMetrics/trainer:coach/days/'+day).updatedAt
  });
});

test('dashboard metric summary computes 7-day and 30-day conversion',()=>{
  const series=Array.from({length:30},(_,index)=>({day:String(index),views:10,clicks:2,leads:1}));
  const summary=summarizeBusinessMetrics(series);
  assert.deepEqual(summary.total30,{views:300,clicks:60,leads:30});
  assert.deepEqual(summary.total7,{views:70,clicks:14,leads:7});
  assert.equal(summary.conversion30,10);
  assert.equal(summary.clickRate30,20);
});
