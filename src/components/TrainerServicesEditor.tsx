import {useState} from 'react';
import {PersonalTrainer,saveTrainerServices} from '../services/sportIdVerification';
export function TrainerServicesEditor({trainer,onSaved}:{trainer:PersonalTrainer;onSaved:(trainer:PersonalTrainer)=>void}){
  const [rate,setRate]=useState(String(trainer.hourlyRate||'')),[description,setDescription]=useState(trainer.serviceDescription||'');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const submit=async()=>{setBusy(true);setError('');setSaved(false);try{const result=await saveTrainerServices(Number(rate),description);onSaved(result.trainer);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить');}finally{setBusy(false);}};
  return <div className="space-y-3 rounded-2xl border border-lime-400/20 bg-slate-950 p-4">
    <h4 className="font-bold text-white">Услуги и стоимость</h4>
    <p className="text-sm text-slate-400">Цена видна в каталоге. Укажите, что входит в занятие и оплачивается ли вход в зал отдельно.</p>
    <label className="block text-sm text-slate-200">Стоимость за 60 минут, ₽<input type="number" inputMode="numeric" min={1} max={1000000} step={1} value={rate} onChange={e=>{setRate(e.target.value);setSaved(false);}} disabled={busy} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-base text-white"/></label>
    <label className="block text-sm text-slate-200">Описание услуг<textarea rows={4} maxLength={1200} value={description} onChange={e=>{setDescription(e.target.value);setSaved(false);}} disabled={busy} placeholder="Индивидуальная тренировка, программа под вашу цель. Место занятий, условия и дополнительные расходы." className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-base text-white"/></label>
    <p className="text-xs text-slate-400">Изменение цены не снимает подтверждение квалификации. В отправленных заявках сохраняется цена на момент обращения.</p>
    {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}{saved&&<p role="status" className="text-sm text-lime-300">Стоимость сохранена</p>}
    <button disabled={busy||!Number.isSafeInteger(Number(rate))||Number(rate)<1||Number(rate)>1000000} onClick={()=>void submit()} className="min-h-12 w-full rounded-xl bg-lime-300 p-3 font-bold text-slate-950 disabled:opacity-40">{busy?'Сохраняем…':'Сохранить услуги и цену'}</button>
  </div>;
}
