import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore,FieldPath} from 'firebase-admin/firestore';
import {readUserStatus} from '../server/user-status.js';
import {publicFeedPost} from '../server/public-feed.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  res.setHeader('Cache-Control','private, no-store');
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется вход'});
    if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
    const {uid}=await getAuth().verifyIdToken(token,true),db=getFirestore();
    await readUserStatus(db,uid);
    const cursor=req.body?.cursor;
    if(cursor!==undefined && (typeof cursor!=='string'||!cursor||cursor.includes('/')||cursor.length>180))
      return res.status(400).json({error:'Некорректная страница'});
    // Document-id pagination includes legacy posts without createdAt/isHidden.
    let query=db.collection('feed').orderBy(FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor);
    const snap=await query.get();
    return res.json({posts:snap.docs.map(doc=>publicFeedPost(doc.id,doc.data())).filter(Boolean),
      nextCursor:snap.docs.length===100?snap.docs.at(-1).id:null});
  }catch(error){
    const status=error.code?.startsWith?.('auth/')?401:error.status||500;
    return res.status(status).json({error:status===401?'Требуется повторный вход':status===403?'Аккаунт ограничен':'Не удалось загрузить ленту'});
  }
}
