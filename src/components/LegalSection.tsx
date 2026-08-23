import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, ChevronDown, Building2, Mail, BadgeInfo, ShieldCheck, LifeBuoy } from 'lucide-react';
import { LEGAL_DOCUMENTS, APP_LEGAL_INFO } from '../lib/legal';
import { triggerHapticImpact } from '../services/native';
import { SafetyTab } from './SafetyTab';

type LegalView = 'safety' | 'documents';

interface LegalSectionProps {
  onReport?: () => void;
  onAdminTrigger?: () => void;
}

export const LegalSection: React.FC<LegalSectionProps> = ({ onReport, onAdminTrigger }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  // Safety rules open first — they are the most important for users
  const [view, setView] = useState<LegalView>('safety');

  return (
    <div className="space-y-4">
      {/* Safety / Documents switcher */}
      <div className="bg-slate-900 border border-slate-800 p-1 rounded-2xl flex gap-1">
        {([
          { id: 'safety' as LegalView, label: 'Безопасность', icon: ShieldCheck },
          { id: 'documents' as LegalView, label: 'Документы', icon: Scale }
        ]).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { triggerHapticImpact('light'); setView(tab.id); }}
              className={`flex-1 py-2.5 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 ${
                view === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          );
        })}
      </div>

      {view === 'safety' && <SafetyTab onReport={onReport} />}

      {view === 'documents' && (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center gap-2.5">
        <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
          <Scale className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-white">Правовая информация</h3>
          <p className="text-[11px] text-slate-400">Законодательство РФ и Санкт-Петербурга</p>
        </div>
      </div>

      <div className="space-y-2">
        {LEGAL_DOCUMENTS.map((docItem) => {
          const isOpen = openId === docItem.id;
          return (
            <div
              key={docItem.id}
              className={`rounded-2xl border overflow-hidden transition-colors ${
                isOpen ? 'bg-slate-950 border-emerald-500/40' : 'bg-slate-950 border-slate-800'
              }`}
            >
              <button
                onClick={() => { triggerHapticImpact('light'); setOpenId(isOpen ? null : docItem.id); }}
                className="w-full flex items-center gap-3 p-3.5 text-left"
              >
                <span className="text-xl shrink-0">{docItem.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-extrabold text-white truncate">{docItem.title}</h4>
                  <p className="text-[10px] text-slate-500">Ред. от {docItem.updatedAt}</p>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-slate-800"
                  >
                    <div className="p-4 space-y-3.5 max-h-80 overflow-y-auto no-scrollbar">
                      {docItem.sections.map((section, i) => (
                        <div key={i} className="space-y-1.5">
                          <h5 className="text-[11px] font-black text-emerald-400 uppercase tracking-wide">
                            {section.heading}
                          </h5>
                          {section.body.map((p, j) => (
                            <p key={j} className="text-[11px] text-slate-300 leading-relaxed">
                              {p}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Operator details — required for RuStore publication */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 space-y-2">
        <h4 className="text-[11px] font-black text-slate-300 flex items-center gap-1.5 mb-2">
          <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Сведения об операторе
        </h4>

        <div className="space-y-1">
          <p className="text-[11px] font-bold text-white">{APP_LEGAL_INFO.operator}</p>
          <p className="text-[10px] text-slate-400 font-mono">{APP_LEGAL_INFO.inn}</p>
          <p className="text-[10px] text-slate-400">{APP_LEGAL_INFO.region}</p>
        </div>

        <div className="pt-2 mt-1 border-t border-slate-800 space-y-1.5">
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
              Почта для связи
            </span>
            <a
              href={`mailto:${APP_LEGAL_INFO.contactEmail}`}
              className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 hover:underline"
            >
              <Mail className="w-3 h-3 shrink-0" /> {APP_LEGAL_INFO.contactEmail}
            </a>
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 block">
              Служба поддержки
            </span>
            <a
              href={`mailto:${APP_LEGAL_INFO.email}`}
              className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 hover:underline"
            >
              <LifeBuoy className="w-3 h-3 shrink-0" /> {APP_LEGAL_INFO.email}
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800">
          <span 
            onClick={onAdminTrigger} 
            className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer select-none active:text-emerald-400"
          >
            <BadgeInfo className="w-3 h-3" /> {APP_LEGAL_INFO.appName} v{APP_LEGAL_INFO.version}
          </span>
          <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/40">
            {APP_LEGAL_INFO.ageRating}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-slate-600 leading-relaxed text-center">
        Продолжая использовать приложение, вы подтверждаете согласие на обработку персональных данных
        в соответствии с 152-ФЗ.
      </p>
    </div>
      )}
    </div>
  );
};
