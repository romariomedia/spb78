import { useEffect,useState } from 'react';
import { Megaphone,X } from 'lucide-react';
import { AppAnnouncement,loadAnnouncements } from '../services/announcements';

function dismissedKey(item:AppAnnouncement){return `sb_announcement_dismissed:${item.id}:${item.updatedAt||'v1'}`;}
export function AppAnnouncements({placement}:{placement:string}){
  const [items,setItems]=useState<AppAnnouncement[]>([]);
  useEffect(()=>{let live=true;void loadAnnouncements(placement).then(next=>{if(live)setItems(next.filter(x=>!localStorage.getItem(dismissedKey(x))));});return()=>{live=false;};},[placement]);
  if(!items.length)return null;
  return <div className="relative z-20 mx-auto mt-2 w-full max-w-md px-4 lg:max-w-5xl">
    <div className="space-y-2">
      {items.map(item=><article key={item.id} className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-slate-900/95 shadow-lg">
        {item.imageUrl&&<img src={item.imageUrl} alt="" className="h-28 w-full object-cover sm:h-36"/>}
        <div className="flex gap-3 p-3 sm:p-4">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><Megaphone className="h-4 w-4"/></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-white sm:text-sm">{item.title}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-300 sm:text-xs">{item.text}</p>
            {item.buttonLabel&&item.buttonLink&&<a href={item.buttonLink} className="mt-2 inline-flex rounded-xl bg-emerald-500 px-3 py-2 text-[10px] font-black text-slate-950 sm:text-xs">{item.buttonLabel}</a>}
          </div>
          {item.dismissible&&<button onClick={()=>{localStorage.setItem(dismissedKey(item),'1');setItems(prev=>prev.filter(x=>x.id!==item.id));}} className="h-8 w-8 shrink-0 rounded-lg border border-slate-700 bg-slate-950 text-slate-400 hover:text-white" aria-label="Скрыть объявление"><X className="mx-auto h-4 w-4"/></button>}
        </div>
      </article>)}
    </div>
  </div>;
}
