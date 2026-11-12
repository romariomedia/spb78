import {useState,type ReactNode} from 'react';
import {Reorder,useDragControls} from 'framer-motion';
import {ArrowDown,ArrowUp,GripVertical,SlidersHorizontal} from 'lucide-react';
import {normalizeDashboardOrder,moveDashboardSection} from '../../shared/dashboard-order.js';

type Section={id:string;title:string;content:ReactNode};
function OrderRow({id,title,index,count,onMove}:{id:string;title:string;index:number;count:number;onMove:(offset:number)=>void}){
 const controls=useDragControls();
 return <Reorder.Item value={id} dragListener={false} dragControls={controls} className="relative flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white shadow-lg">
  <button type="button" aria-label={`Перетащить: ${title}`} onPointerDown={e=>controls.start(e)} className="touch-none cursor-grab rounded-xl p-3 text-lime-300 active:cursor-grabbing"><GripVertical size={20}/></button>
  <span className="flex-1 font-semibold">{title}</span>
  <button type="button" aria-label={`${title}: вверх`} disabled={!index} onClick={()=>onMove(-1)} className="rounded-xl p-3 text-slate-300 disabled:opacity-20"><ArrowUp size={18}/></button>
  <button type="button" aria-label={`${title}: вниз`} disabled={index===count-1} onClick={()=>onMove(1)} className="rounded-xl p-3 text-slate-300 disabled:opacity-20"><ArrowDown size={18}/></button>
 </Reorder.Item>;
}
export function DashboardSections({userId,visible,sections}:{userId:string;visible:boolean;sections:Section[]}){
 const storageKey=`sb78-home-order-v1:${userId}`;
 const [order,setOrder]=useState(()=>{try{return normalizeDashboardOrder(JSON.parse(localStorage.getItem(storageKey)||'null'));}catch{return normalizeDashboardOrder(null);}});
 const [editing,setEditing]=useState(false),[warning,setWarning]=useState('');
 const save=(next:string[])=>{const normalized=normalizeDashboardOrder(next);setOrder(normalized);try{localStorage.setItem(storageKey,JSON.stringify(normalized));setWarning('');}catch{setWarning('Порядок изменён. Устройство не разрешило сохранить его после закрытия приложения.');}};
 return <div className="space-y-4">
  {visible&&<div className="space-y-3">
   <div className="flex justify-end"><button type="button" onClick={()=>setEditing(v=>!v)} aria-expanded={editing} className="flex min-h-11 items-center gap-2 rounded-full border border-lime-300/20 bg-slate-900 px-4 text-xs font-bold text-lime-300"><SlidersHorizontal size={16}/>{editing?'Готово':'Настроить главную'}</button></div>
   {editing&&<section aria-label="Порядок разделов" className="rounded-3xl border border-lime-300/25 bg-slate-950 p-4">
    <h2 className="font-bold text-white">Главная под ваш ритм</h2><p className="mb-4 mt-1 text-xs leading-relaxed text-slate-400">Перетащите раздел за ручку или используйте стрелки. Порядок сохранится для вашего аккаунта на этом устройстве.</p>
    <Reorder.Group axis="y" values={order} onReorder={save} className="space-y-2">{order.map((id,index)=><OrderRow key={id} id={id} title={sections.find(s=>s.id===id)?.title||id} index={index} count={order.length} onMove={offset=>save(moveDashboardSection(order,id,offset))}/>)}</Reorder.Group>
    <button type="button" onClick={()=>save(normalizeDashboardOrder(null))} className="mt-3 min-h-11 text-xs text-slate-400 underline underline-offset-4">Вернуть исходный порядок</button>
   </section>}
   {warning&&<p role="status" className="text-xs text-amber-300">{warning}</p>}
  </div>}
  {order.map(id=><div key={id} hidden={!visible&&id!=='running'} className="space-y-4" data-dashboard-section={id}>{sections.find(s=>s.id===id)?.content}</div>)}
 </div>;
}
