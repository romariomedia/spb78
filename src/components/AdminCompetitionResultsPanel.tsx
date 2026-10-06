import { useEffect,useMemo,useState } from 'react';
import { CheckCircle2,RefreshCw,Save,Trash2,Trophy } from 'lucide-react';
import { OfficialEvent } from '../lib/types';
import { loadCompetitionResults,recordCompetitionResult,revokeCompetitionResult,CompetitionResultBundle } from '../services/adminCompetitionResults';

export function AdminCompetitionResultsPanel({events}:{events:OfficialEvent[]}){
  const competitions=useMemo(()=>events.filter(e=>e.category==='competition'&&e.status==='finished'),[events]);
  const [eventId,setEventId]=useState(competitions[0]?.id||'');
  const [bundle,setBundle]=useState<CompetitionResultBundle|null>(null);
  const [placements,setPlacements]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');

  useEffect(()=>{if(!eventId&&competitions[0])setEventId(competitions[0].id);},[competitions,eventId]);
  const refresh=async()=>{if(!eventId){setBundle(null);return;}setBusy('load');setError('');try{const next=await loadCompetitionResults(eventId);setBundle(next);setPlacements(Object.fromEntries(next.results.map(r=>[r.userId,r.placement])));}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить результаты');}finally{setBusy('');}};
  useEffect(()=>{void refresh();},[eventId]);

  const save=async(userId:string)=>{
    const placement=(placements[userId]||'').trim();if(!placement)return;
    setBusy(userId);setError('');setNotice('');
    try{await recordCompetitionResult(eventId,userId,placement);setNotice('Результат записан в Спортивный ID SportBuddy78.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить результат');}finally{setBusy('');}
  };
  const revoke=async(userId:string)=>{
    setBusy('revoke:'+userId);setError('');
    try{await revokeCompetitionResult(eventId,userId);setNotice('Официальный результат отозван.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отозвать результат');}finally{setBusy('');}
  };
  const existing=new Map((bundle?.results||[]).map(r=>[r.userId,r]));

  return <section className="rounded-2xl border border-amber-500/20 bg-slate-950 p-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-300">SportBuddy78 Results</p><h3 className="mt-1 text-sm font-black text-white">Результаты соревнований → Спортивный ID</h3><p className="mt-1 text-[9px] text-slate-500">Только завершённые официальные соревнования. Запись получает статус «Подтверждено SportBuddy78».</p></div>
      <button onClick={()=>void refresh()} disabled={busy==='load'} className="rounded-xl border border-slate-700 p-2 text-slate-300"><RefreshCw className={'h-4 w-4 '+(busy==='load'?'animate-spin':'')}/></button>
    </div>
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-[10px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[10px] text-emerald-200">{notice}</p>}
    {competitions.length===0?<div className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-[10px] text-slate-500">Нет завершённых соревнований. Сначала переведите соревнование в статус «Завершено».</div>:<>
      <select value={eventId} onChange={e=>setEventId(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white">{competitions.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select>
      <div className="grid gap-2 xl:grid-cols-2">{(bundle?.participants||[]).map(p=>{const result=existing.get(p.id);return <article key={p.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
        <div className="flex items-center gap-3"><div className="h-10 w-10 overflow-hidden rounded-xl bg-slate-800">{p.avatar&&<img src={p.avatar} alt="" className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-black text-white">{p.name}</p><p className="truncate text-[8px] text-slate-600">{p.id}</p></div>{result&&<span className="flex items-center gap-1 rounded-full bg-lime-400 px-2 py-1 text-[8px] font-black text-slate-950"><CheckCircle2 className="h-3 w-3"/>ID</span>}</div>
        <div className="mt-3 flex gap-2"><input value={placements[p.id]||''} onChange={e=>setPlacements(prev=>({...prev,[p.id]:e.target.value}))} placeholder="1 место / 2 место / Победитель" className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-[10px] text-white"/><button onClick={()=>void save(p.id)} disabled={busy===p.id||!(placements[p.id]||'').trim()} className="rounded-xl bg-amber-400 px-3 text-slate-950 disabled:opacity-40"><Save className="h-4 w-4"/></button></div>
        {result&&<button onClick={()=>void revoke(p.id)} disabled={busy==='revoke:'+p.id} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 py-2 text-[9px] font-bold text-rose-300"><Trash2 className="h-3.5 w-3.5"/>Отозвать официальный результат</button>}
      </article>})}</div>
      {bundle&&bundle.participants.length===0&&<div className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-[10px] text-slate-500"><Trophy className="mx-auto mb-2 h-5 w-5"/>На соревнование пока никто не зарегистрирован.</div>}
    </>}
  </section>;
}
