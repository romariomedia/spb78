import { useEffect, useState } from 'react';
import { Activity, Building2, CalendarDays, Compass, RefreshCw, ShieldAlert, Users, Dumbbell } from 'lucide-react';
import { loadAdminDashboard, AdminDashboardData } from '../services/adminDashboard';
import { refreshVenues } from '../services/venues';

const cards = [
  ['users','Пользователи',Users],
  ['trainings','Тренировки',Dumbbell],
  ['venues','Площадки',Building2],
  ['leisureEvents','Активный отдых',Compass],
  ['events','События',CalendarDays],
  ['reports','Жалобы',ShieldAlert],
] as const;

export function AdminDashboard() {
  const [data,setData]=useState<AdminDashboardData|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const refresh=async()=>{
    setLoading(true);setError('');
    try{
      const [dashboard,venues]=await Promise.all([loadAdminDashboard(),refreshVenues(true)]);
      setData({...dashboard,counts:{...dashboard.counts,venues:venues.length}});
    }
    catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить обзор');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[]);

  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">SportBuddy78 Control Center</p>
        <h3 className="mt-1 text-base font-black text-white">Обзор платформы</h3>
      </div>
      <button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 disabled:opacity-50" title="Обновить">
        <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>
      </button>
    </div>
    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">{error}</div>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map(([key,label,Icon])=><div key={key} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center gap-2 text-slate-400"><Icon className="h-4 w-4"/><span className="text-[10px] font-bold">{label}</span></div>
        <p className="mt-2 text-xl font-black text-white">{data?.counts[key] ?? '—'}</p>
      </div>)}
    </div>
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-400"/><span className="text-xs font-black text-white">Система</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
        <span>Release</span><span className="truncate text-right font-mono text-slate-200">{data?.release || '—'}</span>
        <span>Push queue</span><span className="text-right font-black text-slate-200">{data?.counts.notificationOutbox ?? '—'}</span>
      </div>
    </div>
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs font-black text-white">Последние регистрации</p>
      <div className="mt-2 space-y-2">
        {(data?.recentUsers||[]).length===0?<p className="text-[11px] text-slate-500">Нет данных</p>:(data?.recentUsers||[]).map(user=><div key={user.id} className="flex items-center justify-between gap-3 text-[11px]">
          <span className="truncate text-slate-200">{user.name}</span>
          <span className={user.isVerified?'text-emerald-400':'text-amber-400'}>{user.isVerified?'verified':'pending'}</span>
        </div>)}
      </div>
    </div>
  </section>;
}
