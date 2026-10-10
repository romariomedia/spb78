import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink, MapPin, ShieldCheck, Ticket, Users } from 'lucide-react';
import { OfficialEvent, UserProfile } from '../lib/types';
import { getUpcomingCityEvents, isRegistered, refreshEvents, toggleEventRegistration, verifiedTicketUrl } from '../services/events';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';

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
  const [events,setEvents]=useState<OfficialEvent[]>(()=>getUpcomingCityEvents(7));
  const [filter,setFilter]=useState<Filter>('all');
  const [busy,setBusy]=useState('');

  useEffect(()=>{
    void refreshEvents().then(()=>setEvents(getUpcomingCityEvents(7))).catch(()=>{});
  },[refreshKey]);

  const visible=useMemo(()=>events.filter(event=>{
    if(filter==='all')return true;
    if(filter==='mine')return isRegistered(event,currentUser.id);
    if(filter==='media')return event.isMediaLeague===true;
    return event.sport===filter;
  }),[events,filter,currentUser.id]);

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

  if(events.length===0)return null;

  return <section className="rounded-3xl border border-sky-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/30 p-4 shadow-xl space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-sky-400"/>
          <h3 className="text-sm font-black text-white">Спортивные события Петербурга</h3>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Главные события ближайших 7 дней. Найдите компанию. Для клубных матчей — официальные билетные сайты, для медиалиг — информация организаторов.
        </p>
      </div>
      <span className="shrink-0 rounded-xl border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-black text-sky-300">{events.length}</span>
    </div>

    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {filters.map(item=><button key={item.id} type="button" onClick={()=>setFilter(item.id)}
        className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-black transition ${filter===item.id?'bg-sky-400 text-slate-950':'border border-slate-700 bg-slate-950 text-slate-300'}`}>
        {item.label}
      </button>)}
    </div>

    {visible.length===0?<div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-center text-xs text-slate-500">В этой категории на ближайшую неделю событий пока нет.</div>:
    <div className="space-y-3">{visible.map(event=>{
      const joined=isRegistered(event,currentUser.id);
      const ticketUrl=verifiedTicketUrl(event);
      const isMedia=event.isMediaLeague===true;
      const organizerUrl=isMedia?event.organizerUrl:'';
      return <article key={event.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        {event.coverUrl&&<div className="relative block h-32 w-full overflow-hidden">
          <img src={event.coverUrl} alt={event.title} loading="lazy" className="h-full w-full object-cover"/>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"/>
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-slate-950/90 px-2 py-1 text-[9px] font-black text-emerald-300">
            <ShieldCheck className="h-3 w-3"/> Источник проверен
          </span>
          {event.isMediaLeague&&<span className="absolute right-2 top-2 rounded-lg bg-fuchsia-500 px-2 py-1 text-[9px] font-black text-white">МЕДИАЛИГА</span>}
        </div>}
        <div className="space-y-2.5 p-3.5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-sky-400">{event.league||event.sport}</p>
            <h4 className="mt-0.5 text-sm font-black leading-snug text-white">{event.title}</h4>
            <p className="mt-1 text-[11px] text-slate-400">{event.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
            <span className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5"><CalendarDays className="h-3 w-3 shrink-0 text-sky-400"/>{when(event)}</span>
            <span className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 truncate"><MapPin className="h-3 w-3 shrink-0 text-sky-400"/>{event.locationName}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Users className="h-3 w-3"/>{event.participantIds.length} из SportBuddy78 собираются идти</div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy===event.id} onClick={()=>void attend(event)}
              className={`min-h-11 rounded-xl px-3 text-[11px] font-black transition ${joined?'border border-emerald-500/40 bg-emerald-500/10 text-emerald-300':'bg-sky-400 text-slate-950'}`}>
              {busy===event.id?'Обновляем…':joined?'✓ Я иду':'Иду / ищу компанию'}
            </button>
            {isMedia && organizerUrl?<a href={organizerUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-sky-400/40 bg-sky-400/10 px-3 text-center text-[11px] font-black text-sky-300">Уточнить у организаторов <ExternalLink className="h-3.5 w-3.5"/></a>:ticketUrl?<a href={ticketUrl} target="_blank" rel="noopener noreferrer"
              className="flex min-h-11 items-center justify-center gap-1 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 text-center text-[11px] font-black text-amber-300">
              Купить билет <ExternalLink className="h-3.5 w-3.5"/>
            </a>:<span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-800 px-3 text-center text-[10px] font-bold text-slate-600">{isMedia?'Информация уточняется':'Билеты уточняются'}</span>}
          </div>
          {joined&&onOpenChat&&<button type="button" onClick={()=>onOpenChat(event)}
            className="w-full min-h-10 rounded-xl border border-sky-500/35 bg-sky-500/10 text-[11px] font-black text-sky-300">
            💬 Открыть чат тех, кто идёт
          </button>}
          {ticketUrl&&<p className="flex items-center gap-1 text-[9px] text-slate-500"><ShieldCheck className="h-3 w-3 text-emerald-400"/>Ссылка подтверждена администратором · {event.ticketSourceName}</p>}
        </div>
      </article>;
    })}</div>}
  </section>;
};
