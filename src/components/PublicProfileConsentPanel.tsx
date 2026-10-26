import {useEffect,useMemo,useState} from 'react';
import {Eye,EyeOff,RefreshCw,ShieldCheck} from 'lucide-react';
import type {UserProfile} from '../lib/types';
import {
  PublicConsentGroup,grantPublicConsent,loadPublicConsent,revokePublicConsent
} from '../services/publicConsent';
import {Modal} from './Modal';
import {LegalSection} from './LegalSection';

const GROUPS:Array<{id:PublicConsentGroup;label:string;description:string}>=[
  {id:'identity',label:'Основные данные профиля',description:'Имя, возраст, пол и аватар.'},
  {id:'profile',label:'Спортивная анкета',description:'Описание, виды спорта и статус поиска напарника.'},
  {id:'portfolio',label:'Фото портфолио',description:'Спортивные фотографии, которые вы загрузили в портфолио.'},
  {id:'location',label:'Район и поиск рядом',description:'Район/локация и только округлённые сервером координаты. Точная точка устройства не публикуется.'},
  {id:'presence',label:'Статус активности',description:'Когда вы были активны в SportBuddy78.'},
  {id:'reputation',label:'Спортивная статистика',description:'Рейтинг, количество тренировок, медали и отметка верификации.'},
  {id:'trainer',label:'Профиль персонального тренера',description:'Проверенные публичные сведения о тренерских услугах.'}
];

export function PublicProfileConsentPanel({user}:{user:UserProfile}){
  const [active,setActive]=useState(false);
  const [groups,setGroups]=useState<PublicConsentGroup[]>([]);
  const [selected,setSelected]=useState<PublicConsentGroup[]>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [legalOpen,setLegalOpen]=useState(false);

  const available=useMemo(
    ()=>GROUPS.filter(group=>group.id!=='trainer'||user.personalTrainer?.enabled===true),
    [user.personalTrainer?.enabled]
  );

  const load=async()=>{
    setBusy(true);setError('');
    try{
      const consent=await loadPublicConsent();
      setActive(consent.active);
      setGroups(consent.groups);
      setSelected(consent.groups);
    }catch(e){setError(e instanceof Error?e.message:'Не удалось загрузить настройки публичности.');}
    finally{setBusy(false);}
  };
  useEffect(()=>{void load();},[]);

  const toggle=(id:PublicConsentGroup)=>{
    setSelected(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
    setConfirmed(false);
    setNotice('');
  };

  const grant=async()=>{
    if(!confirmed){setError('Подтвердите отдельное согласие на распространение выбранных данных.');return;}
    if(selected.length===0){setError('Выберите хотя бы одну категорию данных.');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const next=await grantPublicConsent(selected);
      setActive(next.active);setGroups(next.groups);setSelected(next.groups);setConfirmed(false);
      setNotice('Настройки публичного профиля сохранены. Изменения применяются сервером сразу.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить согласие.');}
    finally{setBusy(false);}
  };

  const revoke=async()=>{
    setBusy(true);setError('');setNotice('');
    try{
      const next=await revokePublicConsent();
      setActive(next.active);setGroups(next.groups);setSelected(next.groups);setConfirmed(false);
      setNotice('Согласие отозвано. Профиль исключён из общего поиска и рейтинга.');
    }catch(e){setError(e instanceof Error?e.message:'Не удалось отозвать согласие.');}
    finally{setBusy(false);}
  };

  return <section className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-4 space-y-3 shadow-xl">
    <div className="flex items-start gap-3">
      <span className="rounded-2xl bg-cyan-400/10 p-2.5 text-cyan-300">{active?<Eye className="h-5 w-5"/>:<EyeOff className="h-5 w-5"/>}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-white">Публичность профиля</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          Профиль показывается другим пользователям только после отдельного согласия на распространение персональных данных.
        </p>
      </div>
      <button type="button" onClick={()=>void load()} disabled={busy} className="rounded-xl p-2 text-slate-400 disabled:opacity-40" aria-label="Обновить">
        <RefreshCw className={`h-4 w-4 ${busy?'animate-spin':''}`}/>
      </button>
    </div>

    <div className={`rounded-xl border p-3 text-[11px] ${active?'border-emerald-500/30 bg-emerald-500/10 text-emerald-200':'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
      {active
        ? 'Публичный профиль включён. Ниже можно изменить разрешённые категории или полностью отозвать согласие.'
        : 'Публичный профиль выключен. Другие пользователи не должны видеть вашу анкету в поиске и рейтинге.'}
    </div>

    <div className="space-y-2">
      {available.map(group=><label key={group.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
        <input
          type="checkbox"
          checked={selected.includes(group.id)}
          onChange={()=>toggle(group.id)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
        />
        <span className="min-w-0">
          <span className="block text-[11px] font-black text-white">{group.label}</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">{group.description}</span>
        </span>
      </label>)}
    </div>

    <button type="button" onClick={()=>setLegalOpen(true)} className="text-[10px] font-black text-cyan-300 underline underline-offset-2">
      Открыть условия публичного размещения данных
    </button>

    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={e=>setConfirmed(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-400"
      />
      <span className="text-[10px] leading-relaxed text-slate-300">
        Я отдельно разрешаю SportBuddy78 распространять <b className="text-white">только выбранные выше категории</b>
        для публичного профиля и понимаю, что согласие можно отозвать.
      </span>
    </label>

    {error&&<p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-[11px] text-rose-200">{error}</p>}
    {notice&&<p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-[11px] text-emerald-200">{notice}</p>}

    <div className="grid gap-2 sm:grid-cols-2">
      <button type="button" disabled={busy||!confirmed||selected.length===0} onClick={()=>void grant()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 text-xs font-black text-slate-950 disabled:bg-slate-800 disabled:text-slate-500">
        <ShieldCheck className="h-4 w-4"/>{active?'Сохранить разрешённые данные':'Включить публичный профиль'}
      </button>
      <button type="button" disabled={busy||!active} onClick={()=>void revoke()} className="min-h-11 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-black text-rose-200 disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600">
        Отозвать согласие
      </button>
    </div>

    {groups.length>0&&<p className="text-[9px] leading-relaxed text-slate-600">Серверная активная конфигурация: {groups.join(', ')}.</p>}

    <Modal isOpen={legalOpen} onClose={()=>setLegalOpen(false)} title="Публичное размещение персональных данных" subtitle="Отдельное согласие" maxWidth="xl">
      <LegalSection initialView="documents" initialDocumentId="dissemination"/>
    </Modal>
  </section>;
}
