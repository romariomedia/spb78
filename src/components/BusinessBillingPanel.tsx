import {useEffect,useState} from 'react';
import {BadgeRussianRuble,CalendarClock,Crown,RefreshCw,WalletCards} from 'lucide-react';
import {
  BusinessBillingInterval,BusinessBillingState,BusinessSubscription,
  createBusinessPayment,loadBusinessBilling
} from '../services/businessBilling';

const formatDate=(value:string)=>{
  if(!value)return '—';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU'):'—';
};
const typeLabel=(item:BusinessSubscription)=>item.subjectType==='trainer'?'Персональный тренер':item.subjectType==='venue'?'Площадка / студия':'Массаж / wellness';

export function BusinessBillingPanel(){
  const [state,setState]=useState<BusinessBillingState|null>(null);
  const [busy,setBusy]=useState(false),[paying,setPaying]=useState(''),[error,setError]=useState('');
  const [intervals,setIntervals]=useState<Record<string,BusinessBillingInterval>>({});
  const load=async()=>{setBusy(true);setError('');try{setState(await loadBusinessBilling());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить подписки.');}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  if(!busy&&!error&&state&&state.subjects.length===0)return null;

  const pay=async(item:BusinessSubscription)=>{
    if(!state?.config.billingOpen)return;
    const interval=intervals[item.subjectType+':'+item.subjectId]||'monthly';
    const key=item.subjectType+':'+item.subjectId;
    setPaying(key);setError('');
    try{
      const payment=await createBusinessPayment(item.subjectType,item.subjectId,interval);
      if(!payment.confirmationUrl)throw new Error('ЮKassa не вернула ссылку на оплату.');
      window.location.assign(payment.confirmationUrl);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось перейти к оплате.');setPaying('');}
  };

  return <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-5 space-y-4">
    <div className="flex items-start gap-3">
      <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><WalletCards size={23}/></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-cyan-300">Бизнес в SportBuddy78</p>
        <h3 className="mt-1 text-lg font-bold text-white">Коммерческие подписки</h3>
        <p className="mt-1 text-sm text-slate-400">Управление размещением тренера, площадки или wellness-партнёра.</p>
      </div>
      <button disabled={busy} onClick={()=>void load()} className="rounded-xl p-2 text-slate-400 hover:text-white disabled:opacity-40" aria-label="Обновить подписки"><RefreshCw size={17} className={busy?'animate-spin':''}/></button>
    </div>

    {!state?.config.billingOpen&&<div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-3">
      <p className="text-sm font-bold text-lime-200">Сейчас размещение бесплатно</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">Платный режим не может начать списания раньше 1 января 2027 года и дополнительно включается администратором. Тарифы уже можно подготовить и протестировать без оплаты.</p>
    </div>}
    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</p>}
    {busy&&!state&&<p role="status" className="text-sm text-slate-400">Загружаем подписки…</p>}

    <div className="space-y-3">{state?.subjects.map(item=>{
      const id=item.subjectType+':'+item.subjectId;
      const plan=state.config.plans[item.subjectType];
      const interval=intervals[id]||'monthly';
      const price=interval==='monthly'?plan.monthlyRub:plan.yearlyRub;
      const active=item.status==='active';
      return <article key={id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{typeLabel(item)}</p>
            <p className="mt-1 truncate font-black text-white">{item.subjectLabel}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-black ${active?'bg-emerald-500/15 text-emerald-300':'bg-slate-800 text-slate-400'}`}>{active?'АКТИВНО':'БЕСПЛАТНЫЙ РЕЖИМ'}</span>
        </div>
        {item.foundingCoachFreeUntil&&<div className="mt-3 flex items-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/5 p-2.5 text-xs text-lime-200"><Crown size={15}/>Founding Coach · бесплатное размещение до {formatDate(item.foundingCoachFreeUntil)}</div>}
        {active&&<div className="mt-3 flex items-center gap-2 text-xs text-slate-300"><CalendarClock size={15} className="text-emerald-400"/>Размещение активно до <b className="text-white">{formatDate(item.activeUntil)}</b></div>}

        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['monthly','yearly'] as const).map(value=><button key={value} type="button" onClick={()=>setIntervals(old=>({...old,[id]:value}))} className={`rounded-xl border p-2.5 text-left ${interval===value?'border-cyan-400/50 bg-cyan-400/10':'border-slate-800 bg-slate-900'}`}>
            <span className="block text-[10px] uppercase text-slate-500">{value==='monthly'?'1 месяц':'12 месяцев'}</span>
            <span className="mt-1 block text-sm font-black text-white">{(value==='monthly'?plan.monthlyRub:plan.yearlyRub).toLocaleString('ru-RU')} ₽</span>
          </button>)}
        </div>
        <button disabled={!state.config.billingOpen||paying===id||price<=0} onClick={()=>void pay(item)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-sm font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">
          <BadgeRussianRuble size={17}/>{paying===id?'Переход к ЮKassa…':!state.config.billingOpen?'Оплата откроется в 2027':active?'Продлить размещение':'Оформить размещение'}
        </button>
      </article>;
    })}</div>
  </section>;
}
