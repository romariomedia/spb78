import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Download, Smartphone, Share, PlusSquare } from 'lucide-react';
import { Modal } from './Modal';

export function InstallApp() {
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(media.matches || !!(navigator as Navigator & {standalone?: boolean}).standalone);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  if (Capacitor.isNativePlatform() || installed) return null;
  return <section aria-label="Установка SportBuddy78" className="relative mx-auto my-3 w-[calc(100%_-_2rem)] max-w-4xl rounded-2xl border border-lime-300/20 bg-slate-900/90 p-3 text-slate-100">
    <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Smartphone size={18} className="text-lime-300"/>SportBuddy — всегда под рукой</div>
    <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-200"><Smartphone size={18}/>Установить на iPhone</button>
      <a href="/downloads/sportbuddy78-rustore-v28.apk" download="sportbuddy78-rustore-v28.apk" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-sm font-bold transition hover:border-lime-300"><Download size={18}/>Установить на Android</a>
    </div>
    <p className="mt-2 text-xs leading-relaxed text-slate-400">iPhone — через Safari · Android — APK v28, 20 МБ. После скачивания открой файл для установки.</p>
    {createPortal(<Modal isOpen={open} onClose={() => setOpen(false)} title="SportBuddy78 на iPhone" subtitle="Без App Store — с иконкой на экране «Домой»">
      <div className="space-y-5">
        <p className="text-base leading-relaxed text-slate-300">Открой <a className="text-lime-300 underline" href="https://sportbuddy78.pro">sportbuddy78.pro</a> именно в Safari. Если ты перешёл из Telegram или VK, сначала открой ссылку во внешнем браузере.</p>
        <ol className="space-y-3">
          <li className="flex gap-3 rounded-2xl bg-slate-800 p-4"><Share className="mt-1 shrink-0 text-lime-300"/><span><strong>1. Нажми «Поделиться»</strong><br/><span className="text-sm text-slate-300">Квадрат со стрелкой вверх; в некоторых версиях Safari — внутри меню страницы.</span></span></li>
          <li className="flex gap-3 rounded-2xl bg-slate-800 p-4"><PlusSquare className="mt-1 shrink-0 text-lime-300"/><span><strong>2. Выбери «На экран “Домой”»</strong><br/><span className="text-sm text-slate-300">Если есть переключатель «Открыть как веб-приложение», включи его.</span></span></li>
          <li className="flex gap-3 rounded-2xl bg-slate-800 p-4"><Smartphone className="mt-1 shrink-0 text-lime-300"/><span><strong>3. Нажми «Добавить»</strong><br/><span className="text-sm text-slate-300">Запускай SportBuddy78 с новой иконки. При первом открытии может потребоваться вход в аккаунт.</span></span></li>
        </ol>
        <p className="text-sm text-slate-400">Это веб-версия приложения. Для загрузки данных нужен интернет. Установка подтверждается в Safari — сайт не может сделать это за тебя.</p>
        <button type="button" onClick={() => setOpen(false)} className="min-h-12 w-full rounded-xl bg-lime-300 py-3 font-bold text-slate-950">Понятно</button>
      </div>
    </Modal>, document.body)}
  </section>;
}
