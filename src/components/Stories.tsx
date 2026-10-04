import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { UserProfile } from '../lib/types';
import { callServer } from '../services/serverApi';
import { isBetaActive } from '../lib/release';
import { avatarUrl } from '../services/cloudinary';
import { AvatarImage } from './AvatarImage';
import { PhotoEditor } from './PhotoEditor';
import { MediaDialog } from './MediaDialog';
interface Story { id:string;authorId:string;authorName:string;authorAvatar:string;caption:string;createdAt:number;expiresAt:number }
const fileData=(file:File)=>new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('Не удалось прочитать фотографию'));r.readAsDataURL(file);});
export function Stories({user,canPublish,onLocked}:{user:UserProfile;canPublish:boolean;onLocked:()=>void}){
 const [items,setItems]=useState<Story[]>([]),[cursor,setCursor]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [edit,setEdit]=useState<File|null>(null),[ready,setReady]=useState<File|null>(null),[preview,setPreview]=useState(''),[caption,setCaption]=useState(''),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<Story|null>(null),[image,setImage]=useState(''),[viewerError,setViewerError]=useState(''),[deleting,setDeleting]=useState(false);
 const [now,setNow]=useState(Date.now()),[retry,setRetry]=useState(0);
 const publishId=useRef(crypto.randomUUID());
 const input=useRef<HTMLInputElement>(null),requestVersion=useRef(0),activeRequest=useRef(false),publishLock=useRef(false);
 const refresh=useCallback(async(more?:string)=>{
  if(activeRequest.current)return;activeRequest.current=true;const version=++requestVersion.current;setLoading(true);
  try{const response=await callServer<{stories:Story[];next:string|null}>('/api/stories',{action:'list',cursor:more});if(version!==requestVersion.current)return;
   setItems(old=>more?[...old,...response.stories.filter(s=>!old.some(o=>o.id===s.id))]:response.stories);setCursor(response.next);setError('');
  }catch(e){if(version===requestVersion.current)setError(e instanceof Error?e.message:'Не удалось загрузить истории');}finally{activeRequest.current=false;if(version===requestVersion.current)setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},120000);return()=>{clearInterval(timer);requestVersion.current++;};},[refresh]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!ready){setPreview('');return;}const url=URL.createObjectURL(ready);setPreview(url);return()=>URL.revokeObjectURL(url);},[ready]);
 useEffect(()=>{if(!selected)return;let active=true;setImage('');setViewerError('');callServer<{image:string;expiresAt:number}>('/api/stories',{action:'read',id:selected.id}).then(r=>{if(active)setImage(r.image);}).catch(e=>{if(active)setViewerError(e.message);});return()=>{active=false;};},[selected?.id,retry]);
 const visible=items.filter(s=>s.expiresAt>now);
 const authors=[...new Map(visible.map(s=>[s.authorId,s])).values()];
 const group=selected?visible.filter(s=>s.authorId===selected.authorId).sort((a,b)=>a.createdAt-b.createdAt):[];
 const index=group.findIndex(s=>s.id===selected?.id);
 async function publish(){if(!ready||publishLock.current)return;publishLock.current=true;setBusy(true);setError('');try{
  if(ready.size>2*1024*1024)throw new Error('Фото получилось больше 2 МБ. Выберите меньший кадр.');
  const {story}=await callServer<{story:Story}>('/api/stories',{action:'create',ownerId:user.id,requestId:publishId.current,caption,image:await fileData(ready)});
  setItems(old=>[story,...old]);setReady(null);setCaption('');
 }catch(e){setError(e instanceof Error?e.message:'Не удалось опубликовать');}finally{publishLock.current=false;setBusy(false);}}
 async function remove(){if(!selected||deleting)return;setDeleting(true);try{await callServer('/api/stories',{action:'delete',id:selected.id});setItems(old=>old.filter(s=>s.id!==selected.id));setSelected(null);}catch(e){setViewerError(e instanceof Error?e.message:'Не удалось удалить');}finally{setDeleting(false);}}
 return <section className="sb-story-panel" aria-label="Истории сообщества">
  <div className="sb-story-heading"><div><h3>Моменты города</h3><small>Истории · исчезают через 24 часа</small></div><button aria-label="Обновить истории" disabled={loading} onClick={()=>void refresh()} className="p-3"><RefreshCw size={16} className={loading?'animate-spin':''}/></button></div>
  <div className="sb-story-row">
   <button className="sb-story-circle" onClick={()=>{if(!canPublish){onLocked();return;}input.current?.click();}}><div className="sb-story-ring"><AvatarImage src={avatarUrl(user.avatar)} alt=""/><i><Plus size={16}/></i></div><span>Твоя история</span></button>
   {authors.map(s=><button key={s.authorId} className="sb-story-circle" onClick={()=>setSelected(visible.filter(x=>x.authorId===s.authorId).sort((a,b)=>a.createdAt-b.createdAt)[0]!)}><div className="sb-story-ring"><AvatarImage src={avatarUrl(s.authorAvatar)} alt=""/></div><span>{s.authorId===user.id?'Мои истории':s.authorName}</span></button>)}
   {!visible.length&&!loading&&<p className="sb-media-hint self-center max-w-52">Первый момент — за тобой. Покажи тренировку, прогулку или спортивный Петербург.</p>}
   {cursor&&<button className="text-xs px-3 shrink-0" disabled={loading} onClick={()=>void refresh(cursor)}>Ещё истории</button>}
  </div>
  <p className="sb-media-hint">{isBetaActive()?'В тестовом сезоне публикации бесплатны. С 1 января 2027 — для Premium.':'Публикация историй — для Premium. Смотреть могут все участники.'}</p>
  {error&&!ready&&<p role="alert" className="sb-media-error">{error}</p>}
  <input ref={input} type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)setEdit(f);}}/>
  {edit&&<PhotoEditor key={edit.lastModified} file={edit} story onClose={()=>setEdit(null)} onSave={f=>{setEdit(null);publishId.current=crypto.randomUUID();setReady(f);setError('');}}/>}
  {ready&&<MediaDialog title="Твоя история на 24 часа" busy={busy} onClose={()=>setReady(null)}>
   <div className="sb-story-view"><img src={preview} alt="Предпросмотр истории"/></div>
   <div className="p-4"><label className="text-sm">Подпись<textarea maxLength={240} rows={2} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Что сегодня вдохновляет?" className="w-full bg-slate-950 rounded-xl p-3 mt-2"/></label><p className="sb-media-hint">До 5 историй в сутки. Можно удалить раньше.</p></div>
   {error&&<p role="alert" className="sb-media-error">{error}</p>}
   <footer><button disabled={busy} className="sb-media-primary" onClick={()=>void publish()}>{busy?'Публикуем…':'Опубликовать историю'}</button></footer>
  </MediaDialog>}
  {selected&&<MediaDialog title={selected.authorName} busy={deleting} onClose={()=>setSelected(null)}>
   {selected.expiresAt<=now?<div className="p-8 text-center">Эта история уже исчезла.</div>:<>
    <div className="sb-story-view">{image?<img src={image} alt={selected.caption||'История спортсмена'}/>:<p className="p-5 text-sm">{viewerError||'Загружаем историю…'}</p>}</div>
    {viewerError&&<button className="p-3 text-sm" onClick={()=>setRetry(n=>n+1)}>Повторить загрузку</button>}
    <p className="sb-story-caption">{selected.caption}</p><p className="sb-media-hint px-5">Исчезнет через {Math.max(1,Math.ceil((selected.expiresAt-now)/3600000))} ч.</p>
    <div className="sb-story-nav"><button disabled={index<=0} onClick={()=>setSelected(group[index-1]!)}>← Назад</button><span className="text-xs">{index+1} / {group.length}</span><button disabled={index<0||index>=group.length-1} onClick={()=>setSelected(group[index+1]!)}>Далее →</button></div>
   </>}
   {selected.authorId===user.id&&<footer><button disabled={deleting} onClick={()=>void remove()} className="flex items-center gap-2 text-sm text-rose-300"><Trash2 size={16}/>{deleting?'Удаляем…':'Удалить мою историю'}</button></footer>}
  </MediaDialog>}
 </section>;
}
