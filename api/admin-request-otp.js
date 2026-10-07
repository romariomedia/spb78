import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { requireProductionAdminSecrets } from '../server/admin-control.js';
import { ADMIN_EMAIL, reserveAdminOtp, discardFailedOtp } from '../server/admin-otp.js';

if (!getApps().length) initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))});

export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  try {
    requireProductionAdminSecrets();
    const db=getFirestore();
    const result=await reserveAdminOtp(db,{
      email:req.body?.email,password:req.body?.password,
      expectedPassword:process.env.ADMIN_ACCESS_PASSWORD,pepper:process.env.ADMIN_OTP_PEPPER
    });
    if (result.status !== 200) return res.status(result.status).json(result.payload);
    try {
      const port=Number(process.env.SMTP_PORT || 465);
      const transporter=nodemailer.createTransport({
        host:process.env.SMTP_HOST,port,secure:port===465,
        auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},
        connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,
        disableFileAccess:true,disableUrlAccess:true
      });
      await transporter.sendMail({
        from:process.env.SMTP_FROM || ADMIN_EMAIL,to:ADMIN_EMAIL,
        subject:`SportBuddy78 — код входа в админку: ${result.code}`,
        text:`Ваш одноразовый код администратора SportBuddy78: ${result.code}\n\nКод действует 10 минут. Никому не сообщайте его.`
      });
    } catch {
      await discardFailedOtp(db,result.key,result.challengeId);
      return res.status(503).json({error:'Mail delivery failed. Request a new code.'});
    }
    return res.json(result.payload);
  } catch (error) {
    return res.status(error.status || 503).json({error:error.status ? error.message : 'Admin authentication temporarily unavailable.'});
  }
}
