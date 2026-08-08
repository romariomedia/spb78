/**
 * Конвертация медиа из Capacitor Camera / браузера в File.
 *
 * Здесь и была корневая причина, почему фото не доходили до хранилища:
 *  - CameraResultType.Base64 возвращает ЧИСТЫЙ base64 без префикса "data:";
 *  - в браузере photo.path пустой — есть только blob-webPath;
 *  - браузер может отдать PNG там, где ожидался JPEG.
 * photoToFile() закрывает все четыре варианта разом.
 */

import { Capacitor } from '@capacitor/core';
import type { Photo } from '@capacitor/camera';

/** base64 (с префиксом или без) -> Blob. Чанками, иначе OOM на 12-Мп снимках. */
export function base64ToBlob(base64: string, contentType = 'image/jpeg'): Blob {
  const clean = base64.includes(',') ? (base64.split(',')[1] ?? '') : base64;
  const chars = atob(clean);
  const slices: Uint8Array[] = [];
  for (let offset = 0; offset < chars.length; offset += 1024) {
    const chunk = chars.slice(offset, offset + 1024);
    const bytes = new Uint8Array(chunk.length);
    for (let i = 0; i < chunk.length; i += 1) bytes[i] = chunk.charCodeAt(i);
    slices.push(bytes);
  }
  return new Blob(slices as BlobPart[], { type: contentType });
}

export function blobToFile(blob: Blob, name = 'upload'): File {
  const mime = blob.type || 'image/jpeg';
  const ext = (mime.split('/')[1] || 'jpg')
    .replace('jpeg', 'jpg')
    .replace('quicktime', 'mov')
    .replace(/[^a-z0-9]/gi, '');
  return new File([blob], `${name}.${ext || 'jpg'}`, {
    type: mime,
    lastModified: Date.now()
  });
}

/** MIME берётся ИЗ Data URL, а не угадывается по расширению. */
export function dataUrlToFile(dataUrl: string, name = 'upload'): File {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const payload = parts[1] || '';
  if (!payload) throw new Error('Некорректный формат изображения');
  const match = /:(.*?);/.exec(header);
  const mime = match ? match[1] : 'image/jpeg';
  return blobToFile(base64ToBlob(payload, mime), name);
}

/** Универсально: web + iOS + Android, любой CameraResultType. */
export async function photoToFile(photo: Photo, name = 'photo'): Promise<File> {
  const filename = `${name}-${Date.now()}`;

  if (photo.dataUrl) return dataUrlToFile(photo.dataUrl, filename);

  if (photo.base64String) {
    const mime = `image/${photo.format || 'jpeg'}`;
    return blobToFile(base64ToBlob(photo.base64String, mime), filename);
  }

  // blob: в браузере, capacitor:// в native WebView
  if (photo.webPath) {
    const res = await fetch(photo.webPath);
    if (!res.ok) throw new Error('Не удалось прочитать снимок');
    return blobToFile(await res.blob(), filename);
  }

  // только native
  if (photo.path) {
    const res = await fetch(Capacitor.convertFileSrc(photo.path));
    if (!res.ok) throw new Error('Не удалось прочитать файл с устройства');
    return blobToFile(await res.blob(), filename);
  }

  throw new Error('Камера не вернула данные изображения');
}

/**
 * Сжатие ДО отправки: снимок с iPhone — это 4-6 МБ.
 * Экономит мобильный трафик пользователя и квоту Cloudinary.
 * При любой ошибке возвращает оригинал, а не падает.
 */
export async function compressImage(
  file: File,
  maxSide = 1600,
  quality = 0.82
): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  if (typeof createImageBitmap !== 'function') return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      if (bitmap.close) bitmap.close();
      return file;
    }

    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    let blob: Blob;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      if (!ctx) { if (bitmap.close) bitmap.close(); return file; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { if (bitmap.close) bitmap.close(); return file; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('canvas'))),
          'image/jpeg',
          quality
        );
      });
    }
    if (bitmap.close) bitmap.close();

    if (blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

/** Строка (data URL или http) -> File. Для legacy-кода, отдающего строки. */
export async function sourceToFile(source: string, name = 'photo'): Promise<File> {
  if (source.startsWith('data:')) return dataUrlToFile(source, name);
  const res = await fetch(source);
  if (!res.ok) throw new Error('Не удалось прочитать изображение');
  return blobToFile(await res.blob(), name);
}

export const isNativeApp = Capacitor.isNativePlatform();
