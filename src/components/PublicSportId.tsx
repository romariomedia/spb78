import { useEffect,useState } from 'react';
import { CheckCircle2,MapPin,ShieldCheck,Star,Trophy,Dumbbell } from 'lucide-react';
import { districtLabel } from '../../shared/districts.js';
import { loadPublicSportId,SportPassportSnapshot } from '../services/sportPassport';
import { AvatarImage } from './AvatarImage';

const fmt=(v:number)=>new Date(v).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});

export function PublicSportId({slug}:{slug:string}){
  const [data,setData]=useState<SportPassportSnapshot|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{void loadPublicSportId(slug).then(setData).catch(e=>setError(e instanceof Error?e.message:'SportBuddy78 ID не найден'));},[slug]);

  if(error)return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center"><img src="/sportbuddy78-logo.png" className="mx-auto h-20 w-20 object-contain" alt="SportBuddy78"/><h1 className="mt-4 text-xl font-black">Спортивный ID SportBuddy78</h1><p className="mt-2 text-sm text-slate-400">{error}</p></div></main>;
  if(!data)return <main className="min-h-screen bg-slate-950 p-6 text-slate-400"><div className="mx-auto max-w-xl text-center">Загрузка SportBuddy78 ID…</div></main>;

  const {identity,profile,stats,officialResults,achievements}=data;
  return <main className="min-h-screen bg-slate-950 px-4 py-8 text-white">
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="relative overflow-hidden rounded-[30px] border border-lime-400/50 bg-black p-5 shadow-[0_0_50px_rgba(163,230,53,.12)]">
        <img src="/sportbuddy78-logo.png" alt="SportBuddy78" className="absolute right-4 top-4 h-24 w-24 object-contain opacity-30"/>
        <div className="relative flex items-start gap-4 pr-20">
          <div className="relative rounded-2xl border border-lime-400/50 p-1"><AvatarImage src={identity.avatar} alt={identity.name} className="h-20 w-20 rounded-xl object-cover"/>{identity.isVerified&&<span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-lime-400 text-slate-950"><ShieldCheck className="h-4 w-4"/></span>}</div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-lime-300">Спортивный ID SportBuddy78</p><h1 className="mt-1 truncate text-xl font-black">{identity.name}</h1><p className="mt-1 text-sm font-black text-lime-300">{profile.mainSport||'Спорт не указан'}</p><p className="mt-1 text-xs text-slate-400">{profile.rankTitle||profile.levelLabel}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><MapPin className="h-3 w-3"/>{districtLabel(identity.districtId)||identity.locationName||'Санкт-Петербург'}</p></div>
        </div>
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Dumbbell className="h-4 w-4 text-lime-300"/><p className="mt-1 text-xl font-black">{stats.totalWorkouts}</p><p className="text-[9px] text-slate-500">тренировок</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Star className="h-4 w-4 text-violet-300"/><p className="mt-1 text-xl font-black">{Number(stats.rating||0).toFixed(1)}</p><p className="text-[9px] text-slate-500">рейтинг</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><Trophy className="h-4 w-4 text-amber-300"/><p className="mt-1 text-xl font-black">{stats.sportBuddyWins||0}</p><p className="text-[9px] text-slate-500">побед SportBuddy78</p></div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="text-sm font-black">Спортивная биография</h2><div className="mt-3 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-950 p-3"><p className="text-[9px] text-slate-500">Уровень</p><p className="mt-1 text-[11px] font-black">{profile.levelLabel}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-[9px] text-slate-500">Опыт</p><p className="mt-1 text-[11px] font-black">{profile.yearsExperience?profile.yearsExperience+' лет':'—'}</p></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-[9px] text-slate-500">Призовых мест</p><p className="mt-1 text-[11px] font-black">{stats.sportBuddyPodiums||0}</p></div></div></section>

      {officialResults.length>0&&<section className="rounded-3xl border border-lime-500/20 bg-slate-900/70 p-4"><h2 className="text-sm font-black">Официальные результаты SportBuddy78</h2><div className="mt-3 space-y-2">{officialResults.map(r=><div key={r.id} className="rounded-xl border border-lime-500/20 bg-lime-950/10 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black">{r.eventTitle||r.title}</p><p className="mt-1 text-[9px] text-slate-400">{[r.sport,r.placement,r.achievedAt?fmt(r.achievedAt):''].filter(Boolean).join(' · ')}</p></div><span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-400 px-2 py-1 text-[8px] font-black text-slate-950"><CheckCircle2 className="h-3 w-3"/>SportBuddy78</span></div></div>)}</div></section>}

      {achievements.length>0&&<section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4"><h2 className="text-sm font-black">Заявленные достижения</h2><div className="mt-3 space-y-2">{achievements.map(a=><div key={a.id} className="rounded-xl bg-slate-950 p-3"><p className="text-[11px] font-black">{a.title}</p><p className="mt-1 text-[9px] text-slate-500">{[a.sport,a.placement,a.date].filter(Boolean).join(' · ')}</p></div>)}</div></section>}

      <footer className="flex items-center justify-center gap-3 py-5 text-center"><img src="/sportbuddy78-logo.png" alt="" className="h-10 w-10 object-contain"/><div className="text-left"><p className="text-[10px] font-black text-lime-300">SPORTBUDDY78</p><p className="text-[9px] text-slate-500">Проверяемая цифровая спортивная репутация</p></div></footer>
    </div>
  </main>;
}
