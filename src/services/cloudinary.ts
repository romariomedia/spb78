/**
 * Cloudinary media pipeline — единственная точка загрузки файлов в проекте.
 *
 * Заменил Yandex Object Storage: presigned-PUT из браузера ломался на
 * preflight CORS (бакет не отдавал Access-Control-Allow-Origin на OPTIONS)
 * и на SignatureDoesNotMatch (canonical request не совпадал побайтово).
 * Unsigned upload не требует подписи вообще — только upload_preset,
 * а ограничения задаются на стороне Cloudinary и клиентом не переопределяются.
 */

export const CLOUD_NAME =
  (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string) || 'qndhzp3o';
export const UPLOAD_PRESET =
  (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string) || 'sportbuddy_unsigned';
const ROOT_FOLDER =
  (import.meta.env.VITE_CLOUDINARY_FOLDER as string) || 'sportbuddy';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type CldResourceType = 'image' | 'video' | 'auto';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format: string;
  width?: number;
  height?: number;
  duration?: number;
  bytes: number;
}

export interface UploadOptions {
  folder?: string;
  tags?: string[];
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  resourceType?: CldResourceType;
  retries?: number;
}

export class CloudinaryUploadError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CloudinaryUploadError';
    this.status = status;
  }
}

const endpoint = (t: CldResourceType) =>
  `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${t}/upload`;

/** Видео обязано уходить на /video/upload, иначе Cloudinary отклонит файл. */
function detectType(file: File): CldResourceType {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return 'auto';
}

function validate(file: File, type: CldResourceType): void {
  if (!file || file.size === 0) {
    throw new CloudinaryUploadError('Файл пуст или не выбран');
  }
  const limit = type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    throw new CloudinaryUploadError(
      `Файл ${(file.size / 1048576).toFixed(1)} МБ — максимум ${Math.round(limit / 1048576)} МБ.`
    );
  }
}

function buildForm(payload: File | string, opts: UploadOptions): FormData {
  const form = new FormData();
  form.append('file', payload);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', opts.folder || ROOT_FOLDER);
  if (opts.tags && opts.tags.length) form.append('tags', opts.tags.join(','));
  return form;
}

/** XHR, а не fetch: только он даёт upload progress. */
function send(
  url: string,
  form: FormData,
  opts: UploadOptions
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (opts.onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          opts.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    const abort = () => xhr.abort();
    if (opts.signal) opts.signal.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      if (opts.signal) opts.signal.removeEventListener('abort', abort);
    };

    xhr.onload = () => {
      cleanup();
      let data: any;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        reject(new CloudinaryUploadError('Некорректный ответ сервера медиа', xhr.status));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && data && data.secure_url) {
        if (opts.onProgress) opts.onProgress(100);
        resolve({
          secureUrl: data.secure_url,
          publicId: data.public_id,
          resourceType: data.resource_type,
          format: data.format,
          width: data.width,
          height: data.height,
          duration: data.duration,
          bytes: data.bytes
        });
        return;
      }
      const msg = (data && data.error && data.error.message) || `Ошибка загрузки (${xhr.status})`;
      reject(new CloudinaryUploadError(msg, xhr.status));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new CloudinaryUploadError('Нет соединения с сервером медиа'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new CloudinaryUploadError('Загрузка отменена'));
    };

    xhr.send(form);
  });
}

/** Полный результат: publicId нужен, чтобы позже удалить ассет через Admin API. */
export async function uploadMedia(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const type = options.resourceType || detectType(file);
  validate(file, type);

  const retries = options.retries === undefined ? 2 : options.retries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await send(endpoint(type), buildForm(file, options), options);
    } catch (err) {
      lastError = err;
      const status = (err as CloudinaryUploadError).status;
      // 4xx кроме 429 не лечится повтором: неверный preset / формат / размер
      const retryable = !status || status === 429 || status >= 500;
      const aborted = options.signal ? options.signal.aborted : false;
      if (!retryable || attempt === retries || aborted) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError instanceof CloudinaryUploadError
    ? lastError
    : new CloudinaryUploadError('Не удалось загрузить файл');
}

