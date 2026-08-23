// api/verify-profile.js
// Vercel Serverless Function: server-side profile verification + 30-day trial.
// Replaces the Firebase Cloud Function `verifyMyProfile` (Blaze-free backend).
//
// Reads the user's persisted avatar + portfolio from Firestore, validates them,
// sets the trusted `isVerified` flag, and grants the 30-day welcome Premium
// only when no paid/active premium exists. Uses Firebase Admin SDK, so it
// bypasses Security Rules by design.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))
  });
}

const PLACEHOLDER_PATTERN = /ui-avatars|placeholder|dicebear|gravatar\.com\/avatar\/00000/i;

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();const decoded=await getAuth().verifyIdToken(token);const db=getFirestore();const ref=db.collection('users').doc(decoded.uid);const snap=await ref.get();if(!snap.exists)return res.status(404).json({error:'User not found'});const user=snap.data();if(user.isVerified===true){const current=user.premiumUntil?.toDate?user.premiumUntil.toDate().toISOString():String(user.premiumUntil||'');return res.status(200).json({ok:true,verifiedAt:user.verifiedAt||null,premiumGranted:false,premiumUntil:current});}const avatar=String(user.avatar||'').trim(),portfolio=Array.isArray(user.photoPortfolio)?user.photoPortfolio.filter(x=>typeof x==='string'&&x.trim()):[];if(!avatar||PLACEHOLDER_PATTERN.test(avatar)||portfolio.length===0)return res.status(412).json({error:'Для верификации нужны личная фотография и минимум одно фото в портфолио.'});const registered=user.registeredAt?.toDate?user.registeredAt.toDate().getTime():Date.parse(String(user.registeredAt||''));if(Number.isFinite(registered)&&Date.now()-registered>24*60*60*1000)return res.status(410).json({error:'Срок верификации 24 часа истёк.'});const now=new Date(),update={hasRealPhoto:true,isVerified:true,verifiedAt:now.toISOString()};let premiumGranted=false,premiumUntil='';const existingUntil=user.premiumUntil?.toDate?user.premiumUntil.toDate().getTime():Date.parse(String(user.premiumUntil||''));const active=Number.isFinite(existingUntil)&&existingUntil>Date.now();if(!user.welcomeTrialGrantedAt&&!active&&user.subscriptionPlan!=='premium'){const end=new Date(Date.now()+30*24*60*60*1000);premiumGranted=true;premiumUntil=end.toISOString();Object.assign(update,{subscriptionPlan:'premium',premiumUntil:Timestamp.fromDate(end),trialPremiumEndsAt:premiumUntil,rewardPremiumEndsAt:premiumUntil,welcomeTrialGrantedAt:now.toISOString()});}else{premiumUntil=user.premiumUntil?.toDate?user.premiumUntil.toDate().toISOString():String(user.premiumUntil||'');}await ref.set(update,{merge:true});return res.status(200).json({ok:true,verifiedAt:now.toISOString(),premiumGranted,premiumUntil});}catch(e){console.error('[verify-profile]',e);return res.status(e.code?.startsWith?.('auth/')?401:500).json({error:'Не удалось подтвердить профиль'});}
}
