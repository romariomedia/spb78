import {useEffect,useRef,useState} from 'react';
import {TrainerBooking,loadTrainerBookings,decideTrainerBooking} from '../services/sportIdVerification';
const labels={pending:'Ожидает решения',accepted:'Принята · можно общаться',rejected:'Отклонена',cancelled:'Отменена'};
export function TrainerBookings({incoming=false,refreshKey=0,forceOpen=false,onChat}:{incoming?:boolean;refreshKey?:number;forceOpen?:boolean;onChat:(id:string)=>void}){
 const [open,setOpen]=useState(forceOpen),[role,setRole]=useState<'client'|'trainer'>(incoming?'trainer':'client');
 const [items,setItems]=useState<TrainerBooking[]>([]),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),lock=useRef(false);
 useEffect(()=>{if(forceOpen)setOpen(true);},[forceOpen,refreshKey]);
 const load=async(append=false)=>{if(lock.current)return;const epoch=generation.current;lock.current=true;setBusy(true);setError('');try{const page=await loadTrainerBookings(role,append?cursor:null);if(epoch===generation.current){setItems(old=>append?[...old,...page.requests.filter(x=>!old.some(y=>y.id===x.id))]:page.requests);setCursor(page.nextCursor);}}catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:'Не удалось загрузить заявки');}finally{if(epoch===generation.current){lock.current=false;setBusy(false);}}};
 useEffect(()=>{++generation.current;lock.current=false;setBusy(false);setItems([]);setCursor(null);if(!open)return;void load();return()=>{++generation.current;};},[open,role,refreshKey]);
 const decide=async(item:TrainerBooking,action:'bookingAccept'|'bookingReject'|'bookingCancel')=>{if(lock.current)return;const epoch=generation.current;lock.current=true;setBusy(true);setError('');try{const data=await decideTrainerBooking(item,action);if(epoch===generation.current)setItems(old=>old.map(x=>x.id===item.id?data.request:x));}catch(e){if(epoch===generation.current)setError(e instanceof Error?e.message:'Не удалось изменить заявку. Обновите список.');}finally{if(epoch===generation.current){lock.current=false;setBusy(false);}}};
 return <section className="rounded-3xl border border-lime-400/20 bg-slate-900 p-4">
 <button onClick={()=>setOpen(x=>!x)} aria-expanded={open} className="flex min-h-10 w-full items-center justify-between text-left font-bold text-white"><span>{incoming?'Записи к персональному тренеру':'Мои заявки к тренерам'}</span><span>{open?'−':'+'}</span></button>
 {open&&<div className="mt-3 space-y-3">
 {incoming&&<div className="flex gap-2">{(['trainer','client'] as const).map(r=><button key={r} disabled={busy} onClick={()=>setRole(r)} className={'flex-1 rounded-xl p-3 text-sm '+(role===r?'bg-lime-300 text-slate-950':'bg-slate-800 text-slate-300')}>{r==='trainer'?'Ко мне':'Мои заявки'}</button>)}</div>}
 <p className="text-sm text-slate-400">Чат открывается после одобрения тренером. Время и место согласуются в переписке. Оплата — напрямую тренеру.</p>
 {error&&<p role="alert" className="text-sm text-rose-300">{error}</p>}{busy&&<p role="status" className="text-sm text-slate-400">Обновляем…</p>}
 {!busy&&!error&&!items.length&&<p className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">Заявок пока нет.</p>}
 {[...items].sort((a,b)=>Number(b.status==='pending')-Number(a.status==='pending')||b.updatedAt.localeCompare(a.updatedAt)).map(item=><article key={item.id} className="space-y-2 rounded-2xl border border-slate-700 bg-slate-950 p-4">
 <h4 className="break-words font-bold text-white">{role==='trainer'?item.clientName:item.trainerName}</h4><p className="text-sm text-lime-300">{item.sport} · {item.hourlyRate.toLocaleString('ru-RU')} ₽ / 60 минут</p>
 <p className="text-sm text-slate-200">{labels[item.status]}</p><p className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('ru-RU')}</p>
 <p className="whitespace-pre-wrap break-words text-sm text-slate-300">Удобное время: {item.preferredTime}</p>{item.note&&<p className="whitespace-pre-wrap break-words text-sm text-slate-300">{item.note}</p>}
 {item.serviceDescription&&<details className="text-sm text-slate-400"><summary>Условия на момент заявки</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.serviceDescription}</p></details>}
 {item.status==='pending'&&<div className="flex flex-wrap gap-2">{role==='trainer'?<><button disabled={busy} onClick={()=>void decide(item,'bookingAccept')} className="min-h-11 rounded-xl bg-lime-300 px-4 py-3 font-bold text-slate-950 disabled:opacity-40">Принять</button><button disabled={busy} onClick={()=>void decide(item,'bookingReject')} className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-slate-300">Отклонить</button></>:<button disabled={busy} onClick={()=>void decide(item,'bookingCancel')} className="min-h-11 rounded-xl border border-slate-600 px-4 py-3 text-slate-300">Отменить заявку</button>}</div>}
 {item.status==='accepted'&&<button onClick={()=>onChat(item.chatId)} className="min-h-11 w-full rounded-xl bg-lime-300 p-3 font-bold text-slate-950">Открыть чат</button>}
 </article>)}
 {cursor&&<button disabled={busy} onClick={()=>void load(true)} className="min-h-11 w-full rounded-xl border border-slate-600 p-3 text-lime-300">Загрузить ещё</button>}
 <button disabled={busy} onClick={()=>void load()} className="min-h-11 text-sm text-lime-300">Обновить заявки</button>
 </div>}</section>;
}
