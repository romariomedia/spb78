export async function listVerificationRequests(db,{status='pending',cursor=''}={}){
  if(!['pending','approved','rejected','all'].includes(status))throw Object.assign(new Error('Некорректный фильтр заявок.'),{status:400});
  if(cursor&&(typeof cursor!=='string'||!/^[a-f0-9]{64}$/.test(cursor)))throw Object.assign(new Error('Некорректная страница заявок.'),{status:400});
  const collection=db.collection('sportVerificationRequests');
  let query=status==='all'?collection:collection.where('status','==',status);
  query=query.orderBy('updatedAtMs','desc');
  if(cursor){
    const last=await collection.doc(cursor).get();
    if(!last.exists)throw Object.assign(new Error('Список изменился. Обновите заявки.'),{status:409});
    query=query.startAfter(last);
  }
  const snap=await query.limit(51).get(),docs=snap.docs.slice(0,50);
  return {requests:docs.map(doc=>({id:doc.id,...doc.data()})),nextCursor:snap.docs.length>50?docs.at(-1).id:null};
}
