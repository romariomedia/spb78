import {useEffect,useState} from 'react';
import {CheckCircle2,FileText,RefreshCw,ShieldCheck} from 'lucide-react';
import {LegalSection} from './LegalSection';
import {
  USER_LEGAL_VERSION,loadLegalAcceptanceStatus,recordCurrentLegalAcceptance
} from '../services/legalAcceptance';

export function LegalReacceptanceGate({active}:{active:boolean}){
  const [status,setStatus]=useState<'idle'|'loading'|'complete'|'required'|'error'>('idle');
  const [terms,setTerms]=useState(false);
  const [personalData,setPersonalData]=useState(false);
  const [documents,setDocuments]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  const check=async()=>{
    if(!active){setStatus('idle');return;}
    setStatus('loading');setError('');
    try{
      const next=await loadLegalAcceptanceStatus();
      setStatus(next.complete?'complete':'required');
    }catch(e){
      setStatus('error');
      setError(e instanceof Error?e.message:'Не удалось проверить актуальность правовых согласий.');
    }
  };

  useEffect(()=>{void check();},[active]);

  const accept=async()=>{
    if(!terms||!personalData)return;
    setSaving(true);setError('');
    try{
      const next=await recordCurrentLegalAcceptance();
      if(!next.complete)throw new Error('Не удалось подтвердить все обязательные документы.');
      setStatus('complete');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось зафиксировать согласия.');}
    finally{setSaving(false);}
  };

  if(!active||status==='idle'||status==='complete')return null;

  return <div className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/98 px-3 py-6 text-slate-100 backdrop-blur-xl">
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-[28px] border border-emerald-400/25 bg-slate-900 p-5 shadow-2xl sm:p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300"><ShieldCheck className="h-6 w-6"/></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">SportBuddy78 · правовые документы</p>
            <h2 className="mt-1 text-xl font-black text-white">Подтвердите актуальную редакцию</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Правовая база SportBuddy78 обновлена. Для существующих аккаунтов мы отдельно фиксируем принятие Пользовательского соглашения и согласие на обработку персональных данных редакции {USER_LEGAL_VERSION}.
            </p>
          </div>
        </div>

        {status==='loading'&&<div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-xs text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin"/>Проверяем сохранённые согласия…
        </div>}

        {status==='error'&&<div className="mt-5 space-y-3 rounded-2xl border border-rose-500/30 bg-rose-950/20 p-4">
          <p className="text-xs leading-relaxed text-rose-200">{error||'Не удалось проверить правовые согласия.'}</p>
          <button type="button" onClick={()=>void check()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-xs font-black text-slate-950">
            <RefreshCw className="h-4 w-4"/>Повторить проверку
          </button>
        </div>}

        {status==='required'&&<div className="mt-5 space-y-3">
          <button type="button" onClick={()=>setDocuments(v=>!v)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 text-xs font-black text-cyan-200">
            <FileText className="h-4 w-4"/>{documents?'Скрыть документы':'Открыть документы перед подтверждением'}
          </button>

          {documents&&<div className="max-h-[46vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-2">
            <LegalSection initialView="documents"/>
          </div>}

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <input type="checkbox" checked={terms} onChange={e=>setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"/>
            <span className="text-xs leading-relaxed text-slate-300">
              Я отдельно принимаю <b className="text-white">Пользовательское соглашение SportBuddy78</b> актуальной редакции.
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <input type="checkbox" checked={personalData} onChange={e=>setPersonalData(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"/>
            <span className="text-xs leading-relaxed text-slate-300">
              Я отдельно предоставляю <b className="text-white">Согласие на обработку персональных данных</b> в объёме и для целей, указанных в соответствующем документе.
            </span>
          </label>

          <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3 text-[10px] leading-relaxed text-amber-100">
            Это подтверждение не включает согласие на распространение персональных данных. Публичность профиля, публикации в Ленте и внешний QR Sport ID регулируются отдельными согласиями.
          </p>

          {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}

          <button type="button" disabled={saving||!terms||!personalData} onClick={()=>void accept()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">
            <CheckCircle2 className="h-4 w-4"/>{saving?'Фиксируем…':'Принять и продолжить'}
          </button>
        </div>}
      </div>
    </div>
  </div>;
}
