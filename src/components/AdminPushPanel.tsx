import { useEffect,useMemo,useState } from 'react';
import { BellRing,CalendarClock,RefreshCw,Send,ShieldCheck,Users,XCircle } from 'lucide-react';
import { DISTRICTS,districtLabel } from '../../shared/districts.js';
import { SPORT_TAGS } from '../lib/types';
import {
  AdminPushAudience,AdminPushCampaign,AdminPushPreview,cancelAdminPushCampaign,
  loadAdminPushCampaigns,previewAdminPush,sendAdminPush
} from '../services/adminPush';

const DEFAULT_AUDIENCE:AdminPushAudience={userId:'',districtId:'',sport:'',verifiedOnly:false,activeWithinDays:0};

function statusLabel(status:string){
  return ({
    scheduled:'Запланировано',queued:'В очереди',processing:'Отправляется',retrying:'Повторная попытка',
    completed:'Завершено',failed:'Ошибка',expired:'Истекло',cancelled:'Отменено'
  } as Record<string,string>)[status]||status;
}
function statusClass(status:string){
  if(status==='completed')return 'text-emerald-300 bg-emerald-500/15';
  if(status==='failed'||status==='expired')return 'text-rose-300 bg-rose-500/15';
  if(status==='cancelled')return 'text-slate-400 bg-slate-800';
  return 'text-amber-300 bg-amber-500/15';
}
function formatDate(value:string){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
}
function audienceSummary(a:AdminPushAudience){
  const parts:string[]=[];
  if(a.userId)parts.push('1 UID');
  if(a.districtId)parts.push(districtLabel(a.districtId)||a.districtId);
  if(a.sport)parts.push(a.sport);
  if(a.verifiedOnly)parts.push('только verified');
  if(a.activeWithinDays)parts.push('активные 30 дней');
  return parts.length?parts.join(' · '):'Все активные аккаунты';
}

