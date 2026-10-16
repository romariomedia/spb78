import { publicProfileCache } from '../server/public-profile-cache.js';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldPath } from 'firebase-admin/firestore';
import { readUserStatus } from '../server/user-status.js';
import { publicProfile } from '../server/public-profile.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','private, no-store');
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    await readUserStatus(db,uid); // A newly authenticated account may still be bootstrapping.
    const cursor=req.body?.cursor;
    const ids=req.body?.ids;
    const pageSize=req.body?.pageSize ?? 200;
    const validId=id=>typeof id==='string' && id.length>0 && id.length<=128 && !id.includes('/');
    if(ids!==undefined){
      if(!Array.isArray(ids)||ids.length>50||!ids.every(validId)||cursor!==undefined)
        return res.status(400).json({error:'Некорректный список атлетов'});
      const unique=[...new Set(ids)].sort();
      const page=await publicProfileCache(db).get('ids:'+JSON.stringify(unique),async()=>{
        const docs=await Promise.all(unique.map(async id=>({id,snapshot:await db.collection('users').doc(id).get()})));
        return {profiles:docs.filter(({snapshot:s})=>s.exists && s.data().isSuspended!==true && s.data().isDemo!==true)
          .map(({id,snapshot:s})=>publicProfile(id,s.data())),nextCursor:null};
      });
      return res.status(200).json(page);
    }
    if(!Number.isInteger(pageSize)||pageSize<1||pageSize>200)
      return res.status(400).json({error:'Некорректный размер страницы'});
    if(cursor!==undefined && (typeof cursor!=='string'||!cursor||cursor.length>128||cursor.includes('/')))
      return res.status(400).json({error:'Некорректная страница'});
    const page=await publicProfileCache(db).get('page:'+JSON.stringify([pageSize,cursor || '']), async()=>{
      let query=db.collection('users').orderBy(FieldPath.documentId()).limit(pageSize);
      if(cursor)query=query.startAfter(cursor);
      const snap=await query.get();
      const profiles=snap.docs.filter(doc=>doc.data().isSuspended!==true && doc.data().isDemo!==true)
        .map(doc=>publicProfile(doc.id,doc.data()));
      return {profiles,nextCursor:snap.docs.length===pageSize?snap.docs.at(-1).id:null};
    });
    return res.status(200).json(page);
  }catch(error){
    const status=error.code?.startsWith?.('auth/')?401:error.status||500;
    return res.status(status).json({error:status===401?'Требуется повторный вход':status===403?'Аккаунт ограничен':'Не удалось загрузить анкеты'});
  }
}
