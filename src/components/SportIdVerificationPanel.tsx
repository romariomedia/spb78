import { useEffect,useMemo,useRef,useState } from 'react';
import { CheckCircle2,ExternalLink,FileCheck2,ImagePlus,RefreshCw,Send,ShieldCheck,XCircle } from 'lucide-react';
import { SportPassportSnapshot } from '../services/sportPassport';
import {
  cancelSportIdVerification,loadSportIdVerificationRequests,SportIdClaimType,
  SportIdVerificationRequest,submitSportIdVerification
} from '../services/sportIdVerification';
import { uploadMedia } from '../services/cloudinary';
import { compressImage } from '../services/media';

interface Props{data:SportPassportSnapshot|null;onVerifiedChanged:()=>void}

const statusLabel:Record<string,string>={
  pending:'На проверке',approved:'Подтверждено',rejected:'Отклонено',revoked:'Отозвано',cancelled:'Отменено'
};
const statusClass:Record<string,string>={
  pending:'bg-amber-500/15 text-amber-300',approved:'bg-emerald-500/15 text-emerald-300',
  rejected:'bg-rose-500/15 text-rose-300',revoked:'bg-slate-800 text-slate-400',cancelled:'bg-slate-800 text-slate-500'
};

export function SportIdVerificationPanel({data,onVerifiedChanged}:Props){
  const [requests,setRequests]=useState<SportIdVerificationRequest[]>([]);
  const [claimType,setClaimType]=useState<SportIdClaimType>('rank');
  const [claimId,setClaimId]=useState('');
  const [evidenceUrl,setEvidenceUrl]=useState('');
  const [officialUrl,setOfficialUrl]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const inputRef=useRef<HTMLInputElement>(null);

  const refresh=async()=>{setBusy('load');setError('');try{setRequests(await loadSportIdVerificationRequests());}catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить заявки');}finally{setBusy('');}};
  useEffect(()=>{void refresh();},[]);
  useEffect(()=>{if(claimType==='achievement'&&!claimId&&data?.achievements?.[0])setClaimId(data.achievements[0].id);},[claimType,claimId,data]);

  const currentClaim=useMemo(()=>{
    if(!data)return null;
    if(claimType==='rank')return data.profile.rankTitle?{id:'rank',title:data.profile.rankTitle,verification:data.profile.rankVerification}:null;
    return data.achievements.find(item=>item.id===claimId)||null;
  },[data,claimType,claimId]);

  const relevant=useMemo(()=>requests.filter(r=>r.claimType===claimType&&(claimType==='rank'||r.claimId===claimId)).slice(0,3),[requests,claimType,claimId]);

  const upload=async(file?:File)=>{
    if(!file)return;setBusy('upload');setError('');
    try{
      let payload=file;
      if(file.type.startsWith('image/'))payload=await compressImage(file,1800,0.86);
      const result=await uploadMedia(payload,{folder:'sportbuddy/sport-id-verification',resourceType:'auto',tags:['sport-id-verification']});
      setEvidenceUrl(result.secureUrl);setNotice('Документ загружен.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить документ');}
    finally{setBusy('');}
  };

  const submit=async()=>{
    setBusy('submit');setError('');setNotice('');
    try{
      await submitSportIdVerification({claimType,claimId:claimType==='achievement'?claimId:undefined,evidenceUrl,officialUrl,note});
      setEvidenceUrl('');setOfficialUrl('');setNote('');setNotice('Заявка отправлена в Verification Center.');
      await refresh();onVerifiedChanged();
    }catch(e){setError(e instanceof Error?e.message:'Не удалось отправить заявку');}
    finally{setBusy('');}
  };

  const cancel=async(requestId:string)=>{
    setBusy(requestId);setError('');
    try{await cancelSportIdVerification(requestId);setNotice('Заявка отменена.');await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Не удалось отменить заявку');}
    finally{setBusy('');}
  };

  const alreadyVerified=currentClaim?.verification==='verified';
  return <section className="rounded-3xl border border-emerald-500/25 bg-slate-950 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-300"/><p className="text-xs font-black text-white">Verification Center</p></div><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Подтвердите разряд или конкретное достижение документом, скриншотом либо официальной ссылкой.</p></div>
      <button onClick={()=>void refresh()} disabled={busy==='load'} className="rounded-xl border border-slate-800 p-2 text-slate-400"><RefreshCw className={'h-3.5 w-3.5 '+(busy==='load'?'animate-spin':'')}/></button>
    </div>
    {error&&<p className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5 text-[10px] text-rose-200">{error}</p>}
    {notice&&<p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-[10px] text-emerald-200">{notice}</p>}

    <div className="grid grid-cols-2 gap-2">
      <button onClick={()=>{setClaimType('rank');setClaimId('');}} className={'rounded-xl px-3 py-2.5 text-[10px] font-black '+(claimType==='rank'?'bg-emerald-500 text-slate-950':'border border-slate-800 bg-slate-900 text-slate-400')}>Разряд / статус</button>
      <button onClick={()=>setClaimType('achievement')} className={'rounded-xl px-3 py-2.5 text-[10px] font-black '+(claimType==='achievement'?'bg-emerald-500 text-slate-950':'border border-slate-800 bg-slate-900 text-slate-400')}>Достижение</button>
    </div>

    {claimType==='rank'&&!data?.profile.rankTitle&&<p className="rounded-xl border border-dashed border-slate-800 p-3 text-[10px] text-slate-500">Сначала укажите разряд или спортивный статус в разделе «Спортивная биография».</p>}
    {claimType==='achievement'&&<select value={claimId} onChange={e=>setClaimId(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-[10px] text-white"><option value="">Выберите достижение</option>{(data?.achievements||[]).map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select>}

    {currentClaim&&<div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex items-start justify-between gap-2"><div><p className="text-[9px] text-slate-500">Подтверждаемый факт</p><p className="mt-1 text-[11px] font-black text-white">{currentClaim.title}</p></div>{alreadyVerified&&<span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[8px] font-black text-emerald-300"><CheckCircle2 className="h-3 w-3"/>Подтверждено</span>}</div>
    </div>}

    {!alreadyVerified&&currentClaim&&<>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>void upload(e.target.files?.[0])}/>
          <button onClick={()=>inputRef.current?.click()} disabled={busy==='upload'} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900 py-2.5 text-[10px] font-bold text-slate-300 disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5"/>{busy==='upload'?'Загрузка…':evidenceUrl?'Документ загружен':'Фото / PDF документа'}</button>
        </div>
        <input value={officialUrl} onChange={e=>setOfficialUrl(e.target.value)} placeholder="https://официальный-сайт/результат" className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-[10px] text-white outline-none focus:border-emerald-500"/>
      </div>
      {evidenceUrl&&<a href={evidenceUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] font-bold text-emerald-300"><FileCheck2 className="h-3.5 w-3.5"/>Открыть загруженное подтверждение <ExternalLink className="h-3 w-3"/></a>}
      <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={800} rows={2} placeholder="Комментарий проверяющему — например, федерация, турнир, номер протокола" className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900 p-3 text-[10px] text-white outline-none focus:border-emerald-500"/>
      <button onClick={()=>void submit()} disabled={busy!==''||(!evidenceUrl&&!officialUrl)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-[10px] font-black text-slate-950 disabled:opacity-40"><Send className="h-3.5 w-3.5"/>Отправить на подтверждение</button>
    </>}

    {relevant.length>0&&<div className="space-y-2 border-t border-slate-800 pt-3">{relevant.map(r=><div key={r.id} className="rounded-xl bg-slate-900 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-black text-white">{r.title}</p><p className="mt-1 text-[8px] text-slate-500">{new Date(r.updatedAt||r.createdAt).toLocaleString('ru-RU')}</p></div><span className={'rounded-full px-2 py-1 text-[8px] font-black '+(statusClass[r.status]||'bg-slate-800 text-slate-400')}>{statusLabel[r.status]||r.status}</span></div>{r.reviewNote&&<p className="mt-2 text-[9px] leading-relaxed text-slate-400">Комментарий: {r.reviewNote}</p>}{r.status==='pending'&&<button onClick={()=>void cancel(r.id)} disabled={busy===r.id} className="mt-2 flex items-center gap-1 text-[9px] font-bold text-rose-300"><XCircle className="h-3.5 w-3.5"/>Отменить заявку</button>}</div>)}</div>}
  </section>;
}
