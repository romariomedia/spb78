import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Compass, MapPin, RefreshCw, Search, Users, X } from 'lucide-react';
import { LEISURE_DESTINATIONS, LEISURE_REGIONS, getLeisureDestination, LeisureDestination } from '../../shared/leisure-destinations.js';
import { createLeisureEvent, listLeisureEvents, readLeisureEvent, changeLeisureEvent, LeisureDraft, LeisureEvent } from '../services/leisure';
import { UserProfile } from '../lib/types';

interface Props { user:UserProfile; users:UserProfile[]; isPremium:boolean; initialEventId:string; onOpenTariff:()=>void; onOpenUser:(user:UserProfile)=>void }
const field='w-full min-w-0 min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400';
const primary='min-h-11 rounded-xl bg-lime-300 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-50';
const secondary='min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-50';
const mergeEvents=(old:LeisureEvent[],next:LeisureEvent[])=>[...new Map([...old,...next].map(event=>[event.id,event])).values()].sort((a,b)=>a.startsAt-b.startsAt);
const eventTime=(event:LeisureEvent)=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Moscow'}).format(event.startsAt)+' МСК';
function Cover({place,hero=false}:{place:LeisureDestination;hero?:boolean}){
 const [failed,setFailed]=useState(false);
 return <div className={`relative overflow-hidden bg-slate-800 ${hero?'h-64 sm:h-80':'aspect-[16/10]'}`}>
  {!failed?<img src={place.photo} alt={place.name} width="1200" height="750" loading={hero?'eager':'lazy'} decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={()=>setFailed(true)}/>:<div className="flex h-full items-center justify-center text-slate-300">Фото временно недоступно</div>}
  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-transparent to-slate-950/10"/>
  <div className="absolute bottom-4 left-4 right-4"><p className="text-[10px] uppercase tracking-[.18em] text-lime-200">{LEISURE_REGIONS[place.region]}</p><h3 className={`${hero?'text-3xl':'text-xl'} mt-1 font-bold tracking-tight text-white`}>{place.name}</h3></div>
 </div>;
}
export default function LeisureSection({user,users,isPremium,initialEventId,onOpenTariff,onOpenUser}:Props){
 const [view,setView]=useState<'places'|'events'>('places');
 const [region,setRegion]=useState('all'),[search,setSearch]=useState(''),[mine,setMine]=useState(false);
 const [place,setPlace]=useState<LeisureDestination|null>(null),[selected,setSelected]=useState<LeisureEvent|null>(null);
 const [draft,setDraft]=useState<LeisureDraft|null>(null);
 const requestId=useRef('');const busyRef=useRef(false);
 const [events,setEvents]=useState<LeisureEvent[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [cancelConfirm,setCancelConfirm]=useState(false);
 const mounted=useRef(true);const loadVersion=useRef(0);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;loadVersion.current++;};},[]);
 const refresh=useCallback(async(next?:string)=>{
  const version=++loadVersion.current;setLoading(true);
  try{const result=await listLeisureEvents(next);if(!mounted.current||version!==loadVersion.current)return;setEvents(old=>next?mergeEvents(old,result.events):result.events);setCursor(result.next);setError('');}
  catch(e){if(mounted.current&&version===loadVersion.current)setError(e instanceof Error?e.message:'Не удалось загрузить встречи');}
  finally{if(mounted.current&&version===loadVersion.current)setLoading(false);}
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{
  if(!initialEventId)return;let stopped=false;setView('events');setPlace(null);setDraft(null);
  readLeisureEvent(initialEventId).then(({event})=>{if(!stopped){setSelected(event);setEvents(old=>mergeEvents(old,[event]));}}).catch(e=>{if(!stopped)setError(e instanceof Error?e.message:'Встреча недоступна');});
  return()=>{stopped=true;};
 },[initialEventId]);
 const filteredPlaces=useMemo(()=>LEISURE_DESTINATIONS.filter(item=>(region==='all'||item.region===region)&&`${item.name} ${item.description} ${item.format}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))),[region,search]);
 const filteredEvents=events.filter(event=>(region==='all'||event.region===region)&&(!mine||event.participantIds.includes(user.id))&&(mine||event.status==='open')&&`${event.title} ${getLeisureDestination(event.destinationId)?.name||''}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));
 const begin=(destination:LeisureDestination)=>{
  if(!isPremium){onOpenTariff();return;}
  const tomorrow=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()+86400000);
  requestId.current=crypto.randomUUID();setError('');setSelected(null);setPlace(destination);
  setDraft({destinationId:destination.id,title:`Вместе: ${destination.name}`,date:tomorrow,time:'10:00',meetingPoint:'',description:destination.plan,transport:'',costs:'',capacity:6,participantGender:'any'});
 };
 const save=async(e:React.FormEvent)=>{
  e.preventDefault();if(!draft||busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{const {event}=await createLeisureEvent(draft,requestId.current);if(!mounted.current)return;setEvents(old=>mergeEvents(old,[event]));setDraft(null);setPlace(null);setSelected(event);setView('events');}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Не удалось создать встречу');}
  finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 };
 const change=async(event:LeisureEvent,action:'join'|'leave'|'cancel')=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');
  try{const result=await changeLeisureEvent(event.id,action);if(!mounted.current)return;setEvents(old=>mergeEvents(old,[result.event]));setSelected(result.event);setCancelConfirm(false);}
  catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Не удалось обновить запись');}
  finally{busyRef.current=false;if(mounted.current)setBusy(false);}
 };
 const back=()=>{if(busy)return;setDraft(null);setPlace(null);setSelected(null);setCancelConfirm(false);setError('');if(window.location.hash.startsWith('#leisure='))history.replaceState(null,'',location.pathname+location.search);};
 const errorBox=error?<div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-950/40 p-3 text-sm text-amber-200">{error}</div>:null;
 if(draft&&place)return <section className="space-y-4 pb-6">
  <button onClick={back} disabled={busy} className={secondary}><ArrowLeft className="inline h-4 w-4 mr-2"/>Назад к направлениям</button>
  <h2 className="text-2xl font-bold">Новая встреча</h2><p className="text-sm text-lime-300">{place.name} · {LEISURE_REGIONS[place.region]}</p>{errorBox}
  <form onSubmit={save} className="space-y-4 rounded-3xl border border-slate-700 bg-slate-900 p-4 sm:p-6">
   <fieldset disabled={busy} className="space-y-4">
    <label className="block text-sm">Название<input className={field+' mt-1'} required minLength={3} maxLength={120} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm min-w-0">Дата<input className={field+' mt-1'} type="date" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label><label className="text-sm min-w-0">Время сбора, МСК<input className={field+' mt-1'} type="time" required value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label></div>
    <label className="block text-sm">Где встречаемся<input className={field+' mt-1'} required minLength={5} maxLength={300} placeholder="Город, адрес и ориентир: например, у выхода из метро" value={draft.meetingPoint} onChange={e=>setDraft({...draft,meetingPoint:e.target.value})}/></label>
    <label className="block text-sm">Как добираемся<input className={field+' mt-1'} required minLength={3} maxLength={300} placeholder="Электричка, личные машины или встреча на месте" value={draft.transport} onChange={e=>setDraft({...draft,transport:e.target.value})}/></label>
    <label className="block text-sm">Расходы и билеты<input className={field+' mt-1'} required minLength={3} maxLength={300} placeholder="Что оплачивает каждый: дорога, вход, экскурсия" value={draft.costs} onChange={e=>setDraft({...draft,costs:e.target.value})}/></label>
    <div className="grid grid-cols-2 gap-3"><label className="text-sm min-w-0">Всего мест, с вами<input className={field+' mt-1'} type="number" min={2} max={30} required value={draft.capacity} onChange={e=>setDraft({...draft,capacity:Number(e.target.value)})}/></label><label className="text-sm min-w-0">Кто может записаться<select className={field+' mt-1'} value={draft.participantGender} onChange={e=>setDraft({...draft,participantGender:e.target.value as LeisureDraft['participantGender']})}><option value="any">Любой</option><option value="female">Женщины</option><option value="male">Мужчины</option></select></label></div>
    <label className="block text-sm">План, темп и что взять<textarea className={field+' mt-1 min-h-28'} rows={4} maxLength={2000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <p className="text-xs leading-relaxed text-slate-400">Вы собираете компанию. Создание встречи не бронирует билеты, транспорт или экскурсию — договоритесь о них отдельно.</p>
    <button className={primary+' w-full'} disabled={busy}>{busy?'Сохраняем…':'Создать встречу'}</button>
   </fieldset>
  </form>
 </section>;
 if(selected){const destination=getLeisureDestination(selected.destinationId),joined=selected.participantIds.includes(user.id),owner=selected.createdBy===user.id,closed=selected.status==='cancelled'||selected.startsAt<=Date.now(),full=selected.participantIds.length>=selected.capacity;
  return <section className="space-y-4 pb-6"><button onClick={back} className={secondary} disabled={busy}><ArrowLeft className="inline h-4 w-4 mr-2"/>К встречам</button>{errorBox}
   <article className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900">{destination&&<Cover place={destination} hero/>}<div className="space-y-4 p-5">
    <p className="text-xs font-bold uppercase tracking-wider text-lime-300">{selected.status==='cancelled'?'Встреча отменена':closed?'Запись закрыта':'Набираем компанию'}</p><h2 className="text-2xl font-bold break-words">{selected.title}</h2>
    <p className="text-sm text-slate-300"><CalendarDays className="inline h-4 w-4 mr-2"/>{eventTime(selected)}</p>
    <dl className="space-y-3 text-sm break-words">{[['Место сбора',selected.meetingPoint],['Транспорт',selected.transport],['Расходы',selected.costs],['Организатор',selected.organizerName],['Кто может записаться',selected.participantGender==='any'?'Любой':selected.participantGender==='female'?'Женщины':'Мужчины']].map(([label,value])=><div key={label}><dt className="text-slate-400">{label}</dt><dd className="mt-1 text-white">{value}</dd></div>)}</dl>
    <p className="text-sm whitespace-pre-wrap break-words text-slate-200">{selected.description}</p>
    <p className="text-sm font-bold">Участники: {selected.participantIds.length} / {selected.capacity}</p>
    <div className="flex flex-wrap gap-2">{selected.participantIds.map(id=>{const person=users.find(u=>u.id===id)||(id===user.id?user:null);return person?<button key={id} onClick={()=>onOpenUser(person)} className={secondary}>{person.name}{id===selected.createdBy?' · организатор':''}</button>:<span key={id} className="p-2 text-sm text-slate-400">Участник</span>;})}</div>
    {!owner&&<button disabled={busy||(!joined&&(closed||full))} onClick={()=>void change(selected,joined?'leave':'join')} className={primary+' w-full'}>{busy?'Обновляем…':joined?'Отменить свою запись':closed?'Запись закрыта':full?'Мест нет':'Присоединиться'}</button>}
    {owner&&selected.status!=='cancelled'&&(cancelConfirm?<div className="space-y-2 rounded-xl bg-rose-950/30 p-3"><p className="text-sm">Отменить встречу и уведомить участников?</p><div className="flex gap-2"><button disabled={busy} className={secondary} onClick={()=>setCancelConfirm(false)}>Оставить</button><button disabled={busy} className={secondary+' text-rose-300'} onClick={()=>void change(selected,'cancel')}>Да, отменить</button></div></div>:<button disabled={busy} className={secondary+' text-rose-300'} onClick={()=>setCancelConfirm(true)}>Отменить встречу</button>)}
    <button className={secondary} onClick={()=>{const url=location.origin+'/#leisure='+selected.id;(navigator.clipboard?.writeText(url) || Promise.reject(new Error('Clipboard unavailable'))).then(()=>setError('Ссылка на встречу скопирована')).catch(()=>setError('Ссылка: '+url));}}>Скопировать приглашение</button>
   </div></article>
  </section>;
 }
 if(place)return <section className="space-y-4 pb-6"><button onClick={back} className={secondary}><ArrowLeft className="inline h-4 w-4 mr-2"/>Все направления</button><article className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900"><Cover place={place} hero/><div className="space-y-5 p-5 sm:p-6">
  <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-lime-300/10 px-3 py-2 text-lime-200">{place.format}</span><span className="rounded-full bg-slate-800 px-3 py-2">Темп: {place.pace}</span></div>
  <p className="leading-relaxed text-slate-200">{place.description}</p><div><h4 className="font-bold mb-2">Идея для встречи</h4><p className="text-sm leading-relaxed text-slate-300">{place.plan}</p></div>
  <div className="rounded-2xl bg-slate-950 p-4"><h4 className="font-bold mb-2 text-sm">Перед поездкой</h4><p className="text-sm leading-relaxed text-slate-400">{place.access}</p><a href={place.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-lime-300">Официальный сайт <ArrowUpRight size={16}/></a></div>
  <button onClick={()=>begin(place)} className={primary+' w-full'}>Собрать компанию сюда</button>
  <p className="text-[11px] text-slate-500">Фото: {place.photoCredit}. Описание проверено {place.checkedAt}. Фотография не отражает текущую погоду.</p>
 </div></article></section>;
 return <section className="space-y-5 pb-6">
  <header className="relative overflow-hidden rounded-3xl border border-lime-200/15 bg-slate-900 p-5 sm:p-8"><Compass className="absolute -right-5 -top-5 h-44 w-44 text-lime-200/5"/><p className="relative text-xs uppercase tracking-[.2em] text-lime-300">SportBuddy · за пределами привычного</p><h2 className="relative mt-3 text-3xl sm:text-4xl font-bold tracking-tight">Активный отдых</h2><p className="relative mt-3 max-w-md text-sm leading-relaxed text-slate-300">Красивые места и люди, с которыми хочется туда поехать. Соберите компанию на прогулку или выходные.</p><p className="relative mt-4 text-xs text-slate-400">Петербург · Ленинградская область · Карелия</p></header>
  <div className="flex rounded-2xl border border-slate-700 bg-slate-900 p-1 gap-1">{(['places','events'] as const).map(tab=><button key={tab} aria-pressed={view===tab} onClick={()=>setView(tab)} className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${view===tab?'bg-lime-300 text-slate-950':'text-slate-400'}`}>{tab==='places'?'Куда поехать':'Встречи сообщества'}</button>)}</div>
  <div className="space-y-3"><div className="flex flex-wrap gap-2">{[['all','Все регионы'],...Object.entries(LEISURE_REGIONS)].map(([id,label])=><button key={id} aria-pressed={region===id} onClick={()=>setRegion(id!)} className={`min-h-11 rounded-xl px-3 text-xs border ${region===id?'border-lime-300/50 bg-lime-300/10 text-lime-200':'border-slate-700 text-slate-400'}`}>{label}</button>)}</div><label className="relative block"><span className="sr-only">Поиск направления или встречи</span><Search className="absolute left-3 top-3 h-5 w-5 text-slate-500"/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Место, природа или формат отдыха" className={field+' pl-10'}/></label></div>
  {view==='places'?<><p className="text-xs text-slate-500">Подборка SportBuddy · {filteredPlaces.length} направлений</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{filteredPlaces.map(item=><article key={item.id} className="group overflow-hidden rounded-3xl border border-slate-700/70 bg-slate-900"><button className="block w-full text-left" onClick={()=>setPlace(item)} aria-label={`Подробнее: ${item.name}`}><Cover place={item}/></button><div className="p-4 space-y-3"><p className="text-xs text-lime-200">{item.format} · {item.pace}</p><p className="text-sm leading-relaxed text-slate-400 line-clamp-3">{item.description}</p><div className="flex gap-2"><button className={secondary+' flex-1'} onClick={()=>setPlace(item)}>О месте</button><button className={primary+' flex-1'} onClick={()=>begin(item)}>Создать встречу</button></div></div></article>)}</div>{!filteredPlaces.length&&<p className="py-8 text-center text-slate-400">Нет направлений с такими параметрами. Измените поиск или регион.</p>}</>:<>
   <div className="flex items-center justify-between gap-2"><button className={secondary} aria-pressed={mine} onClick={()=>setMine(!mine)}><Users className="inline mr-2 h-4 w-4"/>{mine?'Мои встречи':'Все встречи'}</button><button disabled={loading} className={secondary} onClick={()=>void refresh()}><RefreshCw className={`inline h-4 w-4 mr-2 ${loading?'animate-spin':''}`}/>Обновить</button></div>{errorBox}
   {loading&&!events.length?<p role="status" className="py-6 text-slate-400">Загружаем встречи…</p>:filteredEvents.length?<div className="grid gap-3 sm:grid-cols-2">{filteredEvents.map(event=><button key={event.id} onClick={()=>{setSelected(event);setCancelConfirm(false);setError('');}} className="rounded-2xl border border-slate-700 bg-slate-900 p-4 text-left space-y-2"><p className="text-xs text-lime-300">{getLeisureDestination(event.destinationId)?.name}</p><h3 className="font-bold text-lg break-words">{event.title}</h3><p className="text-xs text-slate-300">{eventTime(event)}</p><p className="text-xs text-slate-400 break-words"><MapPin size={13} className="inline mr-1"/>{event.meetingPoint}</p><p className="text-xs">{event.status==='cancelled'?'Отменена':event.startsAt<=Date.now()?'Запись закрыта':`${event.participantIds.length} / ${event.capacity} участников`}{event.participantIds.includes(user.id)?' · Вы участвуете':''}</p></button>)}</div>:!error&&<div className="rounded-3xl border border-dashed border-slate-700 px-5 py-10 text-center"><Compass className="mx-auto mb-3 h-9 w-9 text-lime-300"/><h3 className="font-bold">Компания начинается с тебя</h3><p className="mt-2 text-sm text-slate-400">Здесь пока нет подходящих встреч. Выберите место и пригласите людей провести день вместе.</p><button className={primary+' mt-5'} onClick={()=>setView('places')}>Выбрать направление</button></div>}
   {cursor&&<button className={secondary+' w-full'} disabled={loading} onClick={()=>void refresh(cursor)}>Загрузить ещё встречи</button>}
  </>}
  {(region!=='all'||search)&&<button className="text-xs text-slate-400 min-h-11" onClick={()=>{setRegion('all');setSearch('');}}><X size={13} className="inline mr-1"/>Сбросить поиск и регион</button>}
 </section>;
}
