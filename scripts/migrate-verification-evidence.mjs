// Copies legacy evidence to the private VPS directory. Default: inventory only.
// Public Cloudinary assets are deliberately NOT deleted by this script:
// verify the private copy and remove their public copies in Cloudinary afterwards.
import 'dotenv/config';
import {initializeApp,cert} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {saveEvidence,downloadEvidence,MAX_EVIDENCE_BYTES} from '../server/verification-evidence.js';

initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY||'{}'))});
const db=getFirestore(),apply=process.argv.includes('--apply');
const cloud=process.env.CLOUDINARY_CLOUD_NAME||process.env.VITE_CLOUDINARY_CLOUD_NAME||'qndhzp3o';
const totals={scanned:0,legacy:0,migrated:0,reviewRequired:0,apply};
let cursor;
for(;;){
 let query=db.collection('sportVerificationRequests').orderBy('__name__').limit(100);
 if(cursor)query=query.startAfter(cursor);
 const page=await query.get();if(page.empty)break;
 for(const doc of page.docs){
  totals.scanned++;const value=doc.data();if(!value.evidenceUrl||value.evidenceId)continue;
  totals.legacy++;
  const record=db.collection('sportEvidenceMigrations').doc(doc.id);
  try{
   const url=new URL(value.evidenceUrl);
   if(url.protocol!=='https:'||url.hostname!=='res.cloudinary.com'||url.username||url.password||url.port||!url.pathname.startsWith('/'+cloud+'/'))throw new Error('Review foreign storage');
   if(!apply)continue;
   // A completed private copy can be reused safely after an interrupted migration.
   const previous=(await record.get()).data();
   let id=previous?.sourceUrl===value.evidenceUrl&&previous?.userId===value.userId?previous.evidenceId:'';
   if(id){await downloadEvidence(db,id,value.userId);}
   else{
    const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30_000)});
    if(!response.ok||Number(response.headers.get('content-length')||0)>MAX_EVIDENCE_BYTES)throw new Error('Download unavailable or too large');
    const parts=[];let size=0;
    for await(const chunk of response.body){size+=chunk.length;if(size>MAX_EVIDENCE_BYTES)throw new Error('File too large');parts.push(chunk);}
    const saved=await saveEvidence(db,value.userId,{base64:Buffer.concat(parts).toString('base64')},{migration:true});id=saved.id;
    // Admin-only migration record retains the old URL for later deletion at source.
    await record.set({userId:value.userId,requestId:doc.id,sourceUrl:value.evidenceUrl,evidenceId:id,publicCopyRemovalRequired:true,createdAt:new Date().toISOString()});
   }
   await db.runTransaction(async tx=>{
    const fresh=await tx.get(doc.ref);
    if(fresh.data()?.evidenceUrl!==value.evidenceUrl||fresh.data()?.evidenceId)throw new Error('Request changed; review migration record');
    tx.update(doc.ref,{evidenceId:id,evidenceUrl:FieldValue.delete()});
   });
   totals.migrated++;
  }catch{
   totals.reviewRequired++;
   // No private document URLs, contents or provider errors in process logs.
   console.error('Manual review required for request',doc.id);
  }
 }
 cursor=page.docs.at(-1);
}
console.log(JSON.stringify(totals));
if(totals.reviewRequired)process.exitCode=1;
