import { randomBytes } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { buildUserDeletionPlan,executeSafeUserDeletion } from '../server/user-lifecycle.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),auth=getAuth(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const op=String(body.operation||'preview');
    const userId=clean(body.userId,180);
    if(!userId||userId.includes('/'))return res.status(400).json({error:'User id required.'});

    if(op==='preview'){
      const plan=await buildUserDeletionPlan(db,auth,userId);
      const previewId=randomBytes(18).toString('hex');
      const confirmationCode=`DELETE-${randomBytes(3).toString('hex').toUpperCase()}`;
      const expiresAtMs=Date.now()+10*60*1000;
      await db.collection('userDeletionPreviews').doc(previewId).set({
        previewId,userId,fingerprint:plan.fingerprint,confirmationCode,
        adminKey:String(session.adminKey||''),adminEmail:String(session.email||''),
        expiresAtMs,createdAt:new Date().toISOString()
      });
      return res.json({preview:{
        id:previewId,userId:plan.userId,name:plan.name,email:plan.email,isVerified:plan.isVerified,isSuspended:plan.isSuspended,
        registeredAt:plan.registeredAt,authCreatedAt:plan.authCreatedAt,authLastSignInAt:plan.authLastSignInAt,
        counts:plan.counts,blockers:plan.blockers,signals:plan.signals,classification:plan.classification,
        safeToDelete:plan.safeToDelete,confirmationCode:plan.safeToDelete?confirmationCode:'',expiresAt:new Date(expiresAtMs).toISOString()
      }});
    }

    if(op==='delete'){
      const previewId=clean(body.previewId,80),confirmation=clean(body.confirmation,80);
      if(!previewId||previewId.includes('/'))return res.status(400).json({error:'Предпросмотр недействителен.'});
      const previewRef=db.collection('userDeletionPreviews').doc(previewId);
      const previewSnap=await previewRef.get();
      if(!previewSnap.exists)return res.status(409).json({error:'Предпросмотр истёк. Выполните dry-run заново.'});
      const preview=previewSnap.data()||{};
      if(preview.userId!==userId||String(preview.adminKey||'')!==String(session.adminKey||''))return res.status(403).json({error:'Предпросмотр принадлежит другой сессии.'});
      if(Number(preview.expiresAtMs||0)<=Date.now())return res.status(409).json({error:'Предпросмотр истёк. Выполните dry-run заново.'});
      if(confirmation!==String(preview.confirmationCode||''))return res.status(400).json({error:'Код подтверждения не совпадает.'});

      const fresh=await buildUserDeletionPlan(db,auth,userId);
      if(fresh.fingerprint!==preview.fingerprint)return res.status(409).json({error:'Данные аккаунта изменились после dry-run. Выполните проверку заново.'});
      if(!fresh.safeToDelete)return res.status(409).json({error:'Аккаунт больше не соответствует условиям безопасного удаления.',blockers:fresh.blockers});

      const result=await executeSafeUserDeletion(db,auth,fresh);
      await previewRef.delete().catch(()=>{});
      await writeAdminAudit(db,session,{
        action:'user.deleteSafe',entityType:'user',entityId:userId,
        before:{name:fresh.name,email:fresh.email,classification:fresh.classification,counts:fresh.counts},
        after:{deleted:true,...result},requestId:String(body.requestId||'')
      });
      return res.json({ok:true,...result});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-user-lifecycle]',error);
    return res.status(status).json({error:status===500?'User lifecycle operation failed.':error.message});
  }
}
