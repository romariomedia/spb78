import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,MapPin,Sparkles} from 'lucide-react';
import {loadMassage,MassageListing} from '../services/massage';
import {Modal} from './Modal';
import {trackBusinessEvent} from '../services/businessBilling';
export function MassageSection(){
 const [items,setItems]=useState<MassageListing[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [revision,setRevision]=useState(0),[query,setQuery]=useState(''),[kind,setKind]=useState('all'),[selected,setSelected]=useState<MassageListing|null>(null);
 useEffect(()=>{const controller=new AbortController();let active=true;setLoading(true);setError('');
 const timer=setTimeout(()=>controller.abort(),15000);
 loadMassage(controller.signal).then(rows=>{if(active)setItems(rows);}).catch(()=>{if(active)setError('Не удалось загрузить объявления. Попробуйте ещё раз.');}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
 return()=>{active=false;clearTimeout(timer);controller.abort();};},[revision]);
 const filtered=useMemo(()=>items.filter(item=>(kind==='all'||item.providerType===kind)&&`${item.name} ${item.address} ${item.district} ${item.services}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'))),[items,kind,query]);
 return <section className="space-y-4">
  <div className="rounded-3xl border border-lime-300/20 bg-gradient-to-br from-lime-300/10 to-slate-900 p-5"><Sparkles className="text-lime-300 h-7 w-7"/><h3 className="mt-3 text-2xl font-black">Время для себя</h3><p className="mt-2 text-sm text-slate-300">Массажные салоны и частные специалисты. Выберите подходящую услугу и свяжитесь с исполнителем напрямую.</p></div>
  {loading?<p role="status" className="p-5 text-slate-400">Загружаем услуги…</p>:error?<div role="alert" className="rounded-2xl border border-rose-500/30 p-4"><p>{error}</p><button className="min-h-11 text-lime-300" onClick={()=>setRevision(v=>v+1)}>Повторить</button></div>:items.length===0?<div className="rounded-3xl border border-dashed border-slate-700 p-8 text-center"><h4 className="text-lg font-bold">Здесь появятся услуги массажа</h4><p className="mt-3 text-sm text-slate-400">Готовим раздел для салонов и частных специалистов. Скоро здесь можно будет выбрать услугу и записаться напрямую.</p></div>:<>
   <div className="flex flex-wrap gap-2">{[['all','Все'],['salon','Салоны'],['private','Специалисты']].map(([id,label])=><button key={id} aria-pressed={kind===id} onClick={()=>setKind(id!)} className={`min-h-11 rounded-xl border px-4 ${kind===id?'bg-lime-300 text-slate-950 border-lime-300':'border-slate-700 text-slate-300'}`}>{label}</button>)}</div>
   <input aria-label="Поиск услуг массажа" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Название, услуга или район" className="w-full min-h-11 rounded-xl border border-slate-700 bg-slate-950 p-3"/>
   <div className="grid gap-4 sm:grid-cols-2">{filtered.map(item=><button key={item.id} onClick={()=>{void trackBusinessEvent('massage',item.id,'view','profile');setSelected(item);}} className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 text-left">
    {item.media.find(m=>m.type==='image')?<img src={item.media.find(m=>m.type==='image')!.url} alt={item.name} loading="lazy" decoding="async" className="aspect-[16/10] w-full object-cover"/>:<div className="h-32 grid place-items-center bg-lime-300/5"><Sparkles className="w-10 h-10 text-lime-300"/></div>}
    <div className="p-4 space-y-2"><div className="flex flex-wrap items-center gap-2"><p className="text-xs text-lime-300">{item.providerType==='salon'?'Массажный салон':'Частный специалист'}</p>{item.isPromoted&&<span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-black text-fuchsia-200">🚀 В приоритете</span>}</div><h4 className="font-bold text-lg break-words">{item.name}</h4>{item.research&&<p className="text-xs text-amber-200">★ {item.research.rating.toFixed(1)} · Яндекс · {item.research.reviewCount} отзывов<span className="block mt-1 text-slate-400">Подборка SportBuddy · данные на {item.research.checkedAt.split('-').reverse().join('.')}</span></p>}<p className="text-sm text-slate-400 line-clamp-2"><MapPin className="inline h-4 w-4"/> {item.district} · {item.address}</p><p className="text-sm text-lime-200 line-clamp-2 whitespace-pre-line">{item.priceText}</p><span className="inline-flex items-center gap-2 text-sm">Услуги и запись <ArrowUpRight size={16}/></span></div>
   </button>)}</div>{!filtered.length&&<p className="p-5 text-slate-400">Нет объявлений по вашему запросу.</p>}
  </>}
  <Modal isOpen={!!selected} onClose={()=>setSelected(null)} title={selected?.name||'Массаж'} maxWidth="lg">
   {selected&&<div className="space-y-5">
    <p className="text-xs font-bold uppercase tracking-wide text-lime-300">{selected.providerType==='salon'?'Массажный салон':'Частный специалист'}</p>
    <div className="space-y-3">{selected.media.map((media,i)=>media.type==='image'?<img key={i} src={media.url} alt={`${selected.name} — фото ${i+1}`} loading="lazy" decoding="async" className="max-h-96 w-full rounded-2xl object-contain bg-slate-950"/>:<video key={i} src={media.url} controls playsInline preload="none" className="max-h-96 w-full rounded-2xl bg-slate-950"/>)}</div>
    {selected.research&&<div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm"><p className="font-bold text-amber-200">★ {selected.research.rating.toFixed(1)} / 5 · Яндекс · {selected.research.reviewCount} отзывов</p><p className="mt-2 text-xs text-slate-400">Подборка SportBuddy. Рейтинг и отзывы — снимок открытого источника на {selected.research.checkedAt.split('-').reverse().join('.')}; показатели могут измениться.</p><a href={selected.research.reviewUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-lime-300">Читать отзывы <ArrowUpRight size={16}/></a></div>}
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{selected.description}</p>
    {selected.services&&<div><h4 className="font-bold mb-2">Услуги</h4><p className="whitespace-pre-wrap text-sm">{selected.services}</p></div>}
    <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4"><h4 className="font-bold text-lime-300">Цены</h4><p className="mt-2 whitespace-pre-wrap text-sm">{selected.priceText}</p></div>
    <p className="text-sm whitespace-pre-wrap">{selected.district} · {selected.address}</p>{selected.hours&&<p className="text-sm">Приём: {selected.hours}</p>}
    {selected.phone&&<a href={`tel:${selected.phone.replace(/[^+\d]/g,'')}`} onClick={()=>{void trackBusinessEvent('massage',selected.id,'click','phone');void trackBusinessEvent('massage',selected.id,'lead','phone');}} className="inline-flex min-h-11 items-center text-sm text-lime-300">Позвонить: {selected.phone}</a>}
    <a href={selected.bookingUrl} onClick={()=>{void trackBusinessEvent('massage',selected.id,'click','booking');void trackBusinessEvent('massage',selected.id,'lead','booking');}} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lime-300 p-3 font-bold text-slate-950">Записаться <ArrowUpRight size={18}/></a>
    <p className="text-xs leading-relaxed text-slate-400">Вы перейдёте к исполнителю. Время, стоимость и подтверждение записи согласовываются напрямую. SportBuddy не принимает оплату и не оформляет бронирование.</p>
   </div>}
  </Modal>
 </section>;
}
