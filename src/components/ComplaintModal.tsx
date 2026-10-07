import React,{useEffect,useState} from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle,CheckCircle2,MessageSquareWarning,ShieldAlert } from 'lucide-react';
import { ChatThread,UserProfile } from '../lib/types';
import { submitComplaint } from '../services/complaints';
import { triggerHapticNotification } from '../services/native';
import { Modal } from './Modal';

interface ReportableContact{user:UserProfile;thread:ChatThread}
interface ComplaintModalProps{isOpen:boolean;onClose:()=>void;reporter:UserProfile|null;contacts:ReportableContact[];initialContactId?:string}
const REASONS=[
  ['unsafe','Небезопасное предложение'],
  ['harassment','Оскорбления / давление'],
  ['spam','Спам / реклама'],
  ['fake','Подозрение на фейковый профиль'],
  ['other','Другое']
] as const;

export const ComplaintModal:React.FC<ComplaintModalProps>=({isOpen,onClose,reporter,contacts,initialContactId})=>{
  const [sentTo,setSentTo]=useState<string|null>(null);
  const [selected,setSelected]=useState<ReportableContact|null>(null);
  const [reason,setReason]=useState<(typeof REASONS)[number][0]>('unsafe');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!isOpen||!initialContactId)return;
    const contact=contacts.find(item=>item.user.id===initialContactId);
    if(contact){setSelected(contact);setSentTo(null);setError('');}
  },[isOpen,initialContactId,contacts]);

  const close=()=>{setSentTo(null);setSelected(null);setReason('unsafe');setDetails('');setError('');onClose();};
  const send=async()=>{
    if(!reporter||!selected)return;
    setBusy(true);setError('');
    try{
      await submitComplaint({targetUserId:selected.user.id,chatId:selected.thread.id,reason,details});
      triggerHapticNotification('success');setSentTo(selected.user.id);setSelected(null);setDetails('');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось отправить жалобу');triggerHapticNotification('error');}
    finally{setBusy(false);}
  };

  return <Modal isOpen={isOpen} onClose={close} title="Пожаловаться" subtitle="Жалоба попадёт в Moderation Center SportBuddy78"
    footer={<button onClick={close} className="w-full rounded-2xl bg-slate-800 py-3 text-xs font-black text-slate-300">Закрыть</button>}>
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"/>
        <p className="text-[11px] leading-relaxed text-slate-200">SportBuddy78 сохраняет жалобу на сервере и прикладывает последние сообщения реального диалога. Подделать другого собеседника через форму нельзя.</p>
      </div>
      {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
      {sentTo&&<p className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="h-4 w-4"/>Жалоба отправлена в службу модерации</p>}
      {!selected?<>
        {contacts.length===0?<div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center"><MessageSquareWarning className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-2 text-xs font-bold text-slate-300">Нет диалогов для жалобы</p></div>:
        <div className="space-y-2">{contacts.map(contact=><motion.button key={contact.thread.id} whileTap={{scale:.985}} onClick={()=>{setSelected(contact);setSentTo(null);setError('');}} className="flex w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left hover:border-rose-500/50">
          <img src={contact.user.avatar} alt="" className="h-11 w-11 rounded-full border border-slate-700 object-cover"/>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{contact.user.name}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{contact.thread.messages.at(-1)?.text||'Диалог'}</p></div>
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400"><AlertTriangle className="h-4 w-4"/></span>
        </motion.button>)}</div>}
      </>:<div className="rounded-2xl border border-slate-700 bg-slate-950 p-3 space-y-3">
        <div className="flex items-center gap-3"><img src={selected.user.avatar} alt="" className="h-10 w-10 rounded-full object-cover"/><div><p className="text-xs font-black text-white">{selected.user.name}</p><p className="text-[9px] text-slate-500">Выберите причину жалобы</p></div></div>
        <select value={reason} onChange={e=>setReason(e.target.value as typeof reason)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-white">{REASONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        <textarea value={details} onChange={e=>setDetails(e.target.value)} maxLength={800} rows={3} placeholder="Комментарий модератору — необязательно" className="w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white outline-none focus:border-rose-400"/>
        <div className="grid grid-cols-2 gap-2"><button onClick={()=>setSelected(null)} className="rounded-xl border border-slate-700 py-2.5 text-[11px] font-bold text-slate-300">Назад</button><button onClick={()=>void send()} disabled={busy} className="rounded-xl bg-rose-500 py-2.5 text-[11px] font-black text-white disabled:opacity-50">{busy?'Отправка…':'Отправить жалобу'}</button></div>
      </div>}
    </div>
  </Modal>;
};
