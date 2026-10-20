import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
// Call before any transaction writes. Older APKs without requestId remain supported.
export async function adminCreateReceipt(tx,db,session,kind,requestId,payload) {
  if(requestId===undefined||requestId==='')return {save:()=>{}};
  if(typeof requestId!=='string'||! /^[a-zA-Z0-9_-]{1,128}$/.test(requestId))throw Object.assign(new Error('Некорректный ключ сохранения.'),{status:400});
  const ref=db.collection('adminMutationReceipts').doc(digest(`${session.adminKey||session.sessionId}|${kind}|${requestId}`));
  const hash=digest(JSON.stringify(canonical(payload??null)));
  const snap=await tx.get(ref);
  if(snap.exists){
    const data=snap.data();
    if(data.hash!==hash)throw Object.assign(new Error('Этот запрос уже использован для другой карточки. Обновите форму.'),{status:409});
    return {result:data.result,save:()=>{}};
  }
  return {save:result=>tx.create(ref,{hash,result,createdAt:new Date().toISOString()})};
}
