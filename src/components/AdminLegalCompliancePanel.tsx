import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,CheckCircle2,RefreshCw,Save,ShieldCheck,XCircle} from 'lucide-react';
import {
  AdminLegalCompliance,LegalCheckKey,loadAdminLegalCompliance,saveAdminLegalCompliance
} from '../services/adminLegalCompliance';

const CHECKS:Array<{key:LegalCheckKey;title:string;description:string;evidence?:keyof AdminLegalCompliance['state']['evidence']}>= [
  {key:'pdLocalizationConfirmed',title:'Локализация персональных данных',description:'Документально подтверждено, где выполняются первичная запись, систематизация, накопление, хранение, уточнение и извлечение ПД граждан РФ.',evidence:'pdLocalization'},
  {key:'rknNotificationConfirmed',title:'Уведомление Роскомнадзора',description:'Сведения оператора, цели, категории ПД, информационные системы и места баз проверены и актуализированы.',evidence:'rkn'},
  {key:'crossBorderReviewed',title:'Трансграничная передача',description:'Все зарубежные получатели/обработчики инвентаризированы; необходимые уведомления/основания оформлены либо передача исключена.',evidence:'crossBorder'},
  {key:'oriStatusReviewed',title:'Чаты / статус ОРИ',description:'Получено правовое решение по режиму организатора распространения информации и обязательствам по хранению/уведомлению.',evidence:'ori'},
  {key:'publicDisseminationFlowReviewed',title:'Публичные персональные данные',description:'Отдельное согласие на распространение, категории данных и отзыв согласия проверены на production-flow.'},
  {key:'ordIntegrationConfirmed',title:'ОРД / ERID / интернет-реклама',description:'Выбран ОРД, ERID реально получается до публикации, отчётность и обязательные отчисления организованы.',evidence:'ord'},
  {key:'kktFiscalizationConfirmed',title:'ККТ / YooKassa / 54-ФЗ',description:'СНО, НДС, признак способа расчёта, номенклатура и чековый сценарий проверены на реальном кассовом контуре.',evidence:'kkt'},
  {key:'incidentPlanApproved',title:'Регламент инцидентов ПД',description:'Ответственные и процедура уведомления/расследования инцидентов утверждены.'},
  {key:'retentionPolicyApproved',title:'Сроки хранения и удаления',description:'Утверждена матрица сроков хранения, включая договоры, платежи, чаты и резервные копии.'},
  {key:'lawyerReviewConfirmed',title:'Финальная юридическая проверка',description:'Актуальные тексты и фактическая архитектура проверены российским профильным юристом.',evidence:'lawyer'},
  {key:'accountantReviewConfirmed',title:'Финальная бухгалтерская проверка',description:'Налоги, чеки, НДС/без НДС и договорно-платёжная модель подтверждены бухгалтером.',evidence:'accountant'}
];

const ENV:Array<{key:keyof AdminLegalCompliance['environment'];label:string;critical?:boolean}>=[
  {key:'legalGate',label:'SB_LEGAL_COMPLIANCE_READY',critical:true},
  {key:'adMarkingGate',label:'SB_AD_MARKING_READY',critical:true},
  {key:'yookassaConfigured',label:'YooKassa shop/secret'},
  {key:'receiptMode',label:'Receipt mode'},
  {key:'vatConfigured',label:'Код НДС'},
  {key:'paymentModeConfigured',label:'Признак способа расчёта'},
  {key:'taxSystemConfigured',label:'Код СНО'}
];

