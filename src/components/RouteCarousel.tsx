import {useRef,useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';

export function RouteCarousel({images,name}:{images:string[];name:string}) {
 const track=useRef<HTMLDivElement>(null);
 const [index,setIndex]=useState(0);
 const go=(next:number)=>track.current?.scrollTo({left:Math.max(0,Math.min(images.length-1,next))*track.current.clientWidth,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 return <div role="region" aria-roledescription="карусель" aria-label={`Фотографии: ${name}`} className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
  <div ref={track} onScroll={e=>setIndex(Math.max(0,Math.min(images.length-1,Math.round(e.currentTarget.scrollLeft/e.currentTarget.clientWidth))))} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain no-scrollbar" tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();go(index+(e.key==='ArrowRight'?1:-1));}}}>
   {images.map((url,i)=><img key={url} src={url} alt={`ИИ-иллюстрация ${name}, ${i+1} из ${images.length}`} loading={i?'lazy':'eager'} className="block w-full shrink-0 snap-center object-cover" draggable={false}/>)}
  </div>
  {images.length>1&&<>
   <span aria-live="polite" className="pointer-events-none absolute right-3 top-3 rounded-full bg-slate-950/75 px-3 py-1 text-xs font-semibold text-white">{index+1} / {images.length}</span>
   <button type="button" aria-label="Предыдущее фото маршрута" disabled={!index} onClick={()=>go(index-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 p-2.5 text-white disabled:invisible"><ChevronLeft size={20}/></button>
   <button type="button" aria-label="Следующее фото маршрута" disabled={index===images.length-1} onClick={()=>go(index+1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/70 p-2.5 text-white disabled:invisible"><ChevronRight size={20}/></button>
   <div className="flex justify-center gap-1 bg-slate-950/70 py-1">{images.map((url,i)=><button key={url} type="button" aria-label={`Фото маршрута ${i+1}`} aria-current={index===i?'true':undefined} onClick={()=>go(i)} className="flex h-8 w-8 items-center justify-center"><span className={`h-1.5 rounded-full transition-all ${index===i?'w-5 bg-lime-300':'w-1.5 bg-slate-500'}`}/></button>)}</div>
  </>}
 </div>;
}
