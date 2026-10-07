import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { requireProductionAdminSecrets } from '../server/admin-control.js';
import { consumeAdminOtp } from '../server/admin-otp.js';

if (!getApps().length) initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))});

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    requireProductionAdminSecrets();
    const result=await consumeAdminOtp(getFirestore(),{
      email:req.body?.email,code:req.body?.code,pepper:process.env.ADMIN_OTP_PEPPER
    });
    return res.status(result.status).json(result.payload);
  } catch (error) {
    return res.status(error.status || 503).json({error:error.status ? error.message : 'Admin authentication temporarily unavailable.'});
  }
}
