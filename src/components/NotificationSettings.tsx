import {useEffect,useState} from 'react';
import {DEFAULT_SETTINGS,NotificationSettings as Settings,loadNotificationSettings,saveNotificationSettings,enablePush,disablePush,pushEnabled,testPush} from '../services/notifications';
export function NotificationSettings() {
  const [prefs,setPrefs]=useState<Settings>(DEFAULT_SETTINGS),[enabled,setEnabled]=useState(pushEnabled),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[feedback,setFeedback]=useState('');
  useEffect(()=>{let live=true;loadNotificationSettings().then(r=>{if(live){setPrefs(r.settings);setReady(true);}}).catch(()=>{if(live)setFeedback('Не удалось загрузить настройки. Откройте окно повторно.');});return()=>{live=false;};},[]);
  const update=async(next:Settings)=>{setBusy(true);try{const r=await saveNotificationSettings(next);setPrefs(r.settings);setFeedback('Настройки сохранены');}catch{setFeedback('Не удалось сохранить настройки');}finally{setBusy(false);}};
  const toggle=async()=>{setBusy(true);try{if(enabled)await disablePush();else await enablePush();setEnabled(pushEnabled());setFeedback(enabled?'Push на этом устройстве выключены':'Устройство подключено. Новые уведомления будут приходить сюда.');}catch(e){setFeedback(e instanceof Error?e.message:'Ошибка подключения');}finally{setBusy(false);}};
  return <div className="rounded-2xl border border-emerald-500/30 bg-slate-950 p-4 space-y-3">
    <p className="text-sm font-bold text-white">Будьте на связи со своими</p>
    <p className="text-xs text-slate-400">Чаты, друзья и спорт рядом. История сохраняется в аккаунте; push включаются отдельно на каждом устройстве.</p>
    <button disabled={busy} onClick={()=>void toggle()} className="w-full rounded-xl py-3 bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50">{busy?'Подождите…':enabled?'Выключить push на этом устройстве':'Включить уведомления на устройстве'}</button>
    {enabled&&<button disabled={busy} onClick={()=>{setBusy(true);void testPush().then(()=>setFeedback('Проверка поставлена в очередь. Должно появиться уведомление «SportBuddy на связи».')).catch(e=>setFeedback(e.message)).finally(()=>setBusy(false));}} className="text-xs text-emerald-300 underline disabled:opacity-50">Отправить проверочное уведомление</button>}
    <div className="grid grid-cols-2 gap-3">{(['messages','friends','trainings','events'] as const).map((key,i)=><label key={key} className="flex gap-2 text-xs text-slate-200"><input type="checkbox" checked={prefs[key]} disabled={busy||!ready} onChange={e=>void update({...prefs,[key]:e.target.checked})}/>{['Сообщения','Друзья','Тренировки','События'][i]}</label>)}</div>
    <label className="flex gap-2 text-xs text-slate-300"><input type="checkbox" checked={prefs.quiet} disabled={busy||!ready} onChange={e=>void update({...prefs,quiet:e.target.checked})}/>Без push с 23:00 до 08:00 по Москве</label>
    <label className="flex items-center gap-2 text-xs text-slate-300">Новые тренировки в радиусе<select className="bg-slate-800 rounded-lg p-2" value={prefs.radiusKm} disabled={busy||!ready} onChange={e=>void update({...prefs,radiusKm:Number(e.target.value)})}>{[5,10,25,50,100].map(n=><option key={n} value={n}>{n} км</option>)}</select></label>
    <p className="text-[11px] text-slate-400">Подбор по видам спорта и месту из профиля. Текст личных сообщений скрыт в push.</p>
    {feedback&&<p role="status" className="text-xs text-emerald-200">{feedback}</p>}
  </div>;
}
