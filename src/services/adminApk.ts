import {apiFetch} from './apiEndpoint';
import {getAdminSession} from './adminAuth';

export interface ApkRelease {
  id:string;
  versionName:string;
  versionCode:number;
  fileName:string;
  fileSize:number;
  sha256:string;
  releaseNotes:string;
  createdAt:string;
  createdBy:string;
  publishedAt:string;
  publishedBy:string;
  packageName:string;
  manifestVersionName:string;
  manifestVersionCode:number;
  signatureScheme:string;
  signingCertSha256:string;
  signatureTrusted:boolean;
  active:boolean;
}
export interface ApkReleaseState {
  active:ApkRelease|null;
  releases:ApkRelease[];
  chunkSize:number;
  storageRootConfigured:boolean;
}

async function post<T>(body:Record<string,unknown>):Promise<T>{
  const session=getAdminSession();
  if(!session)throw new Error('admin-otp-required');
  const response=await apiFetch('/api/admin-apk',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...body,sessionId:session.sessionId})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
  return data as T;
}

export const loadApkReleases=()=>post<ApkReleaseState>({operation:'get'});

function bytesToBase64(bytes:Uint8Array){
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000){
    binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
  }
  return btoa(binary);
}
async function sha256File(file:File){
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function uploadApkRelease(
  file:File,
  input:{versionName:string;versionCode:number;releaseNotes:string},
  onProgress?:(percent:number)=>void
):Promise<ApkRelease>{
  if(!/\.apk$/i.test(file.name))throw new Error('Выберите файл .apk');
  const sha256=await sha256File(file);
  onProgress?.(2);
  const init=await post<{uploadId:string;chunkSize:number}>({
    operation:'initUpload',
    versionName:input.versionName,
    versionCode:input.versionCode,
    releaseNotes:input.releaseNotes,
    fileName:file.name,
    fileSize:file.size,
    sha256
  });
  const chunkSize=Math.max(64*1024,Number(init.chunkSize)||384*1024);
  const total=Math.ceil(file.size/chunkSize);
  for(let index=0;index<total;index++){
    const bytes=new Uint8Array(await file.slice(index*chunkSize,Math.min(file.size,(index+1)*chunkSize)).arrayBuffer());
    await post({
      operation:'uploadChunk',
      uploadId:init.uploadId,
      index,
      data:bytesToBase64(bytes)
    });
    onProgress?.(Math.min(96,2+Math.round(((index+1)/total)*94)));
  }
  const result=await post<{release:ApkRelease}>({
    operation:'finalizeUpload',
    uploadId:init.uploadId,
    requestId:crypto.randomUUID?.()||String(Date.now())
  });
  onProgress?.(100);
  return result.release;
}
export async function publishApkRelease(releaseId:string):Promise<ApkRelease>{
  const result=await post<{active:ApkRelease}>({
    operation:'publish',releaseId,requestId:crypto.randomUUID?.()||String(Date.now())
  });
  return {...result.active,active:true};
}
export async function deleteApkRelease(releaseId:string):Promise<void>{
  await post({operation:'delete',releaseId,requestId:crypto.randomUUID?.()||String(Date.now())});
}