export function AdminLegalCompliancePanel(){
  const [data,setData]=useState<AdminLegalCompliance|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const load=async()=>{
    setBusy(true);setError('');
    try{setData(await loadAdminLegalCompliance());}
    catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить юридическую готовность.');}
    finally{setBusy(false);}
  };
  useEffect(()=>{void load();},[]);

  const completed=useMemo(()=>data?CHECKS.filter(item=>data.state.checks[item.key]).length:0,[data]);

  const toggle=(key:LegalCheckKey)=>{
    if(!data)return;
    setData({...data,state:{...data.state,checks:{...data.state.checks,[key]:!data.state.checks[key]}}});
    setNotice('');
  };

  const evidence=(key:keyof AdminLegalCompliance['state']['evidence'],value:string)=>{
    if(!data)return;
    setData({...data,state:{...data.state,evidence:{...data.state.evidence,[key]:value}}});
  };

  const save=async()=>{
    if(!data)return;
    setBusy(true);setError('');setNotice('');
    try{
      const saved=await saveAdminLegalCompliance(data.state);
      setData(saved);
      setNotice('Юридический чек-лист сохранён в журналируемом административном контуре.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить юридический чек-лист.');}
    finally{setBusy(false);}
  };

  if(!data&&!error)return <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-400">Загружаем юридическую готовность…</div>;

  return <section className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Compliance Center</p>
        <h3 className="mt-1 text-base font-black text-white">Юридическая готовность SportBuddy78</h3>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
          Чек-лист фиксирует фактические подтверждения. Он не меняет production ENV, не включает оплату и не заменяет документы Роскомнадзора, ОРД, ККТ, юриста или бухгалтера.
        </p>
      </div>
      <button type="button" disabled={busy} onClick={()=>void load()} className="rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-slate-300 disabled:opacity-40">
        <RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>
      </button>
    </div>

    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs text-emerald-200">{notice}</p>}

    {data&&<>
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-white">Внешние и организационные обязательства</p>
              <p className="mt-1 text-[10px] text-slate-500">{completed} из {CHECKS.length} подтверждено</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${completed===CHECKS.length?'bg-emerald-500/15 text-emerald-300':'bg-amber-500/15 text-amber-200'}`}>
              {completed===CHECKS.length?'CHECKLIST COMPLETE':'НЕ ГОТОВО'}
            </span>
          </div>
          <div className="space-y-2">
            {CHECKS.map(item=>{
              const checked=data.state.checks[item.key];
              return <div key={item.key} className={`rounded-xl border p-3 ${checked?'border-emerald-500/25 bg-emerald-500/[0.05]':'border-slate-800 bg-slate-900'}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={checked} onChange={()=>toggle(item.key)} className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"/>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-xs font-black text-white">
                      {checked?<CheckCircle2 className="h-4 w-4 text-emerald-400"/>:<XCircle className="h-4 w-4 text-slate-600"/>}{item.title}
                    </span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{item.description}</span>
                  </span>
                </label>
                {item.evidence&&<textarea
                  rows={2}
                  maxLength={600}
                  value={data.state.evidence[item.evidence]}
                  onChange={e=>evidence(item.evidence!,e.target.value)}
                  placeholder="Ссылка/номер документа, дата, поставщик, комментарий — без паролей и секретных ключей"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-[10px] text-slate-200 outline-none focus:border-cyan-400"
                />}
              </div>;
            })}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-slate-950 p-4">
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300"/><p className="text-sm font-black text-white">Server gates</p></div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Только чтение из production environment.</p>
            <div className="mt-3 space-y-2">{ENV.map(item=>{
              const ok=data.environment[item.key]===true;
              return <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                <span className="text-[10px] text-slate-300">{item.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${ok?'bg-emerald-500/15 text-emerald-300':'bg-rose-500/15 text-rose-300'}`}>{ok?'OK':'OFF'}</span>
              </div>;
            })}</div>
          </div>

          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
            <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"/><div>
              <p className="text-xs font-black text-amber-100">Двойная блокировка запуска</p>
              <p className="mt-1 text-[10px] leading-relaxed text-amber-100/70">
                Даже полный чек-лист не включает ENV. И наоборот: ENV не является доказательством исполнения закона. Перед реальной оплатой должны совпасть и фактическая готовность, и серверные gates.
              </p>
            </div></div>
          </div>

          <textarea
            rows={7}
            maxLength={1200}
            value={data.state.notes}
            onChange={e=>setData({...data,state:{...data.state,notes:e.target.value}})}
            placeholder="Общие заметки по юридической готовности"
            className="w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
          />
        </aside>
      </div>

      <button type="button" disabled={busy} onClick={()=>void save()} className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950 disabled:opacity-50">
        <Save className="h-4 w-4"/>{busy?'Сохраняем…':'Сохранить юридический чек-лист'}
      </button>

      {data.state.updatedAt&&<p className="text-center text-[9px] text-slate-600">Последнее изменение: {new Date(data.state.updatedAt).toLocaleString('ru-RU')} · {data.state.updatedBy||'admin'}</p>}
    </>}
  </section>;
}
