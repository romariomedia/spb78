import { useEffect,useRef,useState } from 'react';
import { Eye,EyeOff,Handshake,ImagePlus,Pencil,Plus,RefreshCw,Save,Trash2,Video,X } from 'lucide-react';
import { compressImage } from '../services/media';
import { uploadMedia,videoPoster } from '../services/cloudinary';
import {
  AdminPartner,PartnerDraft,createAdminPartner,deleteAdminPartner,loadAdminPartners,setPartnersVisibility,updateAdminPartner
} from '../services/adminPartners';

const field='w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400';
const empty=():PartnerDraft=>({
  name:'',partnerLabel:'Партнёр SportBuddy78',offerTitle:'',description:'',promoCode:'',
  ctaLabel:'Подробнее',ctaUrl:'',logoUrl:'',coverUrl:'',mediaUrl:'',mediaType:'none',
  startAt:'',endAt:'',priority:50,isActive:true
});
function localDate(value:string){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const p=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
function iso(value:string){if(!value)return '';const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString():'';}

export function AdminPartnersPanel(){
  const [items,setItems]=useState<AdminPartner[]>([]);
  const [visible,setVisible]=useState(false);
  const [draft,setDraft]=useState<PartnerDraft|null>(null);
  const [editingId,setEditingId]=useState('');
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState<'logo'|'cover'|'media'|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const logoRef=useRef<HTMLInputElement>(null),coverRef=useRef<HTMLInputElement>(null),mediaRef=useRef<HTMLInputElement>(null);

  const refresh=async()=>{
    setBusy(true);setError('');
    try{const data=await loadAdminPartners();setItems(data.partners);setVisible(data.visible);}
    catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить партнёров');}
    finally{setBusy(false);}
  };
  useEffect(()=>{void refresh();},[]);

  const toggleVisible=async()=>{
    setBusy(true);setError('');
    try{
      const next=await setPartnersVisibility(!visible);setVisible(next);
      setNotice(next?'Раздел «Наши партнёры» включён в Ленте.':'Раздел скрыт из Ленты.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось изменить видимость');}
    finally{setBusy(false);}
  };
  const edit=(item:AdminPartner)=>{
    setEditingId(item.id);setDraft({
      name:item.name,partnerLabel:item.partnerLabel,offerTitle:item.offerTitle,description:item.description,promoCode:item.promoCode,
      ctaLabel:item.ctaLabel,ctaUrl:item.ctaUrl,logoUrl:item.logoUrl,coverUrl:item.coverUrl,mediaUrl:item.mediaUrl,mediaType:item.mediaType,
      startAt:localDate(item.startAt),endAt:localDate(item.endAt),priority:item.priority,isActive:item.isActive
    });setError('');setNotice('');
  };
  const save=async()=>{
    if(!draft)return;
    setBusy(true);setError('');setNotice('');
    const payload={...draft,startAt:iso(draft.startAt),endAt:iso(draft.endAt)};
    try{
      if(editingId)await updateAdminPartner(editingId,payload);else await createAdminPartner(payload);
      setDraft(null);setEditingId('');setNotice('Партнёр сохранён.');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить партнёра');setBusy(false);}
  };
  const remove=async(item:AdminPartner)=>{
    if(!confirm(`Удалить партнёра «${item.name}»?`))return;
    setBusy(true);setError('');
    try{await deleteAdminPartner(item.id);if(editingId===item.id){setDraft(null);setEditingId('');}await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось удалить партнёра');setBusy(false);}
  };

  const upload=async(file:File|undefined,kind:'logo'|'cover'|'media')=>{
    if(!file||!draft)return;
    setUploading(kind);setError('');
    try{
      const isVideo=kind==='media'&&file.type.startsWith('video/');
      const payload=isVideo?file:await compressImage(file,kind==='logo'?900:1800,kind==='logo'?0.9:0.84);
      const result=await uploadMedia(payload,{
        folder:`sportbuddy/partners/${kind}`,resourceType:isVideo?'video':'image',tags:['partner',kind]
      });
      setDraft(prev=>prev?{
        ...prev,
        ...(kind==='logo'?{logoUrl:result.secureUrl}:kind==='cover'?{coverUrl:result.secureUrl}:{mediaUrl:result.secureUrl,mediaType:isVideo?'video':'image'})
      }:prev);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить медиа');}
    finally{setUploading(null);}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Партнёрская интеграция</p>
        <h3 className="mt-1 text-base font-black text-white">Наши партнёры</h3>
        <p className="mt-1 text-[10px] text-slate-500">Акции, реклама, логотипы и медиа в Ленте без нового deploy</p>
      </div>
      <div className="flex gap-2">
        <button onClick={()=>void refresh()} disabled={busy} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></button>
        <button onClick={()=>{setEditingId('');setDraft(empty());setError('');setNotice('');}} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-[11px] font-black text-slate-950"><Plus className="h-4 w-4"/>Добавить партнёра</button>
      </div>
    </div>

    <div className={`flex items-center justify-between gap-4 rounded-2xl border p-4 ${visible?'border-emerald-500/35 bg-emerald-950/15':'border-slate-800 bg-slate-950'}`}>
      <div><p className="text-xs font-black text-white">Раздел в Ленте</p><p className="mt-1 text-[10px] text-slate-500">{visible?'Пользователи видят активных партнёров.':'Полностью скрыт. Можно заранее наполнить контентом.'}</p></div>
      <button onClick={()=>void toggleVisible()} disabled={busy} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black ${visible?'bg-emerald-500 text-slate-950':'border border-slate-700 bg-slate-900 text-slate-300'}`}>
        {visible?<Eye className="h-4 w-4"/>:<EyeOff className="h-4 w-4"/>}{visible?'Включён':'Скрыт'}
      </button>
    </div>

    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <div className="space-y-3">
        {draft?<div className="rounded-2xl border border-emerald-500/25 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black text-white">{editingId?'Редактирование партнёра':'Новый партнёр'}</p><p className="text-[9px] text-slate-500">Заполните карточку и опубликуйте, когда интеграция готова</p></div><button onClick={()=>{setDraft(null);setEditingId('');}} className="rounded-lg p-2 text-slate-400"><X className="h-4 w-4"/></button></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-[10px] text-slate-400">Название партнёра<input maxLength={100} className={`${field} mt-1`} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Подпись<input maxLength={60} className={`${field} mt-1`} value={draft.partnerLabel} onChange={e=>setDraft({...draft,partnerLabel:e.target.value})}/></label>
            <label className="md:col-span-2 text-[10px] text-slate-400">Заголовок акции / рекламы<input maxLength={120} className={`${field} mt-1`} value={draft.offerTitle} onChange={e=>setDraft({...draft,offerTitle:e.target.value})}/></label>
            <label className="md:col-span-2 text-[10px] text-slate-400">Описание<textarea rows={4} maxLength={700} className={`${field} mt-1 resize-none`} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Промокод<input maxLength={60} className={`${field} mt-1`} value={draft.promoCode} onChange={e=>setDraft({...draft,promoCode:e.target.value})} placeholder="SPORTBUDDY"/></label>
            <label className="text-[10px] text-slate-400">Приоритет 0–100<input type="number" min={0} max={100} className={`${field} mt-1`} value={draft.priority} onChange={e=>setDraft({...draft,priority:Number(e.target.value)})}/></label>
            <label className="text-[10px] text-slate-400">Текст кнопки<input maxLength={50} className={`${field} mt-1`} value={draft.ctaLabel} onChange={e=>setDraft({...draft,ctaLabel:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Ссылка партнёра HTTPS<input className={`${field} mt-1`} value={draft.ctaUrl} onChange={e=>setDraft({...draft,ctaUrl:e.target.value})} placeholder="https://partner.ru/action"/></label>
            <label className="text-[10px] text-slate-400">Начало<input type="datetime-local" className={`${field} mt-1`} value={draft.startAt} onChange={e=>setDraft({...draft,startAt:e.target.value})}/></label>
            <label className="text-[10px] text-slate-400">Окончание<input type="datetime-local" className={`${field} mt-1`} value={draft.endAt} onChange={e=>setDraft({...draft,endAt:e.target.value})}/></label>
            <label className="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-[10px] text-slate-300">Публикация активна<input type="checkbox" checked={draft.isActive} onChange={e=>setDraft({...draft,isActive:e.target.checked})} className="accent-emerald-500"/></label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {([
              ['logo','Логотип','image/*',logoRef],
              ['cover','Обложка','image/*',coverRef],
              ['media','Медиа','image/*,video/*',mediaRef]
            ] as const).map(([kind,label,accept,ref])=><div key={kind} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="mb-2 text-[10px] font-black text-slate-300">{label}</p>
              <button onClick={()=>ref.current?.click()} disabled={uploading!==null} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 py-3 text-[10px] font-bold text-slate-300">
                {kind==='media'?<Video className="h-4 w-4"/>:<ImagePlus className="h-4 w-4"/>}{uploading===kind?'Загрузка…':'Загрузить'}
              </button>
              <input ref={ref} type="file" accept={accept} className="hidden" onChange={e=>void upload(e.target.files?.[0],kind)}/>
              {kind==='logo'&&draft.logoUrl&&<img src={draft.logoUrl} alt="" className="mt-2 h-20 w-full rounded-xl object-contain bg-slate-950"/>}
              {kind==='cover'&&draft.coverUrl&&<img src={draft.coverUrl} alt="" className="mt-2 h-20 w-full rounded-xl object-cover"/>}
              {kind==='media'&&draft.mediaUrl&&(draft.mediaType==='video'?<video src={draft.mediaUrl} poster={videoPoster(draft.mediaUrl,480)} controls className="mt-2 h-20 w-full rounded-xl object-cover bg-black"/>:<img src={draft.mediaUrl} alt="" className="mt-2 h-20 w-full rounded-xl object-cover"/>)}
            </div>)}
          </div>

          <button onClick={()=>void save()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4"/>Сохранить партнёра</button>
        </div>:<button onClick={()=>{setEditingId('');setDraft(empty());}} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-700 bg-slate-950 py-6 text-xs font-bold text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"><Handshake className="h-4 w-4"/>Создать первую партнёрскую карточку</button>}

        <div className="grid gap-2 md:grid-cols-2">
          {items.map(item=><article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-3">
              {item.logoUrl?<img src={item.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover"/>:<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900"><Handshake className="h-5 w-5 text-emerald-400"/></div>}
              <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">{item.name}</p><p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-400">{item.offerTitle}</p></div>
            </div>
            <div className="mt-2 flex gap-1 text-[9px]"><span className={`rounded-full px-2 py-1 ${item.isActive?'bg-emerald-500/15 text-emerald-300':'bg-slate-800 text-slate-400'}`}>{item.isActive?'Активен':'Черновик'}</span>{item.promoCode&&<span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Промокод</span>}</div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>edit(item)} className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-[10px] font-bold text-slate-200"><Pencil className="h-3.5 w-3.5"/>Изменить</button><button onClick={()=>void remove(item)} className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-bold text-rose-300"><Trash2 className="h-3.5 w-3.5"/>Удалить</button></div>
          </article>)}
        </div>
      </div>

      <aside className="xl:sticky xl:top-0 xl:self-start">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <p className="mb-3 text-xs font-black text-white">Предпросмотр карточки в Ленте</p>
          {draft?<div className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-slate-900">
            <div className="relative h-40 bg-slate-950">
              {(draft.mediaUrl||draft.coverUrl)&&<img src={draft.mediaType==='video'?videoPoster(draft.mediaUrl,720):(draft.mediaUrl||draft.coverUrl)} alt="" className="h-full w-full object-cover"/>}
              {draft.logoUrl&&<img src={draft.logoUrl} alt="" className="absolute left-3 top-3 h-12 w-12 rounded-2xl border border-white/10 bg-slate-950 object-cover"/>}
            </div>
            <div className="p-4"><p className="text-[10px] font-black uppercase tracking-[.12em] text-emerald-400">{draft.partnerLabel||'Партнёр SportBuddy78'}</p><p className="mt-1 text-sm font-black text-white">{draft.name||'Название партнёра'}</p><p className="mt-2 text-sm font-black text-white">{draft.offerTitle||'Название акции'}</p><p className="mt-1 text-xs leading-relaxed text-slate-400">{draft.description||'Описание партнёрского предложения.'}</p>{draft.promoCode&&<p className="mt-3 rounded-xl bg-amber-500/10 p-2 text-[10px] text-amber-200">Промокод: <b>{draft.promoCode}</b></p>}<span className="mt-3 inline-flex rounded-xl bg-emerald-500 px-3 py-2 text-xs font-black text-slate-950">{draft.ctaLabel||'Подробнее'}</span></div>
          </div>:<div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-[10px] text-slate-500">Создайте или выберите партнёра.</div>}
        </div>
      </aside>
    </div>
  </section>;
}
