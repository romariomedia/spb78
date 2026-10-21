import {sanitizeMassage} from './massage.js';
export const MASSAGE_SEED_ID='spb-spa-2026-10';
/** One receipt per entry makes retries safe, including after an admin deletes a card. */
export async function seedMassageCatalog(db,entries,{apply=false,now=Date.now()}={}){
 const validated=entries.map(({id,...item})=>{
  if(!/^spa-spb-[a-z0-9-]+$/.test(id))throw new Error('Invalid catalog ID');
  return {id,item:sanitizeMassage(item)};
 });
 if(new Set(validated.map(v=>v.id)).size!==validated.length)throw new Error('Duplicate catalog ID');
 const results=[];
 for(const {id,item} of validated){
  const ref=db.collection('massageServices').doc(id),receipt=db.collection('catalogImports').doc(`${MASSAGE_SEED_ID}-${id}`);
  results.push(await db.runTransaction(async tx=>{
   const [old,done]=await Promise.all([tx.get(ref),tx.get(receipt)]);
   const status=done.exists?'already-imported':old.exists?'existing-preserved':apply?'created':'would-create';
   if(apply&&!done.exists){
    if(!old.exists)tx.create(ref,{...item,createdAtMs:now,updatedAtMs:now});
    tx.create(receipt,{catalog:MASSAGE_SEED_ID,entityId:id,status,importedAtMs:now});
   }
   return {id,status};
  }));
 }
 return results;
}
