import { useEffect,useMemo,useState } from 'react';
import { Check, RefreshCw, Save, Search, Settings2, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react';
import {
  AdminUserRow,AppConfig,loadAdminUsers,loadAppConfig,
  saveFeatureFlags,saveProductSettings,setAdminUserPremiumUntil,setAdminUserVerification
} from '../services/adminManagement';

type View='users'|'flags'|'settings';

function dateValue(value:string){
  if(!value)return '';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):'';
}
function formatDate(value:string){
  if(!value)return '—';
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toLocaleDateString('ru-RU'):'—';
}

export function AdminManagementPanel(){
  const [view,setView]=useState<View>('users');
  const [users,setUsers]=useState<AdminUserRow[]>([]);
  const [query,setQuery]=useState('');
  const [config,setConfig]=useState<AppConfig|null>(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=async()=>{
    setLoading(true);setError('');
    try{
      const [nextUsers,nextConfig]=await Promise.all([loadAdminUsers(query),loadAppConfig()]);
      setUsers(nextUsers);setConfig(nextConfig);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить управление');}
    finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[]);

  const visibleUsers=useMemo(()=>{
    const needle=query.trim().toLowerCase();
    if(!needle)return users;
    return users.filter(user=>[user.id,user.name,user.email,user.districtId,...user.sports].join(' ').toLowerCase().includes(needle));
  },[users,query]);

  const mutate=async(key:string,fn:()=>Promise<void>)=>{
    setSaving(key);setError('');setNotice('');
    try{await fn();setNotice('Изменение сохранено.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить изменение');}
    finally{setSaving('');}
  };

  const saveFlags=async()=>{
    if(!config)return;
    setSaving('flags');setError('');setNotice('');
    try{setConfig(await saveFeatureFlags(config.featureFlags));setNotice('Feature Flags сохранены.');}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить Feature Flags');}
    finally{setSaving('');}
  };
  const saveSettings=async()=>{
    if(!config)return;
    setSaving('settings');setError('');setNotice('');
    try{setConfig(await saveProductSettings(config.product));setNotice('Настройки продукта сохранены.');}
    catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить настройки');}
    finally{setSaving('');}
  };

  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Управление платформой</p>
        <h3 className="mt-1 text-base font-black text-white">Пользователи и настройки</h3>
      </div>
      <button onClick={()=>void refresh()} disabled={loading} className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 disabled:opacity-50" title="Обновить">
        <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>
      </button>
    </div>

    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-950 p-1">
      {([
        ['users','Пользователи',Users],
        ['flags','Feature Flags',SlidersHorizontal],
        ['settings','Настройки',Settings2]
      ] as const).map(([id,label,Icon])=><button key={id} onClick={()=>setView(id)} className={`flex items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-black ${view===id?'bg-emerald-500 text-slate-950':'text-slate-400'}`}>
        <Icon className="h-3.5 w-3.5"/><span className="truncate">{label}</span>
      </button>)}
    </div>

    {error&&<div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</div>}
    {notice&&<div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</div>}

    {view==='users'&&<>
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя, email, UID, район..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500"/>
      </div>
      <div className="space-y-2">
        {visibleUsers.length===0&&!loading&&<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-[11px] text-slate-500">Пользователи не найдены.</div>}
        {visibleUsers.map(user=><article key={user.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-white">{user.name}</p>
              <p className="mt-0.5 truncate text-[9px] text-slate-500">{user.email||user.id}</p>
              <p className="mt-1 text-[9px] text-slate-500">{user.districtId||'Район не указан'} · регистрация {formatDate(user.registeredAt)}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.isVerified?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>{user.isVerified?'verified':'pending'}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={saving===`verify:${user.id}`} onClick={()=>void mutate(`verify:${user.id}`,()=>setAdminUserVerification(user.id,!user.isVerified))} className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-[10px] font-bold text-slate-200 disabled:opacity-50">
              {user.isVerified?'Снять верификацию':'Подтвердить'}
            </button>
            <label className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-[9px] text-slate-400">
              Premium до
              <input type="date" defaultValue={dateValue(user.premiumUntil)} onChange={e=>{
                const value=e.target.value;
                void mutate(`premium:${user.id}`,()=>setAdminUserPremiumUntil(user.id,value?new Date(`${value}T23:59:59+03:00`).toISOString():''));
              }} className="mt-0.5 w-full bg-transparent text-[10px] font-bold text-white outline-none"/>
            </label>
          </div>
        </article>)}
      </div>
    </>}

    {view==='flags'&&config&&<>
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400"/><div><p className="text-xs font-black text-white">Feature Flags</p><p className="text-[9px] text-slate-500">Центральное управление доступностью функций</p></div></div>
        <div className="space-y-2">
          {([
            ['activeLeisureEnabled','Активный отдых'],
            ['datingEnabled','Знакомства'],
            ['pushEnabled','Push-уведомления'],
            ['storiesEnabled','Stories'],
            ['sportPassportEnabled','Спортивный паспорт'],
            ['boxEnabled','SportBuddy BOX']
          ] as const).map(([key,label])=><label key={key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5">
            <span className="text-[11px] font-bold text-slate-200">{label}</span>
            <input type="checkbox" checked={config.featureFlags[key]} onChange={e=>setConfig({...config,featureFlags:{...config.featureFlags,[key]:e.target.checked}})} className="h-4 w-4 accent-emerald-500"/>
          </label>)}
        </div>
      </div>
      <button onClick={()=>void saveFlags()} disabled={saving==='flags'} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Save className="h-4 w-4"/>Сохранить Feature Flags</button>
    </>}

    {view==='settings'&&config&&<>
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Бесплатных матчей
          <input type="number" min="0" max="100" value={config.product.freeMatches} onChange={e=>setConfig({...config,product:{...config.product,freeMatches:Number(e.target.value)}})} className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none"/>
        </label>
        <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Период, дней
          <input type="number" min="1" max="365" value={config.product.matchWindowDays} onChange={e=>setConfig({...config,product:{...config.product,matchWindowDays:Number(e.target.value)}})} className="mt-1 w-full bg-transparent text-sm font-black text-white outline-none"/>
        </label>
        <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Premium бесплатно до
          <input type="date" value={config.product.premiumFreeUntil} onChange={e=>setConfig({...config,product:{...config.product,premiumFreeUntil:e.target.value}})} className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"/>
        </label>
        <label className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Запуск BOX
          <input type="date" value={config.product.boxLaunchAt} onChange={e=>setConfig({...config,product:{...config.product,boxLaunchAt:e.target.value}})} className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"/>
        </label>
      </div>
      <label className="block rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Минимальная версия Android
        <input value={config.product.minimumAndroidVersion} onChange={e=>setConfig({...config,product:{...config.product,minimumAndroidVersion:e.target.value}})} placeholder="например 1.0.8" className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"/>
      </label>
      <label className="block rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Ссылка RuStore
        <input value={config.product.ruStoreUrl} onChange={e=>setConfig({...config,product:{...config.product,ruStoreUrl:e.target.value}})} placeholder="https://..." className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"/>
      </label>
      <label className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div><p className="text-[11px] font-black text-white">Технические работы</p><p className="text-[9px] text-slate-500">Флаг для режима обслуживания</p></div>
        <input type="checkbox" checked={config.product.maintenanceMode} onChange={e=>setConfig({...config,product:{...config.product,maintenanceMode:e.target.checked}})} className="h-4 w-4 accent-emerald-500"/>
      </label>
      <label className="block rounded-xl border border-slate-800 bg-slate-950 p-3 text-[10px] text-slate-400">Сообщение при технических работах
        <textarea rows={2} value={config.product.maintenanceMessage} onChange={e=>setConfig({...config,product:{...config.product,maintenanceMessage:e.target.value}})} className="mt-1 w-full resize-none bg-transparent text-xs font-semibold text-white outline-none"/>
      </label>
      <button onClick={()=>void saveSettings()} disabled={saving==='settings'} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-xs font-black text-slate-950 disabled:opacity-50"><Check className="h-4 w-4"/>Сохранить настройки</button>
    </>}
  </section>;
}
