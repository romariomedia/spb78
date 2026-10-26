import {useMemo,useState} from 'react';
import {
  Clock3,Crown,Eye,Pause,Play,RefreshCw,Rocket,Search,UserRoundCheck,UsersRound,WalletCards
} from 'lucide-react';
import {
  AdminBillingState,AdminBusinessCRMItem,BusinessSubjectType,grantBusinessAccess,
  grantBusinessPromotion,setBusinessPaused
} from '../services/businessBilling';

type Props={state:AdminBillingState;onReload:()=>Promise<void>};

const formatDate=(value:string)=>{
  if(!value)return '—';
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleDateString('ru-RU'):'—';
};
const money=(value:number)=>Number(value||0).toLocaleString('ru-RU')+' ₽';
const typeLabel=(type:BusinessSubjectType)=>type==='trainer'?'Тренер':type==='venue'?'Площадка':'Wellness';
const isExpiring=(item:AdminBusinessCRMItem)=>{
  const until=Date.parse(item.activeUntil||'');
  const left=until-Date.now();
  return item.status==='active'&&left>0&&left<=30*86400000;
};
const statusLabel=(item:AdminBusinessCRMItem,commercialOpen:boolean)=>{
  if(item.adminPaused)return 'ПРИОСТАНОВЛЕНО';
  if(item.status==='active')return 'АКТИВНО';
  return commercialOpen?'НЕАКТИВНО':'БЕТА · БЕСПЛАТНО';
};
const statusClass=(item:AdminBusinessCRMItem,commercialOpen:boolean)=>{
  if(item.adminPaused)return 'bg-rose-500/15 text-rose-300';
  if(item.status==='active')return 'bg-emerald-500/15 text-emerald-300';
  return commercialOpen?'bg-slate-800 text-slate-400':'bg-lime-300/10 text-lime-200';
};

