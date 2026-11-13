import {useEffect, useRef, useState} from 'react';
import {Download, Share2, ImagePlus, Mountain, Layers, Check, RotateCcw, X} from 'lucide-react';
import routes from '../../shared/running-routes.json';
import {hasBackgroundRecorder, runningRecorder} from '../services/runningRecorder';
import {canvasBlob, DEFAULT_CROP, drawRunningCard, loadCardImage, prepareCardPhoto, runAverageSpeed, runDuration, runPace, runStatus, type RunSummary} from '../lib/runningCard';
export type {RunSummary} from '../lib/runningCard';

type Mode = 'route' | 'photo' | 'transparent';
const secondary = 'min-h-11 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-lime-300/60 focus-visible:outline-2 focus-visible:outline-lime-300 disabled:opacity-40';
const modes = [{id: 'route', title: 'Пейзаж', Icon: Mountain}, {id: 'photo', title: 'Моё фото', Icon: ImagePlus}, {id: 'transparent', title: 'Без фона', Icon: Layers}] as const;

export default function RunningResultCard(props: {result: RunSummary; saved: boolean}) {
  return <CardEditor key={props.result.id} {...props}/>;
}

function CardEditor({result, saved}: {result: RunSummary; saved: boolean}) {
  const route = routes.find(r => r.id === result.routeId);
  const [mode, setMode] = useState<Mode>(route ? 'route' : 'transparent');
  const [scenery, setScenery] = useState(0);
  const [photo, setPhoto] = useState('');
  const [crop, setCrop] = useState({...DEFAULT_CROP});
  const [dim, setDim] = useState(12);
  const [darkInk, setDarkInk] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [output, setOutput] = useState<{key: string; url: string; file: File} | null>(null);
  const uploadRequest = useRef(0), actionBusy = useRef(false), input = useRef<HTMLInputElement>(null);
  const native = hasBackgroundRecorder();
  const [nativeSave, setNativeSave] = useState(false);
  const source = mode === 'photo' ? photo : mode === 'route' ? route?.images[scenery] || '' : '';
  const title = route?.name || 'Свободная пробежка';
  const status = runStatus(result, saved);
  // Never export the previous asynchronous render after the selection changes.
  const renderKey = JSON.stringify([result, saved, mode, source, crop, dim, darkInk, retry]);
  const ready = output?.key === renderKey && !loadingPhoto;

  useEffect(() => {
    let alive = true;
    if (native) void runningRecorder.cardCapabilities().then(v => { if (alive) setNativeSave(v.save); }).catch(() => {});
    return () => { alive = false; uploadRequest.current++; };
  }, [native]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => {
    let alive = true, objectUrl = '';
    setError('');
    const timer = window.setTimeout(() => {
      if (mode === 'photo' && !source) return;
      void (async () => {
        try {
          const background = source ? await loadCardImage(source) : null;
          if (!alive) return;
          await document.fonts.ready;
          if (!alive) return;
          const canvas = document.createElement('canvas');
          drawRunningCard(canvas, result, saved, route, background, {transparent: mode === 'transparent', darkInk, dim, crop});
          const blob = await canvasBlob(canvas);
          if (!alive) return;
          objectUrl = URL.createObjectURL(blob);
          setOutput({key: renderKey, url: objectUrl, file: new File([blob], `sportbuddy-run${mode === 'transparent' ? '-transparent' : ''}.png`, {type: 'image/png'})});
        } catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Не удалось создать карточку.'); }
      })();
    }, 100);
    return () => { alive = false; clearTimeout(timer); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // renderKey includes every rendering input, including the result and route ID.
  }, [renderKey]);

  async function choosePhoto(file: File) {
    const request = ++uploadRequest.current;
    setLoadingPhoto(true); setMessage(''); setError('');
    try {
      const blob = await prepareCardPhoto(file);
      if (request !== uploadRequest.current) return;
      setPhoto(URL.createObjectURL(blob)); setCrop({...DEFAULT_CROP}); setMode('photo');
    } catch (e) { if (request === uploadRequest.current) setMessage(e instanceof Error ? e.message : 'Не удалось открыть фото.'); }
    finally { if (request === uploadRequest.current) setLoadingPhoto(false); }
  }
  function removePhoto() { uploadRequest.current++; setLoadingPhoto(false); setPhoto(''); setCrop({...DEFAULT_CROP}); setMessage(''); }
  function download(file: File) {
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    setMessage('Скачивание началось. Карточка появится в загрузках.');
  }
  async function exportCard(action: 'save' | 'share') {
    if (!ready || !output || actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setMessage('');
    try {
      if (native) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]!);
          reader.onerror = () => reject(new Error('Не удалось прочитать карточку.')); reader.readAsDataURL(output.file);
        });
        if (action === 'save' && nativeSave) {
          const response = await runningRecorder.saveCard({data});
          if (!response.cancelled) setMessage('Карточка сохранена в выбранную папку.');
        } else {
          await runningRecorder.shareCard({data});
          if (action === 'save') setMessage('В этой версии приложения сохраните файл через меню отправки. Прямое сохранение доступно после обновления APK.');
        }
      } else if (action === 'share' && navigator.canShare?.({files: [output.file]})) {
        // File is ready before the click, preserving browser user activation.
        await navigator.share({files: [output.file], title: 'Моя пробежка — SportBuddy78'});
      } else {
        download(output.file);
        if (action === 'share') setMessage('Карточка скачивается. Прикрепите её к сообщению или публикации.');
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError')) setMessage('Не удалось сохранить или отправить карточку. Попробуйте ещё раз.');
    } finally { actionBusy.current = false; setBusy(false); }
  }

  return <section aria-label="Итог пробежки" className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
    <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.24em] text-lime-300">SportBuddy78 · Мой результат</p>
        <h3 className="text-xl font-bold">Твоя пробежка. Твоя история.</h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">Выбери фон и сохрани момент, которым хочется поделиться.</p></div>
      {saved && <span className="flex shrink-0 items-center gap-1 rounded-full bg-lime-300/10 px-2 py-1 text-[10px] text-lime-300"><Check size={12}/>Сохранено</span>}
    </div>
    <div className="space-y-5 p-4 sm:p-5">
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Фон карточки">
        {modes.map(({id, title: label, Icon}) => <button type="button" key={id} aria-pressed={mode === id}
          disabled={busy || loadingPhoto || (id === 'route' && !route)} onClick={() => { setMode(id); setMessage(''); setError(''); }}
          className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-lime-300 disabled:opacity-40 ${mode === id ? 'border-lime-300/50 bg-lime-300/10 text-lime-300' : 'border-white/10 bg-white/[.03] text-slate-400 hover:text-white'}`}>
          <Icon size={18}/>{label}</button>)}
      </div>
      {mode === 'route' && route && <div className="space-y-2">
        <div className="flex items-center justify-between text-xs"><span className="text-slate-300">{route.name}</span><span className="text-slate-500">{scenery + 1} / {route.images.length}</span></div>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Пейзажи маршрута">{route.images.map((src, i) => <button type="button" key={src} disabled={busy} aria-label={`Пейзаж ${i + 1}`} aria-pressed={scenery === i} onClick={() => { setScenery(i); setCrop({...DEFAULT_CROP}); }}
          className={`relative overflow-hidden rounded-xl border-2 focus-visible:outline-2 focus-visible:outline-lime-300 ${scenery === i ? 'border-lime-300' : 'border-transparent'}`}>
          <img src={src} alt="" className="aspect-[4/3] w-full object-cover"/>{scenery === i && <span className="absolute bottom-1 right-1 rounded-full bg-lime-300 p-1 text-slate-950"><Check size={12}/></span>}</button>)}</div>
        <p className="text-[10px] text-slate-500">Пейзажные ИИ-иллюстрации локации маршрута.</p>
      </div>}
      {mode === 'photo' && <div className="space-y-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Добавить своё фото" className="sr-only" disabled={busy || loadingPhoto}
          onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void choosePhoto(file); }}/>
        <div className="flex gap-2"><button type="button" className={`${secondary} flex flex-1 items-center justify-center gap-2 border-dashed`} disabled={busy || loadingPhoto} onClick={() => input.current?.click()}><ImagePlus size={17}/>{loadingPhoto ? 'Обрабатываем фото…' : photo ? 'Заменить фото' : 'Добавить своё фото'}</button>
          {photo && <button type="button" className={secondary} aria-label="Удалить фото" disabled={busy} onClick={removePhoto}><X size={18}/></button>}</div>
        <p className="text-[11px] leading-relaxed text-slate-400">Фото остаётся на устройстве. JPG, PNG или WebP до 20 МБ.</p>
      </div>}
      {mode === 'transparent' && <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[.03] p-3">
        <p className="text-xs leading-relaxed text-slate-300">Только показатели и оформление — без фона. PNG можно наложить на своё фото или видео.</p>
        <div className="flex gap-2" role="group" aria-label="Цвет текста">{[false, true].map(dark => <button key={String(dark)} type="button" disabled={busy} aria-pressed={darkInk === dark} onClick={() => setDarkInk(dark)} className={`${secondary} flex-1 ${darkInk === dark ? 'border-lime-300/60 text-lime-300' : ''}`}>{dark ? 'Тёмный текст' : 'Светлый текст'}</button>)}</div>
      </div>}
      <div className="mx-auto max-w-sm">
        <div aria-busy={!ready && !(mode === 'photo' && !photo)} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10"
          style={{backgroundColor: '#243137', backgroundImage: 'conic-gradient(#344349 25%, transparent 0 50%, #344349 0 75%, transparent 0)', backgroundSize: '24px 24px'}}>
          {ready && output ? <img src={output.url} className="h-full w-full object-contain" alt={`${title}: ${(result.distanceM / 1000).toFixed(2)} км, ${runDuration(result.elapsedMs)}, ${runPace(result)} мин/км, средняя скорость ${runAverageSpeed(result)} км/ч с учётом пауз. ${status}`}/>
            : <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 p-6 text-center text-sm text-slate-400"><ImagePlus size={32} className="text-lime-300/60"/>{error || (mode === 'photo' && !photo ? 'Добавь фото — здесь появится твоя карточка' : 'Готовим предпросмотр…')}
              {error && <button type="button" className={secondary} onClick={() => setRetry(n => n + 1)}>Повторить</button>}</div>}
        </div>
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-wider text-slate-500"><span>Предпросмотр</span><span>PNG · 1080 × 1350{mode === 'transparent' ? ' · α' : ''}</span></div>
      </div>
      {mode !== 'transparent' && source && <details className="rounded-2xl border border-white/10 bg-white/[.02] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Кадрирование и свет</summary>
        <fieldset disabled={busy || loadingPhoto} className="mt-4 space-y-4">
          {[{label: 'Масштаб', value: crop.zoom, min: 1, max: 3, step: .05, change: (n: number) => setCrop(v => ({...v, zoom: n})), text: `${Math.round(crop.zoom * 100)}%`},
            {label: 'По горизонтали', value: crop.x, min: 0, max: 100, step: 1, change: (n: number) => setCrop(v => ({...v, x: n})), text: `${crop.x}%`},
            {label: 'По вертикали', value: crop.y, min: 0, max: 100, step: 1, change: (n: number) => setCrop(v => ({...v, y: n})), text: `${crop.y}%`},
            {label: 'Затемнение', value: dim, min: 0, max: 65, step: 1, change: setDim, text: `${dim}%`}].map(control => <label key={control.label} className="block text-xs text-slate-400"><span className="flex justify-between">{control.label}<span className="text-slate-200">{control.text}</span></span><input type="range" className="mt-2 w-full accent-lime-300" aria-label={control.label} min={control.min} max={control.max} step={control.step} value={control.value} onChange={e => control.change(Number(e.target.value))}/></label>)}
          <button type="button" className="flex min-h-11 items-center gap-2 text-xs text-slate-300" onClick={() => { setCrop({...DEFAULT_CROP}); setDim(12); }}><RotateCcw size={14}/>Сбросить настройки</button>
        </fieldset>
      </details>}
      {result.reason && <p className="text-xs leading-relaxed text-slate-400">{result.reason}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!ready || busy} onClick={() => void exportCard('save')} className={`${secondary} flex items-center justify-center gap-2`}><Download size={17}/>Скачать PNG</button>
        <button type="button" disabled={!ready || busy} onClick={() => void exportCard('share')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-lime-300 px-3 py-3 text-sm font-bold text-slate-950 transition hover:bg-lime-200 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"><Share2 size={17}/>Поделиться</button>
      </div>
      <p role="status" aria-live="polite" className="text-xs leading-relaxed text-slate-300">{busy ? 'Подготавливаем файл…' : message}</p>
    </div>
  </section>;
}
