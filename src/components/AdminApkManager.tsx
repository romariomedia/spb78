import {useEffect,useMemo,useRef,useState} from 'react';
import {CheckCircle2,Download,FileArchive,RefreshCw,RotateCcw,Smartphone,Trash2,Upload} from 'lucide-react';
import {
  ApkRelease,deleteApkRelease,loadApkReleases,publishApkRelease,uploadApkRelease
} from '../services/adminApk';

const mb=(value:number)=>value?(`${(value/1024/1024).toFixed(1)} МБ`):'—';
const date=(value:string)=>value?new Date(value).toLocaleString('ru-RU'):'—';

export function AdminApkManager(){
  const [active,setActive]=useState<ApkRelease|null>(null);
  const [releases,setReleases]=useState<ApkRelease[]>([]);
  const [versionName,setVersionName]=useState('');
  const [versionCode,setVersionCode]=useState('');
  const [releaseNotes,setReleaseNotes]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [busy,setBusy]=useState('');
  const [progress,setProgress]=useState(0);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);

  const refresh=async()=>{
    setBusy('load');setError('');
    try{
      const data=await loadApkReleases();
      setActive(data.active);
      setReleases(data.releases);
      if(!versionCode&&data.active?.versionCode)setVersionCode(String(data.active.versionCode+1));
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить APK-релизы.');}
    finally{setBusy('');}
  };
  useEffect(()=>{void refresh();},[]);

  const canUpload=useMemo(()=>Boolean(
    file&&versionName.trim()&&/^\d+$/.test(versionCode)&&Number(versionCode)>0&&!busy
  ),[file,versionName,versionCode,busy]);

  const upload=async()=>{
    if(!file||!canUpload)return;
    setBusy('upload');setProgress(0);setError('');setNotice('');
    try{
      const release=await uploadApkRelease(file,{
        versionName:versionName.trim(),
        versionCode:Number(versionCode),
        releaseNotes:releaseNotes.trim()
      },setProgress);
      setReleases(old=>[release,...old.filter(x=>x.id!==release.id)]);
      setFile(null);setReleaseNotes('');setNotice(`APK v${release.versionName} загружен как черновик. Проверьте и нажмите «Опубликовать».`);
      if(inputRef.current)inputRef.current.value='';
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить APK.');}
    finally{setBusy('');setProgress(0);}
  };

  const publish=async(item:ApkRelease)=>{
    const rollback=active&&item.versionCode<active.versionCode;
    if(!confirm(rollback
      ? `Откатить публичное скачивание на APK v${item.versionName}?`
      : `Опубликовать APK v${item.versionName} для скачивания с сайта?`))return;
    setBusy(`publish:${item.id}`);setError('');setNotice('');
    try{
      const next=await publishApkRelease(item.id);
      setActive(next);
      setReleases(old=>old.map(row=>({...row,active:row.id===item.id,publishedAt:row.id===item.id?next.publishedAt:row.publishedAt,publishedBy:row.id===item.id?next.publishedBy:row.publishedBy})));
      setNotice(`Теперь посетители сайта скачивают APK v${next.versionName}.`);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось опубликовать APK.');}
    finally{setBusy('');}
  };

  const remove=async(item:ApkRelease)=>{
    if(item.active)return;
    if(!confirm(`Удалить APK v${item.versionName} из хранилища? Это действие необратимо.`))return;
    setBusy(`delete:${item.id}`);setError('');setNotice('');
    try{
      await deleteApkRelease(item.id);
      setReleases(old=>old.filter(row=>row.id!==item.id));
      setNotice(`APK v${item.versionName} удалён.`);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось удалить APK.');}
    finally{setBusy('');}
  };

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-lime-300">Android Release Manager</p>
        <h3 className="mt-1 text-base font-black text-white">APK для сайта SportBuddy78</h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
          Загруженный APK хранится на VPS вне папок релизов сайта. Новый веб-деплой его не удалит. Посетители всегда скачивают только активную версию по постоянной ссылке.
        </p>
      </div>
      <button type="button" onClick={()=>void refresh()} disabled={Boolean(busy)} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300 disabled:opacity-40">
        <RefreshCw className={`h-4 w-4 ${busy==='load'?'animate-spin':''}`}/>
      </button>
    </div>

    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200">{notice}</p>}

    <div className="rounded-2xl border border-lime-400/25 bg-slate-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-lime-400/10 p-3 text-lime-300"><Smartphone className="h-5 w-5"/></span>
          <div>
            <p className="text-xs font-black text-white">Активная версия на сайте</p>
            {active
              ? <p className="mt-1 text-lg font-black text-lime-300">v{active.versionName} <span className="text-xs text-slate-500">build {active.versionCode}</span></p>
              : <p className="mt-1 text-sm font-bold text-amber-200">Используется встроенный резервный APK v31</p>}
          </div>
        </div>
        <a href="/api/android-download" className="flex min-h-10 items-center gap-2 rounded-xl border border-lime-400/25 bg-lime-400/10 px-3 text-xs font-black text-lime-200">
          <Download className="h-4 w-4"/>Проверить скачивание
        </a>
      </div>
      {active&&<div className="mt-3 grid gap-2 text-[10px] text-slate-400 sm:grid-cols-3">
        <p>Размер: <b className="text-white">{mb(active.fileSize)}</b></p>
        <p>Опубликован: <b className="text-white">{date(active.publishedAt)}</b></p>
        <p className="truncate" title={active.sha256}>SHA-256: <b className="font-mono text-white">{active.sha256.slice(0,12)}…</b></p>
      </div>}
    </div>

    <div className="rounded-2xl border border-cyan-400/20 bg-slate-950 p-4 space-y-3">
      <div className="flex items-center gap-2"><Upload className="h-4 w-4 text-cyan-300"/><p className="text-sm font-black text-white">Загрузить новую APK-версию</p></div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] text-slate-400">Версия приложения
          <input value={versionName} onChange={e=>setVersionName(e.target.value)} placeholder="например 1.0.32" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs font-bold text-white outline-none focus:border-cyan-400"/>
        </label>
        <label className="text-[10px] text-slate-400">Android versionCode
          <input inputMode="numeric" value={versionCode} onChange={e=>setVersionCode(e.target.value.replace(/\D/g,''))} placeholder="например 32" className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-xs font-bold text-white outline-none focus:border-cyan-400"/>
        </label>
      </div>
      <label className="block text-[10px] text-slate-400">Что изменилось
        <textarea rows={3} maxLength={2000} value={releaseNotes} onChange={e=>setReleaseNotes(e.target.value)} placeholder="Краткое описание новой версии" className="mt-1 w-full resize-none rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-white outline-none focus:border-cyan-400"/>
      </label>

      <input ref={inputRef} type="file" accept=".apk,application/vnd.android.package-archive" onChange={e=>setFile(e.target.files?.[0]||null)} className="hidden"/>
      <button type="button" onClick={()=>inputRef.current?.click()} disabled={Boolean(busy)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 disabled:opacity-40">
        <FileArchive className="h-4 w-4"/>{file?`${file.name} · ${mb(file.size)}`:'Выбрать подписанный APK'}
      </button>

      {busy==='upload'&&<div className="space-y-1">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-cyan-400 transition-all" style={{width:`${progress}%`}}/></div>
        <p className="text-center text-[10px] font-bold text-cyan-200">Загрузка и проверка: {progress}%</p>
      </div>}

      <button type="button" disabled={!canUpload} onClick={()=>void upload()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">
        <Upload className="h-4 w-4"/>{busy==='upload'?'Загружаем…':'Загрузить как черновик'}
      </button>
      <p className="text-[9px] leading-relaxed text-slate-600">
        Сервер проверяет расширение, размер, APK/ZIP-заголовок и SHA-256. Подпись Android должна быть выполнена вашим production-ключом до загрузки. Публикация выполняется отдельной кнопкой после загрузки.
      </p>
    </div>

    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-sm font-black text-white">История APK-релизов</p>
      <p className="mt-1 text-[10px] text-slate-500">Любую сохранённую старую версию можно снова сделать активной — это быстрый откат.</p>
      <div className="mt-3 space-y-2">
        {releases.length===0?<p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-500">Загруженных через админку APK пока нет.</p>:
          releases.map(item=>{
            const rollback=Boolean(active&&item.versionCode<active.versionCode);
            return <div key={item.id} className={`rounded-xl border p-3 ${item.active?'border-lime-400/30 bg-lime-400/[0.05]':'border-slate-800 bg-slate-900'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black text-white">v{item.versionName} · build {item.versionCode}</p>
                    {item.active&&<span className="rounded-full bg-lime-400/15 px-2 py-0.5 text-[9px] font-black text-lime-300">АКТИВНА</span>}
                  </div>
                  <p className="mt-1 text-[9px] text-slate-500">{mb(item.fileSize)} · загружен {date(item.createdAt)}</p>
                  {item.releaseNotes&&<p className="mt-2 whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300">{item.releaseNotes}</p>}
                </div>
                <div className="flex gap-2">
                  {!item.active&&<button type="button" disabled={Boolean(busy)} onClick={()=>void publish(item)} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black disabled:opacity-40 ${rollback?'border border-amber-400/30 bg-amber-400/10 text-amber-200':'bg-lime-400 text-slate-950'}`}>
                    {rollback?<RotateCcw className="h-3.5 w-3.5"/>:<CheckCircle2 className="h-3.5 w-3.5"/>}{rollback?'Откатить':'Опубликовать'}
                  </button>}
                  {!item.active&&<button type="button" disabled={Boolean(busy)} onClick={()=>void remove(item)} className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-2 text-rose-300 disabled:opacity-40" title="Удалить APK">
                    <Trash2 className="h-3.5 w-3.5"/>
                  </button>}
                </div>
              </div>
            </div>;
          })}
      </div>
    </div>
  </section>;
}
