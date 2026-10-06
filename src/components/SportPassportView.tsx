import { useEffect,useState } from 'react';
import { ArrowLeft,CheckCircle2,Copy,Dumbbell,Plus,QrCode,RefreshCw,Save,Share2,ShieldCheck,Star,Trash2,Trophy } from 'lucide-react';
import { districtLabel } from '../../shared/districts.js';
import { DeclaredSportAchievement,SportPassportLevel,UserProfile } from '../lib/types';
import { loadSportPassport,publicSportIdQrUrl,publicSportIdUrl,saveSportPassport,setSportIdPublic,SportPassportSnapshot } from '../services/sportPassport';
import { AvatarImage } from './AvatarImage';
import { SportIdVerificationPanel } from './SportIdVerificationPanel';

interface Props{user:UserProfile;onBack:()=>void;onUserUpdate:(user:UserProfile)=>void}
const LEVELS:Array<[SportPassportLevel,string]>=[['beginner','Начинающий'],['amateur','Любитель'],['advanced','Продвинутый'],['competitive','Соревновательный'],['pro','Профессионал']];
const emptyAchievement=()=>({title:'',sport:'',date:'',placement:''});
const fmt=(v:string|number)=>{const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'}):'—';};

export function SportPassportView({user,onBack,onUserUpdate}:Props){
  const [data,setData]=useState<SportPassportSnapshot|null>(null);
  const [loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[editing,setEditing]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [mainSport,setMainSport]=useState(user.sportPassport?.mainSport||user.sports?.[0]||'');
  const [level,setLevel]=useState<SportPassportLevel>(user.sportPassport?.level||'beginner');
  const [rankTitle,setRankTitle]=useState(user.sportPassport?.rankTitle||'');
  const [yearsExperience,setYearsExperience]=useState(user.sportPassport?.yearsExperience||0);
  const [achievements,setAchievements]=useState<DeclaredSportAchievement[]>(user.sportPassport?.declaredAchievements||[]);
  const [newAchievement,setNewAchievement]=useState(emptyAchievement());

  const apply=(next:SportPassportSnapshot)=>{
    setData(next);setMainSport(next.profile.mainSport||user.sports?.[0]||'');setLevel(next.profile.level);
    setRankTitle(next.profile.rankTitle||'');setYearsExperience(next.profile.yearsExperience||0);setAchievements((next.profile.declaredAchievements||[]).map(item=>({...item,verification:'declared' as const})));
  };
  const refresh=async()=>{setLoading(true);setError('');try{apply(await loadSportPassport());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить Спортивный ID');}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[user.id]);

  const addAchievement=()=>{
    const title=newAchievement.title.trim();if(!title)return;
    if(achievements.length>=30){setError('В Спортивном ID можно хранить до 30 заявленных достижений.');return;}
    setAchievements(prev=>[...prev,{id:crypto.randomUUID?.()||String(Date.now()),title,sport:newAchievement.sport||mainSport,date:newAchievement.date,placement:newAchievement.placement,verification:'declared'}]);
    setNewAchievement(emptyAchievement());setError('');
  };
  const save=async()=>{setSaving(true);setError('');setNotice('');try{
    const next=await saveSportPassport({mainSport,level,rankTitle,yearsExperience,declaredAchievements:achievements});
    apply(next);setEditing(false);setNotice('Спортивный ID SportBuddy78 обновлён.');
    onUserUpdate({...user,sportPassport:{mainSport:next.profile.mainSport,level:next.profile.level,rankTitle:next.profile.rankTitle,yearsExperience:next.profile.yearsExperience,declaredAchievements:(next.profile.declaredAchievements||[]).map(item=>({...item,verification:'declared' as const})),publicEnabled:next.public.enabled,publicSlug:next.public.slug,updatedAt:new Date().toISOString()}});
  }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить Спортивный ID');}finally{setSaving(false);}};

  const togglePublic=async()=>{setSaving(true);setError('');try{const next=await setSportIdPublic(!(data?.public.enabled));apply(next);setNotice(next.public.enabled?'Публичный Спортивный ID включён. QR-код готов.':'Публичный доступ к Спортивному ID выключен.');}catch(e){setError(e instanceof Error?e.message:'Не удалось изменить публичность');}finally{setSaving(false);}};
  const share=async()=>{if(!data?.public.slug)return;const url=publicSportIdUrl(data.public.slug);try{if(navigator.share)await navigator.share({title:'Спортивный ID SportBuddy78',text:user.name,url});else{await navigator.clipboard.writeText(url);setNotice('Ссылка скопирована.');}}catch{}};

  const official=data?.officialResults||[],history=data?.history||[],stats=data?.stats;
  const displayedAchievements=data?.achievements||achievements;
  const publicUrl=data?.public.slug?publicSportIdUrl(data.public.slug):'';
  return <section className="space-y-4">
    <div className="flex items-center justify-between gap-3"><button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] font-black text-slate-300"><ArrowLeft className="h-3.5 w-3.5"/>Профиль</button><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/></button></div>
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-lime-500/30 bg-lime-950/20 p-3 text-[11px] text-lime-200">{notice}</p>}

    <div className="relative overflow-hidden rounded-[28px] border border-lime-400/50 bg-slate-950 p-4 shadow-[0_0_40px_rgba(163,230,53,.10)] sm:p-5">
      <img src="/sportbuddy78-logo.png" alt="SportBuddy78" className="absolute right-3 top-3 h-20 w-20 object-contain opacity-25"/>
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0 rounded-2xl border border-lime-400/50 p-1"><AvatarImage src={user.avatar} width={78} height={78} alt={user.name} className="h-[78px] w-[78px] rounded-xl object-cover"/>{user.isVerified&&<span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-950 bg-lime-400 text-slate-950"><ShieldCheck className="h-4 w-4"/></span>}</div>
        <div className="min-w-0 flex-1 pr-16"><p className="text-[9px] font-black uppercase tracking-[.22em] text-lime-300">Спортивный ID SportBuddy78</p><h2 className="mt-1 truncate text-lg font-black text-white">{user.name}</h2><p className="mt-1 text-xs font-black text-lime-300">{data?.profile.mainSport||mainSport||'Вид спорта не указан'}</p><p className="mt-1 text-[10px] text-slate-400">{data?.profile.rankTitle||data?.profile.levelLabel||'Начинающий'} {data?.profile.rankVerification==='verified'&&<span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-black text-emerald-300">Подтверждено</span>}</p><p className="mt-1 text-[9px] text-slate-500">{districtLabel(user.districtId)||user.locationName||'Санкт-Петербург'}</p></div>
      </div>
      <div className="relative mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Dumbbell className="h-4 w-4 text-lime-300"/><p className="mt-1 text-lg font-black text-white">{stats?.totalWorkouts??user.totalWorkouts}</p><p className="text-[8px] text-slate-500">тренировок</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Star className="h-4 w-4 text-violet-300"/><p className="mt-1 text-lg font-black text-white">{Number(stats?.rating??user.rating??0).toFixed(1)}</p><p className="text-[8px] text-slate-500">рейтинг</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-2.5"><Trophy className="h-4 w-4 text-amber-300"/><p className="mt-1 text-lg font-black text-white">{stats?.sportBuddyWins??0}</p><p className="text-[8px] text-slate-500">побед SportBuddy78</p></div>
      </div>
    </div>

    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-white">Спортивная биография</p><p className="mt-1 text-[9px] text-slate-500">Личные данные помечаются как «Заявлено».</p></div><button onClick={()=>setEditing(v=>!v)} className="rounded-xl border border-lime-500/30 bg-lime-500/10 px-3 py-2 text-[10px] font-black text-lime-300">{editing?'Отмена':'Редактировать'}</button></div>
      {editing&&<div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-[9px] font-bold text-slate-500">Основной вид спорта<select value={mainSport} onChange={e=>setMainSport(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white">{user.sports.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="text-[9px] font-bold text-slate-500">Уровень<select value={level} onChange={e=>setLevel(e.target.value as SportPassportLevel)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white">{LEVELS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
        <label className="text-[9px] font-bold text-slate-500">Разряд / статус<input value={rankTitle} onChange={e=>setRankTitle(e.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white"/></label>
        <label className="text-[9px] font-bold text-slate-500">Опыт, лет<input type="number" min={0} max={80} value={yearsExperience} onChange={e=>setYearsExperience(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white"/></label>

        <div className="sm:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between"><div><p className="text-[10px] font-black text-white">Личные достижения</p><p className="text-[8px] text-slate-500">До 30 записей · каждое остаётся «Заявлено» до проверки</p></div><span className="text-[9px] font-black text-lime-300">{achievements.length}/30</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={newAchievement.title} onChange={e=>setNewAchievement({...newAchievement,title:e.target.value})} placeholder="Название достижения" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-white"/><input value={newAchievement.placement} onChange={e=>setNewAchievement({...newAchievement,placement:e.target.value})} placeholder="Результат / место" className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-white"/><select value={newAchievement.sport} onChange={e=>setNewAchievement({...newAchievement,sport:e.target.value})} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-white"><option value="">Основной спорт</option>{user.sports.map(s=><option key={s}>{s}</option>)}</select><input type="date" value={newAchievement.date} onChange={e=>setNewAchievement({...newAchievement,date:e.target.value})} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-white"/></div>
          <button onClick={addAchievement} disabled={!newAchievement.title.trim()||achievements.length>=30} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-lime-500/30 bg-lime-500/10 py-2.5 text-[10px] font-black text-lime-300 disabled:opacity-40"><Plus className="h-3.5 w-3.5"/>Добавить достижение</button>
          <div className="mt-3 space-y-2">{achievements.map((a,i)=><div key={a.id} className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950 p-2.5"><div className="min-w-0 flex-1"><p className="text-[10px] font-black text-white">{a.title}</p><p className="mt-1 text-[8px] text-slate-500">{[a.sport,a.placement,a.date].filter(Boolean).join(' · ')}</p></div><button onClick={()=>setAchievements(prev=>prev.filter((_,idx)=>idx!==i))} className="rounded-lg p-2 text-rose-300"><Trash2 className="h-3.5 w-3.5"/></button></div>)}</div>
        </div>

        <button onClick={()=>void save()} disabled={saving||!mainSport} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 text-xs font-black text-slate-950 disabled:opacity-40"><Save className="h-4 w-4"/>{saving?'Сохранение…':'Сохранить Спортивный ID'}</button>
      </div>}
    </div>

    <SportIdVerificationPanel data={data} onVerifiedChanged={()=>void refresh()}/>

    {displayedAchievements.length>0&&<div className="rounded-3xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-black text-white">Личные достижения</p><div className="mt-3 space-y-2">{displayedAchievements.map(a=><div key={a.id} className="rounded-xl bg-slate-900 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-black text-white">{a.title}</p><p className="mt-1 text-[9px] text-slate-500">{[a.sport,a.placement,a.date].filter(Boolean).join(' · ')}</p></div><span className={'rounded-full px-2 py-1 text-[8px] font-black '+(a.verification==='verified'?'bg-emerald-500/15 text-emerald-300':'bg-slate-800 text-slate-400')}>{a.verification==='verified'?'Подтверждено':'Заявлено'}</span></div></div>)}</div></div>}

    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-300"/><p className="text-xs font-black text-white">Результаты соревнований SportBuddy78</p></div>
      {official.length?<div className="mt-3 space-y-2">{official.map(item=><div key={item.id} className="rounded-xl border border-lime-500/25 bg-lime-950/10 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-black text-white">{item.eventTitle||item.title}</p><p className="mt-1 text-[9px] text-slate-400">{[item.sport,item.placement,item.achievedAt?fmt(item.achievedAt):''].filter(Boolean).join(' · ')}</p></div><span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-400 px-2 py-1 text-[8px] font-black text-slate-950"><CheckCircle2 className="h-3 w-3"/>SportBuddy78</span></div></div>)}</div>:<div className="mt-3 rounded-xl border border-dashed border-slate-800 p-5 text-center"><p className="text-[10px] font-bold text-slate-400">Официальных результатов пока нет</p><p className="mt-1 text-[9px] text-slate-600">Победы и призовые места появятся здесь автоматически после соревнований SportBuddy78.</p></div>}
    </div>

    <div className="rounded-3xl border border-lime-500/25 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><QrCode className="h-4 w-4 text-lime-300"/><p className="text-xs font-black text-white">Публичный Спортивный ID</p></div><p className="mt-1 text-[9px] leading-relaxed text-slate-500">QR открывает проверяемую read-only карточку без телефона, e-mail и других закрытых данных.</p></div><button onClick={()=>void togglePublic()} disabled={saving} className={'rounded-xl px-3 py-2 text-[9px] font-black '+(data?.public.enabled?'bg-lime-400 text-slate-950':'border border-slate-700 text-slate-300')}>{data?.public.enabled?'Опубликован':'Включить'}</button></div>
      {data?.public.enabled&&data.public.slug&&<div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center"><div className="rounded-2xl bg-white p-2"><img src={publicSportIdQrUrl(data.public.slug)} alt="QR-код Спортивного ID SportBuddy78" className="aspect-square w-full"/></div><div><img src="/sportbuddy78-logo.png" alt="SportBuddy78" className="h-14 w-14 object-contain"/><p className="mt-2 text-[10px] font-black text-white">Проверяемая цифровая спортивная репутация</p><p className="mt-1 break-all text-[9px] text-slate-500">{publicUrl}</p><div className="mt-3 flex gap-2"><button onClick={()=>void share()} className="flex items-center gap-1.5 rounded-xl bg-lime-400 px-3 py-2 text-[9px] font-black text-slate-950"><Share2 className="h-3.5 w-3.5"/>Поделиться</button><button onClick={()=>void navigator.clipboard.writeText(publicUrl).then(()=>setNotice('Ссылка скопирована.'))} className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-[9px] font-black text-slate-300"><Copy className="h-3.5 w-3.5"/>Копировать</button></div></div></div>}
    </div>

    {history.length>0&&<div className="rounded-3xl border border-slate-800 bg-slate-950 p-4"><p className="text-xs font-black text-white">Подтверждённая история тренировок</p><div className="mt-3 space-y-2">{history.map(item=><div key={item.id||item.trainingId+String(item.timestamp)} className="rounded-xl bg-slate-900 p-3"><p className="text-[10px] font-black text-white">{item.title}</p><p className="mt-1 text-[8px] text-slate-500">{[item.sport,item.locationName,item.dateKey||fmt(item.timestamp)].filter(Boolean).join(' · ')}</p></div>)}</div></div>}
  </section>;
}
