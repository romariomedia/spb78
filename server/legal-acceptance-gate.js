import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {USER_LEGAL_VERSION} from '../shared/legal-version.js';

export function requiresLegalAcceptance(name,req){
  if(req.method!=='POST')return false;
  const b=req.body||{};
  if(name==='sportbuddy-mutation')return !['bootstrapProfile','syncIdentity','myPromos'].includes(b.action)&&!(b.action==='chat'&&b.operation==='history');
  if(name==='sport-id-verification')return ['trainerServices','trainerSave','trainerSubmit','submit','bookingCreate','bookingAccept'].includes(b.action);
  if(name==='sport-passport')return b.action==='update'||(b.action==='setPublic'&&b.enabled===true);
  if(name==='stories')return b.action==='create';
  if(name==='public-consent')return b.operation==='grant';
  if(name==='business-legal-profile')return b.operation==='save';
  return ['feed-create','create-payment','create-business-payment','verify-profile'].includes(name);
}

// Gate only product writes. Login, legal/privacy requests, revocation, admin and webhooks remain reachable.
export async function enforceLegalAcceptance(name,req,res){
  if(!requiresLegalAcceptance(name,req))return false;
  res.setHeader('Cache-Control','private, no-store');
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token){res.status(401).json({error:'Требуется авторизация'});return true;}
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const docs=await Promise.all(['terms','personal_data'].map(kind=>db.collection('legalAcceptances').doc(`${uid}:${kind}:${USER_LEGAL_VERSION}`).get()));
    if(docs.every(doc=>doc.exists))return false;
    res.status(428).json({code:'LEGAL_ACCEPTANCE_REQUIRED',version:USER_LEGAL_VERSION,updateUrl:'https://sportbuddy78.pro',error:'Подтвердите актуальные документы SportBuddy78. Если окно подтверждения не появляется, обновите приложение или войдите на sportbuddy78.pro и подтвердите документы там.'});
    return true;
  }catch(error){
    const authError=error?.code?.startsWith?.('auth/');
    res.status(authError?401:503).json({error:authError?'Войдите в аккаунт заново.':'Не удалось проверить согласия. Повторите действие позже.'});
    return true;
  }
}