/** Основная функция загрузки. Возвращает secure_url. */
export async function uploadToCloudinary(
  file: File,
  options: UploadOptions = {}
): Promise<string> {
  const result = await uploadMedia(file, options);
  return result.secureUrl;
}

/**
 * Перекладывает внешнюю картинку (Unsplash, VK-аватар) на наш CDN.
 * Cloudinary принимает https-URL прямо в поле file.
 */
export async function uploadRemoteUrl(
  url: string,
  options: UploadOptions = {}
): Promise<string> {
  if (!/^https?:\/\//i.test(url)) {
    throw new CloudinaryUploadError('Нужен корректный http(s)-адрес');
  }
  if (url.includes('res.cloudinary.com')) return url; // уже у нас
  const type = options.resourceType || 'auto';
  const result = await send(endpoint(type), buildForm(url, options), options);
  return result.secureUrl;
}

/* ------------------------- Оптимизация доставки ------------------------- */

export interface TransformOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'fit' | 'thumb' | 'limit' | 'scale';
  gravity?: 'auto' | 'face' | 'faces' | 'center';
  radius?: number | 'max';
  quality?: 'auto' | 'auto:eco' | 'auto:good' | 'auto:best' | 'auto:low' | number;
  dpr?: 'auto' | number;
  blur?: number;
}

/**
 * Вставляет трансформации в готовый URL.
 * f_auto — WebP/AVIF по возможностям браузера, q_auto — авто-качество.
 * Не-Cloudinary адреса (Unsplash, VK, локальные ассеты) возвращаются
 * без изменений — безопасно вызывать на любом avatar/mediaUrl.
 */
export function cldUrl(url?: string | null, t: TransformOptions = {}): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;

  const parts: string[] = ['f_auto', `q_${t.quality || 'auto'}`];
  if (t.width) parts.push(`w_${t.width}`);
  if (t.height) parts.push(`h_${t.height}`);
  if (t.width || t.height) parts.push(`c_${t.crop || 'fill'}`);
  if (t.gravity) parts.push(`g_${t.gravity}`);
  if (t.radius !== undefined) parts.push(`r_${t.radius}`);
  if (t.blur) parts.push(`e_blur:${t.blur}`);
  if (t.dpr) parts.push(`dpr_${t.dpr}`);

  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

/** Аватар: квадрат, кроп по лицу, круглые края. */
export const avatarUrl = (url?: string | null, size = 96): string =>
  cldUrl(url, {
    width: size,
    height: size,
    crop: 'thumb',
    gravity: 'face',
    radius: 'max',
    dpr: 'auto'
  });

/** Крупное фото: свайп-карточка, портфолио, обложка. */
export const photoUrl = (url?: string | null, width = 800): string =>
  cldUrl(url, { width, crop: 'limit', quality: 'auto:good', dpr: 'auto' });

/**
 * srcset для картинок в ленте. Список ширин фиксирован намеренно:
 * каждая уникальная трансформация создаёт отдельный derived-ассет.
 */
export function cldSrcSet(
  url?: string | null,
  widths: number[] = [320, 480, 640, 828, 1080]
): string | undefined {
  if (!url || !url.includes('res.cloudinary.com')) return undefined;
  return widths
    .map((w) => `${cldUrl(url, { width: w, crop: 'limit' })} ${w}w`)
    .join(', ');
}

/** LQIP-заглушка для плавного появления. */
export const cldPlaceholder = (url?: string | null): string =>
  cldUrl(url, { width: 24, quality: 'auto:low', blur: 400 });

/** Постер первого кадра видео. */
export const videoPoster = (url?: string | null, width = 720): string => {
  if (!url) return '';
  return cldUrl(url.replace(/\.(mp4|mov|webm|m4v)$/i, '.jpg'), {
    width,
    crop: 'limit'
  });
};
