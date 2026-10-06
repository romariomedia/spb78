import { randomUUID } from 'node:crypto';
import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { enqueueNotification,notificationId } from '../server/notification-policy.js';
import {
  resolveAdminPushAudience,sanitizeAdminPushAudience,sanitizeAdminPushContent,sanitizeAdminPushSchedule
} from '../server/admin-push.js';

if(!getApps().length){
  initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
}

function campaignView(doc){
  const d=doc.data()||{};
  return {
    id:doc.id,title:String(d.title||''),message:String(d.message||''),link:String(d.link||''),
    audience:d.audience||{},audienceCount:Number(d.audienceCount||0),processedCount:Number(d.processedCount||0),
    status:String(d.status||'queued'),createdAt:String(d.createdAt||''),scheduledAt:String(d.scheduledAt||''),
    completedAt:String(d.completedAt||''),createdBy:String(d.createdBy||''),lastError:String(d.lastError||'')
  };
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'list');

    if(operation==='list'){
      const snap=await db.collection('adminPushCampaigns').orderBy('createdAtMs','desc').limit(50).get();
      return res.json({campaigns:snap.docs.map(campaignView)});
    }

    if(operation==='preview'){
      const audience=sanitizeAdminPushAudience(body.audience||{});
      const content=sanitizeAdminPushContent(body);
      const scheduledAtMs=sanitizeAdminPushSchedule(body.scheduledAt);
      const resolved=await resolveAdminPushAudience(db,audience);
      if(resolved.count<1)return res.status(409).json({error:'По выбранным фильтрам нет получателей.'});

      const previewId=randomUUID();
      const preview={
        id:previewId,audience,...content,audienceCount:resolved.count,sample:resolved.sample,
        scheduledAtMs,scheduledAt:new Date(scheduledAtMs).toISOString(),
        adminKey:String(session.adminKey||''),adminEmail:String(session.email||''),
        createdAt:new Date().toISOString(),createdAtMs:Date.now(),expiresAtMs:Date.now()+10*60*1000
      };
      await db.collection('adminPushPreviews').doc(previewId).set(preview);
      return res.json({preview:{
        id:previewId,audience:preview.audience,audienceCount:preview.audienceCount,sample:preview.sample,
        title:preview.title,message:preview.message,link:preview.link,scheduledAt:preview.scheduledAt,
        expiresAt:new Date(preview.expiresAtMs).toISOString()
      }});
    }

    if(operation==='send'){
      const previewId=String(body.previewId||'').trim();
      if(!previewId||previewId.includes('/'))return res.status(400).json({error:'Предпросмотр недействителен.'});
      const previewRef=db.collection('adminPushPreviews').doc(previewId);
      const campaignId=randomUUID();
      const campaignRef=db.collection('adminPushCampaigns').doc(campaignId);
      const queueId=notificationId(`admin-push:${campaignId}`);
      const queueRef=db.collection('notificationOutbox').doc(queueId);
      const now=Date.now();

      const campaign=await db.runTransaction(async tx=>{
        const snap=await tx.get(previewRef);
        if(!snap.exists)throw Object.assign(new Error('Предпросмотр истёк. Выполните проверку аудитории заново.'),{status:409});
        const preview=snap.data()||{};
        if(preview.expiresAtMs<=now)throw Object.assign(new Error('Предпросмотр истёк. Выполните проверку аудитории заново.'),{status:409});
        if(String(preview.adminKey||'')!==String(session.adminKey||''))throw Object.assign(new Error('Предпросмотр принадлежит другой сессии администратора.'),{status:403});

        const scheduledAtMs=Math.max(now,Number(preview.scheduledAtMs||now));
        const value={
          id:campaignId,title:preview.title,message:preview.message,link:preview.link,
          audience:preview.audience,audienceCount:Number(preview.audienceCount||0),processedCount:0,
          status:scheduledAtMs>now+1000?'scheduled':'queued',
          createdAt:new Date(now).toISOString(),createdAtMs:now,
          scheduledAt:new Date(scheduledAtMs).toISOString(),scheduledAtMs,
          createdBy:String(session.email||'admin'),queueId
        };
        tx.create(campaignRef,value);
        enqueueNotification(tx,db,{
          id:`admin-push:${campaignId}`,actorId:'',broadcast:true,adminAudience:preview.audience,
          campaignId,category:'events',kind:'admin_broadcast',
          title:preview.title,message:preview.message,link:preview.link,
          nextAttemptAt:scheduledAtMs,expiresAt:scheduledAtMs+24*60*60*1000
        });
        tx.delete(previewRef);
        return value;
      });

      await writeAdminAudit(db,session,{
        action:'push.send',entityType:'pushCampaign',entityId:campaignId,
        before:null,after:{audience:campaign.audience,audienceCount:campaign.audienceCount,title:campaign.title,scheduledAt:campaign.scheduledAt},
        requestId:String(body.requestId||'')
      });
      return res.json({ok:true,campaign:{...campaign}});
    }

    if(operation==='cancel'){
      const campaignId=String(body.campaignId||'').trim();
      if(!campaignId||campaignId.includes('/'))return res.status(400).json({error:'Рассылка не найдена.'});
      const campaignRef=db.collection('adminPushCampaigns').doc(campaignId);
      const result=await db.runTransaction(async tx=>{
        const snap=await tx.get(campaignRef);
        if(!snap.exists)throw Object.assign(new Error('Рассылка не найдена.'),{status:404});
        const campaign=snap.data()||{};
        if(campaign.status!=='scheduled'||Number(campaign.scheduledAtMs||0)<=Date.now()){
          throw Object.assign(new Error('Отменить можно только ещё не начавшуюся запланированную рассылку.'),{status:409});
        }
        if(campaign.queueId)tx.delete(db.collection('notificationOutbox').doc(String(campaign.queueId)));
        tx.update(campaignRef,{status:'cancelled',cancelledAt:new Date().toISOString(),cancelledBy:String(session.email||'admin')});
        return campaign;
      });
      await writeAdminAudit(db,session,{
        action:'push.cancel',entityType:'pushCampaign',entityId:campaignId,
        before:{status:result.status,scheduledAt:result.scheduledAt},after:{status:'cancelled'},
        requestId:String(body.requestId||'')
      });
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);
    if(status===500)console.error('[admin-push]',error);
    return res.status(status).json({error:status===500?'Push Center unavailable.':error.message});
  }
}
