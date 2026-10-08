import { useEffect,useMemo,useState } from 'react';
import { CheckCircle2,Clock3,Dumbbell,Eye,EyeOff,Flag,MapPin,Pencil,Plus,RefreshCw,Save,Trash2,Users,XCircle } from 'lucide-react';
import { DISTRICTS,districtLabel } from '../../shared/districts.js';
import { SPORTS,Training } from '../lib/types';
import { refreshVenues } from '../services/venues';
import { SportVenue } from '../lib/venues';
import {
  OfficialTraining,OfficialTrainingDraft,cancelOfficialTraining,completeOfficialTraining,
  createOfficialTraining,deleteOfficialTraining,loadOfficialTrainings,updateOfficialTraining
} from '../services/adminOfficialTrainings';

const field='w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400';

const STARTER_TEMPLATES=[
  {title:'Лёгкая пробежка 5 км',sport:'Бег',description:'Спокойная совместная пробежка. Подходит тем, кто хочет познакомиться с участниками SportBuddy78 и провести тренировку в комфортном темпе.'},
  {title:'Вечерняя пробежка по Петербургу',sport:'Бег',description:'Встречаемся, знакомимся и бежим вместе в разговорном темпе. Маршрут и темп уточняем в групповом чате.'},
  {title:'Футбол 5×5 — собираем команду',sport:'Футбол',description:'Открытая тренировка SportBuddy78. Собираем игроков любительского уровня на дружеский матч.'},
  {title:'Теннис — открытая игра',sport:'Теннис',description:'Совместная игра для знакомства и практики. Уровень — любительский, пары распределим на месте.'},
  {title:'Падел — знакомство с игрой',sport:'Падел',description:'Открытая тренировка для тех, кто хочет попробовать падел или найти постоянных партнёров для игры.'},
  {title:'Баскетбол — игра для любителей',sport:'Баскетбол',description:'Собираем открытую группу SportBuddy78 для совместной игры. Главное — желание играть и хорошее настроение.'},
  {title:'Волейбол — собираем группу',sport:'Волейбол',description:'Открытая любительская тренировка. После записи участники смогут договориться о деталях в общем чате.'},
  {title:'Воркаут — совместная тренировка',sport:'Воркаут',description:'Функциональная тренировка на открытой площадке. Подходит для знакомства и совместной работы в своём темпе.'}
] as const;

function tomorrowKey(days=1){
  const d=new Date();d.setDate(d.getDate()+days);
  const p=(n:number)=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}
function labelForDate(key:string){
  if(!key)return '';
  const d=new Date(key+'T12:00:00');
  return new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'long'}).format(d);
}
function emptyDraft():OfficialTrainingDraft{
  return {
    title:'',sport:'Бег',dateKey:tomorrowKey(2),dateLabel:labelForDate(tomorrowKey(2)),time:'19:00',
    districtId:'',locationName:'',address:'',lat:NaN,lng:NaN,level:'amateur',participantsMax:12,
    participantGender:'any',description:'',venueId:'',venueName:'',officialStatus:'draft'
  };
}
function statusLabel(item:OfficialTraining){
  if(item.officialStatus==='completed'||item.isCompleted)return 'Завершена';
  if(item.officialStatus==='cancelled')return 'Отменена';
  if(item.officialStatus==='published')return 'Опубликована';
  return 'Черновик';
}

