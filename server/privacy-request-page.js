import {FieldPath} from 'firebase-admin/firestore';

// Time + document ID gives stable pages even when timestamps are identical.
export async function privacyRequestPage(db,{ownerUserId,cursor,pageSize=50}={}){
  let query=db.collection('privacyRequests');
  if(ownerUserId)query=query.where('ownerUserId','==',ownerUserId);
  query=query.orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');
  if(cursor!==undefined&&cursor!==null){
    if(typeof cursor!=='object'||Array.isArray(cursor)||typeof cursor.id!=='string'||
      !cursor.id||cursor.id.length>150||cursor.id.includes('/')||typeof cursor.createdAt!=='string'||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(cursor.createdAt)||!Number.isFinite(Date.parse(cursor.createdAt)))
      throw Object.assign(new Error('Некорректная страница обращений.'),{status:400});
    query=query.startAfter(cursor.createdAt,cursor.id);
  }
  const snap=await query.limit(pageSize+1).get();
  const docs=snap.docs.slice(0,pageSize),last=docs.at(-1);
  return {docs,nextCursor:snap.docs.length>pageSize?{createdAt:last.data().createdAt,id:last.id}:null};
}
