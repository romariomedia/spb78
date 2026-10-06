import { useEffect,useMemo,useState } from 'react';
import { ArrowLeft,Award,CheckCircle2,Clock3,Dumbbell,MapPin,Medal,RefreshCw,Save,ShieldCheck,Star,Trophy } from 'lucide-react';
import { districtLabel } from '../../shared/districts.js';
import { SportPassportLevel,UserProfile } from '../lib/types';
import { loadSportPassport,saveSportPassport,SportPassportSnapshot } from '../services/sportPassport';
import { AvatarImage } from './AvatarImage';

interface Props { user:UserProfile; onBack:()=>void; onUserUpdate:(user:UserProfile)=>void; }
const LEVELS:Array<[SportPassportLevel,string]>=[['beginner','Начинающий'],['amateur','Любитель'],['advanced','Продвинутый'],['competitive','Соревновательный'],['pro','Профессионал']];
const fmt=(v:string|number)=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}):'—';};

export function SportPassportView({user,onBack,onUserUpdate}:Props){
  const [data,setData]=useState<SportPassportSnapshot|null>(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [mainSport,setMainSport]=useState(user.sportPassport?.mainSport||user.sports?.[0]||'');
  const [level,setLevel]=useState<SportPassportLevel>(user.sportPassport?.level||'beginner');
  const [rankTitle,setRankTitle]=useState(user.sportPassport?.rankTitle||'');
  const [yearsExperience,setYearsExperience]=useState(user.sportPassport?.yearsExperience||0);
  const [achievementTitle,setAchievementTitle]=useState('');

  const refresh=async()=>{setLoading(true);setError('');try{const next=await loadSportPassport();setData(next);setMainSport(next.profile.mainSport||user.sports?.[0]||'');setLevel(next.profile.level);setRankTitle(next.profile.rankTitle||'');setYearsExperience(next.profile.yearsExperience||0);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить спортивный паспорт');}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[user.id]);

  const declared=useMemo(()=>data?.profile.declaredAchievements||user.sportPassport?.declaredAchievements||[],[data,user.sportPassport]);
  const save=async()=>{setSaving(true);setError('');setNotice('');try{
    const achievements=[...declared];const title=achievementTitle.trim();
    if(title)achievements.unshift({id:crypto.randomUUID?.()||String(Date.now()),title,sport:mainSport,verification:'declared'});
    const next=await saveSportPassport({mainSport,level,rankTitle,yearsExperience,declaredAchievements:achievements});
    setData(next);setAchievementTitle('');setEditing(false);setNotice('Спортивный паспорт обновлён.');
    onUserUpdate({...user,sportPassport:{mainSport:next.profile.mainSport,level:next.profile.level,rankTitle:next.profile.rankTitle,yearsExperience:next.profile.yearsExperience,declaredAchievements:next.profile.declaredAchievements,updatedAt:new Date().toISOString()}});
  }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить спортивный паспорт');}finally{setSaving(false);}};

  const achievements=data?.achievements||[],official=data?.officialResults||[],history=data?.history||[],stats=data?.stats;
  const hasJourney=(stats?.totalWorkouts||0)>0||achievements.length>0||official.length>0||history.length>0;
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] font-black text-slate-300"><ArrowLeft className="h-3.5 w-3.5"/>Профиль</button><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/></button></div>
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-lime-500/30 bg-lime-950/20 p-3 text-[11px] text-lime-200">{notice}</p>}

    <div className="relative overflow-hidden rounded-[28px] border border-lime-400/50 bg-slate-950 p-4 shadow-[0_0_40px_rgba(163,230,53,.10)] sm:p-5">
      <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-lime-400/10 blur-3xl"/>
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0 rounded-2xl border border-lime-400/50 p-1"><AvatarImage src={user.avatar} width={78} height={78} alt={user.name} className="h-[78px] w-[78px] rounded-xl object-cover"/>{user.isVerified&&<span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-lime-400 text-slate-950"><ShieldCheck className="h-4 w-4"/></span>}</div>
        <div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.22em] text-lime-300">SportBuddy78 · Спортивный паспорт</p><h2 className="mt-1 truncate text-lg font-black text-white">{user.name}</h2><p className="mt-1 text-xs font-black text-lime-300">{data?.profile.mainSport||mainSport||'Вид спорта не указан'}</p><p className="mt-1 text-[10px] text-slate-400">{data?.profile.rankTitle||data?.profile.levelLabel||'Начинающий'}</p><p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500"><MapPin className="h-3 w-3"/>{districtLabel(user.districtId)||user.locationName||'Санкт-Петербург'}</p></div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Dumbbell className="h-4 w-4 text-lime-300"/><p className="mt-1 text-lg font-black text-white">{stats?.totalWorkouts??user.totalWorkouts}</p><p className="text-[8px] text-slate-500">тренировок</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Star className="h-4 w-4 text-violet-300"/><p className="mt-1 text-lg font-black text-white">{Number(stats?.rating??user.rating??0).toFixed(1)}</p><p className="text-[8px] text-slate-500">рейтинг</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Medal className="h-4 w-4 text-amber-300"/><p className="mt-1 text-lg font-black text-white">{stats?.totalDailyMedals??user.totalDailyMedals}</p><p className="text-[8px] text-slate-500">медалей</p></div>
      </div>
    </div>

    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-white">Спортивная биография</p><p className="mt-1 text-[9px] text-slate-500">Самостоятельные данные помечаются как «Заявлено».</p></div><button onClick={()=>setEditing(v=>!v)} className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-3 py-2 text-[10px] font-black text-lime-300">{editing?'Отмена':'Редактировать'}</button></div>
      {editing?<div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-[9px] font-bold text-slate-500">Основной вид спорта<select value={mainSport} onChange={e=>setMainSport(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white">{user.sports.length?user.sports.map(s=><option key={s} value={s}>{s}</option>):<option value="">Сначала добавьте спорт</option>}</select></label>
        <label className="text-[9px] font-bold text-slate-500">Уровень<select value={level} onChange={e=>setLevel(e.target.value as SportPassportLevel)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white">{LEVELS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-[9px] font-bold text-slate-500">Разряд / статус<input value={rankTitle} onChange={e=>setRankTitle(e.target.value)} maxLength={120} placeholder="Например: КМС, 1 разряд" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white"/></label>
        <label className="text-[9px] font-bold text-slate-500">Опыт, лет<input type="number" min={0} max={80} value={yearsExperience} onChange={e=>setYearsExperience(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white"/></label>
        <label className="sm:col-span-2 text-[9px] font-bold text-slate-500">Добавить достижение<input value={achievementTitle} onChange={e=>setAchievementTitle(e.target.value)} maxLength={180} placeholder="Например: финишировал полумарафон за 1:42" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white"/></label>
        <button onClick={()=>void save()} disabled={saving||!mainSport} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-xs font-black text-slate-950 disabled:opacity-40"><Save className="h-4 w-4"/>{saving?'Сохранение…':'Сохранить паспорт'}</button>
      </div>:<div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] text-slate-500">Основной спорт</p><p className="mt-1 text-[11px] font-black text-white">{data?.profile.mainSport||'—'}</p></div>
        <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] text-slate-500">Уровень</p><p className="mt-1 text-[11px] font-black text-white">{data?.profile.levelLabel||'Начинающий'}</p></div>
        <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] text-slate-500">Опыт</p><p className="mt-1 text-[11px] font-black text-white">{data?.profile.yearsExperience?String(data.profile.yearsExperience)+' лет':'—'}</p></div>
      </div>}
    </div>

    {!hasJourney&&<div className="rounded-3xl border border-dashed border-lime-500/30 bg-lime-950/10 p-6 text-center"><Trophy className="mx-auto h-8 w-8 text-lime-300"/><p className="mt-3 text-sm font-black text-white">Ваш спортивный путь начинается здесь.</p><p className="mt-1 text-[11px] leading-relaxed text-slate-400">Первая тренировка уже станет частью вашей истории.</p></div>}

    {(achievements.length>0||official.length>0)&&<div className="rounded-3xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center gap-2"><Award className="h-4 w-4 text-amber-300"/><p className="text-xs font-black text-white">Достижения</p></div><div className="mt-3 space-y-2">
      {official.map(item=><div key={'official-'+item.id} className="rounded-xl border border-lime-500/25 bg-lime-950/10 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-black text-white">{item.title||item.eventTitle}</p><p className="mt-1 text-[9px] text-slate-500">{item.sport+(item.placement?' · '+item.placement:'')+(item.achievedAt?' · '+fmt(item.achievedAt):'')}</p></div><span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-400 px-2 py-1 text-[8px] font-black text-slate-950"><CheckCircle2 className="h-3 w-3"/>SportBuddy78</span></div></div>)}
      {achievements.map(item=><div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-black text-white">{item.title}</p><p className="mt-1 text-[9px] text-slate-500">{(item.sport||data?.profile.mainSport||'')+(item.date?' · '+item.date:'')}</p></div><span className={'shrink-0 rounded-full px-2 py-1 text-[8px] font-black '+(item.verification==='sportbuddy'?'bg-lime-500/15 text-lime-300':'bg-slate-800 text-slate-400')}>{item.verification==='sportbuddy'?'Подтверждено SportBuddy78':'Заявлено'}</span></div></div>)}
    </div></div>}

    {history.length>0&&<div className="rounded-3xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-lime-300"/><p className="text-xs font-black text-white">История тренировок</p></div><div className="mt-3 space-y-2">{history.map(item=><div key={item.id||item.trainingId+String(item.timestamp)} className="flex items-start gap-3 rounded-xl bg-slate-900 p-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-500/10 text-lime-300"><CheckCircle2 className="h-4 w-4"/></div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">{item.title}</p><p className="mt-1 text-[9px] text-slate-500">{item.sport+(item.locationName?' · '+item.locationName:'')}</p><p className="mt-1 text-[8px] text-slate-600">{(item.dateKey||fmt(item.timestamp))+' · GPS check-in подтверждён'}</p></div></div>)}</div></div>}

    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-[9px] leading-relaxed text-slate-500">Уровень, разряд и личные достижения пока считаются заявленными пользователем. Тренировки, check-in и результаты официальных мероприятий SportBuddy78 отмечаются отдельно и не могут быть подтверждены самим пользователем.</div>
  </section>;
}
