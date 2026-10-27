import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,appendFile,rename,rm,stat,open,readdir} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';

export const APK_MAX_BYTES=150*1024*1024;
export const APK_CHUNK_BYTES=384*1024;

const clean=(v,max=500)=>typeof v==='string'?v.trim().slice(0,max):'';
const safeVersion=v=>{
  const value=clean(v,60).replace(/^v/i,'');
  return /^[0-9]+(?:\.[0-9]+){0,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(value)?value:'';
};
const safeCode=v=>{
  const n=Number(v);
  return Number.isInteger(n)&&n>0&&n<=2100000000?n:0;
};
export function apkStorageRoot(env=process.env){
  return resolve(clean(env.SB_APK_STORAGE_ROOT,1000)||'/opt/sportbuddy-downloads/android');
}
export function validateApkReleaseInput(input={}){
  const versionName=safeVersion(input.versionName);
  const versionCode=safeCode(input.versionCode);
  const fileName=basename(clean(input.fileName,180)||'');
  const fileSize=Number(input.fileSize);
  const sha256=clean(input.sha256,64).toLowerCase();
  const releaseNotes=clean(input.releaseNotes,2000);
  if(!versionName)throw Object.assign(new Error('Укажите версию APK, например 1.0.31.'),{status:400,code:'APK_VERSION_INVALID'});
  if(!versionCode)throw Object.assign(new Error('Укажите положительный versionCode Android.'),{status:400,code:'APK_VERSION_CODE_INVALID'});
  if(!/\.apk$/i.test(fileName))throw Object.assign(new Error('Можно загрузить только файл .apk.'),{status:400,code:'APK_FILE_INVALID'});
  if(!Number.isInteger(fileSize)||fileSize<1024||fileSize>APK_MAX_BYTES)throw Object.assign(new Error('Некорректный размер APK.'),{status:400,code:'APK_SIZE_INVALID'});
  if(!/^[a-f0-9]{64}$/.test(sha256))throw Object.assign(new Error('Не удалось проверить SHA-256 файла.'),{status:400,code:'APK_SHA256_INVALID'});
  return {versionName,versionCode,fileName,fileSize,sha256,releaseNotes};
}
export function safeApkStorageName(value){
  const v=clean(value,220);
  return /^[a-zA-Z0-9._-]+\.apk$/.test(v)?v:'';
}
export function publicApkRelease(value={}){
  return {
    id:clean(value.id,120),
    versionName:clean(value.versionName,60),
    versionCode:safeCode(value.versionCode),
    fileName:basename(clean(value.fileName,180)||'sportbuddy78.apk'),
    fileSize:Number.isFinite(Number(value.fileSize))?Number(value.fileSize):0,
    sha256:/^[a-f0-9]{64}$/i.test(String(value.sha256||''))?String(value.sha256).toLowerCase():'',
    releaseNotes:clean(value.releaseNotes,2000),
    createdAt:clean(value.createdAt,80),
    createdBy:clean(value.createdBy,320),
    publishedAt:clean(value.publishedAt,80),
    publishedBy:clean(value.publishedBy,320)
  };
}
export function newUploadId(){return randomUUID();}
export function releaseStorageName(meta,id){
  const version=String(meta.versionName).replace(/[^a-zA-Z0-9._-]/g,'-');
  return `sportbuddy78-v${version}-${meta.versionCode}-${String(id).slice(0,8)}.apk`;
}
export async function ensureApkStorage(root=apkStorageRoot()){
  await mkdir(root,{recursive:true});
  await mkdir(join(root,'.staging'),{recursive:true});
}
const metaPath=(root,id)=>join(root,'.staging',`${id}.json`);
const partPath=(root,id)=>join(root,'.staging',`${id}.part`);
export async function createApkUpload(meta,createdBy,root=apkStorageRoot()){
  await ensureApkStorage(root);
  const id=newUploadId();
  const record={id,...validateApkReleaseInput(meta),createdBy:clean(createdBy,320),createdAt:new Date().toISOString(),nextIndex:0,bytesReceived:0};
  await writeFile(metaPath(root,id),JSON.stringify(record),'utf8');
  await writeFile(partPath(root,id),Buffer.alloc(0));
  return record;
}
export async function readApkUpload(id,root=apkStorageRoot()){
  if(!/^[0-9a-f-]{36}$/i.test(String(id)))throw Object.assign(new Error('Некорректная загрузка.'),{status:400});
  return JSON.parse(await readFile(metaPath(root,id),'utf8'));
}
export async function appendApkChunk(id,index,base64,createdBy,root=apkStorageRoot()){
  const record=await readApkUpload(id,root);
  if(record.createdBy!==clean(createdBy,320))throw Object.assign(new Error('Нет доступа к загрузке.'),{status:403});
  if(index!==record.nextIndex)throw Object.assign(new Error('Нарушен порядок частей APK. Начните загрузку заново.'),{status:409,code:'APK_CHUNK_ORDER'});
  const data=Buffer.from(String(base64||''),'base64');
  if(data.length<1||data.length>APK_CHUNK_BYTES)throw Object.assign(new Error('Некорректный размер части APK.'),{status:400});
  if(record.bytesReceived+data.length>record.fileSize)throw Object.assign(new Error('Размер загружаемого файла превышает заявленный.'),{status:400});
  await appendFile(partPath(root,id),data);
  record.nextIndex+=1;record.bytesReceived+=data.length;
  await writeFile(metaPath(root,id),JSON.stringify(record),'utf8');
  return {nextIndex:record.nextIndex,bytesReceived:record.bytesReceived,fileSize:record.fileSize};
}
async function hashFile(path){
  return await new Promise((resolveHash,reject)=>{
    const hash=createHash('sha256'),stream=createReadStream(path);
    stream.on('data',chunk=>hash.update(chunk));stream.on('error',reject);stream.on('end',()=>resolveHash(hash.digest('hex')));
  });
}
export async function finalizeApkUpload(id,createdBy,root=apkStorageRoot()){
  const record=await readApkUpload(id,root);
  if(record.createdBy!==clean(createdBy,320))throw Object.assign(new Error('Нет доступа к загрузке.'),{status:403});
  const part=partPath(root,id),info=await stat(part);
  if(info.size!==record.fileSize||record.bytesReceived!==record.fileSize)throw Object.assign(new Error('APK загружен не полностью.'),{status:409,code:'APK_INCOMPLETE'});
  const fd=await open(part,'r');const header=Buffer.alloc(4);await fd.read(header,0,4,0);await fd.close();
  if(!(header[0]===0x50&&header[1]===0x4b&&(header[2]===0x03||header[2]===0x05||header[2]===0x07)))throw Object.assign(new Error('Файл не похож на APK/ZIP архив.'),{status:400,code:'APK_FORMAT_INVALID'});
  const actual=await hashFile(part);
  if(actual!==record.sha256)throw Object.assign(new Error('SHA-256 загруженного APK не совпадает.'),{status:409,code:'APK_HASH_MISMATCH'});
  const storageName=releaseStorageName(record,id),target=join(root,storageName);
  await rename(part,target);
  await rm(metaPath(root,id),{force:true});
  return {...record,storageName,sha256:actual,finalizedAt:new Date().toISOString()};
}
export async function cleanupOldApkStaging(root=apkStorageRoot(),now=Date.now()){
  await ensureApkStorage(root);
  const dir=join(root,'.staging'),items=await readdir(dir).catch(()=>[]);
  for(const name of items){
    if(!name.endsWith('.json'))continue;
    try{
      const p=join(dir,name),s=await stat(p);
      if(now-s.mtimeMs<24*60*60*1000)continue;
      const id=name.slice(0,-5);
      await rm(p,{force:true});await rm(partPath(root,id),{force:true});
    }catch{}
  }
}
export async function verifyStoredApk(storageName,expectedSize,root=apkStorageRoot()){
  const safe=safeApkStorageName(storageName);
  if(!safe)return false;
  try{return (await stat(join(root,safe))).size===Number(expectedSize);}catch{return false;}
}
export function storedApkPath(storageName,root=apkStorageRoot()){
  const safe=safeApkStorageName(storageName);
  if(!safe)throw new Error('Unsafe APK storage name');
  return join(root,safe);
}
