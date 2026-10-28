import {useEffect, useState} from 'react';
import {ImageOff} from 'lucide-react';
import {eventCoverSources} from '../lib/eventCoverSources';

// These small official posters also ship with the APK, so an existing cover
// does not depend on reaching the website from Android's WebView.
const assets = import.meta.glob('/public/event-{posters,covers}/**/*.{webp,png,jpg,jpeg,svg}', {eager:true, query:'?url', import:'default'});
const bundledPaths = Object.keys(assets).map(path=>path.replace(/^\/public/,''));

export function EventCover({src, fallback, title, eager=false}: {src:string; fallback:string; title:string; eager?:boolean}) {
  const sources = eventCoverSources(src, fallback, bundledPaths);
  const identity = JSON.stringify(sources);
  const [attempt, setAttempt] = useState({identity, index:0});
  const index = attempt.identity === identity ? attempt.index : 0;
  const [loaded, setLoaded] = useState('');
  const current = sources[index];
  const advance = () => setAttempt(old=>({identity, index:(old.identity===identity?old.index:0)+1}));
  // Give network requests a bounded time; a stalled poster must not leave an
  // unexplained empty rectangle. The user can explicitly retry after failure.
  useEffect(()=>{
    if (!eager || !current || loaded===current) return;
    const timer=window.setTimeout(advance,15000);
    return ()=>window.clearTimeout(timer);
  },[identity,index,current,loaded,eager]);
  if (!current) return <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 rounded-lg bg-slate-900 p-4 text-center text-sm text-slate-400">
    <ImageOff className="h-6 w-6" aria-hidden="true"/>
    <span>Афиша временно недоступна</span>
    <button type="button" onClick={()=>{setLoaded('');setAttempt({identity,index:0});}} className="text-sky-300 underline">Загрузить снова</button>
  </div>;
  return <img key={identity+index} src={current} alt={`Афиша: ${title}`} loading={eager?'eager':'lazy'} decoding="async"
    onLoad={()=>setLoaded(current)} onError={advance}
    style={{contentVisibility:'visible'}}
    className="aspect-[16/10] w-full rounded-lg bg-slate-900 object-contain"/>;
}
