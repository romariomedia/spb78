export type RunSummary = {
  id: string; routeId: string; endedAt: number; distanceM: number;
  elapsedMs: number; paceSecPerKm: number; reason: string;
  eligible?: boolean; published?: boolean;
};
export type CardCrop = {zoom: number; x: number; y: number};
export type CardStyle = {
  transparent: boolean; darkInk: boolean; dim: number; crop: CardCrop;
};
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const DEFAULT_CROP: CardCrop = {zoom: 1, x: 50, y: 50};
const nonnegative = (n: number) => Number.isFinite(n) ? Math.max(0, n) : 0;
export const runDuration = (ms: number) => {
  const s = Math.floor(nonnegative(ms) / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
};
export const runPace = (result: RunSummary) => {
  if (result.distanceM <= 0 || !Number.isFinite(result.paceSecPerKm) || result.paceSecPerKm <= 0) return '—';
  const s = Math.round(result.paceSecPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const runStatus = (result: RunSummary, saved: boolean) => !saved ? 'Результат ещё не сохранён'
  : result.published ? 'Результат включён в рейтинг'
  : result.eligible ? 'Трасса пройдена · личный результат' : 'Личный результат · вне рейтинга';

export function loadCardImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = window.setTimeout(() => { img.src = ''; reject(new Error('Изображение не загрузилось. Попробуйте ещё раз.')); }, 15000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('Не удалось открыть изображение. Выберите другое фото.')); };
    img.src = src;
  });
}

// Decode and resize locally. No upload, EXIF metadata or original file is exported.
export async function prepareCardPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Выберите фото JPG, PNG или WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Фото слишком большое. Выберите файл до 20 МБ.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadCardImage(url);
    if (image.naturalWidth * image.naturalHeight > 60000000) throw new Error('Разрешение фото слишком большое. Выберите уменьшенную копию.');
    const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Не удалось обработать фото.');
    ctx.fillStyle = '#071015'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasBlob(canvas, 'image/jpeg', .92);
  } finally { URL.revokeObjectURL(url); }
}

export function canvasBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение.')), type, quality));
}

export function drawRunningCard(canvas: HTMLCanvasElement, result: RunSummary, saved: boolean,
  route: {name: string; city: string} | undefined, background: HTMLImageElement | null, style: CardStyle) {
  canvas.width = CARD_WIDTH; canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Создание карточки недоступно.');
  const {transparent, darkInk, crop} = style;
  const ink = transparent && darkInk ? '#10232a' : '#f8faf6';
  const muted = transparent && darkInk ? '#334b52' : '#d2ddd9';
  const accent = transparent && darkInk ? '#365900' : '#c6ff00';
  if (!transparent) {
    ctx.fillStyle = '#071015'; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    if (background) {
      const scale = Math.max(CARD_WIDTH / background.naturalWidth, CARD_HEIGHT / background.naturalHeight) * crop.zoom;
      const w = background.naturalWidth * scale, h = background.naturalHeight * scale;
      ctx.drawImage(background, (CARD_WIDTH - w) * crop.x / 100, (CARD_HEIGHT - h) * crop.y / 100, w, h);
    }
    ctx.fillStyle = `rgba(3,12,17,${style.dim / 100})`; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    const shade = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    shade.addColorStop(0, 'rgba(3,12,17,.66)'); shade.addColorStop(.32, 'rgba(3,12,17,.02)');
    shade.addColorStop(.52, 'rgba(3,12,17,.18)'); shade.addColorStop(.78, 'rgba(3,12,17,.88)'); shade.addColorStop(1, '#030c11');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }
  const text = (value: string, x: number, y: number, size: number, color = ink, weight = 600, maxWidth = 936) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Manrope, Arial, sans-serif`;
    while (ctx.measureText(value).width > maxWidth && size > 16) { size--; ctx.font = `${weight} ${size}px Manrope, Arial, sans-serif`; }
    ctx.fillText(value, x, y);
  };
  const line = (x: number, y: number, w: number, color: string) => {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  };
  // Small pace bars form a recognizable mark, leaving the landscape unobstructed.
  ctx.fillStyle = accent;
  [0, 1, 2].forEach(i => { ctx.beginPath(); ctx.roundRect(72 + i * 13, 74 - i * 6, 7, 21 + i * 6, 2); ctx.fill(); });
  text('SPORTBUDDY78', 128, 94, 30, ink, 800, 590);
  text('RUN / 78', 840, 94, 22, accent, 700, 168);
  line(72, 124, 936, transparent ? (darkInk ? '#10232a55' : '#ffffff66') : '#ffffff44');
  text(route?.city.toLocaleUpperCase('ru-RU') || 'МОЙ РИТМ · МОЙ МАРШРУТ', 72, 178, 21, muted, 600);
  text(route?.name || 'Свободная пробежка', 72, 240, 48, ink, 800);
  const date = new Date(result.endedAt);
  text(Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}), 74, 287, 25, muted, 400);
  text('МОЯ ПРОБЕЖКА', 74, 718, 25, ink, 700);
  text((nonnegative(result.distanceM) / 1000).toFixed(2).replace('.', ','), 61, 884, 176, accent, 800, 820);
  text('КМ', 909, 877, 35, accent, 700, 99);
  text('ДИСТАНЦИЯ ПО GPS', 74, 930, 21, muted, 600);
  line(72, 974, 936, transparent ? (darkInk ? '#10232a88' : '#ffffff88') : '#ffffff44');
  text(runDuration(result.elapsedMs), 72, 1059, 58, ink, 700, 470);
  text(runPace(result), 650, 1059, 58, ink, 700, 358);
  text('ПОЛНОЕ ВРЕМЯ', 74, 1103, 20, muted, 600);
  text('ТЕМП · МИН / КМ', 652, 1103, 20, muted, 600);
  line(72, 1140, 936, transparent ? (darkInk ? '#10232a55' : '#ffffff66') : '#ffffff33');
  text(runStatus(result, saved), 74, 1192, 25, ink, 500);
  text('Время включает паузы', 74, 1230, 20, muted, 400);
  text('Каждый шаг имеет значение.', 74, 1291, 22, muted, 400, 560);
  text('sportbuddy78.pro', 748, 1291, 23, accent, 700, 260);
}
