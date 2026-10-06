import { createHash } from 'node:crypto';
export const notificationId = value => createHash('sha256').update(value).digest('hex');
export const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({messages:true,friends:true,trainings:true,events:true,quiet:false,quietStart:23,quietEnd:8,radiusKm:25});
export function cleanSettings(input={}) {
  const p={...DEFAULT_NOTIFICATION_SETTINGS};
  for(const key of ['messages','friends','trainings','events','quiet']) if(typeof input[key]==='boolean')p[key]=input[key];
  for(const key of ['quietStart','quietEnd']) if(Number.isInteger(input[key])&&input[key]>=0&&input[key]<=23)p[key]=input[key];
  if([5,10,25,50,100].includes(input.radiusKm))p.radiusKm=input.radiusKm;
  return p;
}
export function isQuiet(settings,now=Date.now()) {
  if(!settings.quiet || settings.quietStart===settings.quietEnd)return false;
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'}).format(now));
  return settings.quietStart<settings.quietEnd ? hour>=settings.quietStart&&hour<settings.quietEnd : hour>=settings.quietStart||hour<settings.quietEnd;
}
export function matchesTraining(user,t,radiusKm=25) {
  if(!user || t.isCompleted || user.id===t.createdBy || (t.participantIds||[]).includes(user.id))return false;
  if((t.participantIds||[]).length>=Number(t.participantsMax))return false;
  const starts=Date.parse(`${t.dateKey}T${t.time}:00+03:00`);
  if(!Number.isFinite(starts)||starts<=Date.now())return false;
  if(t.participantGender&&t.participantGender!=='any'&&(user.genderSet===false||user.gender!==t.participantGender))return false;
  if(!Array.isArray(user.sports)||!user.sports.includes(t.sport))return false;
  if(![user.lat,user.lng,t.lat,t.lng].every(x=>typeof x==='number'&&Number.isFinite(x)))return false;
  const rad=x=>x*Math.PI/180,dLat=rad(t.lat-user.lat),dLng=rad(t.lng-user.lng);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(user.lat))*Math.cos(rad(t.lat))*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))<=radiusKm;
}
// Called INSIDE the business transaction: either both writes commit or neither does.
export function enqueueNotification(tx,db,{id,...job}) {
  tx.set(db.collection('notificationOutbox').doc(notificationId(id)),{
    ...job,title:String(job.title||'SportBuddy').slice(0,100),message:String(job.message||'').slice(0,240),link:String(job.link||'#notifications').slice(0,512),eventId:notificationId(id),createdAt:Date.now(),expiresAt:Number(job.expiresAt)||Date.now()+86400000,
    status:'pending',nextAttemptAt:Number(job.nextAttemptAt)||0,attempts:0,cursor:'',offset:0
  });
}
export function mergeInbox(entries,item,now=Date.now()) {
  return [item,...entries.filter(n=>n.id!==item.id&&n.createdAt>now-30*86400000)].slice(0,100);
}
