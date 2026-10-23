import {AvatarImage} from './AvatarImage';
import {useEffect,useRef,useState} from 'react';
import {ChevronDown,MessageCircle,ArrowUpRight} from 'lucide-react';
import {callServer} from '../services/serverApi';
import {TabType} from '../lib/types';
import {createAssistantRequests} from '../services/assistantRequests.js';
type Topic={id:string;label:string;text:string;target:string};
type Payload={enabled:boolean;state?:{welcomeRead:boolean;muted:boolean;history:{id:string;topicId:string;at:number}[]};topics?:Topic[]};
export default function OnboardingAssistant({visible,onNavigate}:{visible:boolean;onNavigate:(tab:TabType,topicId?:string)=>void}){
 const [data,setData]=useState<Payload|null>(null),[expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=useRef<{topicId:string;requestId:string}|null>(null);
 const requests=useRef<ReturnType<typeof createAssistantRequests<Payload>>|null>(null);
 useEffect(()=>{
  const client=createAssistantRequests<Payload>(body=>callServer<Payload>('/api/onboarding-assistant',body),{
   busy:setBusy,error:setError,result:(value,body)=>{setData(value);if(body.action==='ask')pending.current=null;}
  });
  requests.current=client;void client.run({action:'state'});
  return()=>{client.dispose();if(requests.current===client)requests.current=null;};
 },[]);
 const send=(body:Record<string,unknown>)=>requests.current?.run(body);
 function open(){setExpanded(true);onNavigate('chats');void send({action:'read'});}
 const state=data?.state;
 if(data?.enabled===false)return null;
 if(!visible && !error && (!state||state.welcomeRead||state.muted))return null;
 return <section aria-label="Виртуальный помощник SportBuddy" className="mb-4 rounded-3xl border border-lime-300/25 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 p-4 sm:p-5 shadow-lg">
  <div className="flex items-center gap-3">
   <AvatarImage src="/assistants/alina-avatar.jpg" alt="Алина — виртуальный помощник SportBuddy" width={56} height={56} decoding="async" className="h-14 w-14 shrink-0 rounded-2xl border border-lime-300/50 bg-slate-800 object-cover object-[50%_18%] shadow-[0_0_16px_rgba(190,242,100,0.12)]" />
   <div className="min-w-0 flex-1"><h3 className="font-bold text-white">Алина · SportBuddy</h3><p className="text-xs text-lime-300">Виртуальный помощник · готовые ответы</p></div>
   <button type="button" disabled={busy||!state} onClick={()=>expanded?setExpanded(false):open()} aria-expanded={expanded} className="rounded-xl bg-slate-800 p-3 text-lime-300 disabled:opacity-50" aria-label={expanded?'Свернуть помощника':'Открыть помощника'}>{expanded?<ChevronDown/>:<MessageCircle/>}</button>
  </div>
  {!state?.muted && (!state?.welcomeRead||expanded)&&<p className="mt-4 text-sm leading-relaxed text-slate-200">Привет! Я Алина, виртуальный помощник SportBuddy 💚 Помогу освоиться и найти занятие по душе. Что тебе сейчас интереснее?</p>}
  {!expanded&&!state?.welcomeRead&&state&&!state.muted&&<button disabled={busy} onClick={open} className="mt-3 rounded-xl bg-lime-300 px-4 py-3 font-bold text-slate-950">Познакомиться с проектом</button>}
  {expanded&&state&&!state.muted&&<>
   <div className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto" aria-live="polite">{state.history.map(entry=>{const topic=data?.topics?.find(t=>t.id===entry.topicId);if(!topic)return null;return <div key={entry.id} className="space-y-2"><p className="ml-6 rounded-2xl bg-lime-300/10 p-3 text-sm text-lime-100">{topic.label}</p><div className="mr-3 rounded-2xl bg-slate-800/70 p-3 text-sm leading-relaxed text-slate-200"><p>{topic.text}</p>{topic.target==='support'?<a className="mt-3 inline-block text-lime-300 underline" href="mailto:support@sportbuddy78.ru">Написать в поддержку</a>:<button onClick={()=>onNavigate(topic.target as TabType,topic.id)} className="mt-3 flex items-center gap-2 font-bold text-lime-300">Открыть раздел <ArrowUpRight size={16}/></button>}</div></div>;})}</div>
   <div className="mt-4 grid gap-2 sm:grid-cols-2">{data?.topics?.map(topic=><button key={topic.id} disabled={busy} onClick={()=>{if(!pending.current||pending.current.topicId!==topic.id)pending.current={topicId:topic.id,requestId:crypto.randomUUID()};void send({action:'ask',...pending.current});}} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-left text-sm text-slate-100 hover:border-lime-300 disabled:opacity-50">{topic.label}</button>)}</div>
   <p className="mt-3 text-xs text-slate-400">Здесь ответы по кнопкам. Для личного вопроса выбери «Нужна помощь человека».</p>
  </>}
  {state&&visible&&<button disabled={busy} onClick={()=>void send({action:'mute',muted:!state.muted})} className="mt-3 text-xs text-slate-400 underline">{state.muted?'Включить помощника':'Отключить сообщения помощника'}</button>}
  {state&&!visible&&<button disabled={busy} onClick={()=>void send({action:'read'})} className="ml-3 text-xs text-slate-400 underline">Позже</button>}
  {error&&<div role="status" className="mt-3 text-sm text-amber-200">{error}<button disabled={busy} onClick={()=>void requests.current?.retry()} className="ml-2 underline">Повторить</button></div>}
 </section>;
}
