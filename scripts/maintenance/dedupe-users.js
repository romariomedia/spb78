// One-off/admin maintenance endpoint for consolidating duplicate Firestore profiles.
// It never creates accounts. The e-mail/Firebase Auth UID is preferred as the
// canonical identity; VK ID is a second identity key used to find duplicates.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')) });

function keyFor(data) {
  const vk = String(data.vkId || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  return vk ? `vk:${vk}` : email ? `email:${email}` : '';
}

export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const secret=req.headers['x-dedupe-secret']; if(!process.env.DEDUPLICATION_SECRET||secret!==process.env.DEDUPLICATION_SECRET)return res.status(403).json({error:'Forbidden'});
  try{
    const db=getFirestore(),auth=getAuth(),snap=await db.collection('users').get(),groups=new Map();
    for(const d of snap.docs){const key=keyFor(d.data());if(!key)continue;const list=groups.get(key)||[];list.push(d);groups.set(key,list);}
    let mergedGroups=0,deletedProfiles=0,deletedAuthUsers=0;
    for(const [key,docs] of groups){if(docs.length<2)continue;const email=String(docs[0].data().email||'').trim().toLowerCase();let canonicalUid=null;try{if(email)canonicalUid=(await auth.getUserByEmail(email)).uid;}catch{};if(!canonicalUid)canonicalUid=docs.slice().sort((a,b)=>String(b.data().registeredAt||'').localeCompare(String(a.data().registeredAt||'')))[0].id;const canonicalRef=db.collection('users').doc(canonicalUid);const canonicalSnap=await canonicalRef.get();const merged=canonicalSnap.exists?canonicalSnap.data():{};for(const d of docs){if(d.id===canonicalUid)continue;for(const [k,v] of Object.entries(d.data()))if(merged[k]===undefined||merged[k]===null||merged[k]===''||(Array.isArray(merged[k])&&!merged[k].length))merged[k]=v;await d.ref.delete();deletedProfiles++;try{await auth.deleteUser(d.id);deletedAuthUsers++;}catch{}}await canonicalRef.set({...merged,id:canonicalUid}, {merge:true});mergedGroups++;}
    return res.status(200).json({ok:true,mergedGroups,deletedProfiles,deletedAuthUsers});
  }catch(error){console.error('[dedupe-users]',error);return res.status(500).json({error:'Deduplication failed'});}
}
