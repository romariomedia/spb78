import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Award, Check, Gift, Info } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { MEDAL_TIERS, TIER_ORDER, MedalTier } from '../lib/medals';
import { profileMedals, claimDailyMedal, medalDayKey, totalMedals, syncProfileMedals } from '../services/medals';

function Medal({tier, large=false}: {tier:MedalTier;large?:boolean}) {
  return <div className={`sb-medal sb-medal-${tier} ${large?'sb-medal-large':''}`} aria-label={`Медаль: ${MEDAL_TIERS[tier].name}`} role="img">
    <div className="sb-medal-ribbon"/><div className="sb-medal-face"><Award aria-hidden="true"/><span>SPORTBUDDY · 78</span></div>
  </div>;
}
interface Props {user:UserProfile;onUpdateUser:(user:UserProfile)=>void;onOpenModal:(title:string,subtitle:string,content:React.ReactNode)=>void}
export function MedalsSection({user,onUpdateUser,onOpenModal}:Props) {
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [rules,setRules]=useState(false);
  const reduced=useReducedMotion();
  const p=profileMedals(user),cfg=MEDAL_TIERS[p.tier],total=totalMedals(p);
  const level=Math.floor(total/7)+1,remaining=7-total%7;
  const medalWord=(count:number)=>{ const form=new Intl.PluralRules('ru').select(count); return form==='one'?'медаль':form==='few'?'медали':'медалей'; };
  const claimed=p.lastClaimDayKey===medalDayKey();
  const claim=async()=>{
    if(busy)return;setBusy(true);
    try {
      const result=await claimDailyMedal(user);setNotice(result.message);
      if(!result.ok)return;
      onUpdateUser(syncProfileMedals({...user,medalProgress:result.progress}));
      if(result.rewardGiven)onOpenModal('Твой ритм. Твоя награда.',result.message,
        <div className="text-center py-5 space-y-5"><Medal tier={result.tierEarned || p.tier} large/>
          {result.promoted&&result.newTier&&<p className="text-lime-300">Открыт уровень «{MEDAL_TIERS[result.newTier].name}»</p>}
          {result.promo&&<div className="rounded-2xl bg-slate-950 p-4"><p>{result.promo.days} дней Premium</p><p className="font-mono break-all mt-2">{result.promo.code}</p><p className="text-xs text-slate-400 mt-2">Активируйте код в разделе наград профиля.</p></div>}
        </div>);
    } finally {setBusy(false);}
  };
  return <section className="sb-medal-showcase" aria-label="Медали и уровень активности">
    <div className="flex justify-between items-start gap-3"><div><p className="text-[10px] tracking-[.2em] text-slate-400 uppercase">Твой личный рекорд</p><h3 className="text-xl font-bold text-white mt-1">Коллекция движения</h3></div><button aria-label="Правила наград" aria-expanded={rules} onClick={()=>setRules(!rules)} className="p-3 rounded-xl bg-white/5"><Info size={18}/></button></div>
    <div className="sb-medal-hero"><Medal tier={p.tier} large/><div><p className="text-sm text-slate-400">Уровень активности</p><p className="text-4xl font-extrabold text-white mt-1">{level.toString().padStart(2,'0')}</p><p className="text-xs text-slate-300 mt-2">До следующего уровня: {remaining} {medalWord(remaining)}</p></div></div>
    <div className="h-2 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-label="Прогресс уровня активности" aria-valuenow={total%7} aria-valuemin={0} aria-valuemax={7}><motion.div initial={false} animate={{width:`${total%7/7*100}%`}} transition={{duration:reduced?0:.6}} className="h-full bg-lime-300 rounded-full"/></div>
    <p className="text-xs text-slate-400">Один вход в день — одна медаль. Каждые 7 медалей повышают уровень. Накопленные награды сохраняются.</p>
    <div className="grid grid-cols-3 gap-2">{TIER_ORDER.map(t=><div key={t} className={`sb-medal-shelf ${p.tier===t?'sb-medal-current':''}`}><Medal tier={t}/><p className="text-xs font-semibold mt-2">{MEDAL_TIERS[t].name}</p><p className="text-lg font-bold">{p.totals[t]}</p></div>)}</div>
    <div className="rounded-2xl bg-slate-950/60 border border-white/10 p-4 space-y-3"><div className="flex justify-between text-xs"><span>Цикл «{cfg.name}»</span><span>{p.cycleDays} / {cfg.daysRequired} дней</span></div><div className="grid grid-cols-7 gap-1.5">{Array.from({length:7},(_,i)=><div key={i} className={`sb-medal-day ${i<p.cycleDays?'sb-medal-day-done':''}`}>{i<p.cycleDays?<Check size={15}/>:i+1}</div>)}</div>{cfg.workoutsRequired>0&&<p className="text-xs text-slate-300">Подтверждённые тренировки: {p.cycleWorkouts} / {cfg.workoutsRequired}</p>}<p className="text-xs text-slate-300 flex gap-2"><Gift size={16} className="shrink-0 text-lime-300"/>{cfg.rewardDays} дней Premium за завершённый цикл</p></div>
    {rules&&<div className="text-xs leading-relaxed text-slate-300 space-y-2 rounded-2xl bg-white/5 p-4"><p>День считается с 00:00 до 23:59 по Москве. Медаль начисляется автоматически при входе с подключением к серверу.</p><p>Уровень активности растёт от общего числа медалей и не снижается. Пропуск календарного дня сбрасывает текущую серию, но сохраняет коллекцию и открытый ранг.</p><p>Бронза: 7 дней подряд → 5 дней Premium. Для перехода в Серебро нужна хотя бы одна подтверждённая тренировка.</p><p>Серебро: 7 дней подряд и 3 тренировки в цикле → 7 дней Premium и Золото. Золото: 7 дней подряд и 5 тренировок → 30 дней Premium. Если тренировок пока не хватает, продолжайте серию.</p><p>После завершения цикла начинается новый. Промокоды доступны в разделе наград. Тренировки и их подтверждение учитывает сервер.</p></div>}
    <button onClick={claim} disabled={busy||claimed} className="w-full rounded-2xl py-3.5 px-4 font-bold text-sm bg-lime-300 text-slate-950 disabled:bg-white/5 disabled:text-slate-300">{busy?'Получаем награду…':claimed?'✓ Сегодняшняя медаль в коллекции':'Получить ежедневную медаль'}</button>
    <p role="status" className="text-xs text-center text-slate-400">{notice||`Всего ${total} медалей · Культ спорта и здоровых отношений`}</p>
  </section>;
}
