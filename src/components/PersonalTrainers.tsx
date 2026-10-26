import {TrainerLevelBadge,TrainerLevelGuide} from './TrainerLevelBadge';
import {TrainerBookingModal} from './TrainerBookingModal';
import {createPortal} from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { BadgeCheck, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { loadPersonalTrainers } from '../services/sportIdVerification';
import { AvatarImage } from './AvatarImage';
import { districtLabel } from '../../shared/districts.js';
import {trackBusinessEvent} from '../services/businessBilling';
export function PersonalTrainers({onSelectUser,refreshKey,userId,onBooked}:{userId:string;onBooked:()=>void;onSelectUser:(user:UserProfile)=>Promise<void>;refreshKey?:number}){
  const [open,setOpen]=useState(false),[items,setItems]=useState<UserProfile[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [level,setLevel]=useState<'all'|'start'|'pro'>('all');
  const [booking,setBooking]=useState<UserProfile|null>(null);
  const [selecting,setSelecting]=useState(false);
  const select=async(user:UserProfile)=>{void trackBusinessEvent('trainer',user.id,'view','profile');setSelecting(true);setError('');try{await onSelectUser(user);}catch(e){setError(e instanceof Error?e.message:'Анкета недоступна');}finally{setSelecting(false);}};
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),requestBusy=useRef(false);
  useEffect(()=>{
    const epoch=++generation.current;
    if(!open){requestBusy.current=false;setBusy(false);return;}
    requestBusy.current=true;setBusy(true);setError('');setItems([]);setCursor(null);
    loadPersonalTrainers(null,level).then(page=>{
      if(generation.current===epoch){setItems(page.trainers);setCursor(page.nextCursor);}
    }).catch(e=>{if(generation.current===epoch)setError(e.message);})
      .finally(()=>{if(generation.current===epoch){requestBusy.current=false;setBusy(false);}});
    return()=>{++generation.current;};
  },[open,refreshKey,level]);
  const load=async(append=false)=>{
    if(requestBusy.current||!open)return;
    const epoch=generation.current;
    requestBusy.current=true;setBusy(true);setError('');
    try{
      const page=await loadPersonalTrainers(append?cursor:null,level);
      if(generation.current!==epoch)return;
      setItems(old=>append?[...old,...page.trainers.filter(x=>!old.some(y=>y.id===x.id))]:page.trainers);
      setCursor(page.nextCursor);
    }catch(e){if(generation.current===epoch)setError(e instanceof Error?e.message:'Не удалось загрузить тренеров');}
    finally{if(generation.current===epoch){requestBusy.current=false;setBusy(false);}}
  };
  return <section className="overflow-hidden rounded-3xl border border-lime-400/25 bg-slate-900">
    <button aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="flex w-full items-center gap-3 p-4 text-left"><span className="rounded-2xl bg-lime-400/15 p-3 text-lime-300"><BadgeCheck size={23}/></span><span className="min-w-0 flex-1"><span className="block font-bold text-white">Персональные тренеры</span><span className="mt-1 block text-sm text-slate-400">Квалификация проверена командой SportBuddy78</span></span>{open?<ChevronUp size={20}/>:<ChevronDown size={20}/>}</button>
    {open&&<div className="space-y-3 border-t border-slate-800 p-4">
      <p className="text-sm text-slate-400">Отдельный каталог специалистов. Тренеры не участвуют в рейтинге атлетов.</p>
      <TrainerLevelGuide/>
      <div className="flex gap-2" aria-label="Уровень тренера">{(['all','start','pro'] as const).map(value=><button key={value} aria-pressed={level===value} onClick={()=>setLevel(value)} className={'min-h-11 flex-1 rounded-xl px-3 py-2 text-sm font-bold '+(level===value?'bg-lime-300 text-slate-950':'border border-slate-700 text-slate-300')}>{value==='all'?'Все':value==='start'?'Start · I':'Pro · II'}</button>)}</div>
      {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
      {busy&&<p role="status" className="text-sm text-slate-400">Загружаем тренеров…</p>}
      {!busy&&!error&&!items.length&&<p className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-300">В этой категории пока нет доступных тренеров. Вы тренер? Подайте заявку в профиле через Спортивный ID.</p>}
      <div className="grid gap-3 sm:grid-cols-2">{items.map(user=><article key={user.id} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950 p-4">
        <button disabled={selecting} onClick={()=>void select(user)} className="flex w-full items-start gap-3 text-left"><AvatarImage src={user.avatar} alt={user.name} width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl object-cover"/><span className="min-w-0"><span className="block break-words font-semibold text-white">{user.name}</span><span className="mt-2 block"><TrainerLevelBadge level={user.personalTrainer?.trainerLevel}/></span><span className="mt-2 block text-sm text-slate-200">{user.personalTrainer?.sports.join(' · ')}</span><span className="mt-1 block text-xs text-slate-400">{districtLabel(user.districtId)||user.locationName}</span><span className="mt-2 block text-xs text-lime-300">Посмотреть профиль →</span></span></button>
        <p className="text-xl font-bold text-lime-300">{user.personalTrainer?.hourlyRate?`${user.personalTrainer.hourlyRate.toLocaleString('ru-RU')} ₽ / 60 мин`:'Стоимость ещё не указана'}</p>
        {user.personalTrainer?.serviceDescription&&<p className="line-clamp-3 break-words text-sm text-slate-300">{user.personalTrainer.serviceDescription}</p>}
        {user.id!==userId&&<button disabled={!user.personalTrainer?.hourlyRate} onClick={()=>{void trackBusinessEvent('trainer',user.id,'click','booking');setBooking(user);}} className="min-h-12 w-full rounded-xl bg-lime-300 p-3 font-bold text-slate-950 disabled:opacity-40">Записаться к тренеру</button>}
      </article>)}</div>
      {booking&&createPortal(<TrainerBookingModal key={booking.id} trainer={booking} onClose={()=>setBooking(null)} onCreated={onBooked}/>,document.body)}
      {cursor&&<button disabled={busy} onClick={()=>void load(true)} className="w-full rounded-xl border border-slate-700 p-3 text-sm text-lime-300">Загрузить ещё</button>}
      <button disabled={busy} onClick={()=>void load()} className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw size={14}/>Обновить</button>
    </div>}
  </section>;
}
