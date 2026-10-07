import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import sharp from 'sharp';

export const MAX_EVIDENCE_BYTES=4*1024*1024;
const MAX_USER_BYTES=50*1024*1024;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});

function storageDirectory(){
  const dir=process.env.SB_PRIVATE_MEDIA_DIR;
  if(!dir||!isAbsolute(dir))throw fail('Закрытое хранилище документов ещё не настроено.',503);
  const path=resolve(dir),app=resolve(process.cwd());
  // Private evidence must survive release switches and never enter the web root.
  if(path===app||path.startsWith(app+sep))throw fail('Закрытое хранилище должно находиться вне каталога приложения.',503);
  return path;
}
export function evidenceId(value){
  if(typeof value!=='string'||!/^ev_[0-9a-f-]{36}$/.test(value))throw fail('Документ не найден.',404);
  return value;
}
export async function normalizeEvidence(input={}){
  const value=input.base64;
  if(typeof value!=='string'||value.length>Math.ceil(MAX_EVIDENCE_BYTES/3)*4||!value.length||value.length%4!==0||/[^A-Za-z0-9+/=]/.test(value))throw fail('Файл должен быть JPEG, PNG, WebP или PDF размером до 4 МБ.');
  const bytes=Buffer.from(value,'base64');
  if(!bytes.length||bytes.length>MAX_EVIDENCE_BYTES||bytes.toString('base64')!==value)throw fail('Размер документа — до 4 МБ.');
  if(bytes.subarray(0,5).toString()==='%PDF-')return {bytes,mime:'application/pdf',extension:'pdf'};
  try{
    const picture=sharp(bytes,{limitInputPixels:20_000_000,animated:false});
    const meta=await picture.metadata();
    if(!['jpeg','png','webp'].includes(meta.format))throw new Error('Unsupported image');
    const safe=await picture.rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
    return {bytes:safe,mime:'image/jpeg',extension:'jpg'};
  }catch{throw fail('Не удалось прочитать изображение. Загрузите JPEG, PNG, WebP или PDF.');}
}

export async function saveEvidence(db,uid,input,{migration=false}={}){
  const dir=storageDirectory();
  const file=await normalizeEvidence(input);
  const id='ev_'+randomUUID(),ref=db.collection('sportVerificationEvidence').doc(id);
  const quota=db.collection('sportEvidenceQuotas').doc(uid),now=Date.now();
  const day=new Date(now).toISOString().slice(0,10);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(quota),q=snap.data()||{};
    const count=q.day===day?Number(q.count||0):0;
    if((!migration&&count>=10)||Number(q.bytes||0)+file.bytes.length>MAX_USER_BYTES)throw fail('Лимит загрузок документов достигнут. Обратитесь в поддержку.',429);
    tx.set(quota,{day,count:count+(migration?0:1),bytes:Number(q.bytes||0)+file.bytes.length});
    tx.create(ref,{id,userId:uid,state:'uploading',mime:file.mime,extension:file.extension,bytes:file.bytes.length,createdAt:now});
  });
  try{
    await mkdir(dir,{recursive:true,mode:0o700});
    await writeFile(join(dir,id),file.bytes,{flag:'wx',mode:0o600});
    await ref.update({state:'ready'});
  }catch(error){
    await unlink(join(dir,id)).catch(()=>{});
    await db.runTransaction(async tx=>{
      const snap=await tx.get(quota),q=snap.data()||{};
      tx.set(quota,{...q,bytes:Math.max(0,Number(q.bytes||0)-file.bytes.length),count:q.day===day?Math.max(0,Number(q.count||0)-(migration?0:1)):Number(q.count||0)});
      tx.delete(ref);
    }).catch(()=>{});
    throw fail('Не удалось сохранить документ. Повторите загрузку.',503);
  }
  return {id,mime:file.mime,bytes:file.bytes.length};
}
export async function requireOwnedEvidence(db,id,uid){
  const snap=await db.collection('sportVerificationEvidence').doc(evidenceId(id)).get();
  const data=snap.data();
  if(!snap.exists||data?.userId!==uid||data.state!=='ready')throw fail('Документ не найден или недоступен.',404);
  return data;
}
export async function downloadEvidence(db,id,uid){
  const data=await requireOwnedEvidence(db,id,uid);
  let bytes;
  try{bytes=await readFile(join(storageDirectory(),evidenceId(id)));}
  catch(error){if(error?.status)throw error;throw fail('Документ временно недоступен.',503);}
  return {base64:bytes.toString('base64'),mime:data.mime,filename:`sportbuddy-confirmation.${data.extension}`};
}
