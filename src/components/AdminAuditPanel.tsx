import { useEffect,useState } from 'react';
import { FileClock,RefreshCw } from 'lucide-react';
import { AdminAuditEntry,loadAdminAudit } from '../services/adminAudit';

function label(entry:AdminAuditEntry){
  const names:Record<string,string>={
    'event.create':'Создано событие','event.update':'Изменено событие','event.delete':'Удалено событие',
    'venue.create':'Создана площадка','venue.update':'Изменена площадка','venue.delete':'Удалена площадка','venue.seed':'Импортированы площадки',
    'leisure.create':'Добавлено направление','leisure.update':'Изменено направление','leisure.delete':'Удалено направление','leisure.seed':'Импортирован активный отдых',
    'session.revoke':'Завершена сессия администратора'
  };
  return names[entry.action]||entry.action;
}
export function AdminAuditPanel(){
 const [items,setItems]=useState<AdminAuditEntry[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const refresh=async()=>{setLoading(true);setError('');try{setItems(await loadAdminAudit());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить журнал');}finally{setLoading(false);}};
 useEffect(()=>{void refresh();},[]);
 return <section className="space-y-3">
  <div className="flex items-center justify-between">
   <div className="flex items-center gap-2"><FileClock className="h-4 w-4 text-emerald-400"/><div><h3 className="text-sm font-black text-white">Журнал администратора</h3><p className="text-[10px] text-slate-500">Последние изменения Control Center</p></div></div>
   <button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300"><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/></button>
  </div>
  {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
  <div className="space-y-2">
   {items.length===0&&!loading&&<p className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-center text-[11px] text-slate-500">Журнал пока пуст.</p>}
   {items.map(item=><article key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black text-white">{label(item)}</p><p className="mt-0.5 truncate text-[9px] text-slate-500">{item.entityType}{item.entityId?` · ${item.entityId}`:''}</p></div><time className="shrink-0 text-[9px] text-slate-500">{item.createdAt?new Date(item.createdAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</time></div>
   </article>)}
  </div>
 </section>;
}
