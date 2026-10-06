import { useId } from 'react';
import { DISTRICTS, districtLabel } from '../../shared/districts.js';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  emptyLabel?: string;
  required?: boolean;
}
export function DistrictSelect({ value, onChange, label, emptyLabel = 'Не указан', required = false }: Props) {
  const id = useId();
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="block text-xs font-bold text-slate-300">{label}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value)} required={required}
      className="w-full min-w-0 min-h-11 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-400">
      <option value="">{emptyLabel}</option>
      {(['spb', 'lo'] as const).map(region => <optgroup key={region} label={region === 'spb' ? 'Санкт-Петербург' : 'Ленинградская область'}>
        {DISTRICTS.filter(item => item.region === region).map(item => <option key={item.id} value={item.id}>{districtLabel(item.id)}</option>)}
      </optgroup>)}
    </select>
  </div>;
}
