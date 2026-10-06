import { useEffect,useState } from 'react';
import { Compass,Eye,EyeOff,Pencil,Plus,RefreshCw,Save,Trash2,X } from 'lucide-react';
import { uploadMedia } from '../services/cloudinary';
import { AdminLeisureDestination,listAdminLeisure,mutateAdminLeisure,seedAdminLeisure } from '../services/adminLeisure';

const empty:AdminLeisureDestination={id:'',name:'',region:'spb',format:'',pace:'Умеренный',description:'',plan:'',access:'',source:'',photo:'',photoCredit:'',isPublished:true};
const field='w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none';

export function LeisureAdminPanel(){
 const [items,setItems]=useState<AdminLeisureDestination[]>([]),[draft,setDraft]=useState<AdminLeisureDestination|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const refresh=async()=>{setBusy(true);setError('');try{setItems((await listAdminLeisure()).destinations);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить каталог');}finally{setBusy(false);}};
 useEffect(()=>{void refresh();},[]);
 const save=async()=>{if(!draft)return;setBusy(true);setError('');try{const exists=items.some(x=>x.id===draft.id);await mutateAdminLeisure(exists?'update':'create',draft.id,draft);setDraft(null);await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить направление');setBusy(false);}};
 const remove=async(item:AdminLeisureDestination)=>{if(!confirm(`Удалить «${item.name}»?`))return;setBusy(true);try{await mutateAdminLeisure('delete',item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось удалить');setBusy(false);}};
 const seed=async()=>{setBusy(true);setError('');try{await seedAdminLeisure();await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось импортировать каталог');setBusy(false);}};
 const upload=async(file?:File)=>{if(!file||!draft)return;setBusy(true);try{const result=await uploadMedia(file,{folder:'sportbuddy/leisure',resourceType:'image',tags:['leisure','cover']});setDraft({...draft,photo:result.secureUrl});}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить фото');}finally{setBusy(false);}};

 return <section className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-3">
  <div className="flex items-center justify-between gap-2">
   <div className="flex items-center gap-2"><Compass className="h-4 w-4 text-lime-300"/><div><h4 className="text-xs font-black text-white">Активный отдых</h4><p className="text-[9px] text-slate-500">CMS направлений</p></div></div>
   <div className="flex gap-1">
    <button onClick={()=>void refresh()} disabled={busy} className="rounded-lg border border-slate-700 p-2 text-slate-400"><RefreshCw className={`h-3.5 w-3.5 ${busy?'animate-spin':''}`}/></button>
    <button onClick={()=>setDraft({...empty,id:`place-${Date.now()}`})} className="rounded-lg bg-lime-300 p-2 text-slate-950"><Plus className="h-3.5 w-3.5"/></button>
   </div>
  </div>
  {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-2 text-[10px] text-rose-200">{error}</p>}
  {items.length===0&&!draft&&<button onClick={()=>void seed()} disabled={busy} className="w-full rounded-xl border border-lime-300/30 bg-lime-300/10 py-2.5 text-[11px] font-bold text-lime-200">Импортировать текущие 9 направлений</button>}
  {draft&&<div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900 p-3">
    <div className="flex justify-between"><p className="text-xs font-black text-white">{items.some(x=>x.id===draft.id)?'Редактирование':'Новое направление'}</p><button onClick={()=>setDraft(null)}><X className="h-4 w-4 text-slate-400"/></button></div>
    <input className={field} placeholder="ID (латиница)" value={draft.id} disabled={items.some(x=>x.id===draft.id)} onChange={e=>setDraft({...draft,id:e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'')})}/>
    <input className={field} placeholder="Название" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
    <div className="grid grid-cols-2 gap-2"><select className={field} value={draft.region} onChange={e=>setDraft({...draft,region:e.target.value as AdminLeisureDestination['region']})}><option value="spb">Санкт-Петербург</option><option value="lo">Ленинградская область</option><option value="karelia">Карелия</option></select><input className={field} placeholder="Темп" value={draft.pace} onChange={e=>setDraft({...draft,pace:e.target.value})}/></div>
    <input className={field} placeholder="Формат" value={draft.format} onChange={e=>setDraft({...draft,format:e.target.value})}/>
    <textarea className={field} rows={3} placeholder="Описание" value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/>
    <textarea className={field} rows={3} placeholder="План" value={draft.plan} onChange={e=>setDraft({...draft,plan:e.target.value})}/>
    <textarea className={field} rows={3} placeholder="Условия посещения" value={draft.access} onChange={e=>setDraft({...draft,access:e.target.value})}/>
    <input className={field} placeholder="Официальный источник https://…" value={draft.source} onChange={e=>setDraft({...draft,source:e.target.value})}/>
    <input className={field} placeholder="Фото URL" value={draft.photo} onChange={e=>setDraft({...draft,photo:e.target.value})}/>
    <label className="block rounded-xl border border-dashed border-slate-700 p-2 text-center text-[10px] text-slate-400">Загрузить обложку<input type="file" accept="image/*" className="hidden" onChange={e=>void upload(e.target.files?.[0])}/></label>
    <input className={field} placeholder="Источник/автор фото" value={draft.photoCredit} onChange={e=>setDraft({...draft,photoCredit:e.target.value})}/>
    <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={draft.isPublished} onChange={e=>setDraft({...draft,isPublished:e.target.checked})}/>Опубликовано</label>
    <button onClick={()=>void save()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 py-2.5 text-xs font-black text-slate-950"><Save className="h-4 w-4"/>Сохранить</button>
  </div>}
  <div className="max-h-[360px] space-y-2 overflow-y-auto">
   {items.map(item=><div key={item.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2.5">
    {item.photo&&<img src={item.photo} alt="" className="h-11 w-14 rounded-lg object-cover"/>}
    <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">{item.name}</p><p className="truncate text-[9px] text-slate-500">{item.format} · {item.region}</p></div>
    {item.isPublished?<Eye className="h-3.5 w-3.5 text-emerald-400"/>:<EyeOff className="h-3.5 w-3.5 text-slate-500"/>}
    <button onClick={()=>setDraft({...item})} className="p-1.5 text-amber-300"><Pencil className="h-3.5 w-3.5"/></button>
    <button onClick={()=>void remove(item)} className="p-1.5 text-rose-400"><Trash2 className="h-3.5 w-3.5"/></button>
   </div>)}
  </div>
 </section>;
}
