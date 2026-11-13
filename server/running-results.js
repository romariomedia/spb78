import {createHash} from 'node:crypto';
export const resultId=(uid,id)=>createHash('sha256').update(uid+':'+id).digest('hex');
export const routeKey=r=>`${r.routeId}:v${r.routeVersion}`;
export function bestResult(results){
 return results.filter(r=>r.eligible&&r.published).sort((a,b)=>a.elapsedMs-b.elapsedMs||a.endedAt-b.endedAt)[0]||null;
}
export function publicResult(run){
 return {userId:run.userId,routeKey:routeKey(run),elapsedMs:run.elapsedMs,distanceM:run.distanceM,paceSecPerKm:run.paceSecPerKm,endedAt:run.endedAt};
}
// All reads precede writes; one best record per person and route version.
export async function writeResult(db,uid,run,id,remove=false){
 return db.runTransaction(async tx=>{
  const ref=db.collection('runningResults').doc(resultId(uid,id)),old=await tx.get(ref);
  if(!remove&&old.exists){
   if(old.data().fingerprint!==run.fingerprint)throw Object.assign(new Error('Эта пробежка уже сохранена с другими данными'),{status:409});
   return old.data();
  }
  const value=remove?old.data():run;
  if(!value)return null;
  let bestRef=null,best=null;
  if(value.routeId&&value.eligible&&value.published){
   const history=await tx.get(db.collection('runningResults').where('userId','==',uid).where('routeKey','==',routeKey(value)));
   const candidates=history.docs.map(d=>d.data()).filter(r=>r.id!==id);
   if(!remove)candidates.push(value);
   best=bestResult(candidates);
   bestRef=db.collection('runningBest').doc(resultId(uid,routeKey(value)));
  }
  if(remove)tx.delete(ref);else tx.create(ref,value);
  if(bestRef){if(best)tx.set(bestRef,publicResult(best));else tx.delete(bestRef);}
  return value;
 });
}
