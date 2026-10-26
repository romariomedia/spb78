import {TrainerLevelBadge,TrainerLevelGuide} from './TrainerLevelBadge';
import {TrainerServicesEditor} from './TrainerServicesEditor';
import { useEffect, useState } from 'react';
import { BadgeCheck, FileCheck2, RefreshCw, ArrowRight, X } from 'lucide-react';
import { SPORTS } from '../lib/types';
import { loadPersonalTrainer, savePersonalTrainer, submitPersonalTrainer, cancelPersonalTrainer, PersonalTrainer, SportIdVerificationRequest } from '../services/sportIdVerification';
import { uploadMedia } from '../services/cloudinary';
import { compressImage } from '../services/media';
const labels:Record<string,string>={declared:'Документы ещё не отправлены',pending:'Команда проверяет документы',verified:'Персональный тренер · Подтверждён',rejected:'Нужно дополнить документы',revoked:'Подтверждение отозвано'};
interface Props {userId:string;verification?:boolean;onOpenVerification?:()=>void;onChanged?:(trainer:PersonalTrainer)=>void}
export function PersonalTrainerPanel({userId,verification=false,onOpenVerification,onChanged}:Props){
  const [trainer,setTrainer]=useState<PersonalTrainer|null>(null),[enabled,setEnabled]=useState(false),[sports,setSports]=useState<string[]>([]);
  const [request,setRequest]=useState<SportIdVerificationRequest|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [documents,setDocuments]=useState<string[]>([]),[note,setNote]=useState(''),[officialUrl,setOfficialUrl]=useState('');
  const apply=(value:{trainer:PersonalTrainer;request?:SportIdVerificationRequest|null})=>{setTrainer(value.trainer);setEnabled(value.trainer.enabled);setSports(value.trainer.sports);setRequest(value.request||null);onChanged?.(value.trainer);};
  useEffect(()=>{let active=true;setTrainer(null);setError('');loadPersonalTrainer().then(value=>{if(active)apply(value);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[userId]);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить действие.');}finally{setBusy(false);}};
  const changed=Boolean(trainer)&&(enabled!==trainer?.enabled||JSON.stringify(sports)!==JSON.stringify(trainer?.sports));
  const save=()=>run(async()=>{apply(await savePersonalTrainer(enabled,sports));if(enabled&&!verification)onOpenVerification?.();});
  const upload=(files:FileList|null)=>run(async()=>{
    if(!files)return;
    if(files.length+documents.length>5)throw new Error('Можно прикрепить до 5 документов.');
    for(const file of Array.from(files)){
      if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)||file.size>10*1024*1024)throw new Error('Выберите JPG, PNG, WebP или PDF до 10 МБ.');
      const payload=file.type.startsWith('image/')?await compressImage(file,1800,0.86):file;
      const uploaded=await uploadMedia(payload,{folder:'sportbuddy/sport-id-verification',resourceType:'auto',tags:['sport-id-verification','trainer']});
      setDocuments(old=>[...old,uploaded.secureUrl]);
    }
  });
  return <section id="personal-trainer-verification" className="rounded-3xl border border-lime-400/25 bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-5 space-y-4">
    <div className="flex items-start gap-3"><span className="rounded-2xl bg-lime-400/10 p-3 text-lime-300"><BadgeCheck size={24}/></span><div className="min-w-0 flex-1"><p className="text-xs uppercase tracking-widest text-lime-300">{verification?'Спортивный ID · Проверка квалификации':'Твоя роль в сообществе'}</p><h3 className="mt-1 text-lg font-bold text-white">Персональный тренер</h3></div></div>
    <p className="text-sm leading-relaxed text-slate-300">Выберите дисциплины и подтвердите обучение. После проверки командой SportBuddy78 вы получите знак тренера и появитесь в отдельном каталоге тренировок.</p>
    {error&&<div role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{error}<button onClick={()=>void run(async()=>apply(await loadPersonalTrainer()))} disabled={busy} className="ml-2 underline">Повторить загрузку</button></div>}
    {!trainer&&!error&&<p role="status" className="text-sm text-slate-400">Загружаем статус…</p>}
    {trainer&&<>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-700 p-3 text-base font-semibold text-white"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>setEnabled(e.target.checked)} className="h-5 w-5 accent-lime-400"/>Я персональный тренер</label>
      {enabled&&<fieldset disabled={busy} className="space-y-2"><legend className="mb-2 text-sm font-semibold text-slate-200">Дисциплины, по которым вы тренируете</legend><div className="flex flex-wrap gap-2">{SPORTS.map(sport=><label key={sport} className={'cursor-pointer rounded-xl border px-3 py-2 text-sm '+(sports.includes(sport)?'border-lime-400/50 bg-lime-400/10 text-lime-200':'border-slate-700 text-slate-300')}><input type="checkbox" checked={sports.includes(sport)} onChange={e=>setSports(old=>SPORTS.filter(s=>s===sport?e.target.checked:old.includes(s)))} className="mr-2 accent-lime-400"/>{sport}</label>)}</div></fieldset>}
      {trainer.enabled&&<div role="status" className={'rounded-xl p-3 text-sm '+(trainer.status==='verified'?'bg-lime-400/10 text-lime-200':'bg-slate-800 text-slate-200')}>{labels[trainer.status]||labels.declared}{request?.reviewNote&&<p className="mt-2 text-slate-300">Комментарий команды: {request.reviewNote}</p>}</div>}
      {changed&&['pending','verified'].includes(trainer.status)&&<p className="text-sm text-amber-200">Изменение дисциплин или отключение статуса снимет действующее подтверждение / отменит заявку. Для новых дисциплин потребуется повторная проверка.</p>}
      {(changed||enabled&&!verification)&&<button disabled={busy||(enabled&&!sports.length)} onClick={()=>void save()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-400 p-3 font-bold text-slate-950 disabled:opacity-40">{busy?'Сохраняем…':enabled&&!verification?'Продолжить в Спортивном ID':'Сохранить изменения'}<ArrowRight size={18}/></button>}
      {verification&&trainer.enabled&&!changed&&trainer.status!=='verified'&&trainer.status!=='pending'&&<div className="space-y-3 border-t border-slate-700 pt-4">
        <h4 className="font-semibold text-white">Образование и квалификация</h4>
        <p className="text-sm text-slate-300">Для оценки уровня Pro добавьте также подтверждения спортивных результатов и опыта в выбранных дисциплинах: документы и официальную ссылку. Уровень назначит команда после проверки.</p>
        <label className="block text-sm text-slate-300">Курсы, дипломы и учебные организации<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={800} rows={3} disabled={busy} placeholder="Название курса, учебный центр, год окончания. Укажите, какие дисциплины подтверждает каждый документ." className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white"/></label>
        <label className="block text-sm text-slate-300">Документы об обучении · от 1 до 5<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={busy||documents.length>=5} onChange={e=>{void upload(e.target.files);e.target.value='';}} className="mt-2 block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-slate-700 file:p-3 file:text-white"/></label>
        <p className="text-xs text-slate-400">JPG, PNG, WebP или PDF до 10 МБ. Не прикладывайте паспорт и лишние персональные данные. Документы не отображаются в каталоге тренеров.</p>
        {documents.map((url,i)=><div key={url} className="flex items-center gap-2 text-sm text-lime-300"><FileCheck2 size={16}/><a href={url} target="_blank" rel="noreferrer" className="flex-1 underline">Документ {i+1}</a><button disabled={busy} aria-label={`Удалить документ ${i+1} из заявки`} onClick={()=>setDocuments(old=>old.filter((_,index)=>index!==i))}><X size={18}/></button></div>)}
        <label className="block text-sm text-slate-300">Ссылка на реестр / учебный центр (необязательно)<input type="url" value={officialUrl} onChange={e=>setOfficialUrl(e.target.value)} disabled={busy} maxLength={1500} placeholder="https://" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base text-white"/></label>
        <button disabled={busy||!documents.length||note.trim().length<5} onClick={()=>void run(async()=>{apply(await submitPersonalTrainer(documents,note,officialUrl));setDocuments([]);setNote('');setOfficialUrl('');})} className="w-full rounded-2xl bg-lime-400 p-3 font-bold text-slate-950 disabled:opacity-40">{busy?'Обрабатываем…':'Отправить на проверку'}</button>
      </div>}
      {verification&&trainer.enabled&&trainer.status==='pending'&&!changed&&<button disabled={busy} onClick={()=>void run(async()=>apply(await cancelPersonalTrainer()))} className="rounded-xl border border-slate-600 p-3 text-sm text-slate-300">Отменить заявку</button>}
      {trainer.enabled&&<TrainerLevelGuide/>}
      {trainer.status==='verified'&&<TrainerLevelBadge level={trainer.trainerLevel} details/>}
      {trainer.enabled&&<TrainerServicesEditor key={`${userId}:${trainer.hourlyRate}:${trainer.serviceDescription}`} trainer={trainer} onSaved={value=>{setTrainer(value);onChanged?.(value);}}/>}
      {trainer.enabled&&<button disabled={busy} onClick={()=>void run(async()=>apply(await loadPersonalTrainer()))} className="flex items-center gap-2 text-sm text-slate-400"><RefreshCw size={15}/>Обновить статус</button>}
    </>}
  </section>;
}
