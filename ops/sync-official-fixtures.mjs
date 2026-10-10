#!/usr/bin/env node
// Run with a constrained service account on the Russian VPS, e.g. every 6 hours.
// Feeds must be explicitly configured permissioned JSON endpoints; no scraping.
import { readFile } from 'node:fs/promises';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeFixture, validateFeedSource } from '../server/official-fixture-import.js';

async function main() {
  const raw = JSON.parse(await readFile(process.env.SB_OFFICIAL_FEEDS_FILE || '/etc/sportbuddy/official-feeds.json','utf8'));
  if (!Array.isArray(raw) || raw.length > 20) throw new Error('Invalid feed configuration');
  const sources = raw.map(validateFeedSource);
  if (sources.some(x=>!x)) throw new Error('Unapproved feed host or source');
  if (!getApps().length) initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  const db=getFirestore();
  let inserted=0,updated=0,skipped=0;
  for (const source of sources) {
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),12000);
    let payload;
    try {
      const response=await fetch(source.url,{signal:controller.signal,redirect:'manual',headers:{accept:'application/json'}});
      if (!response.ok || response.status>=300 || !String(response.headers.get('content-type')).includes('application/json')) throw new Error('Calendar feed unavailable');
      const body=await response.text();
      if(body.length>2_000_000)throw new Error('Calendar response too large');
      payload=JSON.parse(body);
    } finally { clearTimeout(timeout); }
    if (!Array.isArray(payload.events) || payload.events.length>300) throw new Error('Invalid calendar feed payload');
    for(const row of payload.events){
      const event=normalizeFixture(row,source);
      if(!event){skipped++;continue;}
      const ref=db.collection('events').doc(event.id);
      const outcome=await db.runTransaction(async tx=>{
        const snap=await tx.get(ref), old=snap.exists?snap.data():null;
        if(old && old.isImported!==true)return 'skipped'; // Admin-owned record wins
        const participantIds=Array.isArray(old?.participantIds)?old.participantIds:[];
        const data={...event, participantIds,createdAt:old?.createdAt||new Date().toISOString(),createdBy:old?.createdBy||'official-feed',lastSyncedAt:new Date().toISOString()};
        // Admin can explicitly hide imported events without losing the override.
        if(old?.adminHidden===true)data.status='draft';
        tx.set(ref,data);
        const chatRef=db.collection('chats').doc('event_'+event.id);
        if(old && data.status!=='published')tx.set(chatRef,{archivedAt:new Date().toISOString()},{merge:true});
        return old?'updated':'inserted';
      });
      if(outcome==='inserted')inserted++;else if(outcome==='updated')updated++;else skipped++;
    }
  }
  process.stdout.write(JSON.stringify({ok:true,sources:sources.length,inserted,updated,skipped})+'\n');
}
main().catch(error=>{process.stderr.write('Official calendar sync failed: '+String(error?.message||error)+'\n');process.exitCode=1;});
