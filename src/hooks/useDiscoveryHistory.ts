import {useEffect,useMemo,useState} from 'react';
const TTL=24*60*60*1000;
const key=(uid:string)=>'sportbuddy_swipes_v2:'+uid;
type Entries=Record<string,number>;
function read(uid:string):Entries{
  if(!uid)return {};
  try{const raw=JSON.parse(localStorage.getItem(key(uid))||'{}');return Object.fromEntries(Object.entries(raw).filter(([,at])=>typeof at==='number'&&at<=Date.now()&&Date.now()-at<TTL)) as Entries;}catch{return {};}
}
export function useDiscoveryHistory(uid:string){
  const loaded=useMemo(()=>read(uid),[uid]);
  const [state,setState]=useState({owner:uid,entries:loaded});
  const [last,setLast]=useState<{owner:string;id:string}|null>(null);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[]);
  const entries=state.owner===uid?state.entries:loaded;
  const ids=Object.keys(entries).filter(id=>now-Number(entries[id])<TTL);
  function save(next:Entries){setState({owner:uid,entries:next});try{localStorage.setItem(key(uid),JSON.stringify(next));}catch{}}
  function hide(id:string,skipped=false){save({...entries,[id]:Date.now()});setLast(skipped?{owner:uid,id}:null);}
  function undo(){if(last?.owner===uid){const next={...entries};delete next[last.id];save(next);setLast(null);}}
  function clear(){save({});setLast(null);}
  return {ids,hide,undo,clear,canUndo:last?.owner===uid&&ids.includes(last.id)};
}
