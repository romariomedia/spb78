import {useEffect,useState} from 'react';
import {FileSearch,RefreshCw,Send,Shield} from 'lucide-react';
import {createPrivacyRequest,loadPrivacyRequests,PrivacyRequest,PrivacyRequestType,PrivacyCursor} from '../services/privacyRequests';

const TYPES:Array<{id:PrivacyRequestType;label:string}>=[
  {id:'access',label:'Получить сведения об обработке моих данных'},
  {id:'correction',label:'Уточнить / исправить персональные данные'},
  {id:'restriction',label:'Ограничить или заблокировать обработку'},
  {id:'stop_processing',label:'Прекратить обработку в указанной части'},
  {id:'deletion',label:'Удалить аккаунт / данные, которые можно удалить'},
  {id:'other',label:'Другой запрос по персональным данным'}
];
const typeLabel=(id:string)=>TYPES.find(x=>x.id===id)?.label||id;

export function PrivacyRightsPanel(){
  const [cursor,setCursor]=useState<PrivacyCursor|null>(null);
  const [items,setItems]=useState<PrivacyRequest[]>([]);
  const [type,setType]=useState<PrivacyRequestType>('access');
  const [details,setDetails]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async(more=false)=>{setBusy(true);setError('');try{const page=await loadPrivacyRequests(more?cursor:null);setItems(old=>more?[...old,...page.requests.filter(row=>!old.some(x=>x.id===row.id))]:page.requests);setCursor(page.nextCursor);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить запросы.');}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const submit=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const request=await createPrivacyRequest(type,details);
      setItems(old=>[request,...old]);setDetails('');
      setNotice('Запрос зарегистрирован. Он сохранён с датой и статусом для обработки оператором.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось отправить запрос.');}
    finally{setBusy(false);}
  };
  return <section className="rounded-3xl border border-violet-400/20 bg-slate-900 p-4 space-y-3">
    <div className="flex items-start gap-3">
      <span className="rounded-2xl bg-violet-400/10 p-2.5 text-violet-300"><Shield className="h-5 w-5"/></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-black text-white">Права на персональные данные</p><p className="mt-1 text-[10px] leading-relaxed text-slate-500">Запрос фиксируется сервером. Удаление не уничтожает автоматически договоры, платежные документы и иные записи, которые оператор обязан хранить по закону.</p></div>
      <button type="button" onClick={()=>void load()} disabled={busy} className="rounded-xl p-2 text-slate-400 disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/></button>
    </div>
    <select value={type} onChange={e=>setType(e.target.value as PrivacyRequestType)} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-xs text-white">
      {TYPES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
    </select>
    <textarea rows={3} maxLength={1200} value={details} onChange={e=>setDetails(e.target.value)}
      placeholder="Дополнительное описание: какие данные или действия вас интересуют"
      className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 outline-none focus:border-violet-400"/>
    <button type="button" disabled={busy||(type==='other'&&details.trim().length<10)} onClick={()=>void submit()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-400 px-3 text-xs font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500"><Send className="h-4 w-4"/>Зарегистрировать запрос</button>
    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-[10px] text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[10px] text-emerald-200">{notice}</p>}
    {items.length>0&&<div className="space-y-2 border-t border-slate-800 pt-3">
      <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-violet-300"/><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Мои запросы</p></div>
      {items.map(item=><div key={item.id} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-bold text-white">{typeLabel(item.type)}</p><span className="rounded-full bg-slate-800 px-2 py-0.5 text-[8px] font-black text-slate-300">{item.status}</span></div>
        <p className="mt-1 text-[9px] text-slate-500">{item.createdAt?new Date(item.createdAt).toLocaleString('ru-RU'):'—'}</p>
        {item.responseNote&&<p className="mt-2 text-[10px] leading-relaxed text-slate-300">{item.responseNote}</p>}
      </div>)}
      {cursor&&<button type="button" disabled={busy} onClick={()=>void load(true)} className="min-h-11 w-full rounded-xl border border-violet-400/30 text-sm text-violet-200 disabled:opacity-40">Показать ещё</button>}
    </div>}
  </section>;
}
