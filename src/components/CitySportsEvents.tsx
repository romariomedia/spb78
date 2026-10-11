import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ExternalLink, MapPin, Ticket, Users } from 'lucide-react';
import { OfficialEvent, UserProfile } from '../lib/types';
import { filterUpcomingCityEvents, getUpcomingCityEvents, isRegistered, refreshEvents, toggleEventRegistration, verifiedTicketUrl } from '../services/events';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';
import { effectiveEventCover, presetEventCover } from '../lib/eventCoverPresets';

type Filter='all'|'Хоккей'|'Футбол'|'Баскетбол'|'media'|'mine';

interface Props {
  currentUser: UserProfile;
  refreshKey?: number;
  onOpenChat?: (event:OfficialEvent)=>void;
}

const filters:Array<{id:Filter;label:string}>=[
  {id:'all',label:'Все'},
  {id:'Хоккей',label:'Хоккей'},
  {id:'Футбол',label:'Футбол'},
  {id:'Баскетбол',label:'Баскетбол'},
  {id:'media',label:'Медиалиги'},
  {id:'mine',label:'Я иду'}
];

function when(event:OfficialEvent){
  const ts=Number(event.startsAt||0);
  if(!Number.isFinite(ts)||!ts)return event.dateLabel;
  return new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(ts);
}

export const CitySportsEvents:React.FC<Props>=({currentUser,refreshKey,onOpenChat})=>{
  const [events,setEvents]=useState<OfficialEvent[]>(()=>getUpcomingCityEvents(30));
  const [filter,setFilter]=useState<Filter>('all');
  const [days,setDays]=useState<7|30>(30);
  const [busy,setBusy]=useState('');
  const [loadError,setLoadError]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [expanded,setExpanded]=useState(true);

  useEffect(()=>{
    void refreshEvents().then(all=>{setEvents(filterUpcomingCityEvents(all,30));setLoadError(false);setLoaded(true);}).catch(()=>{setLoadError(true);setLoaded(true);});
  },[refreshKey]);

  const visible=useMemo(()=>(Array.isArray(events)?events:[]).filter(event=>{
    if(Number(event.startsAt)>Date.now()+days*86400000)return false;
    if(filter==='all')return true;
    if(filter==='mine')return isRegistered(event,currentUser.id);
    if(filter==='media')return event.isMediaLeague===true;
    return event.sport===filter;
  }),[events,filter,currentUser.id,days]);

  const attend=async(event:OfficialEvent)=>{
    if(busy)return;
    setBusy(event.id);
    triggerHapticImpact('medium');
    try{
      const updated=await toggleEventRegistration(event.id,currentUser.id);
      if(updated)setEvents(items=>items.map(item=>item.id===updated.id?updated:item));
    }catch(error){
      triggerHapticNotification('error');
    }finally{setBusy('');}
  };

  return <section className="rounded-2xl border border-sky-500/25 bg-slate-900/80 p-3 shadow-lg space-y-2.5">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}
      className="flex w-full items-center gap-2 text-left">
      <Ticket className="h-4 w-4 shrink-0 text-sky-400"/>
      <span className="min-w-0 flex-1 text-sm font-black text-white">Спортивные события Петербурга</span>
      <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-bold text-sky-300">{visible.length}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded?'rotate-180':''}`}/>
    </button>
    {expanded&&<>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px] font-bold">
        <button type="button" onClick={()=>setDays(7)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 ${days===7?'border-sky-400 bg-sky-400/15 text-sky-300':'border-slate-700 text-slate-400'}`}>7 дней</button>
        <button type="button" onClick={()=>setDays(30)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 ${days===30?'border-sky-400 bg-sky-400/15 text-sky-300':'border-slate-700 text-slate-400'}`}>30 дней</button>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-700"/>
        {filters.map(item=><button key={item.id} type="button" onClick={()=>setFilter(item.id)}
          className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${filter===item.id?'bg-sky-400 text-slate-950':'border border-slate-700 text-slate-300'}`}>{item.label}</button>)}
      </div>
      {loadError&&<p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-300">Не удалось обновить афишу. Проверьте подключение.</p>}
      {visible.length===0?<div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-xs text-slate-400">{!loaded?'Загружаем события…':'На выбранный период событий пока нет.'}</div>:
      <div className="space-y-2">{visible.map(event=>{
        const joined=isRegistered(event,currentUser.id);
        const ticketUrl=verifiedTicketUrl(event);
        const eventCover=effectiveEventCover(event);
        const isMedia=event.isMediaLeague===true;
        const organizerUrl=isMedia?event.organizerUrl:'';
        return <article key={event.id} className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
          <div className="flex items-start gap-3">
            {eventCover&&<img src={eventCover} alt="" loading="lazy"
              onError={e=>{const fallback=presetEventCover(event);if(fallback&& !e.currentTarget.src.endsWith(fallback)){e.currentTarget.src=fallback;}else{e.currentTarget.style.display='none';}}}
              className="h-20 w-20 shrink-0 rounded-lg object-cover sm:h-24 sm:w-28"/>}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[10px] font-bold uppercase text-sky-400">{event.league||event.sport}</p>
              <h4 className="text-sm font-black leading-tight text-white">{event.title}</h4>
              <p className="flex items-center gap-1 text-[11px] text-slate-300"><CalendarDays className="h-3 w-3 shrink-0 text-sky-400"/>{when(event)}</p>
              <p className="flex items-center gap-1 truncate text-[11px] text-slate-400"><MapPin className="h-3 w-3 shrink-0 text-sky-400"/>{event.locationName}</p>
              <p className="flex items-center gap-1 text-[10px] text-slate-500"><Users className="h-3 w-3"/>{event.participantIds.length} идут</p>
            </div>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy===event.id} onClick={()=>void attend(event)}
              className={`min-h-9 rounded-lg px-2 text-[11px] font-bold ${joined?'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300':'bg-sky-400 text-slate-950'}`}>
              {busy===event.id?'Обновляем…':joined?'✓ Я иду':'Иду / ищу компанию'}
            </button>
            {isMedia&&organizerUrl?<a href={organizerUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-sky-500/40 text-center text-[11px] font-bold text-sky-300">Организатор <ExternalLink className="h-3 w-3"/></a>:ticketUrl?<a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 text-center text-[11px] font-bold text-amber-300">Билеты <ExternalLink className="h-3 w-3"/></a>:<span className="flex min-h-9 items-center justify-center rounded-lg border border-slate-800 text-[11px] text-slate-500">Нет ссылки</span>}
          </div>
          {joined&&onOpenChat&&<button type="button" onClick={()=>onOpenChat(event)} className="mt-2 w-full rounded-lg border border-sky-500/30 py-2 text-[11px] font-bold text-sky-300">Открыть чат болельщиков</button>}
        </article>;
      })}</div>}
    </>}
  </section>;
};
