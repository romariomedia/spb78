export interface EvidenceDownload {base64:string;mime:string;filename:string}

export function downloadPrivateEvidence(file:EvidenceDownload):void{
  const decoded=atob(file.base64);
  const bytes=Uint8Array.from(decoded,char=>char.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:file.mime}));
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=file.filename;document.body.appendChild(anchor);
  anchor.click();anchor.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),60_000);
}

export async function evidenceBase64(file:File):Promise<string>{
  if(!file.size||file.size>4*1024*1024)throw new Error('Документ должен быть не больше 4 МБ.');
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
    reader.onerror=()=>reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}