export function AdminBusinessCrm({state,onReload}:Props){
  const [query,setQuery]=useState('');
  const [type,setType]=useState<'all'|BusinessSubjectType>('all');
  const [status,setStatus]=useState<'all'|'active'|'inactive'|'paused'|'promoted'|'expiring'>('all');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const commercialOpen=state.config.enabled===true&&Date.now()>=Date.parse(state.config.commercialLaunchAt);

  const rows=useMemo(()=>{
    const needle=query.trim().toLocaleLowerCase('ru-RU');
    return state.items.filter(item=>{
      if(type!=='all'&&item.subjectType!==type)return false;
      if(status==='active'&&item.status!=='active')return false;
      if(status==='inactive'&&item.status!=='inactive')return false;
      if(status==='paused'&&!item.adminPaused)return false;
      if(status==='promoted'&&!item.isPromoted)return false;
      if(status==='expiring'&&!isExpiring(item))return false;
      if(!needle)return true;
      return [item.subjectLabel,item.subjectId,item.ownerUserId].some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(needle));
    }).sort((a,b)=>{
      const rank=(item:AdminBusinessCRMItem)=>item.adminPaused?0:item.isPromoted?1:isExpiring(item)?2:item.status==='active'?3:4;
      return rank(a)-rank(b)||(a.subjectLabel||a.subjectId).localeCompare(b.subjectLabel||b.subjectId,'ru');
    });
  },[state.items,query,type,status]);

  const totals=useMemo(()=>state.items.reduce((acc,item)=>{
    acc.active+=item.status==='active'?1:0;
    acc.paused+=item.adminPaused?1:0;
    acc.promoted+=item.isPromoted?1:0;
    acc.expiring+=isExpiring(item)?1:0;
    acc.leads+=item.metrics?.total30?.leads||0;
    acc.revenue+=(item.finance?.paidRub||0)+(item.finance?.promotionRub||0);
    return acc;
  },{active:0,paused:0,promoted:0,expiring:0,leads:0,revenue:0}),[state.items]);

  const run=async(key:string,success:string,fn:()=>Promise<unknown>)=>{
    setBusy(key);setError('');setNotice('');
    try{
      await fn();
      setNotice(success);
      await onReload();
    }catch(e){
      setError(e instanceof Error?e.message:'Не удалось выполнить действие.');
    }finally{setBusy('');}
  };

  return <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">SportBuddy78 Business CRM</p>
        <h3 className="mt-1 text-base font-black text-white">Партнёры и коммерческие карточки</h3>
        <p className="mt-1 text-xs text-slate-500">Статусы, лиды, выручка, сроки размещения и быстрые действия команды.</p>
      </div>
      <button disabled={Boolean(busy)} onClick={()=>void onReload()} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-50">
        <RefreshCw size={15}/>Обновить
      </button>
    </div>

    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-200">{error}</div>}
    {notice&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-200">{notice}</div>}

    <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><UsersRound size={15} className="text-cyan-300"/><p className="mt-2 text-xl font-black text-white">{state.items.length}</p><p className="text-[10px] text-slate-500">Карточек в CRM</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><Play size={15} className="text-emerald-300"/><p className="mt-2 text-xl font-black text-white">{totals.active}</p><p className="text-[10px] text-slate-500">Активных</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><Clock3 size={15} className="text-amber-300"/><p className="mt-2 text-xl font-black text-white">{totals.expiring}</p><p className="text-[10px] text-slate-500">Истекают ≤ 30 дней</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><Rocket size={15} className="text-fuchsia-300"/><p className="mt-2 text-xl font-black text-white">{totals.promoted}</p><p className="text-[10px] text-slate-500">В продвижении</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><UserRoundCheck size={15} className="text-lime-300"/><p className="mt-2 text-xl font-black text-white">{totals.leads}</p><p className="text-[10px] text-slate-500">Лидов за 30 дней</p></div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><WalletCards size={15} className="text-lime-300"/><p className="mt-2 text-xl font-black text-white">{money(totals.revenue)}</p><p className="text-[10px] text-slate-500">Выручка по журналу</p></div>
    </div>

    <div className="grid gap-2 lg:grid-cols-[1fr_190px_190px]">
      <label className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по названию, ID или UID владельца" className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-cyan-400"/>
      </label>
      <select value={type} onChange={e=>setType(e.target.value as 'all'|BusinessSubjectType)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
        <option value="all">Все типы</option><option value="trainer">Тренеры</option><option value="venue">Площадки</option><option value="massage">Wellness</option>
      </select>
      <select value={status} onChange={e=>setStatus(e.target.value as typeof status)} className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-400">
        <option value="all">Все статусы</option><option value="active">Активные</option><option value="inactive">Неактивные</option><option value="paused">На паузе</option><option value="promoted">В продвижении</option><option value="expiring">Истекают ≤ 30 дней</option>
      </select>
    </div>

    <div className="space-y-2">
      {rows.length===0&&<p className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-xs text-slate-500">По выбранным фильтрам карточек нет.</p>}
      {rows.map(item=>{
        const key=item.subjectType+':'+item.subjectId;
        const revenue=(item.finance?.paidRub||0)+(item.finance?.promotionRub||0);
        const canPromote=!item.adminPaused&&(!commercialOpen||item.status==='active');
        return <article key={key} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-slate-300">{typeLabel(item.subjectType)}</span>
                <span className={'rounded-full px-2 py-1 text-[10px] font-black '+statusClass(item,commercialOpen)}>{statusLabel(item,commercialOpen)}</span>
                {item.isPromoted&&<span className="rounded-full bg-fuchsia-400/10 px-2 py-1 text-[10px] font-black text-fuchsia-200">🚀 В ПРИОРИТЕТЕ</span>}
                {item.foundingCoachFreeUntil&&<span className="flex items-center gap-1 rounded-full bg-lime-300/10 px-2 py-1 text-[10px] font-black text-lime-200"><Crown size={11}/>FOUNDING</span>}
              </div>
              <p className="mt-2 truncate text-sm font-black text-white">{item.subjectLabel||item.subjectId}</p>
              <p className="mt-1 break-all text-[10px] text-slate-600">{item.subjectId}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-slate-600">Выручка</p>
              <p className="text-sm font-black text-lime-300">{money(revenue)}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Владелец</p><p className="mt-1 truncate text-[11px] font-bold text-slate-200" title={item.ownerUserId||''}>{item.ownerUserId||'не привязан'}</p></div>
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Активно до</p><p className="mt-1 text-[11px] font-bold text-slate-200">{formatDate(item.activeUntil)}</p></div>
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Просмотры · 30 дн.</p><p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-200"><Eye size={12}/>{item.metrics.total30.views}</p></div>
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Лиды · 30 дн.</p><p className="mt-1 text-[11px] font-bold text-slate-200">{item.metrics.total30.leads}</p></div>
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Конверсия</p><p className="mt-1 text-[11px] font-bold text-slate-200">{item.metrics.conversion30}%</p></div>
            <div className="rounded-xl bg-slate-900 p-2"><p className="text-[10px] text-slate-500">Продвижение до</p><p className="mt-1 text-[11px] font-bold text-slate-200">{formatDate(item.promotedUntil)}</p></div>
          </div>

          {item.adminPaused&&<p className="mt-2 rounded-xl border border-rose-500/20 bg-rose-950/20 p-2 text-[11px] text-rose-200">Причина паузы: {item.adminPausedReason||'решение администратора'}</p>}
          {item.foundingCoachFreeUntil&&<p className="mt-2 text-[11px] text-lime-200">Founding Coach бесплатно до {formatDate(item.foundingCoachFreeUntil)}</p>}

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button disabled={Boolean(busy)} onClick={()=>void run('extend:'+key,'Размещение продлено на 30 дней.',()=>grantBusinessAccess(item.subjectType,item.subjectId,30,'CRM: бесплатное продление на 30 дней'))} className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-xs font-black text-emerald-200 disabled:opacity-40">+30 дней бесплатно</button>
            <button disabled={Boolean(busy)||!canPromote} onClick={()=>void run('promo:'+key,'Приоритетное продвижение включено на 7 дней.',()=>grantBusinessPromotion(item.subjectType,item.subjectId,7,'CRM: бесплатное приоритетное продвижение на 7 дней'))} className="flex items-center justify-center gap-2 rounded-xl border border-fuchsia-400/30 bg-fuchsia-400/10 px-3 py-2.5 text-xs font-black text-fuchsia-200 disabled:opacity-40"><Rocket size={14}/>+7 дней приоритет</button>
            <button disabled={Boolean(busy)} onClick={()=>void run('pause:'+key,item.adminPaused?'Карточка возобновлена.':'Карточка приостановлена.',()=>setBusinessPaused(item.subjectType,item.subjectId,!item.adminPaused,item.adminPaused?'CRM: возобновление карточки':'CRM: ручная приостановка администратором'))} className={'flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-black disabled:opacity-40 '+(item.adminPaused?'border-cyan-400/30 bg-cyan-400/10 text-cyan-200':'border-rose-500/30 bg-rose-500/10 text-rose-200')}>
              {item.adminPaused?<Play size={14}/>:<Pause size={14}/>}
              {item.adminPaused?'Возобновить':'Приостановить'}
            </button>
          </div>
        </article>;
      })}
    </div>
  </section>;
}
