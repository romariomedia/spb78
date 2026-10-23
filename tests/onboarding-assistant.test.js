import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantTopics,assistantTransition} from '../server/onboarding-assistant.js';
const now=Date.parse('2026-10-23T12:00:00+03:00');
test('new account receives one persisted welcome, old account does not get unsolicited welcome',()=>{
 const fresh=assistantTransition(null,{},now,new Date(now).toISOString());assert.equal(fresh.welcomeRead,false);
 const read=assistantTransition(fresh,{action:'read'},now);assert.equal(assistantTransition(read,{},now).welcomeRead,true);
 assert.equal(assistantTransition(null,{},now,'2026-01-01').welcomeRead,true);
});
test('answers are whitelisted, retries do not duplicate and history is bounded',()=>{
 let s=assistantTransition(null,{},now,new Date(now).toISOString());
 const body={action:'ask',topicId:'profile',requestId:'request-123'};
 s=assistantTransition(s,body,now);assert.equal(assistantTransition(s,body,now).history.length,1);
 assert.throws(()=>assistantTransition(s,{...body,topicId:'invent-premium'},now));
 for(let i=0;i<30;i++)s=assistantTransition(s,{...body,requestId:`request-${i}`},now);
 assert.equal(s.history.length,20);
 assert.equal(s.welcomeRead,true);
});
test('mute survives reload and accepts only booleans',()=>{
 const s=assistantTransition(null,{action:'mute',muted:true},now);assert.equal(assistantTransition(s,{},now).muted,true);
 assert.throws(()=>assistantTransition(s,{action:'mute',muted:'false'},now));
 assert.equal(assistantTransition(s,{action:'mute',muted:false},now).welcomeRead,true);
});
test('beta wording switches at Moscow midnight and no fabricated booking',()=>{
 const answer=t=>assistantTopics(Date.parse(t)).find(x=>x.id==='premium').text;
 assert.match(answer('2026-12-31T23:59:59+03:00'),/бесплатным/);
 assert.match(answer('2027-01-01T00:00:00+03:00'),/завершён/);
 assert.match(assistantTopics(now).find(x=>x.id==='feed').text,/не заменяет билет/);
});
