import {useState} from 'react';
import {Modal} from './Modal';
import {UserProfile} from '../lib/types';
import {createTrainerBooking,TrainerBooking} from '../services/sportIdVerification';
export function TrainerBookingModal({trainer,onClose,onCreated}:{trainer:UserProfile;onClose:()=>void;onCreated:()=>void}){
 const [sport,setSport]=useState(trainer.personalTrainer?.sports[0]||''),[time,setTime]=useState(''),[note,setNote]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<TrainerBooking|null>(null);
 const submit=async()=>{setBusy(true);setError('');try{const data=await createTrainerBooking({trainerId:trainer.id,sport,hourlyRate:trainer.personalTrainer?.hourlyRate||0,preferredTime:time,note});setResult(data.request);onCreated();}catch(e){setError(e instanceof Error?e.message:'Не удалось отправить заявку');}finally{setBusy(false);}};
 return <Modal isOpen onClose={()=>{if(!busy)onClose();}} title={`Запись: ${trainer.name}`} subtitle="Сначала заявка — затем подтверждение и общение">
 <div className="space-y-4">
 <p className="text-2xl font-bold text-lime-300">{trainer.personalTrainer?.hourlyRate?.toLocaleString('ru-RU')} ₽ <span className="text-sm font-normal text-slate-300">/ 60 минут</span></p>
 {trainer.personalTrainer?.serviceDescription&&<p className="whitespace-pre-wrap break-words text-sm text-slate-300">{trainer.personalTrainer.serviceDescription}</p>}
 {result?<div role="status" className="space-y-3 rounded-2xl bg-lime-400/10 p-4 text-lime-200"><p>{result.status==='accepted'?'Тренер уже принял вашу заявку. Чат доступен в разделе «Чаты → Тренеры».':'Заявка отправлена. Тренер получит уведомление. После одобрения можно будет открыть чат.'}</p><p className="text-sm">Статус — в «Моих заявках к тренерам» и в профиле.</p><button className="rounded-xl bg-lime-300 p-3 font-bold text-slate-950" onClick={onClose}>Понятно</button></div>:<>
 <label className="block text-sm text-slate-200">Дисциплина<select value={sport} onChange={e=>setSport(e.target.value)} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base">{trainer.personalTrainer?.sports.map(s=><option key={s}>{s}</option>)}</select></label>
 <label className="block text-sm text-slate-200">Когда удобно заниматься<input value={time} onChange={e=>setTime(e.target.value)} disabled={busy} maxLength={200} placeholder="Например, вторник или четверг после 19:00" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base"/></label>
 <label className="block text-sm text-slate-200">Цель и пожелания (необязательно)<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={600} rows={3} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-base"/></label>
 <p className="text-sm text-slate-400">Это запрос на занятие, не бронь времени и не оплата. Дату, место и окончательные условия вы согласуете с тренером после одобрения. Переписка подчиняется действующим условиям Premium.</p>
 {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}
 <button disabled={busy||!sport||!time.trim()} onClick={()=>void submit()} className="min-h-12 w-full rounded-xl bg-lime-300 p-3 font-bold text-slate-950 disabled:opacity-40">{busy?'Отправляем…':'Отправить заявку'}</button>
 </>}
 </div></Modal>;
}
