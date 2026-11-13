import {useEffect,useRef,useState} from 'react';
import {ImagePlus,X,ChevronDown} from 'lucide-react';
import {Modal} from './Modal';
import {uploadMediaAsset} from '../services/mediaStorage';

export type FeedComposition={text:string;sport:string;mediaUrl?:string;mediaType:'image'|'video'};
export function FeedComposer({name,avatar,sports,onClose,onPublish}:{name:string;avatar?:string;sports:string[];onClose:()=>void;onPublish:(post:FeedComposition)=>Promise<void>}) {
 const [text,setText]=useState(''),[sport,setSport]=useState('Общее'),[file,setFile]=useState<File|null>(null),[preview,setPreview]=useState('');
 const [consent,setConsent]=useState(false),[error,setError]=useState(''),[progress,setProgress]=useState<number|null>(null),[publishing,setPublishing]=useState(false);
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),abort=useRef<AbortController|null>(null),alive=useRef(true);
 const uploaded=useRef<{file:File;url:string}|null>(null);
 const busy=progress!==null||publishing;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;abort.current?.abort();};},[]);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 const select=(candidate:File|undefined)=>{
  if(!candidate)return;
  const video=candidate.type.startsWith('video/'),image=candidate.type.startsWith('image/');
  if(!video&&!image){setError('Выберите фотографию или видео.');return;}
  if(!candidate.size||candidate.size>(video?100:10)*1024*1024){setError(video?'Видео должно быть от 1 байта до 100 МБ.':'Фото должно быть от 1 байта до 10 МБ.');return;}
  uploaded.current=null;setFile(candidate);setError('');
 };
 const publish=async()=>{
  if(lock.current||!consent||(!text.trim()&&!file))return;
  lock.current=true;setError('');
  const controller=new AbortController();abort.current=controller;
  try{
   let url=file&&uploaded.current?.file===file?uploaded.current.url:undefined;
   const mediaType=file?.type.startsWith('video/')?'video':'image';
   if(file&&!url){
    setProgress(0);
    const result=await uploadMediaAsset(file,{folder:`sportbuddy/feed/${mediaType}`,resourceType:mediaType,tags:['feed'],signal:controller.signal,onProgress:p=>{if(alive.current)setProgress(p);}});
    url=result.secureUrl;uploaded.current={file,url};
   }
   if(!alive.current||controller.signal.aborted)return;
   setProgress(null);setPublishing(true);
   await onPublish({text:text.trim(),sport,mediaUrl:url,mediaType});
   if(alive.current)onClose();
  }catch(e){if(alive.current)setError(controller.signal.aborted?'Загрузка отменена. Черновик сохранён в этом окне.':e instanceof Error?e.message:'Не удалось опубликовать. Попробуйте ещё раз.');}
  finally{lock.current=false;if(alive.current){setProgress(null);setPublishing(false);}}
 };
 return <Modal isOpen onClose={()=>{if(!lock.current)onClose();}} title="Новая запись" subtitle="Ваш момент. Ваш спорт.">
  <div className="space-y-4">
   <div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-lime-300/15 text-lime-300">{avatar?<img src={avatar} alt="" className="h-full w-full object-cover"/>:name.slice(0,1)}</div><div><p className="text-sm font-bold text-white">{name}</p><p className="text-[11px] text-slate-400">Сообществу SportBuddy78</p></div></div>
   <textarea aria-label="Текст записи" placeholder="Что нового?" rows={3} maxLength={2000} value={text} disabled={busy} onChange={e=>setText(e.target.value)} className="min-h-24 w-full resize-y border-0 bg-transparent py-2 text-base text-white placeholder:text-slate-500 focus:outline-none"/>
   {file&&preview&&<div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
    {file.type.startsWith('video/')?<video src={preview} controls playsInline preload="metadata" className="max-h-80 w-full"/>:<img src={preview} alt="Фото для публикации" className="max-h-80 w-full object-contain"/>}
    <button type="button" disabled={busy} aria-label="Убрать вложение" onClick={()=>{setFile(null);uploaded.current=null;}} className="absolute right-2 top-2 rounded-full bg-slate-950/90 p-3 text-white"><X size={18}/></button>
   </div>}
   <div className="flex flex-wrap items-center justify-between gap-2 border-y border-white/10 py-2">
    <button type="button" disabled={busy} onClick={()=>input.current?.click()} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-lime-300"><ImagePlus size={21}/>{file?'Заменить фото / видео':'Фото / видео'}</button>
    <span className="text-[10px] text-slate-500">Фото до 10 МБ · видео до 100 МБ</span>
    <input ref={input} type="file" aria-label="Добавить фото или видео" accept="image/*,video/*" disabled={busy} className="hidden" onChange={e=>{select(e.target.files?.[0]);e.target.value='';}}/>
   </div>
   <details className="text-xs text-slate-400"><summary className="flex min-h-10 cursor-pointer items-center gap-2">Тема: {sport}<ChevronDown size={14}/></summary><select aria-label="Тема записи" disabled={busy} value={sport} onChange={e=>setSport(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-200">{[...new Set(['Общее',...sports])].map(s=><option key={s}>{s}</option>)}</select></details>
   <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-400"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-lime-300"/><span>Разрешаю показать эту запись, моё имя и аватар пользователям SportBuddy78.</span></label>
   {error&&<p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
   {progress!==null&&<div role="status" className="space-y-2 text-xs text-slate-300"><div className="flex justify-between"><span>Загружаем медиа · {progress}%</span><button type="button" onClick={()=>abort.current?.abort()} className="text-lime-300">Отменить загрузку</button></div><progress value={progress} max={100} className="h-1 w-full accent-lime-300"/></div>}
   <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{text.length?`${text.length} / 2000`:'Подпись необязательна'}</span><button type="button" onClick={()=>void publish()} disabled={busy||!consent||(!text.trim()&&!file)} className="min-h-11 rounded-full bg-lime-300 px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-40">{publishing?'Публикуем…':progress!==null?'Загружаем…':'Опубликовать'}</button></div>
  </div>
 </Modal>;
}