export function AdminPushPanel(){
  const [title,setTitle]=useState('');
  const [message,setMessage]=useState('');
  const [link,setLink]=useState('#notifications');
  const [scheduledLocal,setScheduledLocal]=useState('');
  const [audience,setAudience]=useState<AdminPushAudience>(DEFAULT_AUDIENCE);
  const [preview,setPreview]=useState<AdminPushPreview|null>(null);
  const [campaigns,setCampaigns]=useState<AdminPushCampaign[]>([]);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const invalidate=()=>{setPreview(null);setNotice('');setError('');};
  const changeAudience=<K extends keyof AdminPushAudience>(key:K,value:AdminPushAudience[K])=>{
    setAudience(prev=>({...prev,[key]:value}));invalidate();
  };

  const refreshHistory=async()=>{
    setBusy('history');setError('');
    try{setCampaigns(await loadAdminPushCampaigns());}
    catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить историю рассылок');}
    finally{setBusy('');}
  };
  useEffect(()=>{void refreshHistory();},[]);

  const scheduleIso=useMemo(()=>{
    if(!scheduledLocal)return '';
    const d=new Date(scheduledLocal);
    return Number.isFinite(d.getTime())?d.toISOString():'';
  },[scheduledLocal]);

  const makePreview=async()=>{
    setBusy('preview');setError('');setNotice('');setPreview(null);
    try{
      const result=await previewAdminPush({audience,title,message,link,scheduledAt:scheduleIso});
      setPreview(result);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось проверить аудиторию');}
    finally{setBusy('');}
  };

  const confirmSend=async()=>{
    if(!preview)return;
    setBusy('send');setError('');setNotice('');
    try{
      const campaign=await sendAdminPush(preview.id);
      setNotice(campaign.status==='scheduled'?'Рассылка запланирована.':'Рассылка поставлена в очередь.');
      setPreview(null);setTitle('');setMessage('');setLink('#notifications');setScheduledLocal('');setAudience(DEFAULT_AUDIENCE);
      await refreshHistory();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось поставить рассылку в очередь');setBusy('');}
  };

  const cancel=async(id:string)=>{
    setBusy(`cancel:${id}`);setError('');
    try{await cancelAdminPushCampaign(id);setNotice('Запланированная рассылка отменена.');await refreshHistory();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отменить рассылку');}
    finally{setBusy('');}
  };

  return <section className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Коммуникации</p>
        <h3 className="mt-1 text-base font-black text-white">Push Center</h3>
        <p className="mt-1 text-[10px] text-slate-500">Предпросмотр аудитории обязателен перед каждой рассылкой</p>
      </div>
      <button onClick={()=>void refreshHistory()} disabled={busy==='history'} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${busy==='history'?'animate-spin':''}`}/>
      </button>
    </div>

    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</div>}
    {notice&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</div>}

    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 space-y-3">
      <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-emerald-400"/><p className="text-xs font-black text-white">Новое уведомление</p></div>

      <label className="block text-[10px] text-slate-400">Заголовок · {title.length}/100
        <input maxLength={100} value={title} onChange={e=>{setTitle(e.target.value);invalidate();}} placeholder="Например: Новая тренировка SportBuddy78" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"/>
      </label>
      <label className="block text-[10px] text-slate-400">Сообщение · {message.length}/240
        <textarea maxLength={240} rows={3} value={message} onChange={e=>{setMessage(e.target.value);invalidate();}} placeholder="Короткий полезный текст без лишнего спама" className="mt-1 w-full resize-none rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"/>
      </label>
      <label className="block text-[10px] text-slate-400">Куда открыть приложение
        <select value={link} onChange={e=>{setLink(e.target.value);invalidate();}} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none">
          <option value="#notifications">Уведомления</option>
          <option value="#trainings">Тренировки</option>
          <option value="#discover">Знакомства</option>
          <option value="#events">События</option>
          <option value="#profile">Профиль</option>
        </select>
      </label>

      <div className="border-t border-slate-800 pt-3">
        <div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-slate-400"/><p className="text-[11px] font-black text-white">Аудитория</p></div>
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[10px] text-slate-400">Конкретный UID · необязательно
            <input value={audience.userId} onChange={e=>changeAudience('userId',e.target.value)} placeholder="Оставьте пустым для группы" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[10px] text-white outline-none"/>
          </label>
          <label className="text-[10px] text-slate-400">Район
            <select value={audience.districtId} onChange={e=>changeAudience('districtId',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-2 py-2 text-[10px] text-white outline-none">
              <option value="">Все</option>
              {DISTRICTS.map(d=><option key={d.id} value={d.id}>{d.name} · {d.region==='spb'?'СПб':'ЛО'}</option>)}
            </select>
          </label>
          <label className="text-[10px] text-slate-400">Вид спорта
            <select value={audience.sport} onChange={e=>changeAudience('sport',e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-2 py-2 text-[10px] text-white outline-none">
              <option value="">Все</option>
              {SPORT_TAGS.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-[10px] font-bold text-slate-300">
            Только verified
            <input type="checkbox" checked={audience.verifiedOnly} onChange={e=>changeAudience('verifiedOnly',e.target.checked)} className="h-4 w-4 accent-emerald-500"/>
          </label>
          <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-[10px] font-bold text-slate-300">
            Активные 30 дней
            <input type="checkbox" checked={audience.activeWithinDays===30} onChange={e=>changeAudience('activeWithinDays',e.target.checked?30:0)} className="h-4 w-4 accent-emerald-500"/>
          </label>
        </div>
      </div>

      <label className="block text-[10px] text-slate-400"><span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5"/>Отложить отправку · необязательно</span>
        <input type="datetime-local" value={scheduledLocal} onChange={e=>{setScheduledLocal(e.target.value);invalidate();}} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-xs text-white outline-none"/>
      </label>

      <button onClick={()=>void makePreview()} disabled={busy!==''||title.trim().length<2||message.trim().length<2} className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-[11px] font-black text-emerald-300 disabled:opacity-40">
        <ShieldCheck className="h-4 w-4"/>Проверить аудиторию
      </button>
    </div>

    {preview&&<div className="rounded-2xl border border-amber-500/40 bg-amber-950/15 p-3 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black text-white">Подтверждение рассылки</p><p className="mt-1 text-[10px] text-slate-400">{audienceSummary(preview.audience)}</p></div>
        <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-black text-amber-300">{preview.audienceCount} получ.</span>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <p className="text-[11px] font-black text-white">{preview.title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-300">{preview.message}</p>
        <p className="mt-2 text-[9px] text-slate-500">Откроет: {preview.link} · {new Date(preview.scheduledAt).getTime()>Date.now()+60000?`отправка ${formatDate(preview.scheduledAt)}`:'отправка сразу'}</p>
      </div>
      {preview.sample.length>0&&<div className="text-[9px] text-slate-500">Пример аудитории: {preview.sample.map(x=>x.name).join(', ')}</div>}
      <p className="text-[9px] leading-relaxed text-amber-200/80">После подтверждения задание попадёт в серверную очередь. Настройки уведомлений и тихие часы пользователей сохраняются.</p>
      <button onClick={()=>void confirmSend()} disabled={busy!==''} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[11px] font-black text-slate-950 disabled:opacity-50">
        <Send className="h-4 w-4"/>Подтвердить рассылку для {preview.audienceCount}
      </button>
    </div>}

    <div className="space-y-2">
      <div className="flex items-center justify-between"><p className="text-xs font-black text-white">История рассылок</p><span className="text-[9px] text-slate-500">{campaigns.length} записей</span></div>
      {campaigns.length===0&&busy!=='history'&&<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-[11px] text-slate-500">Рассылок пока нет.</div>}
      {campaigns.map(c=><article key={c.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="truncate text-[11px] font-black text-white">{c.title}</p><p className="mt-0.5 text-[9px] text-slate-500">{audienceSummary(c.audience)}</p></div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${statusClass(c.status)}`}>{statusLabel(c.status)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[9px] text-slate-500">
          <span>{Math.min(c.processedCount,c.audienceCount)} / {c.audienceCount} обработано</span>
          <span>{formatDate(c.scheduledAt||c.createdAt)}</span>
        </div>
        {c.lastError&&<p className="mt-2 rounded-lg bg-rose-950/30 p-2 text-[9px] text-rose-300">{c.lastError}</p>}
        {c.status==='scheduled'&&<button onClick={()=>void cancel(c.id)} disabled={busy===`cancel:${c.id}`} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-[10px] font-bold text-rose-300 disabled:opacity-50">
          <XCircle className="h-3.5 w-3.5"/>Отменить запланированную рассылку
        </button>}
      </article>)}
    </div>
  </section>;
}