export function AdminOfficialTrainingsPanel(){
  const [items,setItems]=useState<OfficialTraining[]>([]);
  const [venues,setVenues]=useState<SportVenue[]>([]);
  const [draft,setDraft]=useState<OfficialTrainingDraft|null>(null);
  const [editingId,setEditingId]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=async()=>{
    setBusy(true);setError('');
    try{
      const [trainings,venueItems]=await Promise.all([loadOfficialTrainings(),refreshVenues(false)]);
      setItems(trainings);setVenues(venueItems.filter(v=>v.coordinates));
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить официальные тренировки');}
    finally{setBusy(false);}
  };
  useEffect(()=>{void refresh();},[]);

  const activeCount=useMemo(()=>items.filter(i=>i.officialStatus==='published'&&!i.isCompleted).length,[items]);

  const chooseVenue=(venueId:string)=>{
    if(!draft)return;
    const venue=venues.find(v=>v.id===venueId);
    if(!venue?.coordinates){setDraft({...draft,venueId:'',venueName:'',locationName:'',address:'',lat:NaN,lng:NaN});return;}
    setDraft({...draft,venueId:venue.id,venueName:venue.name,locationName:venue.name,address:venue.address,lat:venue.coordinates.lat,lng:venue.coordinates.lng});
  };
  const applyTemplate=(template:(typeof STARTER_TEMPLATES)[number])=>{
    const base=draft||emptyDraft();
    setDraft({...base,title:template.title,sport:template.sport,description:template.description});
    setEditingId('');setError('');setNotice('');
  };
  const edit=(item:OfficialTraining)=>{
    setEditingId(item.id);setDraft({
      title:item.title,sport:item.sport,dateKey:item.dateKey||'',dateLabel:item.dateLabel,time:item.time,districtId:item.districtId||'',
      locationName:item.locationName,address:item.address,lat:item.lat,lng:item.lng,level:item.level,participantsMax:item.participantsMax,
      participantGender:item.participantGender||'any',description:item.description,venueId:item.venueId||'',venueName:item.venueName||'',
      officialStatus:item.officialStatus||'draft'
    });setError('');setNotice('');
  };
  const save=async()=>{
    if(!draft||busy)return;
    if(!Number.isFinite(draft.lat)||!Number.isFinite(draft.lng)){setError('Выберите площадку из базы SportBuddy Places.');return;}
    setBusy(true);setError('');setNotice('');
    const payload={...draft,dateLabel:labelForDate(draft.dateKey)};
    try{
      if(editingId)await updateOfficialTraining(editingId,payload);else await createOfficialTraining(payload);
      setDraft(null);setEditingId('');setNotice('Официальная тренировка сохранена.');await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить тренировку');setBusy(false);}
  };
  const complete=async(item:OfficialTraining)=>{
    if(!confirm(`Завершить «${item.title}»? Групповой чат станет архивом.`))return;
    setBusy(true);try{await completeOfficialTraining(item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось завершить');setBusy(false);}
  };
  const cancel=async(item:OfficialTraining)=>{
    if(!confirm(`Отменить «${item.title}»? Участники больше не смогут записываться, чат станет архивом.`))return;
    setBusy(true);try{await cancelOfficialTraining(item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось отменить');setBusy(false);}
  };
  const remove=async(item:OfficialTraining)=>{
    if(!confirm(`Удалить черновик «${item.title}»?`))return;
    setBusy(true);try{await deleteOfficialTraining(item.id);await refresh();}catch(e){setError(e instanceof Error?e.message:'Не удалось удалить');setBusy(false);}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Стартовая активность</p>
        <h3 className="mt-1 text-base font-black text-white">Официальные тренировки SportBuddy78</h3>
        <p className="mt-1 max-w-2xl text-[10px] leading-relaxed text-slate-500">Наполняйте раздел реальными официальными активностями платформы. Участники видят честную отметку SportBuddy78, записываются как обычно и получают групповой чат.</p>
      </div>
      <div className="flex gap-2">
        <button aria-label="Обновить" onClick={()=>void refresh()} disabled={busy} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></button>
        <button onClick={()=>{setEditingId('');setDraft(emptyDraft());setError('');setNotice('');}} disabled={busy} className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-[11px] font-black text-slate-950"><Plus className="h-4 w-4"/>Создать</button>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><p className="text-[9px] uppercase text-slate-500">Активных</p><p className="mt-1 text-xl font-black text-emerald-400">{activeCount}</p></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><p className="text-[9px] uppercase text-slate-500">Всего</p><p className="mt-1 text-xl font-black text-white">{items.length}</p></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><p className="text-[9px] uppercase text-slate-500">Цель beta</p><p className="mt-1 text-xl font-black text-amber-300">8–12</p></div>
    </div>

    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">Быстрые заготовки</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {STARTER_TEMPLATES.map(t=><button key={t.title} onClick={()=>applyTemplate(t)} className="shrink-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] font-bold text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">{t.sport} · {t.title}</button>)}
      </div>
      <p className="mt-2 text-[9px] text-slate-500">Заготовка не публикуется автоматически: выберите реальную площадку, дату и время.</p>
    </div>

    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    {draft&&<div className="rounded-2xl border border-emerald-500/25 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div><p className="text-xs font-black text-white">{editingId?'Редактирование':'Новая официальная тренировка'}</p><p className="mt-0.5 text-[9px] text-slate-500">Организатор в приложении: SportBuddy78</p></div>
        <button onClick={()=>{setDraft(null);setEditingId('');}} disabled={busy} className="rounded-lg p-2 text-slate-400"><XCircle className="h-4 w-4"/></button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2 text-[10px] text-slate-400">Название<input maxLength={120} className={`${field} mt-1`} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
        <label className="text-[10px] text-slate-400">Вид спорта<select className={`${field} mt-1`} value={draft.sport} onChange={e=>setDraft({...draft,sport:e.target.value})}>{SPORTS.filter(s=>s!=='Активный отдых').map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">Статус<select className={`${field} mt-1`} value={draft.officialStatus} onChange={e=>setDraft({...draft,officialStatus:e.target.value as OfficialTrainingDraft['officialStatus']})}><option value="draft">Черновик</option><option value="published">Опубликована</option></select></label>
        <label className="text-[10px] text-slate-400">Дата<input type="date" className={`${field} mt-1`} value={draft.dateKey} onChange={e=>setDraft({...draft,dateKey:e.target.value,dateLabel:labelForDate(e.target.value)})}/></label>
        <label className="text-[10px] text-slate-400">Время<input type="time" className={`${field} mt-1`} value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label>
        <label className="md:col-span-2 text-[10px] text-slate-400">Площадка SportBuddy Places<select className={`${field} mt-1`} value={draft.venueId||''} onChange={e=>chooseVenue(e.target.value)}><option value="">Выберите площадку с координатами</option>{venues.map(v=><option key={v.id} value={v.id}>{v.name} · {v.address}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">Район<select className={`${field} mt-1`} value={draft.districtId||''} onChange={e=>setDraft({...draft,districtId:e.target.value})}><option value="">Не указан</option>{DISTRICTS.filter(d=>d.region==='spb').map(d=><option key={d.id} value={d.id}>{districtLabel(d.id)}</option>)}</select></label>
        <label className="text-[10px] text-slate-400">Уровень<select className={`${field} mt-1`} value={draft.level} onChange={e=>setDraft({...draft,level:e.target.value as OfficialTrainingDraft['level']})}><option value="amateur">Начинающие</option><option value="semi-pro">Любители+</option><option value="pro">Профи</option></select></label>
        <label className="text-[10px] text-slate-400">Кто может записаться<select className={`${field} mt-1`} value={draft.participantGender} onChange={e=>setDraft({...draft,participantGender:e.target.value as OfficialTrainingDraft['participantGender']})}><option value="any">Все</option><option value="male">Мужчины</option><option value="female">Женщины</option></select></label>
        <label className="text-[10px] text-slate-400">Количество мест<input type="number" min={2} max={100} className={`${field} mt-1`} value={draft.participantsMax} onChange={e=>setDraft({...draft,participantsMax:Number(e.target.value)})}/></label>
        <label className="md:col-span-2 text-[10px] text-slate-400">Описание<textarea rows={4} maxLength={2000} className={`${field} mt-1 resize-none`} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
      </div>

      {draft.venueId&&<div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"/><div><p className="text-[11px] font-black text-white">{draft.locationName}</p><p className="text-[9px] text-slate-500">{draft.address}</p></div></div>}
      <button onClick={()=>void save()} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4"/>{editingId?'Сохранить изменения':'Создать официальную тренировку'}</button>
    </div>}

    <div className="space-y-2">
      {items.length===0&&<div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center"><Dumbbell className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-2 text-xs font-bold text-slate-400">Официальных тренировок пока нет</p></div>}
      {items.map(item=><article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-lg">⚡</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><p className="text-[11px] font-black text-white">{item.title}</p><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black text-emerald-300">SPORTBUDDY78</span></div>
            <p className="mt-1 text-[9px] text-slate-500">{item.sport} · {item.dateLabel} {item.time} · {item.locationName}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.officialStatus==='published'?'bg-emerald-500/15 text-emerald-300':item.officialStatus==='draft'?'bg-slate-800 text-slate-300':item.officialStatus==='cancelled'?'bg-rose-500/10 text-rose-300':'bg-amber-500/10 text-amber-300'}`}>{statusLabel(item)}</span>
              <span className="rounded-full bg-slate-900 px-2 py-1 text-[9px] text-slate-400"><Users className="mr-1 inline h-3 w-3"/>{item.participantIds.length}/{item.participantsMax}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {!item.isCompleted&&item.officialStatus!=='cancelled'&&<button onClick={()=>edit(item)} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-[10px] font-bold text-slate-200"><Pencil className="h-3.5 w-3.5"/>Изменить</button>}
          {item.officialStatus==='published'&&!item.isCompleted&&<button onClick={()=>void complete(item)} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-[10px] font-bold text-amber-300"><CheckCircle2 className="h-3.5 w-3.5"/>Завершить</button>}
          {!item.isCompleted&&item.officialStatus!=='cancelled'&&<button onClick={()=>void cancel(item)} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-bold text-rose-300"><Flag className="h-3.5 w-3.5"/>Отменить</button>}
          {item.participantIds.length===0&&item.officialStatus!=='completed'&&<button onClick={()=>void remove(item)} disabled={busy} className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-[10px] font-bold text-slate-400"><Trash2 className="h-3.5 w-3.5"/>Удалить</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
