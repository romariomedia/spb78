import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });
const db=getFirestore();
const PRIVATE=['email','phone','birthDate','hideBirthDate','hidePhone','deviceId'];
const snap=await db.collection('users').get(); const writer=db.bulkWriter(); let migrated=0;
for(const doc of snap.docs){ const data=doc.data(); const privateData={uid:doc.id}; const deletes={}; for(const key of PRIVATE){ if(data[key]!==undefined){ privateData[key]=data[key]; deletes[key]=FieldValue.delete(); }} if(Object.keys(privateData).length>1){ writer.set(db.collection('usersPrivate').doc(doc.id),privateData,{merge:true}); writer.update(doc.ref,deletes); migrated++; }}
await writer.close(); console.log(`Migrated ${migrated} user profiles to usersPrivate`);
