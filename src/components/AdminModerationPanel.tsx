import { useEffect,useMemo,useState } from 'react';
import { Ban,Eye,EyeOff,FileWarning,RefreshCw,ShieldCheck,Users } from 'lucide-react';
import { loadModeration,ModerationPost,ModerationProfile,ModerationReport,setPostHidden,setReportStatus } from '../services/adminModeration';
import { setAdminUserSuspension,setAdminUserVerification } from '../services/adminManagement';

type Tab='reports'|'feed'|'profiles';
const reasonLabel:Record<string,string>={unsafe:'Небезопасное предложение',harassment:'Оскорбления / давление',spam:'Спам / реклама',fake:'Фейковый профиль',other:'Другое'};
const statusLabel:Record<string,string>={new:'Новая',reviewing:'На проверке',resolved:'Решена',dismissed:'Отклонена'};

export function AdminModerationPanel(){
  const [tab,setTab]=useState<Tab>('reports');
  const [reports,setReports]=useState<ModerationReport[]>([]);
  const [posts,setPosts]=useState<ModerationPost[]>([]);
  const [profiles,setProfiles]=useState<ModerationProfile[]>([]);
  const [busy,setBusy]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [reportFilter,setReportFilter]=useState('open');
  const [profileQuery,setProfileQuery]=useState('');

  const refresh=async()=>{setBusy('refresh');setError('');try{const d=await loadModeration();setReports(d.reports);setPosts(d.posts);setProfiles(d.profiles);}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить модерацию');}finally{setBusy('');}};
  useEffect(()=>{void refresh();},[]);

  const mutate=async(key:string,fn:()=>Promise<unknown>,message:string)=>{setBusy(key);setError('');setNotice('');try{await fn();setNotice(message);await refresh();}catch(e){setError(e instanceof Error?e.message:'Операция не выполнена');}finally{setBusy('');}};

  const visibleReports=useMemo(()=>reportFilter==='all'?reports:reports.filter(r=>reportFilter==='open'?['new','reviewing'].includes(r.status):r.status===reportFilter),[reports,reportFilter]);
  const visibleProfiles=useMemo(()=>{const q=profileQuery.trim().toLowerCase();return profiles.filter(p=>!q||[p.name,p.id,p.districtId,...p.sports].join(' ').toLowerCase().includes(q));},[profiles,profileQuery]);

  const hidePost=(post:ModerationPost)=>{
    if(post.isHidden)return void mutate(`post:${post.id}`,()=>setPostHidden(post.id,false,''),'Публикация восстановлена.');
    const reason=(prompt('Причина скрытия публикации:','Нарушение правил сообщества')||'').trim();
    if(!reason)return;
    void mutate(`post:${post.id}`,()=>setPostHidden(post.id,true,reason),'Публикация скрыта.');
  };
  const suspendProfile=(p:ModerationProfile)=>{
    if(p.isSuspended)return void mutate(`suspend:${p.id}`,()=>setAdminUserSuspension(p.id,false,''),'Аккаунт восстановлен.');
    const reason=(prompt('Причина ограничения аккаунта:','Нарушение правил сообщества')||'').trim();
    if(!reason)return;
    void mutate(`suspend:${p.id}`,()=>setAdminUserSuspension(p.id,true,reason),'Аккаунт ограничен.');
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-400">Безопасность</p><h3 className="mt-1 text-base font-black text-white">Moderation Center</h3><p className="mt-1 text-[10px] text-slate-500">Жалобы, публикации и профили в одном рабочем месте</p></div>
      <button onClick={()=>void refresh()} disabled={busy==='refresh'} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300"><RefreshCw className={`h-4 w-4 ${busy==='refresh'?'animate-spin':''}`}/></button>
    </div>

    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-800 bg-slate-950 p-1">
      {([['reports','Жалобы',FileWarning],['feed','Лента',Eye],['profiles','Профили',Users]] as const).map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black ${tab===id?'bg-emerald-500 text-slate-950':'text-slate-400'}`}><Icon className="h-3.5 w-3.5"/>{label}</button>)}
    </div>

    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    {tab==='reports'&&<>
      <div className="flex flex-wrap gap-2">{([['open','Открытые'],['new','Новые'],['reviewing','На проверке'],['resolved','Решённые'],['dismissed','Отклонённые'],['all','Все']] as const).map(([id,label])=><button key={id} onClick={()=>setReportFilter(id)} className={`rounded-xl px-3 py-2 text-[10px] font-bold ${reportFilter===id?'bg-slate-700 text-white':'border border-slate-800 bg-slate-950 text-slate-400'}`}>{label}</button>)}</div>
      <div className="grid gap-3 xl:grid-cols-2">
        {visibleReports.map(r=><article key={r.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-white">{r.targetName}</p><p className="mt-0.5 text-[9px] text-slate-500">Жалоба от {r.reporterName} · {new Date(r.createdAt).toLocaleString('ru-RU')}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-black ${r.status==='new'?'bg-rose-500/15 text-rose-300':'bg-slate-800 text-slate-300'}`}>{statusLabel[r.status]||r.status}</span></div>
          <p className="mt-3 rounded-xl bg-slate-900 p-2.5 text-[10px] font-bold text-amber-200">{reasonLabel[r.reason]||r.reason}{r.details?` · ${r.details}`:''}</p>
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-2">{(r.excerpt||[]).map((m,i)=><p key={i} className="text-[9px] leading-relaxed text-slate-300"><b className={m.senderId===r.targetUserId?'text-rose-300':'text-emerald-300'}>{m.senderId===r.targetUserId?r.targetName:r.reporterName}:</b> {m.text}</p>)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2"><button onClick={()=>void mutate(`r:${r.id}`,()=>setReportStatus(r.id,'reviewing'),'Жалоба взята на проверку.')} className="rounded-xl border border-amber-500/30 py-2 text-[9px] font-black text-amber-300">Проверяю</button><button onClick={()=>void mutate(`r:${r.id}`,()=>setReportStatus(r.id,'resolved'),'Жалоба закрыта.')} className="rounded-xl border border-emerald-500/30 py-2 text-[9px] font-black text-emerald-300">Решено</button><button onClick={()=>void mutate(`r:${r.id}`,()=>setReportStatus(r.id,'dismissed'),'Жалоба отклонена.')} className="rounded-xl border border-slate-700 py-2 text-[9px] font-black text-slate-400">Отклонить</button></div>
        </article>)}
        {visibleReports.length===0&&<p className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-[11px] text-slate-500">Жалоб в этой категории нет.</p>}
      </div>
    </>}

    {tab==='feed'&&<div className="grid gap-3 xl:grid-cols-2">
      {posts.map(post=><article key={post.id} className={`rounded-2xl border bg-slate-950 p-4 ${post.isHidden?'border-rose-500/30 opacity-70':'border-slate-800'}`}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-black text-white">{post.authorName}</p><p className="text-[9px] text-slate-500">{post.sportTag} · {new Date(post.createdAt).toLocaleString('ru-RU')}</p></div>{post.isHidden?<span className="rounded-full bg-rose-500/15 px-2 py-1 text-[9px] font-black text-rose-300">Скрыто</span>:<span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[9px] font-black text-emerald-300">В ленте</span>}</div>
        <p className="mt-3 whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300">{post.content||'Без текста'}</p>
        {post.mediaUrl&&post.mediaType!=='video'&&<img src={post.mediaUrl} alt="" className="mt-3 max-h-56 w-full rounded-xl object-cover"/>}
        {post.isHidden&&post.hiddenReason&&<p className="mt-2 text-[9px] text-rose-300">Причина: {post.hiddenReason}</p>}
        <button onClick={()=>hidePost(post)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[10px] font-black ${post.isHidden?'bg-emerald-500 text-slate-950':'border border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>{post.isHidden?<><Eye className="h-4 w-4"/>Восстановить</>:<><EyeOff className="h-4 w-4"/>Скрыть публикацию</>}</button>
      </article>)}
    </div>}

    {tab==='profiles'&&<>
      <input value={profileQuery} onChange={e=>setProfileQuery(e.target.value)} placeholder="Поиск по имени, UID, району или спорту" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-500"/>
      <div className="grid gap-3 xl:grid-cols-2">
        {visibleProfiles.map(p=><article key={p.id} className={`rounded-2xl border bg-slate-950 p-4 ${p.reportCount?'border-amber-500/30':'border-slate-800'}`}>
          <div className="flex items-center gap-3">{p.avatar?<img src={p.avatar} alt="" className="h-12 w-12 rounded-xl object-cover"/>:<div className="h-12 w-12 rounded-xl bg-slate-900"/>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{p.name}</p><p className="truncate text-[9px] text-slate-500">{p.id}</p><p className="mt-1 text-[9px] text-slate-400">{p.sports.join(' · ')||'Спорт не указан'}</p></div><div className="text-right">{p.reportCount>0&&<span className="rounded-full bg-amber-500/15 px-2 py-1 text-[9px] font-black text-amber-300">{p.reportCount} жал.</span>}</div></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>void mutate(`verify:${p.id}`,()=>setAdminUserVerification(p.id,!p.isVerified),p.isVerified?'Верификация снята.':'Профиль подтверждён.')} disabled={p.isSuspended} className="flex items-center justify-center gap-1 rounded-xl border border-slate-700 py-2 text-[10px] font-bold text-slate-300 disabled:opacity-40"><ShieldCheck className="h-3.5 w-3.5"/>{p.isVerified?'Снять verified':'Подтвердить'}</button><button onClick={()=>suspendProfile(p)} className={`flex items-center justify-center gap-1 rounded-xl py-2 text-[10px] font-black ${p.isSuspended?'bg-emerald-500 text-slate-950':'border border-rose-500/30 bg-rose-500/10 text-rose-300'}`}><Ban className="h-3.5 w-3.5"/>{p.isSuspended?'Восстановить':'Ограничить'}</button></div>
        </article>)}
      </div>
    </>}
  </section>;
}
