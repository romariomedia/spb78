import { useEffect,useState } from 'react';
import { ExternalLink,Gift,Handshake,Tag,Video } from 'lucide-react';
import { loadFeedPartners,FeedPartner } from '../services/partners';
import { cldUrl,videoPoster } from '../services/cloudinary';

function openPartner(url:string){
  if(!url)return;
  window.open(url,'_blank','noopener,noreferrer');
}

export function PartnerFeedSection(){
  const [visible,setVisible]=useState(false);
  const [items,setItems]=useState<FeedPartner[]>([]);
  useEffect(()=>{
    let alive=true;
    let loading=false;
    const refresh=async()=>{
      if(loading||document.visibilityState==='hidden')return;
      loading=true;
      try{
        const result=await loadFeedPartners();
        if(alive){setVisible(result.visible);setItems(result.partners);}
      }catch{if(alive){setVisible(false);setItems([]);}}
      finally{loading=false;}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),60_000);
    document.addEventListener('visibilitychange',refresh);
    return()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);

  if(!visible||items.length===0)return null;

  return <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/20 p-3.5 shadow-[0_0_28px_rgba(16,185,129,0.08)]">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-400">
          <Handshake className="h-3.5 w-3.5"/> Наши партнёры
        </p>
        <p className="mt-0.5 text-[10px] text-slate-500">Акции и предложения партнёров SportBuddy78</p>
      </div>
      <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">PARTNERS</span>
    </div>

    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 no-scrollbar">
      {items.map(item=><article key={item.id} className="w-[84%] max-w-[430px] shrink-0 snap-start overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-xl sm:w-[68%]">
        <div className="relative h-40 overflow-hidden bg-slate-950">
          {item.mediaType==='video'&&item.mediaUrl?(
            <video src={item.mediaUrl} poster={videoPoster(item.mediaUrl,720)} controls playsInline preload="metadata" className="h-full w-full object-cover"/>
          ):(item.mediaUrl||item.coverUrl)?(
            <img
              src={cldUrl(item.mediaUrl||item.coverUrl,{width:900,crop:'fill',quality:'auto:good'})||item.coverUrl}
              alt={item.name}
              loading="lazy" decoding="async"
              className="h-full w-full object-cover"
            />
          ):null}
          {!item.mediaUrl&&!item.coverUrl&&<div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-950/60 to-slate-950"><Handshake className="h-12 w-12 text-emerald-400/50"/></div>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 to-transparent"/>
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
            <div className="h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-lg">
              {item.logoUrl?<img src={cldUrl(item.logoUrl,{width:120,height:120,crop:'fill'})} alt="" className="h-full w-full object-cover"/>:<div className="flex h-full w-full items-center justify-center"><Handshake className="h-5 w-5 text-emerald-400"/></div>}
            </div>
            <div className="rounded-xl bg-slate-950/75 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-300">{item.partnerLabel}</p>
              <p className="max-w-[180px] truncate text-xs font-black text-white">{item.name}</p>
            </div>
          </div>
          {item.mediaType==='video'&&<span className="pointer-events-none absolute right-3 top-3 rounded-xl bg-slate-950/75 p-2 text-white backdrop-blur"><Video className="h-4 w-4"/></span>}
        </div>

        <div className="p-3.5">
          <h3 className="text-sm font-black leading-snug text-white">{item.offerTitle}</h3>
          <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-slate-400">{item.description}</p>
          {item.promoCode&&<div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2">
            <Tag className="h-3.5 w-3.5 text-amber-300"/>
            <span className="text-[10px] text-slate-400">Промокод</span>
            <strong className="ml-auto break-all text-[11px] tracking-wider text-amber-200">{item.promoCode}</strong>
          </div>}
          {item.ctaUrl&&<button onClick={()=>openPartner(item.ctaUrl)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-[11px] font-black text-slate-950 transition active:scale-[.98]">
            <Gift className="h-4 w-4"/>{item.ctaLabel||'Подробнее'}<ExternalLink className="h-3.5 w-3.5"/>
          </button>}
        </div>
      </article>)}
    </div>
  </section>;
}
