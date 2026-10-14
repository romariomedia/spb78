/** Native HTTP cannot stream NDJSON. Poll only while visible, with no overlap. */
export function pollNotificationInbox<T>({read,isCurrent,isVisible,onData,onError}: {
  read:()=>Promise<T[]>;isCurrent:()=>boolean;isVisible:()=>boolean;
  onData:(items:T[])=>void;onError:(failed:boolean)=>void;
}) {
  let stopped=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  async function refresh(){
    if(stopped)return;
    try{
      if(isCurrent()&&isVisible()){
        const items=await read();
        if(!stopped&&isCurrent()){onData(items);onError(false);}
      }
    }catch{if(!stopped&&isCurrent())onError(true);}
    finally{if(!stopped)timer=setTimeout(()=>void refresh(),15000);}
  }
  void refresh();
  return()=>{stopped=true;clearTimeout(timer);};
}
