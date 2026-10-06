import { Award,ChevronRight,MapPin,ShieldCheck,Trophy } from 'lucide-react';
import { districtLabel } from '../../shared/districts.js';
import { UserProfile } from '../lib/types';
import { AvatarImage } from './AvatarImage';

interface Props {
  user:UserProfile;
  onOpen:()=>void;
}
const levelLabel=(value?:string)=>({
  beginner:'Начинающий',amateur:'Любитель',advanced:'Продвинутый',competitive:'Соревновательный',pro:'Профессионал'
} as Record<string,string>)[value||'beginner']||'Начинающий';

export function SportPassportCard({user,onOpen}:Props){
  const passport=user.sportPassport;
  const mainSport=passport?.mainSport||user.sports?.[0]||'Спорт не выбран';
  const rank=passport?.rankTitle?.trim()||levelLabel(passport?.level);
  return <button onClick={onOpen} className="group relative w-full overflow-hidden rounded-3xl border border-lime-400/45 bg-slate-950 p-4 text-left shadow-[0_0_28px_rgba(163,230,53,.08)] transition active:scale-[.99]">
    <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-lime-400/10 blur-3xl"/>
    <div className="relative flex items-start gap-3">
      <div className="relative shrink-0">
        <div className="rounded-2xl border border-lime-400/50 p-1">
          <AvatarImage src={user.avatar} width={62} height={62} alt={user.name} className="h-[62px] w-[62px] rounded-xl object-cover"/>
        </div>
        {user.isVerified&&<span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-950 bg-lime-400 text-slate-950"><ShieldCheck className="h-3.5 w-3.5"/></span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase tracking-[.18em] text-lime-300">SportBuddy78 ID</span><span className="h-px flex-1 bg-lime-400/20"/></div>
        <h3 className="mt-1 truncate text-sm font-black text-white">{user.name}</h3>
        <p className="mt-0.5 text-[10px] font-bold text-lime-300">{mainSport} · {rank}</p>
        <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500"><MapPin className="h-3 w-3"/>{districtLabel(user.districtId)||user.locationName||'Санкт-Петербург'}</p>
      </div>
      <ChevronRight className="mt-6 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-lime-300"/>
    </div>
    <div className="relative mt-4 grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2"><Trophy className="h-3.5 w-3.5 text-lime-300"/><p className="mt-1 text-sm font-black text-white">{user.totalWorkouts||0}</p><p className="text-[8px] text-slate-500">тренировок</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2"><Award className="h-3.5 w-3.5 text-amber-300"/><p className="mt-1 text-sm font-black text-white">{user.totalDailyMedals||0}</p><p className="text-[8px] text-slate-500">медалей</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2"><span className="text-[12px] text-violet-300">★</span><p className="mt-1 text-sm font-black text-white">{Number(user.rating||0).toFixed(1)}</p><p className="text-[8px] text-slate-500">рейтинг</p></div>
    </div>
    <p className="relative mt-3 text-[9px] font-bold text-slate-500">Открыть спортивный паспорт и историю достижений</p>
  </button>;
}
