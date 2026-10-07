// Idempotent backfill: a moderator's existing visibility decision always wins.
export async function backfillFeedVisibility(db,{apply=false}={}){
  let cursor=null,scanned=0,missing=0,updated=0;
  for(;;){
    let query=db.collection('feed').orderBy('__name__').limit(200);
    if(cursor)query=query.startAfter(cursor);
    const page=await query.get();
    if(page.empty)break;
    for(const doc of page.docs){
      scanned++;
      if(typeof doc.data().isHidden==='boolean')continue;
      missing++;
      if(apply)updated+=await db.runTransaction(async tx=>{
        const fresh=await tx.get(doc.ref);
        if(!fresh.exists||typeof fresh.data().isHidden==='boolean')return 0;
        tx.update(doc.ref,{isHidden:false});return 1;
      });
    }
    cursor=page.docs.at(-1);
  }
  return {scanned,missing,updated,apply};
}
