import { useEffect,useMemo,useState } from 'react';
import {
  Ban, Check, RefreshCw, RotateCcw, Save, Search, Settings2,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, UserRoundSearch, Users, X
} from 'lucide-react';
import {
  AdminUserDetails,AdminUserRow,AppConfig,UserDeletionPreview,executeAdminUserDeletion,loadAdminUser,loadAdminUsers,loadAppConfig,
  previewAdminUserDeletion,saveFeatureFlags,saveProductSettings,setAdminUserAnalyticsExcluded,setAdminUserPremiumUntil,setAdminUserSuspension,setAdminUserVerification
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
function lastSeen(value:number){
  if(!value)return 'нет данных';
  const diff=Math.max(0,Date.now()-value);
  if(diff<60_000)return 'только что';
  if(diff<3_600_000)return `${Math.floor(diff/60_000)} мин назад`;
  if(diff<86_400_000)return `${Math.floor(diff/3_600_000)} ч назад`;
  return formatDate(new Date(value).toISOString());
}

export function AdminManagementPanel(){
  const [view,setView]=useState<View>('users');
  const [users,setUsers]=useState<AdminUserRow[]>([]);
  const [query,setQuery]=useState('');
  const [config,setConfig]=useState<AppConfig|null>(null);
  const [selectedUser,setSelectedUser]=useState<AdminUserDetails|null>(null);
  const [suspensionReason,setSuspensionReason]=useState('');
  const [deletionPreview,setDeletionPreview]=useState<UserDeletionPreview|null>(null);
  const [deletionConfirmation,setDeletionConfirmation]=useState('');
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

  const openUser=async(userId:string)=>{
    setSaving(`detail:${userId}`);setError('');setNotice('');
    try{
      const user=await loadAdminUser(userId);
      setSelectedUser(user);
      setSuspensionReason(user.suspensionReason||'');
      setDeletionPreview(null);setDeletionConfirmation('');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось открыть пользователя');}
    finally{setSaving('');}
  };

  const previewDeletion=async()=>{
    if(!selectedUser)return;
    setSaving(`delete-preview:${selectedUser.id}`);setError('');setNotice('');setDeletionPreview(null);setDeletionConfirmation('');
    try{setDeletionPreview(await previewAdminUserDeletion(selectedUser.id));}
    catch(e){setError(e instanceof Error?e.message:'Не удалось выполнить dry-run удаления');}
    finally{setSaving('');}
  };

  const executeDeletion=async()=>{
    if(!selectedUser||!deletionPreview)return;
    if(deletionConfirmation.trim()!==deletionPreview.confirmationCode){setError('Введите код подтверждения точно как показано в dry-run.');return;}
    setSaving(`delete-execute:${selectedUser.id}`);setError('');setNotice('');
    try{
      await executeAdminUserDeletion(selectedUser.id,deletionPreview.id,deletionConfirmation.trim());
      setNotice(`Аккаунт ${selectedUser.name} безопасно удалён.`);
      setSelectedUser(null);setDeletionPreview(null);setDeletionConfirmation('');setSuspensionReason('');
      await refresh();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось удалить аккаунт');}
    finally{setSaving('');}
  };

  const changeSuspension=async(suspended:boolean)=>{
    if(!selectedUser)return;
    const reason=suspensionReason.trim();
    if(suspended&&reason.length<3){setError('Укажите причину ограничения минимум из 3 символов.');return;}
    await mutate(`suspend:${selectedUser.id}`,async()=>{
      const updated=await setAdminUserSuspension(selectedUser.id,suspended,reason);
      setSelectedUser(updated);
      setSuspensionReason(updated.suspensionReason||'');
    });
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
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Имя, email, UID, район, спорт..." className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500"/>
      </div>

      {selectedUser&&<div className="rounded-2xl border border-emerald-500/30 bg-slate-950 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            {selectedUser.avatar?<img src={selectedUser.avatar} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover"/>:<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg">👤</div>}
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-white">{selectedUser.name}</p>
              <p className="truncate text-[9px] text-slate-500">{selectedUser.email||selectedUser.id}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${selectedUser.isVerified?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>{selectedUser.isVerified?'verified':'pending'}</span>
                {selectedUser.isSuspended&&<span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[9px] font-black text-rose-300">suspended</span>}
              </div>
            </div>
          </div>
          <button onClick={()=>{setSelectedUser(null);setSuspensionReason('');setDeletionPreview(null);setDeletionConfirmation('');}} className="rounded-lg p-1.5 text-slate-500 hover:text-white"><X className="h-4 w-4"/></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Район</span><p className="mt-0.5 font-bold text-white">{selectedUser.districtId||selectedUser.locationName||'—'}</p></div>
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Последняя активность</span><p className="mt-0.5 font-bold text-white">{lastSeen(selectedUser.lastSeenAt)}</p></div>
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Тренировки</span><p className="mt-0.5 font-black text-white">{selectedUser.totalWorkouts}</p></div>
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Медали / серия</span><p className="mt-0.5 font-black text-white">{selectedUser.totalDailyMedals} / {selectedUser.dailyMedalStreak}</p></div>
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Друзья</span><p className="mt-0.5 font-black text-white">{selectedUser.friendsCount}</p></div>
          <div className="rounded-xl bg-slate-900 p-2.5"><span className="text-slate-500">Мэтчи</span><p className="mt-0.5 font-black text-white">{selectedUser.matchesCount}</p></div>
        </div>

        <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <p className="text-[10px] font-black text-white">Спортивный профиль</p>
          <p className="mt-1 text-[10px] text-slate-400">{selectedUser.sports.length?selectedUser.sports.join(' · '):'Виды спорта не указаны'}</p>
          {selectedUser.bio&&<p className="mt-2 text-[10px] leading-relaxed text-slate-300">{selectedUser.bio}</p>}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div>
            <p className="text-[10px] font-black text-white">Продуктовая аналитика</p>
            <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Для тестовых аккаунтов можно исключить регистрацию и активность из DAU, retention и времени.</p>
          </div>
          <button
            onClick={()=>void mutate(`analytics:${selectedUser.id}`,async()=>{const next=!selectedUser.analyticsExcluded;await setAdminUserAnalyticsExcluded(selectedUser.id,next);setSelectedUser(prev=>prev?{...prev,analyticsExcluded:next}:prev);})}
            className={`shrink-0 rounded-xl px-3 py-2 text-[9px] font-black ${selectedUser.analyticsExcluded?'bg-amber-500 text-slate-950':'border border-slate-700 bg-slate-950 text-slate-300'}`}
          >
            {selectedUser.analyticsExcluded?'Исключён':'Учитывается'}
          </button>
        </div>

        <div className={`mt-3 rounded-xl border p-3 ${selectedUser.isSuspended?'border-rose-500/40 bg-rose-950/20':'border-slate-800 bg-slate-900'}`}>
          <div className="flex items-center gap-2">
            <Ban className={`h-4 w-4 ${selectedUser.isSuspended?'text-rose-400':'text-slate-400'}`}/>
            <div>
              <p className="text-[11px] font-black text-white">{selectedUser.isSuspended?'Аккаунт ограничен':'Ограничение аккаунта'}</p>
              <p className="text-[9px] text-slate-500">{selectedUser.isSuspended&&selectedUser.suspendedAt?`с ${formatDate(selectedUser.suspendedAt)}`:'Скрывает профиль и блокирует серверные действия'}</p>
            </div>
          </div>
          {!selectedUser.isSuspended&&<textarea rows={2} value={suspensionReason} onChange={e=>setSuspensionReason(e.target.value)} maxLength={300} placeholder="Причина ограничения — обязательна" className="mt-2 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-2.5 text-[10px] text-white outline-none focus:border-rose-500"/>}
          {selectedUser.isSuspended&&selectedUser.suspensionReason&&<p className="mt-2 rounded-xl bg-slate-950 p-2.5 text-[10px] text-rose-200">Причина: {selectedUser.suspensionReason}</p>}
          <button
            disabled={saving===`suspend:${selectedUser.id}`}
            onClick={()=>void changeSuspension(!selectedUser.isSuspended)}
            className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black disabled:opacity-50 ${selectedUser.isSuspended?'bg-emerald-500 text-slate-950':'bg-rose-500 text-white'}`}
          >
            {selectedUser.isSuspended?<><RotateCcw className="h-3.5 w-3.5"/>Восстановить аккаунт</>:<><Ban className="h-3.5 w-3.5"/>Ограничить аккаунт</>}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-950/10 p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/>
            <div>
              <p className="text-[11px] font-black text-white">Безопасное удаление аккаунта</p>
              <p className="mt-1 text-[9px] leading-relaxed text-slate-500">Удаление доступно только после server dry-run. Верифицированные аккаунты, платежи, чаты, жалобы, рейтинги и созданный контент блокируют удаление.</p>
            </div>
          </div>
          <button onClick={()=>void previewDeletion()} disabled={saving===`delete-preview:${selectedUser.id}`} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-[10px] font-black text-amber-200 disabled:opacity-50">
            <ShieldAlert className="h-3.5 w-3.5"/>{saving===`delete-preview:${selectedUser.id}`?'Проверяю связи…':'Dry-run: проверить возможность удаления'}
          </button>

          {deletionPreview&&<div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-[10px] font-black text-white">Результат dry-run</p><p className="text-[9px] text-slate-500">{deletionPreview.classification==='test_candidate'?'Кандидат на тестовый/пустой аккаунт':'Требуется ручная проверка'}</p></div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${deletionPreview.safeToDelete?'bg-emerald-500/15 text-emerald-300':'bg-rose-500/15 text-rose-300'}`}>{deletionPreview.safeToDelete?'можно удалить':'удаление заблокировано'}</span>
            </div>

            {deletionPreview.signals.length>0&&<div className="rounded-lg bg-slate-900 p-2"><p className="text-[9px] font-black text-slate-400">Сигналы</p><p className="mt-1 text-[9px] leading-relaxed text-slate-300">{deletionPreview.signals.join(' · ')}</p></div>}
            {deletionPreview.blockers.length>0&&<div className="space-y-1 rounded-lg border border-rose-500/20 bg-rose-950/20 p-2">{deletionPreview.blockers.map((item,i)=><p key={i} className="text-[9px] leading-relaxed text-rose-200">• {item}</p>)}</div>}

            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(deletionPreview.counts).filter(([,value])=>value>0).map(([key,value])=><div key={key} className="rounded-lg bg-slate-900 p-2"><p className="truncate text-[8px] text-slate-500">{key}</p><p className="mt-0.5 text-[11px] font-black text-white">{value}</p></div>)}
              {Object.values(deletionPreview.counts).every(value=>value===0)&&<div className="col-span-2 rounded-lg bg-emerald-950/20 p-2 text-[9px] text-emerald-200">Связанных документов не найдено.</div>}
            </div>

            {deletionPreview.safeToDelete&&<>
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5">
                <p className="text-[9px] font-black text-rose-200">Необратимое действие</p>
                <p className="mt-1 text-[9px] leading-relaxed text-slate-400">Dry-run действует 10 минут. Перед удалением сервер повторно проверит все данные и отменит операцию, если что-либо изменилось.</p>
                <p className="mt-2 text-[9px] text-slate-400">Введите код: <b className="font-mono text-white">{deletionPreview.confirmationCode}</b></p>
                <input value={deletionConfirmation} onChange={e=>setDeletionConfirmation(e.target.value)} placeholder={deletionPreview.confirmationCode} className="mt-2 w-full rounded-lg border border-rose-500/30 bg-slate-950 px-3 py-2 text-[10px] font-mono text-white outline-none focus:border-rose-400"/>
              </div>
              <button onClick={()=>void executeDeletion()} disabled={saving===`delete-execute:${selectedUser.id}`||deletionConfirmation!==deletionPreview.confirmationCode} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-[10px] font-black text-white disabled:opacity-30">
                <Trash2 className="h-3.5 w-3.5"/>Удалить аккаунт окончательно
              </button>
            </>}
          </div>}
        </div>
      </div>}

      <div className="grid gap-2 xl:grid-cols-2">
        {visibleUsers.length===0&&!loading&&<div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-[11px] text-slate-500">Пользователи не найдены.</div>}
        {visibleUsers.map(user=><article key={user.id} className={`rounded-2xl border bg-slate-950 p-3 ${user.isSuspended?'border-rose-500/30':'border-slate-800'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-white">{user.name}</p>
              <p className="mt-0.5 truncate text-[9px] text-slate-500">{user.email||user.id}</p>
              <p className="mt-1 text-[9px] text-slate-500">{user.districtId||'Район не указан'} · регистрация {formatDate(user.registeredAt)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${user.isVerified?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-300'}`}>{user.isVerified?'verified':'pending'}</span>
              {user.isSuspended&&<span className="rounded-full bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-300">suspended</span>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button disabled={saving===`verify:${user.id}`||user.isSuspended} onClick={()=>void mutate(`verify:${user.id}`,()=>setAdminUserVerification(user.id,!user.isVerified))} className="rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-[10px] font-bold text-slate-200 disabled:opacity-40">
              {user.isVerified?'Снять верификацию':'Подтвердить'}
            </button>
            <label className={`rounded-xl border border-slate-700 bg-slate-900 px-2 py-1.5 text-[9px] text-slate-400 ${user.isSuspended?'opacity-40':''}`}>
              Premium до
              <input disabled={user.isSuspended} type="date" defaultValue={dateValue(user.premiumUntil)} onChange={e=>{
                const value=e.target.value;
                void mutate(`premium:${user.id}`,()=>setAdminUserPremiumUntil(user.id,value?new Date(`${value}T23:59:59+03:00`).toISOString():''));
              }} className="mt-0.5 w-full bg-transparent text-[10px] font-bold text-white outline-none disabled:cursor-not-allowed"/>
            </label>
          </div>
          <button onClick={()=>void openUser(user.id)} disabled={saving===`detail:${user.id}`} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-[10px] font-black text-emerald-300 disabled:opacity-50">
            <UserRoundSearch className="h-3.5 w-3.5"/>Подробнее
          </button>
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
