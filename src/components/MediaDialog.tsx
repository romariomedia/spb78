import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export function MediaDialog({title,onClose,children,busy=false}:{title:string;onClose:()=>void;children:ReactNode;busy?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
 return createPortal(<dialog ref={ref} className="sb-media-dialog" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
  <header><div><span>SPORTBUDDY · САНКТ-ПЕТЕРБУРГ</span><h2>{title}</h2></div><button disabled={busy} onClick={onClose} aria-label="Закрыть"><X size={22}/></button></header>
  {children}
 </dialog>,document.body);
}
