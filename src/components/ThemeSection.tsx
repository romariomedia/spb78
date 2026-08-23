import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Crown, Check, RotateCcw, Sparkles, Gauge, Zap } from 'lucide-react';
import {
  ACCENT_THEMES, SURFACE_THEMES, ThemePreferences,
  ThemeId, SurfaceId, getAccentTheme, getSurfaceTheme
} from '../lib/themes';
import { persistTheme, resetTheme } from '../services/theme';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';
import { CollapsibleCard } from './CollapsibleCard';

interface ThemeSectionProps {
  theme: ThemePreferences;
  onChange: (theme: ThemePreferences) => void;
  isPremium: boolean;
  onGoPremium: () => void;
}

export const ThemeSection: React.FC<ThemeSectionProps> = ({
  theme, onChange, isPremium, onGoPremium
}) => {
  const [saved, setSaved] = useState(false);

  const accent = getAccentTheme(theme.accent);
  const surface = getSurfaceTheme(theme.surface);

  const apply = async (next: ThemePreferences) => {
    onChange(next);
    await persistTheme(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  const pickAccent = (id: ThemeId, premium: boolean) => {
    if (premium && !isPremium) {
      triggerHapticNotification('warning');
      onGoPremium();
      return;
    }
    triggerHapticImpact('medium');
    apply({ ...theme, accent: id });
  };

  const pickSurface = (id: SurfaceId, premium: boolean) => {
    if (premium && !isPremium) {
      triggerHapticNotification('warning');
      onGoPremium();
      return;
    }
    triggerHapticImpact('medium');
    apply({ ...theme, surface: id });
  };

  return (
    <CollapsibleCard
      storageKey="sportbuddy_profile_theme_open_v1"
      className="bg-slate-900 border border-slate-800"
      defaultOpen={false}
      icon={
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center border"
          style={{
            background: `linear-gradient(135deg, ${accent.accent}33, ${accent.accentDeep}22)`,
            borderColor: `${accent.accent}66`
          }}
        >
          <Palette className="w-5 h-5" style={{ color: accent.accent }} />
        </div>
      }
      title="Тема оформления"
      subtitle={`${accent.emoji} ${accent.name} • ${surface.emoji} ${surface.name}`}
      collapsedSummary={`${accent.emoji} ${accent.name} • ${surface.emoji} ${surface.name}`}
      badge={
        isPremium ? (
          <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2.5 py-1 rounded-xl flex items-center gap-1">
            <Crown className="w-3 h-3 fill-slate-950" /> PRO
          </span>
        ) : (
          <span className="text-[10px] font-black bg-slate-800 text-slate-400 px-2.5 py-1 rounded-xl border border-slate-700">
            🔒
          </span>
        )
      }
    >
      {!isPremium && (
        <button
          onClick={onGoPremium}
          className="w-full bg-gradient-to-r from-amber-950/60 via-slate-950 to-amber-950/60 border border-amber-500/50 rounded-2xl p-3 text-left active:scale-[0.99] transition"
        >
          <p className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Персонализация — функция Premium
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Откройте 7 цветовых палитр и 3 фоновых темы
          </p>
        </button>
      )}

      {/* Live preview */}
      <div
        className="rounded-2xl p-4 border transition-colors"
        style={{ background: surface.surface, borderColor: surface.border }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent.accent}, ${accent.accentDeep})`,
              boxShadow: `0 0 14px rgba(${accent.glow}, 0.45)`
            }}
          >
            <Zap className="w-4 h-4" style={{ color: surface.bg }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-white">Предпросмотр интерфейса</p>
            <p className="text-[10px]" style={{ color: accent.accent }}>
              Так будут выглядеть акценты
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <span
            className="flex-1 py-2 rounded-xl text-[10px] font-black text-center"
            style={{ background: accent.accent, color: surface.bg }}
          >
            Кнопка
          </span>
          <span
            className="px-3 py-2 rounded-xl text-[10px] font-bold border"
            style={{
              background: `${accent.accent}1a`,
              borderColor: `${accent.accent}66`,
              color: accent.accent
            }}
          >
            Тег
          </span>
          <span
            className="px-3 py-2 rounded-xl text-[10px] font-bold border"
            style={{ background: surface.surfaceAlt, borderColor: surface.border, color: '#94a3b8' }}
          >
            Фон
          </span>
        </div>
      </div>

      {/* Accent palette */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Цветовая палитра
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {ACCENT_THEMES.map((t) => {
            const active = theme.accent === t.id;
            const locked = t.premium && !isPremium;
            return (
              <motion.button
                key={t.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => pickAccent(t.id, t.premium)}
                className={`relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition ${
                  active ? 'border-white' : 'border-slate-800'
                } ${locked ? 'opacity-55' : ''}`}
                style={{
                  background: `linear-gradient(140deg, ${t.accent}, ${t.accentDeep})`,
                  boxShadow: active ? `0 0 16px rgba(${t.glow}, 0.55)` : undefined
                }}
                title={t.description}
              >
                <span className="text-lg leading-none drop-shadow">{t.emoji}</span>
                <span className="text-[8px] font-black text-slate-950/85 px-1 text-center leading-tight">
                  {t.name}
                </span>
                {active && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-slate-900 stroke-[3]" />
                  </span>
                )}
                {locked && (
                  <span className="absolute inset-0 rounded-2xl bg-slate-950/45 flex items-center justify-center text-xs">
                    🔒
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Surface themes */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Фон приложения
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {SURFACE_THEMES.map((s) => {
            const active = theme.surface === s.id;
            const locked = s.premium && !isPremium;
            return (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => pickSurface(s.id, s.premium)}
                className={`relative rounded-2xl border-2 p-2.5 flex flex-col items-center gap-1 transition ${
                  active ? 'border-white' : 'border-slate-800'
                } ${locked ? 'opacity-55' : ''}`}
                style={{ background: s.bg }}
              >
                <span
                  className="w-full h-5 rounded-md border"
                  style={{ background: s.surface, borderColor: s.border }}
                />
                <span className="text-sm leading-none">{s.emoji}</span>
                <span className="text-[8px] font-bold text-slate-300 text-center leading-tight">
                  {s.name}
                </span>
                {active && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                    <Check className="w-3 h-3 text-slate-900 stroke-[3]" />
                  </span>
                )}
                {locked && (
                  <span className="absolute inset-0 rounded-2xl bg-slate-950/50 flex items-center justify-center text-xs">
                    🔒
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Display options */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
          Отображение
        </h4>
        {([
          {
            key: 'reducedMotion' as const,
            label: 'Уменьшить анимации',
            hint: 'Меньше движения, дольше работа батареи',
            icon: Gauge
          },
          {
            key: 'compactMode' as const,
            label: 'Компактный режим',
            hint: 'Больше контента на экране',
            icon: Sparkles
          }
        ]).map((opt) => {
          const Icon = opt.icon;
          const on = theme[opt.key];
          return (
            <button
              key={opt.key}
              onClick={() => {
                if (!isPremium) { onGoPremium(); return; }
                triggerHapticImpact('light');
                apply({ ...theme, [opt.key]: !on });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 transition active:scale-[0.99]"
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: accent.accent }} />
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-[11px] font-bold text-slate-200">{opt.label}</span>
                <span className="block text-[10px] text-slate-500">{opt.hint}</span>
              </span>
              <span
                className="w-11 h-6 rounded-full relative transition-colors shrink-0"
                style={{ background: on ? accent.accent : '#334155' }}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    on ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            triggerHapticImpact('medium');
            onChange(resetTheme());
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
          }}
          className="flex-1 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-2xl text-[11px] transition active:scale-95 flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Сбросить
        </button>
        {saved && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 py-2.5 text-[11px] font-black text-center rounded-2xl border"
            style={{
              background: `${accent.accent}1a`,
              borderColor: `${accent.accent}66`,
              color: accent.accent
            }}
          >
            ✓ Тема применена
          </motion.span>
        )}
      </div>
    </CollapsibleCard>
  );
};
