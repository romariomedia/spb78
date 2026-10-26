import {TrainerLevelBadge,TrainerLevelGuide} from './TrainerLevelBadge';
import {isTrainerLevel,TRAINER_LEVELS} from '../../shared/trainer-levels.js';
import { useEffect,useMemo,useState } from 'react';
import { CheckCircle2,ExternalLink,FileCheck2,RefreshCw,ShieldCheck,XCircle } from 'lucide-react';
import { approveSportIdVerification,setTrainerLevel,loadAdminSportIdVerificationPage,rejectSportIdVerification,revokeSportIdVerification } from '../services/adminSportIdVerification';
import { SportIdVerificationRequest } from '../services/sportIdVerification';

type Filter='pending'|'approved'|'rejected'|'all';
const label:Record<string,string>={pending:'На проверке',approved:'Подтверждено',rejected:'Отклонено',revoked:'Отозвано',cancelled:'Отменено'};
const tone:Record<string,string>={pending:'bg-amber-500/15 text-amber-300',approved:'bg-emerald-500/15 text-emerald-300',rejected:'bg-rose-500/15 text-rose-300',revoked:'bg-slate-800 text-slate-400',cancelled:'bg-slate-800 text-slate-500'};

export function AdminSportIdVerificationPanel(){
  const [levels,setLevels]=useState<Record<string,string>>({});
  const [notes,setNotes]=useState<Record<string,string>>({});
  const keyFor=(item:SportIdVerificationRequest)=>item.id+':'+(item.requestVersion||'legacy');
  const selectedLevel=(item:SportIdVerificationRequest)=>levels[keyFor(item)]??item.trainerLevel??'';
  const [cursor,setCursor]=useState<string|null>(null);
  const [items,setItems]=useState<SportIdVerificationRequest[]>([]);
  const [trainersOnly,setTrainersOnly]=useState(false);
  const [filter,setFilter]=useState<Filter>('pending');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=async(append=false)=>{setBusy('load');setError('');try{const page=await loadAdminSportIdVerificationPage(append?cursor:null);setItems(old=>append?[...old,...page.items.filter(x=>!old.some(y=>y.id===x.id))]:page.items);setCursor(page.nextCursor);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить заявки');}finally{setBusy('');}};
  useEffect(()=>{void refresh();},[]);
  const visible=useMemo(()=>items.filter(x=>(filter==='all'||x.status===filter)&&(!trainersOnly||x.claimType==='trainer')),[items,filter,trainersOnly]);

  const approve=async(item:SportIdVerificationRequest)=>{
    const level=selectedLevel(item);
    if(item.claimType==='trainer'&&!isTrainerLevel(level)){setError('Выберите уровень Start или Pro.');return;}
    const answer=item.claimType==='trainer'?(notes[keyFor(item)]||''):prompt('Комментарий к подтверждению — необязательно:','Проверено по предоставленным материалам');if(answer===null)return;const note=answer.trim();
    setBusy(item.id);setError('');setNotice('');
    try{await approveSportIdVerification(item.id,note,item.requestVersion||'',isTrainerLevel(level)?level:undefined);setNotice('Факт подтверждён и появился в Спортивном ID.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось подтвердить');}finally{setBusy('');}
  };
  const changeLevel=async(item:SportIdVerificationRequest)=>{
    const level=selectedLevel(item),note=(notes[keyFor(item)]||'').trim();
    if(!isTrainerLevel(level)||note.length<10){setError('Выберите уровень и укажите основание решения (не менее 10 символов).');return;}
    setBusy(item.id);setError('');setNotice('');
    try{await setTrainerLevel(item.id,level,note,item.requestVersion||'');setNotice('Уровень тренера обновлён. Решение сохранено в журнале.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось изменить уровень');}finally{setBusy('');}
  };
  const reject=async(item:SportIdVerificationRequest)=>{
    const note=(prompt('Причина отклонения:','Недостаточно данных для подтверждения')||'').trim();if(note.length<3)return;
    setBusy(item.id);setError('');setNotice('');
    try{await rejectSportIdVerification(item.id,note,item.requestVersion||'');setNotice('Заявка отклонена.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отклонить');}finally{setBusy('');}
  };
  const revoke=async(item:SportIdVerificationRequest)=>{
    const note=(prompt('Причина отзыва подтверждения:','Подтверждение требует пересмотра')||'').trim();if(note.length<3)return;
    setBusy(item.id);setError('');setNotice('');
    try{await revokeSportIdVerification(item.id,note,item.requestVersion||'');setNotice('Подтверждение отозвано.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отозвать');}finally{setBusy('');}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Trust & Reputation</p><h3 className="mt-1 text-base font-black text-white">Verification Center</h3><p className="mt-1 text-[10px] text-slate-500">Персональные тренеры, разряды и достижения Спортивного ID</p></div>
      <button onClick={()=>void refresh()} disabled={Boolean(busy)} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300"><RefreshCw className={'h-4 w-4 '+(busy==='load'?'animate-spin':'')}/></button>
    </div>
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    <div className="flex flex-wrap gap-2">{([['pending','На проверке'],['approved','Подтверждённые'],['rejected','Отклонённые'],['all','Все']] as const).map(([id,text])=><button key={id} onClick={()=>setFilter(id)} className={'rounded-xl px-3 py-2 text-[10px] font-black '+(filter===id?'bg-emerald-500 text-slate-950':'border border-slate-800 bg-slate-950 text-slate-400')}>{text}</button>)}</div>

    <label className="flex items-center gap-2 text-sm text-lime-200"><input type="checkbox" checked={trainersOnly} onChange={e=>setTrainersOnly(e.target.checked)}/>Только персональные тренеры</label>
    <TrainerLevelGuide/>
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {visible.map(item=><article key={item.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-start gap-3">
          {item.userAvatar?<img src={item.userAvatar} alt="" className="h-12 w-12 rounded-xl object-cover"/>:<div className="h-12 w-12 rounded-xl bg-slate-900"/>}
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{item.userName}</p><p className="mt-0.5 text-[9px] text-slate-500">{item.claimType==='trainer'?'Персональный тренер':item.claimType==='rank'?'Разряд / статус':'Достижение'} · {item.sport||'спорт не указан'}</p><p className="mt-1 text-[11px] font-black text-emerald-300">{item.title}</p>{item.placement&&<p className="mt-0.5 text-[9px] text-slate-400">{item.placement}</p>}</div>
          <span className={'shrink-0 rounded-full px-2 py-1 text-[8px] font-black '+(tone[item.status]||'bg-slate-800 text-slate-400')}>{label[item.status]||item.status}</span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
          <p className="text-[9px] font-black text-slate-400">Материалы</p>
          {(!item.evidenceUrls?.length)&&item.evidenceUrl&&<a href={item.evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-300"><FileCheck2 className="h-3.5 w-3.5"/>Документ / скриншот <ExternalLink className="h-3 w-3"/></a>}
          {item.evidenceUrls?.map((url,index)=><a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-lime-300"><FileCheck2 size={16}/>Документ об обучении {index+1}<ExternalLink size={14}/></a>)}
          {item.sports?.length&&<p className="text-sm text-lime-200">Дисциплины: {item.sports.join(' · ')}</p>}
          {item.officialUrl&&<a href={item.officialUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 break-all text-[10px] font-bold text-sky-300"><ExternalLink className="h-3.5 w-3.5"/>Официальная ссылка</a>}
          {item.note&&<p className="text-[9px] leading-relaxed text-slate-400">Комментарий спортсмена: {item.note}</p>}
        </div>

        {item.claimType==='trainer'&&<div className="mt-3 space-y-3 rounded-2xl border border-lime-300/20 bg-slate-900 p-3">
          {item.status==='approved'&&<TrainerLevelBadge level={item.trainerLevel}/>}
          {['pending','approved'].includes(item.status)&&<>
            <label className="block text-sm font-semibold text-slate-200">Уровень SportBuddy78<select value={selectedLevel(item)} disabled={Boolean(busy)} onChange={e=>setLevels(old=>({...old,[keyFor(item)]:e.target.value}))} className="mt-2 min-w-0 max-w-full w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white"><option value="">Выберите уровень после проверки</option><option value="start">Start · 1 уровень · Общая физическая подготовка</option><option value="pro">Pro · 2 уровень · Подготовленные спортсмены</option></select></label>
            {isTrainerLevel(selectedLevel(item))&&<p className="text-sm leading-relaxed text-slate-300">{TRAINER_LEVELS[selectedLevel(item) as 'start'|'pro'].criteria}</p>}
            <label className="block text-sm text-slate-200">Основание присвоения уровня<textarea rows={3} maxLength={800} value={notes[keyFor(item)]||''} disabled={Boolean(busy)} onChange={e=>setNotes(old=>({...old,[keyFor(item)]:e.target.value}))} placeholder="Проверенные документы, квалификация, достижения и опыт. Для Pro и изменения уровня — обязательно." className="mt-2 min-w-0 max-w-full w-full rounded-xl border border-slate-600 bg-slate-950 p-3 text-base text-white"/></label>
            {item.status==='approved'&&<button disabled={Boolean(busy)||!isTrainerLevel(selectedLevel(item))||selectedLevel(item)===item.trainerLevel||(notes[keyFor(item)]||'').trim().length<10} onClick={()=>void changeLevel(item)} className="min-h-12 w-full rounded-xl bg-lime-300 p-3 text-sm font-bold text-slate-950 disabled:opacity-40">Сохранить уровень</button>}
          </>}
        </div>}

        {item.reviewNote&&<p className="mt-2 rounded-xl bg-slate-900 p-2.5 text-[9px] text-slate-400">Решение: {item.reviewNote}</p>}
        <p className="mt-2 text-[8px] text-slate-600">{new Date(item.updatedAt||item.createdAt).toLocaleString('ru-RU')}</p>

        {item.status==='pending'&&<div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={()=>void approve(item)} disabled={Boolean(busy)||(item.claimType==='trainer'&&(!isTrainerLevel(selectedLevel(item))||(selectedLevel(item)==='pro'&&(notes[keyFor(item)]||'').trim().length<10)))} className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[10px] font-black text-slate-950 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5"/>Подтвердить</button>
          <button onClick={()=>void reject(item)} disabled={Boolean(busy)} className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-[10px] font-black text-rose-300 disabled:opacity-50"><XCircle className="h-3.5 w-3.5"/>Отклонить</button>
        </div>}
        {item.status==='approved'&&<button onClick={()=>void revoke(item)} disabled={Boolean(busy)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-[10px] font-black text-amber-300 disabled:opacity-50"><ShieldCheck className="h-3.5 w-3.5"/>Отозвать подтверждение</button>}
      </article>)}
      {visible.length===0&&!busy&&<div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-8 text-center text-[11px] text-slate-500">Заявок в этой категории нет.</div>}
    </div>
    {cursor&&<button disabled={Boolean(busy)} onClick={()=>void refresh(true)} className="w-full rounded-xl border border-slate-600 p-3 text-sm text-lime-300">Загрузить ещё</button>}
  </section>;
}
