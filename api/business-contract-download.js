import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {renderBusinessContractRtf} from '../server/business-legal.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}
const clean=(value,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const contractId=clean(req.body?.contractId,180);
    if(!contractId||contractId.includes('/'))return res.status(400).json({error:'Некорректный договор'});
    const db=getFirestore();
    const snap=await db.collection('businessContracts').doc(contractId).get();
    if(!snap.exists)return res.status(404).json({error:'Договор не найден'});
    const contract=snap.data()||{};
    if(contract.ownerUserId!==uid)return res.status(403).json({error:'Нет доступа к договору'});
    const rtf=renderBusinessContractRtf(contract);
    const safe=String(contract.contractNumber||contractId).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80);
    res.setHeader('Content-Type','application/rtf; charset=utf-8');
    res.setHeader('Content-Disposition',`attachment; filename="SportBuddy78-contract-${safe}.rtf"`);
    return res.status(200).send(Buffer.from(rtf,'utf8'));
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[business-contract-download]',error);
    return res.status(status).json({error:status===500?'Не удалось сформировать договор.':error.message});
  }
}
