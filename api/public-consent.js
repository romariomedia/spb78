import {randomUUID} from 'node:crypto';
import {cert,getApps,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {requireActiveUser} from '../server/user-status.js';
import {invalidatePublicProfiles} from '../server/public-profile-cache.js';
import {
  PUBLIC_CONSENT_GROUP_IDS,PUBLIC_DISSEMINATION_VERSION,
  publicConsentDocument,publicConsentState,revokedPublicConsentDocument
} from '../server/public-consent.js';

if(!getApps().length){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  initializeApp(raw?{credential:cert(JSON.parse(raw))}:undefined);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({error:'Требуется авторизация'});
    const {uid}=await getAuth().verifyIdToken(token,true);
    const db=getFirestore();
    const {profile:user}=await requireActiveUser(db,uid);
    const operation=String(req.body?.operation||'get');
    const consentRef=db.collection('publicDisseminationConsents').doc(uid);
    const userRef=db.collection('users').doc(uid);

    if(operation==='get'){
      const snap=await consentRef.get();
      const raw=snap.exists?snap.data()||{}:user.publicDissemination||{};
      return res.json({
        version:PUBLIC_DISSEMINATION_VERSION,
        availableGroups:PUBLIC_CONSENT_GROUP_IDS,
        consent:publicConsentState({publicDissemination:raw})
      });
    }

    if(operation==='grant'){
      if(req.body?.confirmed!==true||String(req.body?.version||'')!==PUBLIC_DISSEMINATION_VERSION)
        return res.status(409).json({code:'PUBLIC_CONSENT_CONFIRMATION_REQUIRED',error:'Подтвердите актуальное отдельное согласие на распространение персональных данных.'});
      const consent=publicConsentDocument(uid,req.body?.groups||[]);
      const eventId=randomUUID();
      await db.runTransaction(async tx=>{
        const current=await tx.get(userRef);
        if(!current.exists)throw Object.assign(new Error('Профиль не найден.'),{status:404});
        tx.set(consentRef,{...consent,updatedAt:consent.grantedAt},{merge:false});
        tx.update(userRef,{publicDissemination:consent});
        tx.create(db.collection('legalConsentEvents').doc(eventId),{
          id:eventId,ownerUserId:uid,kind:'public_dissemination',action:'grant',
          version:consent.version,groups:consent.groups,createdAt:consent.grantedAt
        });
      });
      invalidatePublicProfiles();
      return res.json({ok:true,consent:publicConsentState({publicDissemination:consent})});
    }

    if(operation==='revoke'){
      const now=new Date();
      let revoked;
      const eventId=randomUUID();
      await db.runTransaction(async tx=>{
        const [currentUser,currentConsent]=await Promise.all([tx.get(userRef),tx.get(consentRef)]);
        if(!currentUser.exists)throw Object.assign(new Error('Профиль не найден.'),{status:404});
        const previous=currentConsent.exists?currentConsent.data()||{}:currentUser.data()?.publicDissemination||{};
        revoked=revokedPublicConsentDocument(uid,previous,now);
        tx.set(consentRef,{...revoked,updatedAt:revoked.revokedAt},{merge:false});
        tx.update(userRef,{publicDissemination:revoked});
        tx.create(db.collection('legalConsentEvents').doc(eventId),{
          id:eventId,ownerUserId:uid,kind:'public_dissemination',action:'revoke',
          version:revoked.version,groups:revoked.groups,createdAt:revoked.revokedAt
        });
      });
      invalidatePublicProfiles();
      return res.json({ok:true,consent:publicConsentState({publicDissemination:revoked})});
    }

    return res.status(400).json({error:'Unknown operation'});
  }catch(error){
    const status=Number(error?.status||(error?.code?.startsWith?.('auth/')?401:500));
    if(status===500)console.error('[public-consent]',error);
    return res.status(status).json({
      ...(error?.code&&!String(error.code).startsWith('auth/')?{code:String(error.code)}:{}),
      error:status===500?'Не удалось изменить публичное согласие.':error.message
    });
  }
}
