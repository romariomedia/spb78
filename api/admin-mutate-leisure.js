import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { LEISURE_DESTINATIONS } from '../shared/leisure-destinations.js';
import { requireAdminSession, writeAdminAudit } from '../server/admin-control.js';

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
}
const REGIONS=new Set(['spb','lo','karelia']);
const text=(value,max=300)=>typeof value==='string'?value.trim().slice(0,max):'';
function media(value){
  const v=text(value,1200);
  if(/^\/leisure\/[a-z0-9_-]+\.webp$/i.test(v))return v;
  try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
function url(value){
  const v=text(value,1200);if(!v)return '';
  try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}
}
function sanitize(input,id,existing=null){
  const region=REGIONS.has(input?.region)?input.region:'';
  const item={
    id,
    name:text(input?.name,160),
    region,
    format:text(input?.format,120),
    pace:text(input?.pace,80),
    description:text(input?.description,1800),
    plan:text(input?.plan,1800),
    access:text(input?.access,1800),
    source:url(input?.source),
    photo:media(input?.photo),
    photoCredit:text(input?.photoCredit,220),
    isPublished:input?.isPublished!==false,
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };
  if(item.name.length<2||!item.region||item.format.length<2||item.description.length<20||item.plan.length<10||item.access.length<10||!item.source||!item.photo){
    throw Object.assign(new Error('Заполните название, регион, формат, описание, план, условия, официальный источник и фото.'),{status:400});
  }
  return item;
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const body=req.body||{},db=getFirestore();
  try{
    const session=await requireAdminSession(db,body.sessionId);
    const operation=String(body.operation||'');
    if(operation==='list'){
      const snap=await db.collection('leisureDestinations').orderBy('name').get();
      return res.json({destinations:snap.docs.map(d=>({id:d.id,...d.data()}))});
    }
    if(operation==='seed'){
      const batch=db.batch();
      for(const raw of LEISURE_DESTINATIONS){
        const item=sanitize({...raw,isPublished:true},raw.id);
        batch.set(db.collection('leisureDestinations').doc(raw.id),item,{merge:true});
      }
      await batch.commit();
      await writeAdminAudit(db,session,{action:'leisure.seed',entityType:'leisureCatalog',entityId:'leisureDestinations',after:{count:LEISURE_DESTINATIONS.length}});
      return res.json({ok:true,count:LEISURE_DESTINATIONS.length});
    }
    const id=text(body.destinationId,100);
    if(!id||!/^[a-z0-9][a-z0-9_-]{1,99}$/i.test(id))return res.status(400).json({error:'Destination id required.'});
    const ref=db.collection('leisureDestinations').doc(id),beforeSnap=await ref.get(),before=beforeSnap.exists?beforeSnap.data():null;
    let after=null;
    if(operation==='delete'){
      if(!beforeSnap.exists)return res.status(404).json({error:'Destination not found.'});
      await ref.delete();
    }else if(operation==='create'){
      if(beforeSnap.exists)return res.status(409).json({error:'Destination already exists.'});
      after=sanitize(body.destination,id);await ref.create(after);
    }else if(operation==='update'){
      if(!beforeSnap.exists)return res.status(404).json({error:'Destination not found.'});
      after=sanitize({...before,...(body.patch||{})},id,before);await ref.set(after,{merge:false});
    }else return res.status(400).json({error:'Unknown operation.'});
    await writeAdminAudit(db,session,{action:`leisure.${operation}`,entityType:'leisureDestination',entityId:id,before,after,requestId:String(body.requestId||'')});
    return res.json({ok:true,destination:after});
  }catch(error){const status=Number(error?.status||500);return res.status(status).json({error:status===500?'Leisure mutation failed.':error.message});}
}
