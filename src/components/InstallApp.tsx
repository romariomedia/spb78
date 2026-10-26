import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Download, PlusSquare, Share, Smartphone } from 'lucide-react';
import { Modal } from './Modal';
import { INSTALL_PROMO_HERO } from '../assets/installPromoHero';

interface InstallAppProps {
  autoPromptEnabled?: boolean;
}

const PROMPT_DISMISSED_KEY = 'sportbuddy_install_prompt_dismissed_v3';
const ANDROID_APK = '/downloads/sportbuddy78-rustore-v28.apk';

export function InstallApp({ autoPromptEnabled = true }: InstallAppProps) {
  const [open, setOpen] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [heroFailed, setHeroFailed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const device = useMemo(() => {
    const ua = navigator.userAgent || '';
    return {
      ios: /iPad|iPhone|iPod/i.test(ua),
      android: /Android/i.test(ua)
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () =>
      setInstalled(media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (
      !autoPromptEnabled ||
      installed ||
      dismissed ||
      Capacitor.isNativePlatform()
    ) return;

    const timer = window.setTimeout(() => setOpen(true), 1400);
    return () => window.clearTimeout(timer);
  }, [autoPromptEnabled, dismissed, installed]);

  if (Capacitor.isNativePlatform() || installed) return null;

  const markDismissed = () => {
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, '1');
    } catch {
      // Storage may be disabled; closing still works for the current session.
    }
    setDismissed(true);
  };

  const close = () => {
    markDismissed();
    setOpen(false);
    setIosHelp(false);
  };

  const openFromHeader = () => {
    setIosHelp(false);
    setOpen(true);
  };

  const androidButton = (
    <a
      href={ANDROID_APK}
      download="sportbuddy78-rustore-v28.apk"
      onClick={markDismissed}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-lime-300/35 bg-lime-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-lime-200 active:scale-[0.98]"
    >
      <Download size={18} />
      Скачать для Android
    </a>
  );

  const iosButton = (
    <button
      type="button"
      onClick={() => setIosHelp(true)}
      className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:border-lime-300 hover:bg-slate-700 active:scale-[0.98]"
    >
      <Smartphone size={18} />
      Установить на iPhone
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={openFromHeader}
        className="relative flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-xl border border-lime-300/25 bg-lime-300/10 px-2 text-lime-300 transition hover:border-lime-300/50 hover:bg-lime-300/15 hover:text-lime-200 active:scale-95"
        aria-label="Установить приложение SportBuddy78"
        title="Установить SportBuddy78"
      >
        <Smartphone className="h-4 w-4" />
        <span className="hidden text-[10px] font-black tracking-wide xl:inline">APP</span>
        {!dismissed && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-slate-950 bg-lime-300 shadow-[0_0_8px_rgba(190,242,100,.8)]"
          />
        )}
      </button>

      {createPortal(
        <Modal
          isOpen={open}
          onClose={close}
          title="SportBuddy78 в твоём телефоне"
          subtitle="Тренировки, люди, площадки и события — всегда под рукой"
          maxWidth="xl"
        >
          <div className="space-y-4">
            <div className="relative aspect-video overflow-hidden rounded-2xl border border-lime-300/20 bg-slate-950 shadow-[0_16px_48px_rgba(0,0,0,.35)]">
              {!heroFailed ? (
                <img
                  src={INSTALL_PROMO_HERO}
                  alt="SportBuddy78 — найди своих, двигайся вместе"
                  className="h-full w-full object-cover"
                  decoding="async"
                  loading="eager"
                  onError={() => setHeroFailed(true)}
                />
              ) : (
                <div className="flex h-full w-full flex-col justify-end bg-[radial-gradient(circle_at_75%_20%,rgba(190,242,100,.22),transparent_28%),linear-gradient(135deg,#101827,#020617_72%)] p-5 sm:p-7">
                  <div className="mb-auto flex items-center gap-2 text-lime-300">
                    <Smartphone className="h-5 w-5" />
                    <span className="text-[10px] font-black uppercase tracking-[.22em]">SportBuddy78 App</span>
                  </div>
                  <p className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                    Найди своих. <span className="text-lime-300">Двигайся вместе.</span>
                  </p>
                  <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                    Тренировки, люди, площадки, активный отдых и спортивные события Санкт-Петербурга.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-black text-white">Установи SportBuddy78 и открывай сервис одним касанием</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                На Android доступен APK. На iPhone SportBuddy78 устанавливается из Safari на экран «Домой» как веб-приложение.
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {device.ios ? iosButton : androidButton}
                {device.ios ? androidButton : iosButton}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Android — APK v28, около 20 МБ. После скачивания открой файл для установки.
                iPhone — открой sportbuddy78.pro именно в Safari.
              </p>
            </div>

            {iosHelp && (
              <div className="space-y-2 rounded-2xl border border-lime-300/20 bg-lime-300/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">Установка на iPhone</p>
                  <span className="rounded-full bg-lime-300/10 px-2 py-1 text-[10px] font-black text-lime-200">SAFARI</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <Share className="mb-2 h-5 w-5 text-lime-300" />
                    <p className="text-xs font-black text-white">1. Поделиться</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">В Safari нажми кнопку «Поделиться».</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <PlusSquare className="mb-2 h-5 w-5 text-lime-300" />
                    <p className="text-xs font-black text-white">2. На экран «Домой»</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Выбери добавление сайта на домашний экран.</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                    <Smartphone className="mb-2 h-5 w-5 text-lime-300" />
                    <p className="text-xs font-black text-white">3. Добавить</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Подтверди — иконка SportBuddy78 появится рядом с приложениями.</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={close}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800"
            >
              Не сейчас
            </button>
          </div>
        </Modal>,
        document.body
      )}
    </>
  );
}
