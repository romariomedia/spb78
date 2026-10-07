import { useEffect,useMemo,useState } from 'react';
import { Activity,Clock3,RefreshCw,Repeat2,TimerReset,TrendingDown,TrendingUp,UserPlus,Users } from 'lucide-react';
import { AdminAnalyticsData,loadAdminAnalytics } from '../services/adminAnalytics';

function shortDay(day:string){const d=new Date(day+'T12:00:00Z');return d.toLocaleDateString('ru-RU',{weekday:'short',day:'2-digit'});}
function signed(value:number){return value>0?'+'+value:String(value);}
function Trend({value}:{value:number}){
  if(value===0)return <span className="text-[9px] font-bold text-slate-500">без изменений</span>;
  const Up=value>0?TrendingUp:TrendingDown;
  return <span className={'flex items-center gap-1 text-[9px] font-black '+(value>0?'text-emerald-300':'text-rose-300')}><Up className="h-3 w-3"/>{signed(value)}</span>;
}
function MetricCard({title,value,subtitle,icon:Icon,trend}:{title:string;value:string;subtitle:string;icon:typeof Activity;trend?:number}){
  return <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-slate-500">{title}</p><p className="mt-2 text-2xl font-black tracking-tight text-white">{value}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5"/></div></div>
    <div className="mt-2 flex items-center justify-between gap-2"><p className="text-[9px] leading-relaxed text-slate-500">{subtitle}</p>{trend!==undefined&&<Trend value={trend}/>}</div>
  </article>;
}

export function AdminAnalyticsPanel(){
  const [data,setData]=useState<AdminAnalyticsData|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const refresh=async()=>{setLoading(true);setError('');setData(null);try{setData(await loadAdminAnalytics());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить аналитику');}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[]);
  const maxChart=useMemo(()=>Math.max(1,...(data?.daily||[]).flatMap(x=>[x.registrations,x.dau])),[data]);
  const retention=data?.metrics.retentionD7;
  const trackingLabel=data?.observedWindowStartedAt?new Date(data.observedWindowStartedAt).toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}):'';

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Product Analytics</p><h3 className="mt-1 text-base font-black text-white">Аналитика за неделю</h3><p className="mt-1 text-[10px] text-slate-500">Регистрации, DAU, D7 retention и реальное активное время</p></div><button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300 disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/></button></div>
    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</div>}
    {data&&<>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Регистраций за 7 дней" value={String(data.metrics.registrations7d)} subtitle={'предыдущие 7 дней: '+data.metrics.registrationsPrev7d} icon={UserPlus} trend={data.metrics.registrationsDelta}/>
        <MetricCard title="DAU" value={String(data.metrics.dau)} subtitle={'активных сегодня · вчера '+data.metrics.dauYesterday} icon={Activity} trend={data.metrics.dauDelta}/>
        <MetricCard title="Retention D7" value={retention===null?'—':retention+'%'} subtitle={data.metrics.retentionCohort?data.metrics.retentionReturned+' из '+data.metrics.retentionCohort+' вернулись на 7-й день · '+data.metrics.retentionDay:'нет данных для завершённой когорты'} icon={Repeat2}/>
        <MetricCard title="Среднее время" value={data.metrics.avgActiveMinutes7d+' мин'} subtitle="на активного пользователя в день · последние 7 дней" icon={Clock3}/>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.6fr_.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black text-white">Динамика 7 дней</p><p className="mt-1 text-[9px] text-slate-500">зелёный — DAU · серый — регистрации</p></div><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-bold text-slate-400">Europe/Moscow</span></div>
          <div className="mt-5 flex h-52 items-end gap-2 sm:gap-3">
            {data.daily.map(point=><div key={point.day} className="flex min-w-0 flex-1 flex-col items-center justify-end"><div className="flex h-40 w-full items-end justify-center gap-1"><div title={'DAU: '+point.dau} className="w-[38%] rounded-t-md bg-emerald-500/80 transition-all" style={{height:Math.max(point.dau?8:2,point.dau/maxChart*100)+'%'}}/><div title={'Регистрации: '+point.registrations} className="w-[38%] rounded-t-md bg-slate-500/70 transition-all" style={{height:Math.max(point.registrations?8:2,point.registrations/maxChart*100)+'%'}}/></div><div className="mt-2 text-center"><p className="text-[8px] font-black text-slate-300">{shortDay(point.day)}</p><p className="mt-0.5 text-[8px] text-slate-600">{point.dau}/{point.registrations}</p></div></div>)}
          </div>
        </div>
        <div className="space-y-3">
          <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center gap-2"><Users className="h-4 w-4 text-emerald-300"/><p className="text-[11px] font-black text-white">WAU</p></div><p className="mt-3 text-2xl font-black text-white">{data.metrics.wau}</p><p className="mt-1 text-[9px] text-slate-500">уникальных активных пользователей за 7 дней</p></article>
          <article className="rounded-2xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-center gap-2"><TimerReset className="h-4 w-4 text-emerald-300"/><p className="text-[11px] font-black text-white">Средняя сессия</p></div><p className="mt-3 text-2xl font-black text-white">{data.metrics.avgSessionMinutes7d} мин</p><p className="mt-1 text-[9px] text-slate-500">активное видимое время / число сессий</p></article>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <p className="text-[11px] font-black text-white">Как считаются показатели</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] font-black text-emerald-300">DAU</p><p className="mt-1 text-[9px] leading-relaxed text-slate-400">Уникальный авторизованный пользователь, открывавший приложение сегодня.</p></div>
          <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] font-black text-emerald-300">Retention D7</p><p className="mt-1 text-[9px] leading-relaxed text-slate-400">Доля пользователей, вернувшихся на 7-й день после регистрации. Используется последний завершённый день по МСК.</p></div>
          <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] font-black text-emerald-300">Среднее время</p><p className="mt-1 text-[9px] leading-relaxed text-slate-400">Только время, когда приложение открыто и вкладка видима. Фоновое время не учитывается.</p></div>
          <div className="rounded-xl bg-slate-900 p-3"><p className="text-[9px] font-black text-emerald-300">Тестовые аккаунты</p><p className="mt-1 text-[9px] leading-relaxed text-slate-400">Их можно исключить из метрик в карточке пользователя, чтобы не искажать продуктовую аналитику.</p></div>
        </div>
        <p className="mt-3 text-[9px] text-slate-600">{trackingLabel?'Первое наблюдение в текущем 14-дневном окне: '+trackingLabel+'. Покрыто дней: '+data.coverageDays+'. Историческое время до запуска трекинга не придумывается.':'Точные данные активности начнут появляться после первого входа пользователей в эту версию приложения.'}</p>
      </div>
    </>}
  </section>;
}