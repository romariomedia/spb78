import { getFirestore,FieldPath } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { cleanSettings,isQuiet,matchesTraining,mergeInbox } from './notification-policy.js';

export async function deliverNotification(db,messaging,job,uid) {
  if(uid===job.actorId)return;
  const [userSnap,prefSnap]=await Promise.all([db.collection('users').doc(uid).get(),db.collection('notificationSettings').doc(uid).get()]);
  if(!userSnap.exists)return;
  const user={...userSnap.data(),id:uid},prefs=cleanSettings(prefSnap.data());
  if((user.blockedUserIds||[]).includes(job.actorId)||(job.kind!=='push_test'&&!prefs[job.category]))return;
  if(job.kind==='training_new') {
    const latest=await db.collection('trainings').doc(job.entityId).get();
    if(!latest.exists||!matchesTraining(user,latest.data(),prefs.radiusKm))return;
  }
  if(job.kind==='event_new') {
    const latest=await db.collection('events').doc(job.entityId).get();
    if(!latest.exists||latest.data().status!=='published')return;
  }
  const inbox=db.collection('notificationInboxes').doc(uid);
  const item={id:job.eventId,title:job.title,message:job.message,link:job.link,type:job.kind,createdAt:job.createdAt,read:false,pushDone:false};
  const shouldSend=await db.runTransaction(async tx=>{
    const snap=await tx.get(inbox),entries=snap.data()?.entries||[],existing=entries.find(n=>n.id===item.id);
    if(existing)return !existing.pushDone&&!existing.read;
    tx.set(inbox,{entries:mergeInbox(entries,item)});return true;
  });
  if(!shouldSend)return;
  // Quiet hours suppress the external alert; the inbox still receives the event.
  if(job.kind==='push_test'||!isQuiet(prefs)) {
    const devices=await db.collection('pushDevices').where('uid','==',uid).limit(20).get();
    for(const device of devices.docs) {
      if(device.data().updatedAt<Date.now()-90*86400000){await device.ref.delete();continue;}
      try {
        await messaging.send({token:device.data().token,data:{title:job.title,body:job.message,link:job.link,eventId:job.eventId,tag:job.kind==='message'?job.link:job.eventId,recipient:uid},webpush:{headers:{TTL:'3600',Urgency:'normal'}}});
      }catch(e){
        if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e.code))await device.ref.delete();
        else throw e;
      }
    }
  }
  await db.runTransaction(async tx=>{const s=await tx.get(inbox);if(s.exists)tx.update(inbox,{entries:s.data().entries.map(n=>n.id===item.id?{...n,pushDone:true}:n)});});
}

// Runs alongside the single PM2 API process. Durable Firestore jobs survive restarts.
// Snapshot subscription avoids a database poll every few seconds on Spark.
export function startNotificationWorker() {
  const db=getFirestore(),messaging=getMessaging();let jobs=[],busy=false,stopped=false,timer,dirty=false;
  const wake=()=>{dirty=true;clearTimeout(timer);if(!stopped&&!busy)timer=setTimeout(drain,250);};
  async function drain(){
    if(busy||stopped)return;busy=true;dirty=false;
    try {
      for(const snapshot of jobs) {
        if(stopped)break;
        if(snapshot.data().nextAttemptAt>Date.now())continue;
        const job=await db.runTransaction(async tx=>{
          const s=await tx.get(snapshot.ref),j=s.data();
          if(!j||j.nextAttemptAt>Date.now())return null;
          // Lease also prevents two processes delivering the same job concurrently.
          tx.update(snapshot.ref,{nextAttemptAt:Date.now()+120000});return j;
        });
        if(!job)continue;
        try {
          if(job.expiresAt<=Date.now()){await snapshot.ref.delete();continue;}
          let recipients,more=false,nextCursor=job.cursor;
          if(job.broadcast) {
            let q=db.collection('users').orderBy(FieldPath.documentId()).limit(50);
            if(job.cursor)q=q.startAfter(job.cursor);
            const page=await q.get();recipients=page.docs.map(d=>d.id);more=page.size===50;nextCursor=recipients.at(-1)||job.cursor;
          }else recipients=(job.recipients||[]).slice(job.offset,job.offset+20);
          for(const uid of recipients)await deliverNotification(db,messaging,job,uid);
          const offset=job.offset+recipients.length;
          if(more||(!job.broadcast&&offset<(job.recipients||[]).length))await snapshot.ref.update({cursor:nextCursor,offset,nextAttemptAt:0});
          else await snapshot.ref.delete();
        }catch(e){
          const attempts=job.attempts+1;
          // Keep failed records for diagnosis; no tokens or message bodies in logs.
          await snapshot.ref.update({attempts,status:attempts>=8?'failed':'pending',nextAttemptAt:Date.now()+Math.min(3600000,15000*2**attempts),lastError:String(e.code||'delivery-failed').slice(0,100)});
          console.error('[notifications] delivery deferred',String(e.code||'delivery-failed'));
        }
      }
    }catch {console.error('[notifications] worker unavailable');}
    finally {busy=false;if(!stopped)timer=setTimeout(drain,dirty?250:30000);}
  }
  let unsubscribe=()=>{};
  const listen=()=>{if(stopped)return;unsubscribe=db.collection('notificationOutbox').where('status','==','pending').limit(50).onSnapshot(s=>{jobs=s.docs;wake();},()=>{console.error('[notifications] subscription unavailable');jobs=[];setTimeout(listen,30000).unref();});};
  listen();return()=>{stopped=true;clearTimeout(timer);unsubscribe();};
}
