import {useEffect,useRef,useState} from 'react';
import {UserProfile} from '../lib/types';
import {DiscoveryFilters,DEFAULT_DISCOVERY_FILTERS} from '../services/discoveryPolicy';
const levels=[['beginner','Начинающий'],['amateur','Любитель'],['advanced','Опытный'],['pro','Профессионал']];
const times=[['morning','Утро'],['day','День'],['evening','Вечер'],['weekend','Выходные']];
const selectClass='mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-white focus:border-lime-300';
export function DiscoverySettings({user,filters,onFilters,hasLocation,onLocate,onSave,onSaved}:{user:UserProfile;filters:DiscoveryFilters;onFilters:(next:DiscoveryFilters)=>void;hasLocation:boolean;onLocate:()=>void;onSave:(updates:Partial<UserProfile>)=>Promise<UserProfile|null>;onSaved:(user:UserProfile)=>void}){
  const [level,setLevel]=useState<NonNullable<UserProfile['trainingLevel']>>(user.trainingLevel||'');
  const [slots,setSlots]=useState(user.trainingTimes||[]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  async function save(){
    if(busy)return;setBusy(true);setMessage('');
    try{const updated=await onSave({trainingLevel:level,trainingTimes:slots});if(alive.current){if(!updated)throw Error('Не удалось сохранить настройки');onSaved(updated);setMessage('Настройки анкеты сохранены');}}
    catch(error){if(alive.current)setMessage(error instanceof Error?error.message:'Не удалось сохранить');}
    finally{if(alive.current)setBusy(false);}
  }
  return <details className="rounded-3xl border border-lime-300/15 bg-slate-900/90 p-4">
    <summary className="min-h-8 cursor-pointer text-sm font-bold text-lime-300">Настроить знакомства{(filters.radius||filters.level||filters.time)?' · фильтры включены':''}</summary>
    <div className="mt-4 space-y-5">
      <fieldset><legend className="text-sm font-bold text-white">Кого показывать в свайпах</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-300">Расстояние<select aria-label="Расстояние" className={selectClass} value={filters.radius} onChange={e=>onFilters({...filters,radius:Number(e.target.value)})}><option value={0}>Любое</option>{[5,10,25,50,100].map(km=><option key={km} value={km}>До {km} км</option>)}</select></label>
          <label className="text-xs text-slate-300">Уровень подготовки<select aria-label="Уровень подготовки" className={selectClass} value={filters.level} onChange={e=>onFilters({...filters,level:e.target.value})}><option value="">Любой</option>{levels.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
          <label className="text-xs text-slate-300">Время тренировок<select aria-label="Время тренировок" className={selectClass} value={filters.time} onChange={e=>onFilters({...filters,time:e.target.value})}><option value="">Любое</option>{times.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
        </div>
        {!!filters.radius&&!hasLocation&&<button onClick={onLocate} className="mt-3 min-h-11 text-sm text-lime-300">Определить местоположение для поиска рядом</button>}
        <p className="mt-3 text-xs leading-relaxed text-slate-400">При выбранном фильтре показываем анкеты, в которых указаны подходящие данные. Расстояние приблизительное.</p>
        <button onClick={()=>onFilters(DEFAULT_DISCOVERY_FILTERS)} className="mt-2 min-h-11 text-xs text-slate-300">Сбросить фильтры</button>
      </fieldset>
      <fieldset disabled={busy} className="border-t border-white/10 pt-4"><legend className="text-sm font-bold text-white">Мои предпочтения</legend>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Укажите по желанию. Данные появятся в анкете при разрешённой публикации информации профиля.</p>
        <label className="mt-3 block text-xs text-slate-300">Мой уровень<select aria-label="Мой уровень" className={selectClass} value={level} onChange={e=>setLevel(e.target.value as UserProfile['trainingLevel']||'')}><option value="">Не указан</option>{levels.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
        <div className="mt-3 flex flex-wrap gap-2">{times.map(([id,title])=><button type="button" key={id} aria-pressed={slots.includes(id!)} onClick={()=>setSlots(previous=>previous.includes(id!)?previous.filter(x=>x!==id):[...previous,id!])} className={'min-h-11 rounded-xl border px-3 text-xs '+(slots.includes(id!)?'border-lime-300/40 bg-lime-300/15 text-lime-300':'border-white/10 text-slate-300')}>{title}</button>)}</div>
        <button onClick={()=>void save()} className="mt-4 min-h-11 rounded-xl bg-lime-300 px-4 text-sm font-bold text-slate-950">{busy?'Сохраняем…':'Сохранить мои предпочтения'}</button>
      </fieldset>
      {message&&<p role="status" className="text-sm text-slate-300">{message}</p>}
    </div>
  </details>;
}
