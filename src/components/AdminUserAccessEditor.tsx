import {useState} from 'react';
import {AdminUserRow,setAdminUserVerification,setAdminUserPremiumUntil} from '../services/adminManagement';
export function AdminUserAccessEditor({user,onSave,busy}:{user:AdminUserRow;onSave:(key:string,fn:()=>Promise<void>)=>Promise<void>;busy:boolean}){
 const [date,setDate]=useState(user.premiumUntil?new Date(user.premiumUntil).toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'}):'');
 const [verified,setVerified]=useState(user.isVerified);
 const [reason,setReason]=useState('');
 return <details className="mt-3 rounded-xl border border-slate-700 p-3 text-sm">
  <summary className="cursor-pointer font-bold">Изменить доступ</summary>
  <p className="my-2 text-slate-400">Текущий Premium: {user.premiumUntil?new Date(user.premiumUntil).toLocaleDateString('ru-RU'):'нет оплаченного срока'}</p>
  <label className="block">Premium до<input type="date" value={date} onChange={e=>setDate(e.target.value)} className="my-2 block w-full rounded bg-slate-900 p-2"/></label>
  <label className="flex gap-2"><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>Профиль подтверждён</label>
  <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Причина изменения" maxLength={300} className="my-3 w-full rounded bg-slate-900 p-2"/>
  <div className="flex flex-wrap gap-2">
   <button disabled={busy||user.isSuspended||reason.trim().length<3} onClick={()=>void onSave('premium:'+user.id,()=>setAdminUserPremiumUntil(user.id,date?new Date(date+'T23:59:59+03:00').toISOString():'',reason))} className="rounded bg-emerald-600 p-2 disabled:opacity-40">Сохранить Premium</button>
   <button disabled={busy||user.isSuspended||reason.trim().length<3||verified===user.isVerified} onClick={()=>void onSave('verify:'+user.id,()=>setAdminUserVerification(user.id,verified,reason))} className="rounded bg-slate-700 p-2 disabled:opacity-40">Сохранить верификацию</button>
  </div>
 </details>;
}
