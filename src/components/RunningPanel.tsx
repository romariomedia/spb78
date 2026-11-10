import {useEffect,useRef,useState} from 'react';
import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import {MapContainer,TileLayer,Polyline,CircleMarker,useMap} from 'react-leaflet';
import routesData from '../../shared/running-routes.json';
import {MAX_POINTS,MAX_DURATION_MS,distanceM,trackDistance,validPoint,type RunPoint} from '../../shared/running.js';
import {callServer} from '../services/serverApi';
import 'leaflet/dist/leaflet.css';
export type RunningRoute=typeof routesData[number];
type Draft={id:string;routeId:string;startedAt:number;endedAt?:number;points:RunPoint[];segment:number;publish?:boolean};
type Result={id:string;routeId:string;endedAt:number;distanceM:number;elapsedMs:number;paceSecPerKm:number;reason:string};
const clock=(ms:number)=>{const s=Math.floor(ms/1000);return `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor(s/60%60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;};
const button='rounded-xl border border-slate-600 px-3 py-2 text-sm font-bold hover:border-lime-400 disabled:opacity-40';
function FollowRun({point,visible}:{point:RunPoint;visible:boolean}){
 const map=useMap();
 useEffect(()=>{if(visible){map.invalidateSize();map.panTo([point.lat,point.lng]);}},[map,point.lat,point.lng,visible]);
 return null;
}
export default function RunningPanel({userId,visible,onTraining,onOpen}:{userId:string;visible:boolean;onOpen?:()=>void;onTraining:(r:RunningRoute)=>void}){
 const key=`sb78-running-v1:${userId}`;
 const [draft,setDraft]=useState<Draft|null>(()=>{try{const d=JSON.parse(localStorage.getItem(key)||'null');return d&&typeof d.id==='string'&&Number.isFinite(d.startedAt)&&Number.isInteger(d.segment)&&typeof d.routeId==='string'&&(!d.endedAt||Number.isFinite(d.endedAt))&&Array.isArray(d.points)&&d.points.length<=MAX_POINTS&&d.points.every(validPoint)?d:null;}catch{return null;}});
 const ref=useRef(draft),stopRef=useRef<(()=>void)|null>(null),generation=useRef(0);
 const [recording,setRecording]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[gps,setGps]=useState(''),[now,setNow]=useState(Date.now());
 const [history,setHistory]=useState<Result[]>([]),[selected,setSelected]=useState<RunningRoute|null>(null),[photo,setPhoto]=useState(0),[leaders,setLeaders]=useState('');
 const [ranking,setRanking]=useState<{name:string;elapsedMs:number;paceSecPerKm:number;endedAt:number}[]>([]);
 const [consent,setConsent]=useState(false),[open,setOpen]=useState(false);
 const persist=(d:Draft|null)=>{ref.current=d;setDraft(d);try{if(d)localStorage.setItem(key,JSON.stringify(d));else localStorage.removeItem(key);}catch{setError('Память устройства заполнена. Не закрывайте приложение до сохранения результата.');}};
 const stop=()=>{generation.current++;stopRef.current?.();stopRef.current=null;setRecording(false);};
 const refresh=()=>callServer<{runs:Result[]}>('/api/running',{action:'history'}).then(r=>setHistory(r.runs));
 useEffect(()=>{refresh().catch(()=>setError('Не удалось загрузить историю. Нажмите «Обновить».'));return()=>{generation.current++;stopRef.current?.();};},[userId]);
 useEffect(()=>{if(!draft||draft.endedAt)return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[draft?.id,draft?.endedAt]);
 useEffect(()=>{if(draft&&!draft.endedAt&&now-draft.startedAt>=MAX_DURATION_MS){stop();persist({...draft,endedAt:draft.startedAt+MAX_DURATION_MS,points:draft.points.filter(p=>p.timestamp<=draft.startedAt+MAX_DURATION_MS)});setError('Достигнут лимит 6 часов. Сохраните пробежку.');}},[now,draft?.id,draft?.endedAt]);
 useEffect(()=>{if(!recording)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[recording]);
 async function start(routeId:string){
  if(busy||recording)return;
  setBusy(true);setError('');setGps('Ожидаем точный GPS…');setOpen(true);
  const token=++generation.current;
  let next=ref.current;
  if(next?.endedAt){setBusy(false);return;}
  if(next&&Date.now()-next.startedAt>=MAX_DURATION_MS){setError('Запись старше 6 часов. Завершите её или удалите черновик.');setBusy(false);return;}
  if(!next)next={id:`run_${crypto.randomUUID()}`,routeId,startedAt:Date.now(),points:[],segment:0};
  else next={...next,segment:next.segment+1};
  persist(next);
  const position=(p:{coords:{latitude:number;longitude:number;accuracy:number};timestamp:number})=>{
   if(generation.current!==token)return;
   const d=ref.current;if(!d||d.endedAt)return;
   const point={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp,segment:d.segment};
   if(!validPoint(point)){setGps('Слабый GPS: ждём точность до 50 м.');return;}
   const last=d.points.at(-1);
   if(point.timestamp<d.startedAt||point.timestamp>Date.now()+5000||(last&&point.timestamp-last.timestamp<2000))return;
   if(d.points.length>=MAX_POINTS){stop();persist({...d,endedAt:Date.now()});setError('Достигнут лимит точек. Сохраните результат.');return;}
   setGps(`GPS ±${Math.round(point.accuracy)} м`);persist({...d,points:[...d.points,point]});
  };
  const fail=()=>{if(generation.current!==token)return;setError('GPS недоступен. Разрешите точное местоположение и нажмите «Продолжить».');stop();};
  try{
   if(Capacitor.isNativePlatform()){
    await Geolocation.requestPermissions();
    if(generation.current!==token)return;
    const id=await Geolocation.watchPosition({enableHighAccuracy:true,timeout:15000,maximumAge:0},(p,e)=>{if(e)fail();else if(p)position(p);});
    if(generation.current!==token){await Geolocation.clearWatch({id});return;}
    stopRef.current=()=>{void Geolocation.clearWatch({id});};
   }else{
    if(!navigator.geolocation)throw new Error('Геолокация недоступна');
    const id=navigator.geolocation.watchPosition(position,fail,{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    stopRef.current=()=>navigator.geolocation.clearWatch(id);
   }
   if(generation.current===token)setRecording(true);
  }catch{fail();}finally{setBusy(false);}
 }
 async function save(){
  const d=ref.current;if(!d?.endedAt)return;setBusy(true);setError('');
  try{await callServer('/api/running',{action:'save',run:d});persist(null);setGps('Результат сохранён');await refresh();}
  catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить. Черновик остаётся на устройстве.');}
  finally{setBusy(false);}
 }
 const meters=draft?trackDistance(draft.points):0;
 const segments:[number,number][][]=[];
 if(draft)draft.points.forEach((p,i)=>{const prev=draft.points[i-1];if(!prev||p.segment!==prev.segment||p.timestamp-prev.timestamp>30000||distanceM(prev,p)/((p.timestamp-prev.timestamp)/1000)>12)segments.push([]);segments[segments.length-1]!.push([p.lat,p.lng]);});
 const total=history.reduce((sum,r)=>sum+r.distanceM,0);
 return <>{!visible&&draft&&!draft.endedAt&&<button className="w-full rounded-xl bg-lime-300 p-3 text-slate-950 font-bold" onClick={onOpen}>Пробежка {recording?'записывается':'на паузе'} · {clock(now-draft.startedAt)} — открыть</button>}<section className={`${visible?'':'hidden'} rounded-3xl border border-lime-400/25 bg-slate-950 p-4 text-white space-y-4`}>
  <button className="w-full text-left flex justify-between items-center" onClick={()=>setOpen(!open)} aria-expanded={open}><span><span className="text-xs tracking-widest text-lime-300">SPORTBUDDY78 RUN</span><strong className="block text-xl">Пробежки и маршруты</strong></span><span className="text-lime-300">{recording?'● REC':open?'−':'+'}</span></button>
  {(open||draft)&&<>
   <p className="text-xs text-slate-400">Запись работает при открытом приложении. Держите экран включённым: в фоне GPS может остановиться. Полное время включает паузы. Точный трек остаётся на этом устройстве до отправки; сервер сохраняет только личную сводку.</p>
   {error&&<p role="alert" className="text-sm text-amber-300">{error}</p>}
   {!draft?<><label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>Разрешаю запись точного GPS-трека на этом устройстве и его обработку для расчёта результата.</label><button className={`${button} bg-lime-300 text-slate-950`} disabled={!consent||busy} onClick={()=>start('')}>Начать свободную пробежку</button></>:<div className="space-y-3 rounded-2xl bg-slate-900 p-4">
    <p className="text-sm text-lime-300">{routesData.find(r=>r.id===draft.routeId)?.name||'Свободная пробежка'} · {draft.endedAt?'Завершена':recording?'Идёт запись':'Запись на паузе / восстановлена'}</p>
    <div className="grid grid-cols-3 gap-2"><div><strong className="text-xl">{(meters/1000).toFixed(2)}</strong><p className="text-xs text-slate-400">км по GPS</p></div><div><strong>{clock((draft.endedAt||now)-draft.startedAt)}</strong><p className="text-xs text-slate-400">полное время</p></div><div><strong>{meters>=20?`${Math.floor(((draft.endedAt||now)-draft.startedAt)/meters/60)}:${Math.floor(((draft.endedAt||now)-draft.startedAt)/meters%60).toString().padStart(2,'0')}`:'—'}</strong><p className="text-xs text-slate-400">мин/км</p></div></div>
    <p className="text-xs text-slate-400" aria-live="polite">{gps}</p>
    {draft.points[0]&&<div className="relative z-0 overflow-hidden rounded-xl"><MapContainer center={[draft.points[0].lat,draft.points[0].lng]} zoom={15} style={{height:220}} scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap'/>{segments.map((positions,i)=><Polyline key={i} positions={positions} pathOptions={{color:'#a3e635'}}/>)}<CircleMarker center={[draft.points[0].lat,draft.points[0].lng]} radius={5}/><FollowRun point={draft.points[draft.points.length-1]!} visible={visible}/></MapContainer></div>}
    {draft.endedAt&&routesData.find(r=>r.id===draft.routeId)?.verified&&<label className="flex gap-2 text-xs"><input type="checkbox" checked={draft.publish===true} onChange={e=>persist({...draft,publish:e.target.checked})}/>Опубликовать моё имя и результат в рейтинге маршрута. Точный трек не публикуется.</label>}
    <div className="flex flex-wrap gap-2">{!draft.endedAt?<><button className={button} disabled={busy} onClick={()=>recording?stop():start(draft.routeId)}>{recording?'Пауза':'Продолжить'}</button><button className={button} disabled={busy} onClick={()=>{stop();persist({...ref.current!,endedAt:Date.now()});}}>Завершить</button></>:<button className={`${button} bg-lime-300 text-slate-950`} disabled={busy} onClick={save}>{busy?'Сохраняем…':'Сохранить результат'}</button>}<button className={button} disabled={busy} onClick={()=>{if(window.confirm('Удалить несохранённую пробежку?')){stop();persist(null);}}}>Удалить черновик</button></div>
   </div>}
   <div className="grid gap-3 sm:grid-cols-2">{routesData.map(r=><button key={r.id} onClick={()=>{setSelected(r);setPhoto(0);setLeaders('');setRanking([]);}} className="overflow-hidden rounded-2xl border border-slate-700 text-left hover:border-lime-300"><img loading="lazy" src={r.mapImage||r.images[0]} alt={`${r.mapImage?"Схема маршрута":"ИИ-иллюстрация"}: ${r.name}`} className="aspect-[3/2] w-full object-cover"/><div className="p-3"><strong>{r.name}</strong><p className="text-xs text-slate-400">{r.city} · {r.distanceLabel}</p></div></button>)}</div>
   {selected&&<div className="rounded-2xl border border-lime-300/30 p-3 space-y-3">
    <div className="flex justify-between"><h3 className="font-bold">{selected.name}</h3><button onClick={()=>setSelected(null)} aria-label="Закрыть маршрут">✕</button></div>
    {selected.mapImage&&<div className="space-y-2"><a href={selected.mapImage} target="_blank" rel="noreferrer" aria-label="Открыть схему маршрута крупно"><img src={selected.mapImage} alt={`Схема сверху: ${selected.name}, ${selected.distanceLabel}, лаймовая линия, старт и финиш`} className="rounded-xl w-full"/></a><p className="text-xs text-slate-400">{selected.mapNote}</p><a href={selected.geometrySourceUrl} target="_blank" rel="noreferrer" className="text-xs text-lime-300 underline">Исходная карта организаторов</a></div>}
    <img src={selected.images[photo]} alt={`ИИ-иллюстрация ${selected.name}, вариант ${photo+1}`} className="rounded-xl w-full"/>
    <div className="flex gap-2">{selected.images.map((_,i)=><button key={i} className={button} aria-pressed={photo===i} onClick={()=>setPhoto(i)}>Вид {i+1}</button>)}</div>
    <p className="text-sm">{selected.description}</p><p className="text-xs text-slate-400">{selected.surface} · {selected.meetingPoint}. Иллюстрации не являются точной картой местности.</p>
    <a className="text-lime-300 text-xs underline" href={selected.sourceUrl} target="_blank" rel="noreferrer">Описание локации и трассы</a>
    <p className="text-xs text-amber-200">Точная линия маршрута ещё проверяется. Пробежки сохраняются в личную историю; рейтинг пока закрыт.</p>
    <div className="flex flex-wrap gap-2"><button className={`${button} bg-lime-300 text-slate-950`} disabled={!!draft||!consent||busy} onClick={()=>start(selected.id)}>Бежать одному</button><button className={button} onClick={()=>onTraining(selected)}>Создать тренировку</button><button className={button} onClick={()=>callServer<{reason:string;leaders:typeof ranking}>('/api/running',{action:'leaders',routeId:selected.id}).then(r=>{setLeaders(r.reason);setRanking(r.leaders);}).catch(()=>setLeaders('Не удалось загрузить рейтинг. Повторите попытку.'))}>Таблица лидеров</button></div>
    {ranking.length>0&&<div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr><th>Место</th><th>Участник</th><th>Время</th><th>Дата</th></tr></thead><tbody>{ranking.map((r,i)=><tr key={i}><td>{i+1}</td><td>{r.name}</td><td>{clock(r.elapsedMs)}</td><td>{new Date(r.endedAt).toLocaleDateString('ru-RU')}</td></tr>)}</tbody></table></div>}
    {leaders&&<p className="text-sm text-slate-300" role="status">{leaders}</p>}
   </div>}
   <div><div className="flex justify-between"><h3 className="font-bold">Мои результаты</h3><button className="text-xs text-lime-300" onClick={()=>refresh().then(()=>setError('')).catch(()=>setError('Не удалось обновить историю.'))}>Обновить</button></div><p className="text-xs text-slate-400">Последние {history.length} пробежек · {(total/1000).toFixed(1)} км</p>
   {!history.length&&<p className="text-sm text-slate-400 mt-3">Здесь появится ваша первая сохранённая пробежка.</p>}
   {history.map(r=><div key={r.id} className="border-b border-slate-800 py-3"><p className="text-sm">{routesData.find(x=>x.id===r.routeId)?.name||'Свободная пробежка'} · {new Date(r.endedAt).toLocaleDateString('ru-RU')}</p><p className="font-bold text-lime-300">{(r.distanceM/1000).toFixed(2)} км · {clock(r.elapsedMs)} · {Math.floor(r.paceSecPerKm/60)}:{(r.paceSecPerKm%60).toString().padStart(2,'0')} /км</p><p className="text-xs text-slate-400">{r.reason}</p><button className="text-xs text-slate-400 underline" disabled={busy} onClick={async()=>{if(!window.confirm('Удалить результат?'))return;setBusy(true);try{await callServer('/api/running',{action:'delete',id:r.id});await refresh();}catch{setError('Не удалось удалить результат.');}finally{setBusy(false);}}}>Удалить</button></div>)}
   </div>
  </>}
 </section></>;
}
