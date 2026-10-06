import { initializeApp,getApps,cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAdminSession,writeAdminAudit } from '../server/admin-control.js';
import { reportStatus } from '../server/report-policy.js';

if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});

const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const db=getFirestore(),body=req.body||{};
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const op=String(body.operation||'list');
    if(op==='list'){
      const [reportsSnap,feedSnap,usersSnap]=await Promise.all([
        db.collection('reports').orderBy('createdAtMs','desc').limit(100).get().catch(()=>null),
        db.collection('feed').limit(100).get(),
        db.collection('users').limit(150).get()
      ]);
      const reports=reportsSnap?reportsSnap.docs.map(d=>({id:d.id,...d.data()})):[];
      const reportCounts=new Map();
      for(const r of reports){if(r.targetUserId)reportCounts.set(r.targetUserId,(reportCounts.get(r.targetUserId)||0)+1);}
      const posts=feedSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).slice(0,100);
      const profiles=usersSnap.docs.map(d=>{const v=d.data()||{};return{
        id:d.id,name:String(v.name||'Спортсмен').slice(0,120),avatar:String(v.avatar||''),districtId:String(v.districtId||''),
        sports:Array.isArray(v.sports)?v.sports.slice(0,8):[],isVerified:v.isVerified===true,isSuspended:v.isSuspended===true,
        hasRealPhoto:v.hasRealPhoto===true,registeredAt:v.registeredAt?.toDate?.()?.toISOString?.()||String(v.registeredAt||''),
        reportCount:Number(reportCounts.get(d.id)||0)
      }}).sort((a,b)=>b.reportCount-a.reportCount||String(b.registeredAt).localeCompare(String(a.registeredAt)));
      return res.json({reports,posts,profiles});
    }

    if(op==='setReportStatus'){
      const id=clean(body.id,180),status=reportStatus(body.status);
      const ref=db.collection('reports').doc(id),snap=await ref.get();
      if(!snap.exists)return res.status(404).json({error:'Жалоба не найдена.'});
      const before=snap.data()||{},after={...before,status,moderationNote:clean(body.note,500),updatedAt:new Date().toISOString(),updatedAtMs:Date.now(),moderatedBy:String(session.email||'admin')};
      await ref.set(after,{merge:false});
      await writeAdminAudit(db,session,{action:'moderation.report.status',entityType:'report',entityId:id,before:{status:before.status},after:{status,note:after.moderationNote},requestId:String(body.requestId||'')});
      return res.json({ok:true});
    }

    if(op==='setPostHidden'){
      const id=clean(body.id,180),hidden=body.hidden===true,reason=clean(body.reason,300);
      if(hidden&&reason.length<3)return res.status(400).json({error:'Укажите причину скрытия публикации.'});
      const ref=db.collection('feed').doc(id),snap=await ref.get();
      if(!snap.exists)return res.status(404).json({error:'Публикация не найдена.'});
      const before=snap.data()||{};
      const patch={isHidden:hidden,hiddenReason:hidden?reason:'',hiddenAt:hidden?new Date().toISOString():'',hiddenBy:hidden?String(session.email||'admin'):''};
      await ref.update(patch);
      await writeAdminAudit(db,session,{action:hidden?'moderation.post.hide':'moderation.post.restore',entityType:'feedPost',entityId:id,before:{isHidden:before.isHidden===true},after:{isHidden:hidden,reason:patch.hiddenReason},requestId:String(body.requestId||'')});
      return res.json({ok:true});
    }

    return res.status(400).json({error:'Unknown operation.'});
  }catch(error){
    const status=Number(error?.status||500);if(status===500)console.error('[admin-moderation]',error);
    return res.status(status).json({error:status===500?'Moderation Center unavailable.':error.message});
  }
}
