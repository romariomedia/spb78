// Run only against an isolated Firestore emulator; never production.
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,getDoc,collection,getDocs,setDoc} from 'firebase/firestore';
const host=process.env.FIRESTORE_EMULATOR_HOST;
if(!host || !/^(127\.0\.0\.1|localhost):\d+$/.test(host))throw Error('Local Firestore emulator required');
const projectId='demo-sportbuddy-rules';
const base=`http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
for(const id of ['alice','bob']){
 const r=await fetch(`${base}/users/${id}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{name:{stringValue:id},friendIds:{arrayValue:{values:[{stringValue:'private-friend'}]}}}})});
 assert.equal(r.status,200,await r.text());
}
const app=initializeApp({projectId,apiKey:'demo-key'},'rules-audit');
try{
 const db=getFirestore(app);const [hostname,port]=host.split(':');
 connectFirestoreEmulator(db,hostname,Number(port),{mockUserToken:{sub:'alice',user_id:'alice'}});
 assert.equal((await getDoc(doc(db,'users','alice'))).exists(),true);
 await assert.rejects(getDoc(doc(db,'users','bob')),e=>e.code==='permission-denied');
 await assert.rejects(getDocs(collection(db,'users')),e=>e.code==='permission-denied');
 await assert.rejects(setDoc(doc(db,'users','alice'),{name:'Forged'}),e=>e.code==='permission-denied');
 console.log('PASS: own profile readable; foreign profile, collection listing and client writes denied');
}finally{await deleteApp(app)}
