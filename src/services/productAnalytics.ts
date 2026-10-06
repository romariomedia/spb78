import { auth } from './firebaseAuth';

const FLUSH_MS=60_000;

export function startProductAnalytics(userId:string):()=>void{
  if(!userId||typeof window==='undefined')return()=>{};
  const sessionId=crypto.randomUUID?.()||`s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  let seq=0,lastVisibleAt=document.visibilityState==='visible'?Date.now():0,lastFlushAt=lastVisibleAt,stopped=false,pending=false;

  const send=async(activeSeconds:number)=>{
    if(stopped||pending)return;
    const user=auth.currentUser;if(!user||user.uid!==userId)return;
    pending=true;
    try{
      const token=await user.getIdToken();
      await fetch('/api/analytics-session',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({sessionId,seq:seq++,activeSeconds}),keepalive:true
      });
    }catch{/* analytics must never block the product */}
    finally{pending=false;}
  };

  void send(0);
  const flush=()=>{
    if(document.visibilityState!=='visible'||!lastVisibleAt)return;
    const now=Date.now(),seconds=Math.max(0,Math.min(90,Math.round((now-lastFlushAt)/1000)));
    lastFlushAt=now;
    if(seconds>0)void send(seconds);
  };
  const timer=window.setInterval(flush,FLUSH_MS);
  const visibility=()=>{
    const now=Date.now();
    if(document.visibilityState==='hidden'){
      if(lastVisibleAt){const seconds=Math.max(0,Math.min(90,Math.round((now-lastFlushAt)/1000)));lastVisibleAt=0;lastFlushAt=now;if(seconds>0)void send(seconds);}
    }else{
      lastVisibleAt=now;lastFlushAt=now;void send(0);
    }
  };
  document.addEventListener('visibilitychange',visibility);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);};
}
