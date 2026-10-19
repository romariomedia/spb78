import {getApps,initializeApp,cert} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {GUEST_SECTIONS,readGuestCatalog,createGuestReader} from '../server/guest-catalog.js';
const read=createGuestReader(section=>readGuestCatalog(getFirestore(),section));
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Только просмотр'});
 const section=req.query?.section;
 if(typeof section!=='string'||!GUEST_SECTIONS.includes(section))return res.status(400).json({error:'Неизвестный раздел'});
 try{
  if(!getApps().length)initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
  return res.json({items:await read(section)});
 }catch{return res.status(503).json({error:'Не удалось загрузить каталог. Попробуйте ещё раз.'});}
}
