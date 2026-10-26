import {useEffect,useState} from 'react';
import {AdminBusinessCrm} from './AdminBusinessCrm';
import {BadgeRussianRuble,Link2,RefreshCw,Save,ShieldCheck,Unlink,WalletCards} from 'lucide-react';
import {
  AdminBillingState,BusinessSubjectType,assignBusinessOwner,grantBusinessAccess,
  loadAdminBilling,saveAdminBillingConfig,unlinkBusinessOwner
} from '../services/businessBilling';

const input='w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400';
const formatDate=(value:string)=>{
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU'):'—';
};

export function AdminBillingPanel(){
  const [state,setState]=useState<AdminBillingState|null>(null);
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [type,setType]=useState<BusinessSubjectType>('trainer'),[subjectId,setSubjectId]=useState(''),[ownerUserId,setOwnerUserId]=useState('');
  const [days,setDays]=useState(90),[note,setNote]=useState('Бесплатное размещение / решение команды SportBuddy78');

  const load=async()=>{setBusy('load');setError('');try{setState(await loadAdminBilling());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить экономику.');}finally{setBusy('');}};
  useEffect(()=>{void load();},[]);
  const run=async(key:string,fn:()=>Promise<void>)=>{setBusy(key);setError('');setNotice('');try{await fn();setNotice('Изменение сохранено.');await load();}catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить изменение.');}finally{setBusy('');}};

  const saveConfig=()=>run('config',async()=>{
    if(!state)return;
    const config=await saveAdminBillingConfig(state.config);
    setState(old=>old?{...old,config}:old);
  });
  const linkOwner=()=>run('owner',async()=>{
    if(!subjectId.trim()||!ownerUserId.trim())throw new Error('Укажите ID объекта и UID владельца.');
    await assignBusinessOwner(type,subjectId.trim(),ownerUserId.trim(),'Привязка владельца из админки');
  });
  const grant=()=>run('grant',async()=>{
    if(!subjectId.trim())throw new Error('Укажите ID объекта.');
    await grantBusinessAccess(type,subjectId.trim(),days,note.trim());
  });
  const unlink=()=>run('unlink',async()=>{
    if(!subjectId.trim())throw new Error('Укажите ID объекта.');
    await unlinkBusinessOwner(type,subjectId.trim(),'Отвязка владельца из админки');
  });

  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-black uppercase tracking-[.18em] text-lime-300">Экономика SportBuddy78</p>
        <h3 className="mt-1 text-base font-black text-white">Подписки бизнеса и YooKassa</h3>
        <p className="mt-1 text-xs text-slate-500">Цены, владельцы коммерческих карточек и бесплатные продления.</p>
      </div>
      <button disabled={busy==='load'} onClick={()=>void load()} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 disabled:opacity-50"><RefreshCw size={16} className={busy==='load'?'animate-spin':''}/></button>
    </div>

    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}
    {notice&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</div>}

    {state&&<>
      <AdminBusinessCrm state={state} onReload={load}/>

      <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4">
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-lime-300"/><p className="text-sm font-black text-white">Защита запуска 2027</p></div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Даже если включить переключатель сейчас, создание B2B-платежей заблокировано сервером до 01.01.2027. Это позволяет заранее настроить тарифы и проверить интерфейс.</p>
        <label className="mt-3 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div><p className="text-sm font-black text-white">Коммерческие подписки</p><p className="text-xs text-slate-500">Разрешить оплату после даты коммерческого запуска</p></div>
          <input type="checkbox" checked={state.config.enabled} onChange={e=>setState({...state,config:{...state.config,enabled:e.target.checked}})} className="h-5 w-5 accent-lime-400"/>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="mb-3 flex items-center gap-2"><BadgeRussianRuble size={17} className="text-lime-300"/><p className="text-sm font-black text-white">Тарифы</p></div>
        <div className="space-y-3">{(['trainer','venue','massage'] as const).map(key=>{
          const plan=state.config.plans[key];
          const promotion=state.config.promotions[key];
          return <div key={key} className="grid grid-cols-[1fr_100px_100px_100px] items-center gap-2 rounded-xl bg-slate-900 p-3">
            <div><p className="text-xs font-black text-white">{plan.label}</p><p className="text-[10px] text-slate-500">{key}</p></div>
            <label className="text-[10px] text-slate-500">Месяц, ₽<input type="number" min="0" max="1000000" value={plan.monthlyRub} onChange={e=>setState({...state,config:{...state.config,plans:{...state.config.plans,[key]:{...plan,monthlyRub:Number(e.target.value)}}}})} className={input}/></label>
            <label className="text-[10px] text-slate-500">Год, ₽<input type="number" min="0" max="10000000" value={plan.yearlyRub} onChange={e=>setState({...state,config:{...state.config,plans:{...state.config.plans,[key]:{...plan,yearlyRub:Number(e.target.value)}}}})} className={input}/></label>
            <label className="text-[10px] text-slate-500">Продвижение 7 дн., ₽<input type="number" min="0" max="1000000" value={promotion.priceRub} onChange={e=>setState({...state,config:{...state.config,promotions:{...state.config.promotions,[key]:{...promotion,priceRub:Number(e.target.value)}}}})} className={input}/></label>
          </div>;
        })}</div>
        <button disabled={busy==='config'} onClick={()=>void saveConfig()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 py-3 text-sm font-black text-slate-950 disabled:opacity-50"><Save size={16}/>Сохранить тарифы и режим</button>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <div className="flex items-center gap-2"><WalletCards size={17} className="text-cyan-300"/><p className="text-sm font-black text-white">Ручное управление услугой</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          <select value={type} onChange={e=>setType(e.target.value as BusinessSubjectType)} className={input}><option value="trainer">Персональный тренер</option><option value="venue">Площадка / студия</option><option value="massage">Массаж / wellness</option></select>
          <div>
            <input list="billing-subjects" value={subjectId} onChange={e=>setSubjectId(e.target.value)} placeholder={type==='trainer'?'UID тренера':'ID карточки'} className={input}/>
            <datalist id="billing-subjects">{(state.catalog?.[type]||[]).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
          </div>
          <input value={ownerUserId} onChange={e=>setOwnerUserId(e.target.value)} placeholder="UID владельца" className={input}/>
        </div>
        <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
          <label className="text-[10px] text-slate-500">Продлить на дней<input type="number" min="1" max="730" value={days} onChange={e=>setDays(Number(e.target.value))} className={input}/></label>
          <label className="text-[10px] text-slate-500">Причина / комментарий<input value={note} onChange={e=>setNote(e.target.value)} maxLength={300} className={input}/></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <button disabled={Boolean(busy)} onClick={()=>void linkOwner()} className="flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 py-2.5 text-xs font-black text-cyan-200 disabled:opacity-50"><Link2 size={15}/>Привязать владельца</button>
          <button disabled={Boolean(busy)} onClick={()=>void grant()} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50"><BadgeRussianRuble size={15}/>Продлить бесплатно</button>
          <button disabled={Boolean(busy)} onClick={()=>void unlink()} className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 py-2.5 text-xs font-black text-slate-300 disabled:opacity-50"><Unlink size={15}/>Отвязать владельца</button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">Начните вводить ID — браузер предложит найденных подтверждённых тренеров, площадки и массажные карточки. Для тренера ID объекта — его Firebase UID. После привязки владелец увидит услугу в своём профиле и сможет оплачивать/продлевать её самостоятельно после запуска 2027.</p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-white">Журнал экономики</p>
          <span className="text-xs text-slate-500">последние {state.ledger?.length||0}</span>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {(!state.ledger||state.ledger.length===0)&&<p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">Платежей и ручных продлений пока нет.</p>}
          {(state.ledger||[]).map(row=><article key={row.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white">{row.subjectLabel||row.subjectId||'Коммерческая услуга'}</p>
                <p className="mt-1 text-[10px] text-slate-500">{row.eventType} · {row.createdAt?new Date(row.createdAt).toLocaleString('ru-RU'):'—'}</p>
              </div>
              <span className="text-xs font-black text-lime-300">{Number(row.amountRub||0)>0?Number(row.amountRub).toLocaleString('ru-RU')+' ₽':'0 ₽'}</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">{row.months?'Продление: '+row.months+' мес.':row.days?'Продление: '+row.days+' дн.':'Служебное изменение'}{row.activeUntil?' · до '+formatDate(row.activeUntil):''}</div>
            {row.note&&<p className="mt-1 text-[11px] text-slate-500">{row.note}</p>}
          </article>)}
        </div>
      </div>
    </>}
  </section>;
}
