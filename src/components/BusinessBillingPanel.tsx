import {useEffect,useMemo,useState,type ReactNode} from 'react';
import {
  BadgeRussianRuble,BarChart3,CalendarClock,Crown,Download,Eye,FileText,MousePointerClick,
  RefreshCw,Rocket,Save,ShieldCheck,TrendingUp,UserRoundCheck,WalletCards
} from 'lucide-react';
import {
  BUSINESS_OFFER_VERSION,BusinessBillingInterval,BusinessDashboardState,BusinessDashboardSubject,BusinessLegalProfile,
  createBusinessPayment,createBusinessPromotionPayment,downloadBusinessContract,loadBusinessDashboard,saveBusinessLegalProfile
} from '../services/businessBilling';

const formatDate=(value:string)=>{
  if(!value)return '—';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU'):'—';
};
const typeLabel=(item:BusinessDashboardSubject)=>item.subjectType==='trainer'?'Персональный тренер':item.subjectType==='venue'?'Площадка / студия':'Массаж / wellness';
const money=(value:number)=>Number(value||0).toLocaleString('ru-RU')+' ₽';
const eventLabel=(value:string)=>value==='payment'?'Оплата размещения':value==='promotion_payment'?'Продвижение':value==='admin_promotion'?'Бесплатное продвижение':value==='admin_grant'?'Бесплатное продление':value==='admin_paused'?'Размещение приостановлено':value==='admin_resumed'?'Размещение возобновлено':value==='owner_assigned'?'Привязка владельца':value==='owner_unlinked'?'Отвязка владельца':value;

function Metric({label,value,sub,icon}:{label:string;value:string|number;sub:string;icon:ReactNode}){
  return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
    <div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-[10px] font-black uppercase tracking-wider">{label}</span></div>
    <p className="mt-2 text-2xl font-black text-white">{value}</p>
    <p className="mt-1 text-[10px] text-slate-500">{sub}</p>
  </div>;
}

function MiniChart({item}:{item:BusinessDashboardSubject}){
  const rows=item.series.slice(-14);
  const max=Math.max(1,...rows.map(row=>row.views));
  return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><p className="text-xs font-black text-white">Просмотры · 14 дней</p><p className="text-[10px] text-slate-500">Уникальные авторизованные пользователи в сутки</p></div>
      <BarChart3 size={17} className="text-cyan-300"/>
    </div>
    <div className="flex h-20 items-end gap-1">
      {rows.map(row=><div key={row.day} title={row.day+' · '+row.views} className="min-w-0 flex-1 rounded-t bg-cyan-400/70" style={{height:`${Math.max(5,Math.round(row.views/max*100))}%`}} />)}
    </div>
  </div>;
}

