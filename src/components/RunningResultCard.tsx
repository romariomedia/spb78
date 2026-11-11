import {useEffect,useState} from 'react';
import routes from '../../shared/running-routes.json';
import {hasBackgroundRecorder,runningRecorder} from '../services/runningRecorder';
export type RunSummary={id:string;routeId:string;endedAt:number;distanceM:number;elapsedMs:number;paceSecPerKm:number;reason:string;eligible?:boolean;published?:boolean};
const duration=(ms:number)=>{const seconds=Math.max(0,Math.floor(ms/1000));return `${Math.floor(seconds/3600).toString().padStart(2,'0')}:${Math.floor(seconds/60%60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;};
export default function RunningResultCard({result,saved}:{result:RunSummary;saved:boolean}){
 const [image,setImage]=useState(''),[message,setMessage]=useState('');
 const route=routes.find(r=>r.id===result.routeId);
 const title=route?.name||'Свободная пробежка';
 const pace=result.distanceM>0?`${Math.floor(result.paceSecPerKm/60)}:${(result.paceSecPerKm%60).toString().padStart(2,'0')}`:'—';
 const status=!saved?'Результат ещё не сохранён':result.published?'Результат включён в рейтинг':result.eligible?'Трасса пройдена · личный результат':'Личный результат · вне рейтинга';
 useEffect(()=>{
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const bg=ctx.createLinearGradient(0,0,1080,1350);bg.addColorStop(0,'#172c36');bg.addColorStop(1,'#020617');ctx.fillStyle=bg;ctx.fillRect(0,0,1080,1350);
  ctx.strokeStyle='#c6ff00';ctx.lineWidth=5;ctx.strokeRect(45,45,990,1260);
  const text=(s:string,x:number,y:number,size:number,color='#f8fafc',weight=700)=>{ctx.fillStyle=color;ctx.font=`${weight} ${size}px sans-serif`;ctx.fillText(s,x,y);};
  text('SPORTBUDDY78',90,140,44,'#c6ff00');text('МОЯ ПРОБЕЖКА',90,235,55);
  let titleSize=42;ctx.font=`700 ${titleSize}px sans-serif`;while(ctx.measureText(title).width>900&&titleSize>24){titleSize--;ctx.font=`700 ${titleSize}px sans-serif`;}
  text(title,90,310,titleSize);text(new Date(result.endedAt).toLocaleDateString('ru-RU'),90,365,27,'#94a3b8',400);
  text((result.distanceM/1000).toFixed(2).replace('.',','),80,610,170,'#c6ff00');text('ДИСТАНЦИЯ ПО GPS · КМ',90,670,30,'#cbd5e1');
  ctx.fillStyle='#ffffff12';ctx.fillRect(85,740,910,185);
  text(duration(result.elapsedMs),110,825,62);text('ПОЛНОЕ ВРЕМЯ',110,880,24,'#94a3b8');
  text(pace,670,825,62);text('МИН / КМ',670,880,24,'#94a3b8');
  text('Каждая пробежка — твой результат.',90,1010,34);
  text(status,90,1095,28,'#cbd5e1',400);
  text('Время включает паузы',90,1150,26,'#94a3b8',400);
  text('sportbuddy78.pro',90,1250,30,'#c6ff00');
  setImage(canvas.toDataURL('image/png'));
 },[result,title,status,pace]);
 async function share(){
  try{
   if(hasBackgroundRecorder()){await runningRecorder.shareCard({data:image.split(',')[1]!});return;}
   const blob=await (await fetch(image)).blob();const file=new File([blob],'sportbuddy-run.png',{type:'image/png'});
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Моя пробежка — SportBuddy78'});return;}
   const link=document.createElement('a');link.href=image;link.download='sportbuddy-run.png';link.click();setMessage('Карточка подготовлена для скачивания.');
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))setMessage('Не удалось поделиться карточкой. Попробуйте ещё раз.');}
 }
 return <div className="rounded-2xl border border-lime-300/30 p-3 space-y-3" aria-label="Итог пробежки">
  <h3 className="font-bold text-lime-300">{saved?'Пробежка сохранена':'Итог пробежки'}</h3>
  {image&&<img src={image} alt={`${title}: ${(result.distanceM/1000).toFixed(2)} км, ${duration(result.elapsedMs)}, ${pace} мин/км. ${status}`} className="w-full max-w-sm mx-auto rounded-xl"/>}
  <p className="text-xs text-slate-300">{result.reason}</p>
  <button disabled={!image} onClick={()=>void share()} className="rounded-xl bg-lime-300 text-slate-950 px-4 py-2 font-bold">Поделиться результатом</button>
  {message&&<p role="status" className="text-xs text-slate-300">{message}</p>}
 </div>;
}
