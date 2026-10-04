import { mkdir, writeFile, readFile, unlink, readdir, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { hasPremiumAccess } from '../shared/access-policy.js';

sharp.cache({memory:16,files:0,items:20});
sharp.concurrency(1);

export const STORY_TTL = 24*60*60*1000;
export const STORY_LIMIT = 5;
const idPattern=/^[0-9a-f-]{36}$/;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export const storyDir=()=>process.env.SB_STORIES_DIR || '/opt/sportbuddy-media/stories';
export function requireStoryPublisher(user,now=Date.now()) {
 if(!user || user.isArchived)throw fail('Профиль не найден',404);
 if(user.isVerified!==true)throw fail('Для публикации истории подтвердите профиль: личное фото и портфолио.',403);
 if(!hasPremiumAccess(user,now))throw fail('Для публикации историй нужен активный Premium.',403);
}
export async function prepareStoryImage(data) {
 if(typeof data!=='string'||data.length>3*1024*1024||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data))throw fail('Нужна фотография JPEG размером до 2 МБ.');
 const input=Buffer.from(data.slice(data.indexOf(',')+1),'base64');
 if(input.length>2*1024*1024)throw fail('Фотография должна быть меньше 2 МБ.');
 try {
  return await sharp(input,{limitInputPixels:6_000_000,animated:false}).rotate().resize({width:1080,height:1920,fit:'inside',withoutEnlargement:true}).jpeg({quality:80,mozjpeg:false}).toBuffer();
 } catch {throw fail('Не удалось прочитать фотографию. Выберите другой файл.');}
}
const publicStory=s=>({id:s.id,authorId:s.authorId,authorName:s.authorName,authorAvatar:s.authorAvatar,caption:s.caption,createdAt:s.createdAt,expiresAt:s.expiresAt});
const pending=new Set();
export async function createStory(db,uid,body,{dir=storyDir(),now=Date.now()}={}) {
 if(pending.has(uid)||pending.size>=2)throw fail('Загрузка уже идёт. Попробуйте чуть позже.',429);
 pending.add(uid);let file;
 try {
  if(typeof body.caption!=='string'||body.caption.length>240)throw fail('Подпись — не больше 240 символов.');
  if(!idPattern.test(String(body.requestId||'')))throw fail('Некорректный номер публикации');
  const userRef=db.collection('users').doc(uid);
  const contentHash=createHash('sha256').update(String(body.image)+body.caption).digest('hex');
  const existing=(await db.collection('stories').doc(body.requestId).get()).data();
  if(existing){if(existing.authorId!==uid||existing.contentHash!==contentHash)throw fail('Номер публикации уже использован',409);if(existing.expiresAt<=now)throw fail('История уже исчезла',410);return publicStory(existing);}
  requireStoryPublisher((await userRef.get()).data(),now);
  await mkdir(dir,{recursive:true,mode:0o700});
  const space=await statfs(dir);
  if(Number(space.bavail)*Number(space.bsize)<5*1024**3)throw fail('Загрузка временно недоступна: хранилище заполнено.',503);
  if((await readdir(dir)).filter(x=>x.endsWith('.jpg')).length>=2000)throw fail('Лимит хранилища историй достигнут. Попробуйте позже.',503);
  const image=await prepareStoryImage(body.image);
  const id=body.requestId, path=join(dir,id+'.jpg');
  await writeFile(path,image,{flag:'wx',mode:0o600});file=path;
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
  const quotaRef=db.collection('storyQuotas').doc(uid),ref=db.collection('stories').doc(id);
  const result=await db.runTransaction(async tx=>{
   const user=(await tx.get(userRef)).data();const quota=(await tx.get(quotaRef)).data();
   requireStoryPublisher(user,now);
   const count=quota?.day===day?Number(quota.count)||0:0;
   if(count>=STORY_LIMIT)throw fail('Сегодня уже опубликовано 5 историй. Новые — завтра.',429);
   const story={id,authorId:uid,authorName:String(user.name||'Спортсмен'),authorAvatar:String(user.avatar||''),caption:body.caption.trim(),createdAt:now,expiresAt:now+STORY_TTL,bytes:image.length,contentHash};
   tx.set(quotaRef,{day,count:count+1});tx.create(ref,story);return publicStory(story);
  });
  file=null;return result;
 } finally {if(file)await unlink(file).catch(()=>{});pending.delete(uid);}
}
export async function listStories(db, cursor, now=Date.now()) {
 let q=db.collection('stories').where('expiresAt','>',now).orderBy('expiresAt','desc');
 if(cursor){if(!idPattern.test(cursor))throw fail('Некорректная страница');const doc=await db.collection('stories').doc(cursor).get();if(doc.exists)q=q.startAfter(doc);}
 const page=await q.limit(60).get();
 return {stories:page.docs.map(d=>publicStory(d.data())),next:page.size===60?page.docs.at(-1).id:null};
}
export async function readStory(db,id,{dir=storyDir(),now=Date.now()}={}) {
 if(!idPattern.test(String(id)))throw fail('История не найдена',404);
 const s=(await db.collection('stories').doc(id).get()).data();
 if(!s||s.expiresAt<=now)throw fail('История уже исчезла',410);
 try{return {image:'data:image/jpeg;base64,'+(await readFile(join(dir,id+'.jpg'))).toString('base64'),expiresAt:s.expiresAt};}
 catch{throw fail('Фотография недоступна',404);}
}
export async function deleteStory(db,uid,id,{dir=storyDir()}={}) {
 if(!idPattern.test(String(id)))throw fail('История не найдена',404);
 const ref=db.collection('stories').doc(id);const s=(await ref.get()).data();
 if(!s)return;
 if(s.authorId!==uid)throw fail('Можно удалить только свою историю',403);
 // Remove visibility first; cleanup retries any remaining orphan file.
 await ref.delete();await unlink(join(dir,id+'.jpg')).catch(()=>{});
}
export async function cleanupStories(db,{dir=storyDir(),now=Date.now()}={}) {
 const expired=await db.collection('stories').where('expiresAt','<=',now).limit(200).get();
 for(const doc of expired.docs){if(idPattern.test(doc.id)){await unlink(join(dir,doc.id+'.jpg')).catch(e=>{if(e.code!=='ENOENT')throw e;});await doc.ref.delete();}}
 await mkdir(dir,{recursive:true,mode:0o700});
 for(const name of await readdir(dir)){
  if(!idPattern.test(name.replace(/\.jpg$/,''))||!name.endsWith('.jpg'))continue;
  const path=join(dir,name),info=await stat(path).catch(()=>null);
  if(info&&now-info.mtimeMs>STORY_TTL+3600000)await unlink(path).catch(()=>{});
 }
}