export function BusinessBillingPanel(){
  const [state,setState]=useState<BusinessDashboardState|null>(null);
  const [busy,setBusy]=useState(false),[paying,setPaying]=useState(''),[error,setError]=useState('');
  const [intervals,setIntervals]=useState<Record<string,BusinessBillingInterval>>({});
  const [legalDraft,setLegalDraft]=useState<Omit<BusinessLegalProfile,'ready'|'errors'>|null>(null);
  const [legalSaving,setLegalSaving]=useState(false);
  const [offerAccepted,setOfferAccepted]=useState(false);
  const load=async()=>{setBusy(true);setError('');try{
    const next=await loadBusinessDashboard();setState(next);
    setLegalDraft({
      entityType:next.legalProfile.entityType,legalName:next.legalProfile.legalName,inn:next.legalProfile.inn,
      ogrn:next.legalProfile.ogrn,address:next.legalProfile.address,email:next.legalProfile.email,
      phone:next.legalProfile.phone,representative:next.legalProfile.representative,basis:next.legalProfile.basis
    });
  }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить кабинет партнёра.');}finally{setBusy(false);}};
  useEffect(()=>{void load();},[]);
  const ledger=useMemo(()=>state?.ledger?.slice(0,12)||[],[state?.ledger]);
  const legalReady=state?.legalProfile?.ready===true;
  const saveLegal=async()=>{
    if(!legalDraft)return;setLegalSaving(true);setError('');
    try{
      const profile=await saveBusinessLegalProfile(legalDraft);
      setState(old=>old?{...old,legalProfile:profile}:old);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить реквизиты.');}
    finally{setLegalSaving(false);}
  };
  const downloadContract=async(id:string,number:string)=>{
    setError('');try{await downloadBusinessContract(id,number);}catch(e){setError(e instanceof Error?e.message:'Не удалось скачать договор.');}
  };
  if(!busy&&!error&&state&&state.subjects.length===0)return null;

  const pay=async(item:BusinessDashboardSubject)=>{
    if(!state?.config.billingOpen)return;
    if(!legalReady){setError('Заполните и сохраните реквизиты заказчика для договора.');return;}
    if(!offerAccepted){setError('Перед оплатой примите актуальную оферту SportBuddy78 Business.');return;}
    const interval=intervals[item.subjectType+':'+item.subjectId]||'monthly';
    const key='subscription:'+item.subjectType+':'+item.subjectId;
    setPaying(key);setError('');
    try{
      const payment=await createBusinessPayment(item.subjectType,item.subjectId,interval,offerAccepted);
      if(!payment.confirmationUrl)throw new Error('ЮKassa не вернула ссылку на оплату.');
      window.location.assign(payment.confirmationUrl);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось перейти к оплате.');setPaying('');}
  };
  const promote=async(item:BusinessDashboardSubject)=>{
    if(!state?.config.billingOpen||item.status!=='active')return;
    if(!legalReady){setError('Заполните и сохраните реквизиты заказчика для договора.');return;}
    if(!offerAccepted){setError('Перед оплатой примите актуальную оферту SportBuddy78 Business.');return;}
    const key='promotion:'+item.subjectType+':'+item.subjectId;
    setPaying(key);setError('');
    try{
      const payment=await createBusinessPromotionPayment(item.subjectType,item.subjectId,offerAccepted);
      if(!payment.confirmationUrl)throw new Error('ЮKassa не вернула ссылку на оплату.');
      window.location.assign(payment.confirmationUrl);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось включить продвижение.');setPaying('');}
  };

  return <section className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 to-slate-950 p-4 sm:p-5 space-y-4">
    <div className="flex items-start gap-3">
      <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><WalletCards size={23}/></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-widest text-cyan-300">SportBuddy78 · Business</p>
        <h3 className="mt-1 text-lg font-bold text-white">Кабинет партнёра</h3>
        <p className="mt-1 text-sm text-slate-400">Статистика, подписка, оплаты и продвижение ваших коммерческих карточек.</p>
      </div>
      <button disabled={busy} onClick={()=>void load()} className="rounded-xl p-2 text-slate-400 hover:text-white disabled:opacity-40" aria-label="Обновить кабинет"><RefreshCw size={17} className={busy?'animate-spin':''}/></button>
    </div>

    {!state?.config.billingOpen&&<div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-3">
      <p className="text-sm font-bold text-lime-200">Бета-период · размещение бесплатно</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">Кабинет и статистика уже работают. Реальная оплата подписок и продвижения заблокирована сервером до 1 января 2027 года и запускается отдельным переключателем администратора.</p>
    </div>}

    {state&&legalDraft&&<div className="rounded-2xl border border-cyan-400/20 bg-slate-950 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><FileText size={18}/></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-white">Реквизиты для договоров и чеков</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Заполняются один раз. После успешной оплаты SportBuddy78 автоматически фиксирует договор с этими реквизитами.</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${legalReady?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>{legalReady?'ГОТОВО':'НУЖНО ЗАПОЛНИТЬ'}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={legalDraft.entityType} onChange={e=>setLegalDraft({...legalDraft,entityType:e.target.value as BusinessLegalProfile['entityType']})} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white">
          <option value="">Статус заказчика</option>
          <option value="ip">ИП</option>
          <option value="self_employed">Самозанятый / НПД</option>
          <option value="legal_entity">Юридическое лицо</option>
        </select>
        <input value={legalDraft.legalName} onChange={e=>setLegalDraft({...legalDraft,legalName:e.target.value})} placeholder="ФИО / полное наименование" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        <input value={legalDraft.inn} onChange={e=>setLegalDraft({...legalDraft,inn:e.target.value})} placeholder="ИНН" inputMode="numeric" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        <input value={legalDraft.ogrn} onChange={e=>setLegalDraft({...legalDraft,ogrn:e.target.value})} placeholder="ОГРН / ОГРНИП (если применимо)" inputMode="numeric" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        <input value={legalDraft.email} onChange={e=>setLegalDraft({...legalDraft,email:e.target.value})} placeholder="E-mail для договора и чека" type="email" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        <input value={legalDraft.phone} onChange={e=>setLegalDraft({...legalDraft,phone:e.target.value})} placeholder="Телефон (необязательно)" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        <input value={legalDraft.address} onChange={e=>setLegalDraft({...legalDraft,address:e.target.value})} placeholder="Юридический / почтовый адрес" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white sm:col-span-2"/>
        {legalDraft.entityType==='legal_entity'&&<>
          <input value={legalDraft.representative} onChange={e=>setLegalDraft({...legalDraft,representative:e.target.value})} placeholder="ФИО подписанта" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
          <input value={legalDraft.basis} onChange={e=>setLegalDraft({...legalDraft,basis:e.target.value})} placeholder="Основание полномочий (Устав / доверенность)" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-white"/>
        </>}
      </div>
      {state.legalProfile.errors?.length>0&&<div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">{state.legalProfile.errors.join(' · ')}</div>}
      <button type="button" disabled={legalSaving} onClick={()=>void saveLegal()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:opacity-50">
        <Save size={16}/>{legalSaving?'Сохраняем…':'Сохранить реквизиты'}
      </button>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <input type="checkbox" checked={offerAccepted} onChange={e=>setOfferAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 accent-lime-300"/>
        <span className="text-[11px] leading-relaxed text-slate-300"><b className="text-white">Принимаю договор-оферту SportBuddy78 Business</b> редакции {BUSINESS_OFFER_VERSION}. Понимаю, что акцепт фиксируется в авторизованном кабинете, а после оплаты формируется индивидуальный договор.</span>
      </label>
    </div>}
    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-sm text-rose-200">{error}</p>}
    {busy&&!state&&<p role="status" className="text-sm text-slate-400">Загружаем кабинет…</p>}

    <div className="space-y-4">{state?.subjects.map(item=>{
      const id=item.subjectType+':'+item.subjectId;
      const plan=state.config.plans[item.subjectType];
      const promo=state.config.promotions[item.subjectType];
      const interval=intervals[id]||'monthly';
      const price=interval==='monthly'?plan.monthlyRub:plan.yearlyRub;
      const active=item.status==='active';
      const paused=item.status==='paused';
      return <article key={id} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{typeLabel(item)}</p>
            <p className="mt-1 truncate text-lg font-black text-white">{item.subjectLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.isPromoted&&<span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2 py-1 text-[10px] font-black text-fuchsia-200">🚀 ПРОДВИГАЕТСЯ</span>}
            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${paused?'bg-rose-500/15 text-rose-300':active?'bg-emerald-500/15 text-emerald-300':'bg-slate-800 text-slate-400'}`}>{paused?'РАЗМЕЩЕНИЕ ПРИОСТАНОВЛЕНО':active?'РАЗМЕЩЕНИЕ АКТИВНО':'БЕСПЛАТНЫЙ РЕЖИМ'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Просмотры" value={item.metrics.total30.views} sub={`7 дней: ${item.metrics.total7.views}`} icon={<Eye size={14}/>}/>
          <Metric label="Переходы" value={item.metrics.total30.clicks} sub={`CTR: ${item.metrics.clickRate30}%`} icon={<MousePointerClick size={14}/>}/>
          <Metric label="Лиды" value={item.metrics.total30.leads} sub={`7 дней: ${item.metrics.total7.leads}`} icon={<UserRoundCheck size={14}/>}/>
          <Metric label="Конверсия" value={item.metrics.conversion30+'%'} sub="лид / просмотр" icon={<TrendingUp size={14}/>}/>
        </div>
        <MiniChart item={item}/>

        {item.foundingCoachFreeUntil&&<div className="flex items-center gap-2 rounded-xl border border-lime-300/20 bg-lime-300/5 p-2.5 text-xs text-lime-200"><Crown size={15}/>Founding Coach · бесплатное размещение до {formatDate(item.foundingCoachFreeUntil)}</div>}
        {paused&&<div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-200">Размещение временно приостановлено администратором.{item.adminPausedReason?' Причина: '+item.adminPausedReason:''}</div>}
        {active&&<div className="flex items-center gap-2 text-xs text-slate-300"><CalendarClock size={15} className="text-emerald-400"/>Размещение активно до <b className="text-white">{formatDate(item.activeUntil)}</b></div>}
        {item.isPromoted&&<div className="flex items-center gap-2 text-xs text-fuchsia-200"><Rocket size={15}/>Приоритетное размещение до <b>{formatDate(item.promotedUntil)}</b></div>}

        <div className="grid grid-cols-2 gap-2">
          {(['monthly','yearly'] as const).map(value=><button key={value} type="button" onClick={()=>setIntervals(old=>({...old,[id]:value}))} className={`rounded-xl border p-2.5 text-left ${interval===value?'border-cyan-400/50 bg-cyan-400/10':'border-slate-800 bg-slate-950'}`}>
            <span className="block text-[10px] uppercase text-slate-500">{value==='monthly'?'1 месяц':'12 месяцев'}</span>
            <span className="mt-1 block text-sm font-black text-white">{(value==='monthly'?plan.monthlyRub:plan.yearlyRub).toLocaleString('ru-RU')} ₽</span>
          </button>)}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button disabled={!state.config.billingOpen||!legalReady||!offerAccepted||paused||paying==='subscription:'+id||price<=0} onClick={()=>void pay(item)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">
            <BadgeRussianRuble size={17}/>{paused?'Размещение приостановлено':paying==='subscription:'+id?'Переход к ЮKassa…':!state.config.billingOpen?'Оплата откроется в 2027':active?'Продлить размещение':'Оформить размещение'}
          </button>
          <button disabled={!state.config.billingOpen||!legalReady||!offerAccepted||!active||paying==='promotion:'+id||promo.priceRub<=0} onClick={()=>void promote(item)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-3 text-sm font-black text-fuchsia-200 disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600">
            <Rocket size={17}/>{paying==='promotion:'+id?'Переход к ЮKassa…':`Продвинуть на 7 дней · ${promo.priceRub.toLocaleString('ru-RU')} ₽`}
          </button>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-500">Продвижение поднимает коммерческую карточку выше обычных карточек в соответствующем каталоге. Метрики считаются по взаимодействиям внутри SportBuddy78 и не являются гарантией покупки услуги.</p>
      </article>;
    })}</div>

    {state&&state.subjects.length>0&&<div className="grid grid-cols-2 gap-2">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase text-slate-500">Оплачено за размещение</p><p className="mt-1 text-lg font-black text-white">{money(state.finance.paidRub)}</p></div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3"><p className="text-[10px] uppercase text-slate-500">Оплачено за продвижение</p><p className="mt-1 text-lg font-black text-white">{money(state.finance.promotionRub)}</p></div>
    </div>}

    {state&&state.contracts.length>0&&<div className="rounded-2xl border border-emerald-400/20 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><p className="text-sm font-black text-white">Договоры SportBuddy78 Business</p><p className="mt-1 text-[10px] text-slate-500">Формируются сервером после подтвержденной оплаты YooKassa.</p></div>
        <ShieldCheck size={18} className="text-emerald-300"/>
      </div>
      <div className="space-y-2">{state.contracts.map(contract=><div key={contract.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white">Договор № {contract.contractNumber}</p>
          <p className="mt-1 text-[10px] text-slate-500">{contract.subjectLabel} · {contract.createdAt?new Date(contract.createdAt).toLocaleDateString('ru-RU'):'—'} · {money(contract.amountRub)}</p>
        </div>
        <button type="button" onClick={()=>void downloadContract(contract.id,contract.contractNumber)} className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-black text-emerald-200">
          <Download size={15}/>Скачать договор
        </button>
      </div>)}</div>
    </div>}

    {ledger.length>0&&<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-black text-white">История операций</p><span className="text-[10px] text-slate-500">последние {ledger.length}</span></div>
      <div className="space-y-2">{ledger.map(row=><div key={row.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="min-w-0"><p className="truncate text-xs font-bold text-white">{row.subjectLabel||'Коммерческая услуга'}</p><p className="mt-1 text-[10px] text-slate-500">{eventLabel(row.eventType)} · {row.createdAt?new Date(row.createdAt).toLocaleString('ru-RU'):'—'}</p></div>
        <span className="shrink-0 text-xs font-black text-lime-300">{Number(row.amountRub||0)>0?money(Number(row.amountRub)):row.days?row.days+' дн.':'—'}</span>
      </div>)}</div>
    </div>}
  </section>;
}
