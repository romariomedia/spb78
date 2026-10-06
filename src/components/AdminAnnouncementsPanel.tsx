import { useEffect,useRef,useState } from 'react';
import { Eye,ImagePlus,Megaphone,Pencil,Plus,RefreshCw,Save,Trash2,X } from 'lucide-react';
import { DISTRICTS,districtLabel } from '../../shared/districts.js';
import { SPORT_TAGS } from '../lib/types';
import { uploadMedia } from '../services/cloudinary';
import { compressImage } from '../services/media';
import {
  AdminAnnouncement,AnnouncementDraft,createAdminAnnouncement,deleteAdminAnnouncement,
  loadAdminAnnouncements,updateAdminAnnouncement
} from '../services/adminAnnouncements';

const empty=():AnnouncementDraft=>({
  title:'',text:'',imageUrl:'',buttonLabel:'',buttonLink:'#notifications',placement:'global',
  audienceType:'all',audienceValue:'',startAt:'',endAt:'',priority:50,isActive:true,dismissible:true
});
const field='w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400';

function localDate(value:string){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function iso(value:string){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';}
function status(item:AdminAnnouncement){
  if(!item.isActive)return 'Выключено';
  const now=Date.now(),start=Date.parse(item.startAt||''),end=Date.parse(item.endAt||'');
  if(Number.isFinite(start)&&start>now)return 'Запланировано';
  if(Number.isFinite(end)&&end<=now)return 'Завершено';
  return 'Активно';
}

export function AdminAnnouncementsPanel(){
  const [items,setItems]=useState<AdminAnnouncement[]>([]);
  const [draft,setDraft]=useState<AnnouncementDraft|null>(null);
  const [editingId,setEditingId]=useState('');
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);

  const refresh=async()=>{setBusy(true);setError('');try{setItems(await loadAdminAnnouncements());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить объявления');}finally{setBusy(false);}};
  useEffect(()=>{void refresh();},[]);

  const edit=(item:AdminAnnouncement)=>{
    setEditingId(item.id);
    setDraft({
      title:item.title,text:item.text,imageUrl:item.imageUrl||'',buttonLabel:item.buttonLabel||'',buttonLink:item.buttonLink||'#notifications',
      placement:item.placement,audienceType:item.audienceType,audienceValue:item.audienceValue||'',
      startAt:localDate(item.startAt),endAt:localDate(item.endAt),priority:item.priority,isActive:item.isActive,dismissible:item.dismissible
    });
    setError('');setNotice('');
  };
  const create=()=>{setEditingId('');setDraft(empty());setError('');setNotice('');};

  const save=async()=>{
    if(!draft)return;
    setBusy(true);setError('');setNotice('');
    const payload={...draft,startAt:iso(draft.startAt),endAt:iso(draft.endAt)};
    try{
      if(editingId)await updateAdminAnnouncement(editingId,payload);else await createAdminAnnouncement(payload);
      setDraft(null);setEditingId('');setNotice('Объявление сохранено.');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить объявление');setBusy(false);}
  };
  const remove=async(item:AdminAnnouncement)=>{
    if(!confirm(`Удалить объявление «${item.title}»?`))return;
    setBusy(true);setError('');
    try{await deleteAdminAnnouncement(item.id);if(editingId===item.id){setDraft(null);setEditingId('');}await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось удалить объявление');setBusy(false);}
  };
  const upload=async(file?:File)=>{
    if(!file||!draft)return;setUploading(true);setError('');
    try{
      const compressed=await compressImage(file,1800,0.84);
      const result=await uploadMedia(compressed,{folder:'sportbuddy/announcements',resourceType:'image',tags:['announcement']});
      setDraft(prev=>prev?{...prev,imageUrl:result.secureUrl}:prev);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить изображение');}
    finally{setUploading(false);}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Коммуникации</p>
        <h3 className="mt-1 text-base font-black text-white">Баннеры и объявления</h3>
        <p className="mt-1 text-[10px] text-slate-500">Управление сообщениями приложения без нового deploy</p>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>void refresh()} disabled={busy} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></button>
        <button onClick={create} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-[11px] font-black text-slate-950"><Plus className="h-4 w-4"/>Создать</button>
      </div>
    </div>

    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <div className="space-y-3">
        {draft?<div className="rounded-2xl border border-emerald-500/25 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-white">{editingId?'Редактирование объявления':'Новое объявление'}</p><p className="text-[9px] text-slate-500">Поля справа сразу показываются в предпросмотре</p></div><button onClick={()=>{setDraft(null);setEditingId('');}} className="rounded-lg p-2 text-slate-400"><X className="h-4 w-4"/></button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2 text-[10px] text-slate-400">Заголовок<input maxLength={120} className={`${field} mt-1`} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
            <label className="md:col-span-2 text-[10px] text-slate-400">Текст<textarea maxLength={500} rows={4} className={`${field} mt-1 resize-none`} value={draft.text} onChange={e=>setDraft({...draft,text:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Размещение<select className={`${field} mt-1`} value={draft.placement} onChange={e=>setDraft({...draft,placement:e.target.value as AnnouncementDraft['placement']})}><option value="global">Везде</option><option value="discover">Знакомства</option><option value="trainings">Тренировки</option><option value="leisure">Активный отдых</option><option value="feed">Лента</option><option value="profile">Профиль</option></select></label>
            <label className="text-[10px] text-slate-400">Аудитория<select className={`${field} mt-1`} value={draft.audienceType} onChange={e=>setDraft({...draft,audienceType:e.target.value as AnnouncementDraft['audienceType'],audienceValue:''})}><option value="all">Все пользователи</option><option value="verified">Только verified</option><option value="district">По району</option><option value="sport">По виду спорта</option></select></label>
            {draft.audienceType==='district'&&<label className="md:col-span-2 text-[10px] text-slate-400">Район<select className={`${field} mt-1`} value={draft.audienceValue} onChange={e=>setDraft({...draft,audienceValue:e.target.value})}><option value="">Выберите район</option>{DISTRICTS.map(d=><option key={d.id} value={d.id}>{districtLabel(d.id)}</option>)}</select></label>}
            {draft.audienceType==='sport'&&<label className="md:col-span-2 text-[10px] text-slate-400">Вид спорта<select className={`${field} mt-1`} value={draft.audienceValue} onChange={e=>setDraft({...draft,audienceValue:e.target.value})}><option value="">Выберите спорт</option>{SPORT_TAGS.filter(x=>x!=='Общее').map(s=><option key={s}>{s}</option>)}</select></label>}
            <label className="text-[10px] text-slate-400">Начало<input type="datetime-local" className={`${field} mt-1`} value={draft.startAt} onChange={e=>setDraft({...draft,startAt:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Окончание<input type="datetime-local" className={`${field} mt-1`} value={draft.endAt} onChange={e=>setDraft({...draft,endAt:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Текст кнопки<input maxLength={60} className={`${field} mt-1`} value={draft.buttonLabel} onChange={e=>setDraft({...draft,buttonLabel:e.target.value})} placeholder="Подробнее"/></label>
            <label className="text-[10px] text-slate-400">Переход<select className={`${field} mt-1`} value={draft.buttonLink} onChange={e=>setDraft({...draft,buttonLink:e.target.value})}><option value="#notifications">Уведомления</option><option value="#discover">Знакомства</option><option value="#trainings">Тренировки</option><option value="#leisure">Активный отдых</option><option value="#feed">Лента</option><option value="#profile">Профиль</option></select></label>
            <label className="text-[10px] text-slate-400">Приоритет 0–100<input type="number" min={0} max={100} className={`${field} mt-1`} value={draft.priority} onChange={e=>setDraft({...draft,priority:Number(e.target.value)})}/></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 text-[10px] text-slate-300">Активно<input type="checkbox" checked={draft.isActive} onChange={e=>setDraft({...draft,isActive:e.target.checked})} className="accent-emerald-500"/></label>
              <label className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 text-[10px] text-slate-300">Можно скрыть<input type="checkbox" checked={draft.dismissible} onChange={e=>setDraft({...draft,dismissible:e.target.checked})} className="accent-emerald-500"/></label>
            </div>
            <label className="md:col-span-2 text-[10px] text-slate-400">Изображение<input className={`${field} mt-1`} value={draft.imageUrl} onChange={e=>setDraft({...draft,imageUrl:e.target.value})} placeholder="https://..."/></label>
            <div className="md:col-span-2 flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>void upload(e.target.files?.[0])}/>
              <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-900 py-2.5 text-[10px] font-bold text-slate-300"><ImagePlus className="h-4 w-4"/>{uploading?'Загрузка…':'Загрузить изображение'}</button>
              {draft.imageUrl&&<button onClick={()=>setDraft({...draft,imageUrl:''})} className="rounded-xl border border-rose-500/30 px-3 text-rose-300"><Trash2 className="h-4 w-4"/></button>}
            </div>
          </div>
          <button onClick={()=>void save()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4"/>Сохранить объявление</button>
        </div>:<button onClick={create} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950 py-6 text-xs font-bold text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"><Megaphone className="h-4 w-4"/>Создать новый баннер или системное объявление</button>}

        <div className="grid gap-2 md:grid-cols-2">
          {items.map(item=><article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-3">
              {item.imageUrl&&<img src={item.imageUrl} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover"/>}
              <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">{item.title}</p><p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-400">{item.text}</p></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 text-[9px]"><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{item.placement}</span><span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{item.audienceType}</span><span className={`rounded-full px-2 py-1 ${status(item)==='Активно'?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>{status(item)}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>edit(item)} className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-[10px] font-bold text-slate-200"><Pencil className="h-3.5 w-3.5"/>Изменить</button><button onClick={()=>void remove(item)} className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-bold text-rose-300"><Trash2 className="h-3.5 w-3.5"/>Удалить</button></div>
          </article>)}
        </div>
      </div>

      <aside className="xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="mb-3 flex items-center gap-2"><Eye className="h-4 w-4 text-emerald-400"/><div><p className="text-xs font-black text-white">Предпросмотр</p><p className="text-[9px] text-slate-500">Как объявление будет выглядеть в приложении</p></div></div>
          {draft?<div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900">
            {draft.imageUrl&&<img src={draft.imageUrl} alt="" className="h-40 w-full object-cover"/>}
            <div className="p-4"><p className="text-sm font-black text-white">{draft.title||'Заголовок объявления'}</p><p className="mt-2 text-xs leading-relaxed text-slate-300">{draft.text||'Здесь будет текст сообщения для пользователей SportBuddy78.'}</p>{draft.buttonLabel&&<span className="mt-3 inline-flex rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950">{draft.buttonLabel}</span>}</div>
          </div>:<div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-[10px] text-slate-500">Выберите или создайте объявление для предпросмотра.</div>}
        </div>
      </aside>
    </div>
  </section>;
}
