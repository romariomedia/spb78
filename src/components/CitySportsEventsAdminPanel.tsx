import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck, Trash2, X } from 'lucide-react';
import { EventStatus, OfficialEvent, UserProfile } from '../lib/types';
import { createEvent, refreshEvents, removeEvent, updateEvent, validateEventDraft, EventDraft } from '../services/events';
import { LEAGUE_SPORT, LEAGUE_VENUES, teamsForLeague, venuesForLeague, eventMatchTitle } from '../lib/eventAdminPresets';
import { presetEventCover } from '../lib/eventCoverPresets';

interface Props { currentUser:UserProfile; onChanged:()=>void }

const sports=['Хоккей','Футбол','Баскетбол','Волейбол','Теннис','Общее'];

export const CitySportsEventsAdminPanel:React.FC<Props>=({currentUser,onChanged})=>{
  const [events,setEvents]=useState<OfficialEvent[]>([]);
  const [editing,setEditing]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [title,setTitle]=useState('');
  const [tagline,setTagline]=useState('Ищете компанию на матч? Присоединяйтесь к болельщикам SportBuddy78');
  const [sport,setSport]=useState('Хоккей');
  const [league,setLeague]=useState('');
  const [isMediaLeague,setIsMediaLeague]=useState(false);
  const [homeTeam,setHomeTeam]=useState('');
  const [awayTeam,setAwayTeam]=useState('');
  const [description,setDescription]=useState('');
  const [coverUrl,setCoverUrl]=useState('');
  const [locationName,setLocationName]=useState('');
  const [address,setAddress]=useState('');
  const [lat,setLat]=useState('59.9386');
  const [lng,setLng]=useState('30.3141');
  const [dateKey,setDateKey]=useState('');
  const [time,setTime]=useState('19:00');
  const [officialSourceUrl,setOfficialSourceUrl]=useState('');
  const [ticketUrl,setTicketUrl]=useState('');
  const [ticketSourceName,setTicketSourceName]=useState('');
  const [ticketVerified,setTicketVerified]=useState(false);
  const [status,setStatus]=useState<EventStatus>('draft');

  const load=async()=>{const all=await refreshEvents();setEvents(all.filter(e=>e.category==='spectator'));};
  useEffect(()=>{void load().catch(()=>{});},[]);
  const availableTeams=useMemo(()=>isMediaLeague?[]:teamsForLeague(league),[league,isMediaLeague]);
  const availableVenues=useMemo(()=>isMediaLeague?[]:venuesForLeague(league),[league,isMediaLeague]);
  const useLeague=(next:string)=>{
    setLeague(next);
    if(next in LEAGUE_SPORT)setSport(LEAGUE_SPORT[next as keyof typeof LEAGUE_SPORT]);
    setHomeTeam('');setAwayTeam('');setTitle('');
    setLocationName('');setAddress('');setLat('');setLng('');
  };
  const useTeams=(home:string,away:string)=>{
    if(home && away && home===away)return;
    setHomeTeam(home);setAwayTeam(away);
    const next=eventMatchTitle(home,away);if(next)setTitle(next);
  };
  const useVenue=(id:string)=>{
    const selected=LEAGUE_VENUES.find(v=>v.id===id);
    if(!selected)return;
    setLocationName(selected.name);setAddress(selected.address);setLat(String(selected.lat));setLng(String(selected.lng));
  };
  const defaultCover=presetEventCover({league,sport,homeTeam,awayTeam,isMediaLeague});
  const sorted=useMemo(()=>[...events].sort((a,b)=>Number(a.startsAt||0)-Number(b.startsAt||0)),[events]);

  const reset=()=>{
    setEditing(null);setError('');setTitle('');setTagline('Ищете компанию на матч? Присоединяйтесь к болельщикам SportBuddy78');
    setSport('Хоккей');setLeague('');setIsMediaLeague(false);setHomeTeam('');setAwayTeam('');setDescription('');
    setCoverUrl('');setLocationName('');setAddress('');setLat('59.9386');setLng('30.3141');setDateKey('');setTime('19:00');
    setOfficialSourceUrl('');setTicketUrl('');setTicketSourceName('');setTicketVerified(false);setStatus('draft');
  };

  const edit=(event:OfficialEvent)=>{
    setEditing(event.id);setTitle(event.title);setTagline(event.tagline);setSport(event.sport);setLeague(event.league||'');
    setIsMediaLeague(event.isMediaLeague===true);setHomeTeam(event.homeTeam||'');setAwayTeam(event.awayTeam||'');
    setDescription(event.description);setCoverUrl(event.coverUrl||'');setLocationName(event.locationName);setAddress(event.address);
    setLat(String(event.lat));setLng(String(event.lng));setDateKey(event.dateKey||'');setTime(event.time);
    setOfficialSourceUrl(event.officialSourceUrl||'');setTicketUrl(event.ticketUrl||'');setTicketSourceName(event.ticketSourceName||'');
    setTicketVerified(event.ticketVerified===true);setStatus(event.status);setError('');
  };

  const save=async()=>{
    setError('');
    const ts=dateKey&&time?Date.parse(`${dateKey}T${time}:00+03:00`):NaN;
    const dateLabel=Number.isFinite(ts)?new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(ts):dateKey;
    const draft:EventDraft={
      title,tagline,category:'spectator',sport,description,coverUrl:coverUrl||undefined,
      locationName,address,lat:Number(lat),lng:Number(lng),dateLabel,time,dateKey,startsAt:ts,participantsMax:100,
      audienceMode:'spectator',league:league||undefined,isMediaLeague,homeTeam:homeTeam||undefined,awayTeam:awayTeam||undefined,
      officialSourceUrl:officialSourceUrl||undefined,ticketUrl:ticketUrl||undefined,ticketSourceName:ticketSourceName||undefined,
      ticketVerified,status,entryFee:'Билет приобретается самостоятельно на официальном сайте'
    };
    if(coverUrl==='custom'){setError('Укажите ссылку на индивидуальную обложку или выберите стандартную.');return;}
    const problem=validateEventDraft(draft);if(problem){setError(problem);return;}
    setBusy(true);
    try{
      if(editing)await updateEvent(editing,draft);else await createEvent(draft,currentUser.id);
      await load();reset();onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить событие');}
    finally{setBusy(false);}
  };

  const remove=async(id:string)=>{
    if(!confirm('Удалить событие из афиши?'))return;
    setBusy(true);try{await removeEvent(id);await load();onChanged();}finally{setBusy(false);}
  };

  const field='w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-sky-500';
  return <div className="space-y-4 rounded-2xl border border-sky-500/20 bg-slate-900/50 p-3">
    <div>
      <h4 className="text-xs font-black text-white">Спортивные события Петербурга</h4>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-400">События в статусе «Опубликовано» отображаются в афише на 30 дней вперёд. Черновики пользователям не видны. Официальные билетные ссылки требуют подтверждения.</p>
    </div>

    <div className="grid gap-2 md:grid-cols-2">
      <input className={field} value={title} onChange={e=>setTitle(e.target.value)} placeholder="СКА — Спартак"/>
      <select className={field} value={sport} onChange={e=>setSport(e.target.value)}>{sports.map(x=><option key={x}>{x}</option>)}</select>
      {isMediaLeague?<input className={field} value={league} onChange={e=>setLeague(e.target.value)} placeholder="Медиалига"/>:
        <select className={field} value={league} onChange={e=>useLeague(e.target.value)}>
          <option value="">Выберите лигу</option>
          <option value="КХЛ">КХЛ</option><option value="РПЛ">РПЛ</option>
          <option value="Единая лига ВТБ">Единая лига ВТБ</option>
          {league&&!['КХЛ','РПЛ','Единая лига ВТБ'].includes(league)&&<option value={league}>{league}</option>}
        </select>}
      <label className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-slate-300"><input type="checkbox" checked={isMediaLeague} onChange={e=>setIsMediaLeague(e.target.checked)}/> Медиалига</label>
      {!isMediaLeague&&availableTeams.length>0?<>
        <select aria-label="Команда хозяев" className={field} value={homeTeam} onChange={e=>useTeams(e.target.value,awayTeam)}>
          <option value="">Хозяева — выберите команду</option>
          {homeTeam&&!availableTeams.includes(homeTeam)&&<option value={homeTeam}>{homeTeam}</option>}
          {availableTeams.map(team=><option key={team} value={team} disabled={team===awayTeam}>{team}</option>)}
        </select>
        <select aria-label="Команда гостей" className={field} value={awayTeam} onChange={e=>useTeams(homeTeam,e.target.value)}>
          <option value="">Гости — выберите команду</option>
          {awayTeam&&!availableTeams.includes(awayTeam)&&<option value={awayTeam}>{awayTeam}</option>}
          {availableTeams.map(team=><option key={team} value={team} disabled={team===homeTeam}>{team}</option>)}
        </select>
      </>:<>
        <input className={field} value={homeTeam} onChange={e=>setHomeTeam(e.target.value)} placeholder="Команда 1"/>
        <input className={field} value={awayTeam} onChange={e=>setAwayTeam(e.target.value)} placeholder="Команда 2"/>
      </>}
      <input className={field} type="date" value={dateKey} onChange={e=>setDateKey(e.target.value)}/>
      <input className={field} type="time" value={time} onChange={e=>setTime(e.target.value)}/>
      {!isMediaLeague&&availableVenues.length>0&&<select aria-label="Готовые площадки Санкт-Петербурга" className={field+' md:col-span-2'} value={LEAGUE_VENUES.find(v=>v.name===locationName&&v.address===address)?.id||''} onChange={e=>useVenue(e.target.value)}>
        <option value="">Выбрать готовую арену (проверьте место матча)</option>
        {availableVenues.map(v=><option key={v.id} value={v.id}>{v.name} · {v.address}</option>)}
      </select>}
      <input className={field} value={locationName} onChange={e=>setLocationName(e.target.value)} placeholder="Арена / стадион"/>
      <input className={field} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Адрес"/>
      <input className={field} value={lat} onChange={e=>setLat(e.target.value)} placeholder="Широта"/>
      <input className={field} value={lng} onChange={e=>setLng(e.target.value)} placeholder="Долгота"/>
    </div>

    <textarea className={field+' min-h-20'} value={tagline} onChange={e=>setTagline(e.target.value)} placeholder="Короткий текст"/>
    <textarea className={field+' min-h-24'} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Описание события"/>
    <div className="space-y-2 rounded-xl border border-slate-800 p-3">
      <p className="text-xs font-bold text-slate-200">Обложка события</p>
      {!isMediaLeague&&defaultCover&&<>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>setCoverUrl('')} className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${!coverUrl?'border-lime-400 text-lime-300':'border-slate-700 text-slate-400'}`}>Стандартная обложка клуба</button>
          <button type="button" onClick={()=>setCoverUrl('custom')} className={`rounded-lg border px-3 py-2 text-[11px] font-bold ${coverUrl?'border-lime-400 text-lime-300':'border-slate-700 text-slate-400'}`}>Своя обложка</button>
        </div>
        {!coverUrl&&<img src={defaultCover} alt="Стандартная обложка" className="h-28 w-full rounded-xl object-cover"/>}
      </>}
      {(isMediaLeague||!defaultCover||Boolean(coverUrl))&&<input className={field} value={coverUrl==='custom'?'':coverUrl} onChange={e=>setCoverUrl(e.target.value)} placeholder="https://... индивидуальная обложка" />}
      {!isMediaLeague&&!defaultCover&&<p className="text-[10px] text-slate-500">Для этой пары команд стандартной обложки нет. Добавьте индивидуальную при необходимости.</p>}
    </div>

    <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      <p className="flex items-center gap-1 text-[10px] font-black uppercase text-amber-300"><ShieldCheck className="h-3.5 w-3.5"/>Проверка официальных источников</p>
      <input className={field} value={officialSourceUrl} onChange={e=>{setOfficialSourceUrl(e.target.value);setTicketVerified(false);}} placeholder="Официальная страница матча / клуба"/>
      <input className={field} value={ticketUrl} onChange={e=>{setTicketUrl(e.target.value);setTicketVerified(false);}} placeholder="Официальная ссылка покупки билета"/>
      <input className={field} value={ticketSourceName} onChange={e=>{setTicketSourceName(e.target.value);setTicketVerified(false);}} placeholder="Источник билетов: ХК СКА / ФК Зенит / официальный оператор"/>
      <label className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-[10px] leading-relaxed text-slate-300">
        <input type="checkbox" className="mt-0.5" checked={ticketVerified} onChange={e=>setTicketVerified(e.target.checked)}/>
        <span><b className="text-emerald-300">Я проверил ссылку.</b> Она ведёт на официальный сайт клуба, организатора или официального билетного оператора, а не на посредника.</span>
      </label>
      {ticketVerified&&<p className="flex items-center gap-1 text-[10px] font-bold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5"/>Билетная ссылка допущена к публикации</p>}
    </div>

    <div className="grid grid-cols-2 gap-2">
      <select className={field} value={status} onChange={e=>setStatus(e.target.value as EventStatus)}>
        <option value="draft">Черновик</option><option value="published">Опубликовано</option><option value="finished">Завершено</option>
      </select>
      <button disabled={busy} onClick={()=>void save()} className="rounded-xl bg-sky-400 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">
        {editing?'Сохранить событие':'Добавить в афишу'}
      </button>
    </div>
    {editing&&<button onClick={reset} className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-700 py-2 text-xs font-bold text-slate-300"><X className="h-4 w-4"/>Отменить редактирование</button>}
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] font-bold text-rose-300">{error}</p>}

    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Городская афиша ({sorted.length})</p>
      {sorted.map(event=><div key={event.id} className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-white">{event.title}</p>
          <p className="truncate text-[9px] text-slate-500">{event.dateLabel} · {event.time} · {event.locationName}</p>
          <p className={`mt-0.5 text-[9px] font-bold ${event.ticketVerified?'text-emerald-400':'text-amber-400'}`}>{event.ticketVerified?'✓ Билеты проверены':'⚠ Билеты не подтверждены'} · {event.status==='published'?'Опубликовано':event.status==='draft'?'Черновик':'Завершено'}{Number(event.startsAt)>Date.now()+30*86400000?' · Не входит в 30-дневную афишу':''}</p>
        </div>
        {event.ticketUrl&&<a href={event.ticketUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-sky-400" title="Проверить ссылку"><ExternalLink className="h-4 w-4"/></a>}
        <button onClick={()=>edit(event)} className="rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] font-bold text-white">Править</button>
        <button onClick={()=>void remove(event.id)} className="p-2 text-rose-400"><Trash2 className="h-4 w-4"/></button>
      </div>)}
      {!sorted.length&&<div className="rounded-xl border border-dashed border-slate-700 p-4 text-center text-[10px] text-slate-500">Пока нет городских спортивных событий.</div>}
    </div>
  </div>;
};
