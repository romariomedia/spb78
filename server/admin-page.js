// Snapshot cursor includes Firestore's implicit document-id tie-breaker.
export async function readAdminPage(collection, cursor, field='updatedAtMs', size=50) {
  let query=collection.orderBy(field,'desc');
  if(cursor!==undefined && cursor!==null && cursor!=='') {
    if(typeof cursor!=='string'||cursor.length>180||cursor.includes('/'))throw Object.assign(new Error('Некорректный курсор списка.'),{status:400});
    const snapshot=await collection.doc(cursor).get();
    if(!snapshot.exists)throw Object.assign(new Error('Список изменился. Нажмите «Обновить».'),{status:409});
    query=query.startAfter(snapshot);
  }
  const snapshot=await query.limit(size+1).get();
  const docs=snapshot.docs.slice(0,size);
  return {items:docs.map(doc=>({...doc.data(),id:doc.id})),nextCursor:snapshot.docs.length>size?docs.at(-1).id:null};
}
