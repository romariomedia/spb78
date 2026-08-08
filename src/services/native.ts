import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { photoToFile, compressImage, sourceToFile } from './media';
import confetti from 'canvas-confetti';
import { AppNotification } from '../lib/types';

// Haptics Wrappers
export async function triggerHapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  try {
    const capacitorStyle = 
      style === 'light' ? ImpactStyle.Light : 
      style === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium;
    await Haptics.impact({ style: capacitorStyle });
  } catch {
    // Web fallback using navigator.vibrate if available
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(style === 'heavy' ? 80 : 40);
    }
  }
}

export async function triggerHapticNotification(type: 'success' | 'warning' | 'error' = 'success'): Promise<void> {
  try {
    const notifType = 
      type === 'success' ? NotificationType.Success : 
      type === 'error' ? NotificationType.Error : NotificationType.Warning;
    await Haptics.notification({ type: notifType });
  } catch {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(type === 'success' ? [50, 50, 100] : [100, 50, 100]);
    }
  }
}

/** Browser fallback: opens the native gallery picker when Camera plugin is unavailable. */
function pickImageFromBrowser(): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.position = 'fixed';
    input.style.left = '-10000px';

    const cleanup = (): void => {
      input.remove();
      window.removeEventListener('focus', onWindowFocus);
    };
    // Browser does not fire change when the picker is cancelled.
    const onWindowFocus = (): void => {
      window.setTimeout(() => {
        if (!input.files?.length) {
          cleanup();
          resolve(null);
        }
      }, 350);
    };

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        cleanup();
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        cleanup();
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => {
        cleanup();
        resolve(null);
      };
      reader.readAsDataURL(file);
    };

    document.body.appendChild(input);
    window.addEventListener('focus', onWindowFocus, { once: true });
    input.click();
  });
}

// Camera / Gallery for Avatar and portfolio
/** Отмена пользователем — это не ошибка, возвращаем null. */
function isUserCancelled(err: unknown): boolean {
  const msg = String((err as Error)?.message || '').toLowerCase();
  return msg.includes('cancel') || msg.includes('denied') || msg.includes('no image picked');
}

/**
 * Возвращает готовый File для uploadToCloudinary.
 * Раньше отдавал строку (dataUrl), из-за чего в UI появлялись костыли
 * с prompt('Введите URL...'). Теперь конвертация живёт в services/media.
 */
export async function takeAvatarPhoto(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    const source = await pickImageFromBrowser();
    if (!source) return null;
    return compressImage(await sourceToFile(source, 'avatar'), 1024, 0.85);
  }

  try {
    const image = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      correctOrientation: true,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Обновить фото профиля',
      promptLabelPhoto: 'Выбрать из галереи',
      promptLabelPicture: 'Сделать фото'
    });
    return compressImage(await photoToFile(image, 'avatar'), 1024, 0.85);
  } catch (err: any) {
    if (isUserCancelled(err)) return null;
    console.warn('Camera unavailable, falling back to file input:', err);
    const source = await pickImageFromBrowser();
    if (!source) return null;
    return compressImage(await sourceToFile(source, 'avatar'), 1024, 0.85);
  }
}

/** Выбор из галереи нативным picker'ом. */
export async function pickPhotoFromGallery(): Promise<File | null> {
  if (!Capacitor.isNativePlatform()) {
    const source = await pickImageFromBrowser();
    if (!source) return null;
    return compressImage(await sourceToFile(source, 'gallery'));
  }
  try {
    const image = await Camera.getPhoto({
      quality: 92,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      correctOrientation: true,
      source: CameraSource.Photos
    });
    return compressImage(await photoToFile(image, 'gallery'));
  } catch (err) {
    if (isUserCancelled(err)) return null;
    throw err;
  }
}

// Share API
export async function shareContent(title: string, text: string, url?: string): Promise<boolean> {
  try {
    await Share.share({
      title,
      text,
      url: url || window.location.href,
      dialogTitle: 'Поделиться в SportBuddy'
    });
    return true;
  } catch (error) {
    console.warn('Share plugin error/cancel, falling back to Web Share or clipboard:', error);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: url || window.location.href });
        return true;
      } catch {
        return false;
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url || window.location.href}`);
      alert('Ссылка скопирована в буфер обмена!');
      return true;
    }
    return false;
  }
}

// Deep Links Handler
export function setupDeepLinkListener(
  onTrainingOpen: (trainingId: string) => void,
  onVkCallback?: (code: string, deviceId: string) => void
): () => void {
  try {
    const listener = App.addListener('appUrlOpen', (event) => {
      const url = new URL(event.url);
      
      // ===== VK ID OAuth Callback =====
      // When VK ID redirect returns with code & device_id, extract and handle login
      const code = url.searchParams.get('code');
      const deviceId = url.searchParams.get('device_id');
      if (code && deviceId) {
        console.log('[VK Callback] Code received, finishing login...');
        if (onVkCallback) onVkCallback(code, deviceId);
        return;
      }
      
      // ===== Deep Link: Training =====
      // e.g., sportbuddy://training/123 or https://sportbuddy.ru/training/123
      const parts = url.pathname.split('/');
      const idx = parts.indexOf('training');
      if (idx !== -1 && parts[idx + 1]) {
        const id = parts[idx + 1];
        if (id) onTrainingOpen(id);
      }
    });
    
    // Also check current location hash (for web & PWA preview)
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#training=')) {
        const id = hash.replace('#training=', '');
        if (id) onTrainingOpen(id);
      }
    };
    window.addEventListener('hashchange', checkHash);
    checkHash();

    return () => {
      listener.then(h => h.remove()).catch(() => {});
      window.removeEventListener('hashchange', checkHash);
    };
  } catch {
    return () => {};
  }
}

// Match Confetti Animation
export function launchMatchConfetti(): void {
  try {
    triggerHapticNotification('success');
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10B981', '#34D399', '#6EE7B7', '#FBBF24', '#F59E0B'],
      disableForReducedMotion: true
    });
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#10B981', '#10B981']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#34D399', '#FBBF24']
      });
    }, 250);
  } catch {
    // Ignore if canvas-confetti fails
  }
}

// Mock push notifications generator for demonstration of Firebase Cloud Messaging
/**
 * Shows a system notification (Web Notifications API / Capacitor WebView).
 * Silently degrades when permission is not granted.
 */
export async function sendLocalNotification(title: string, body: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png', tag: 'sportbuddy-training' });
      return;
    }
    if (Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification(title, { body, icon: '/icon-192.png', tag: 'sportbuddy-training' });
      }
    }
  } catch {
    /* notifications unavailable — in-app banner already shown */
  }
}

/**
 * Notification list for a fresh account.
 *
 * Only a real welcome message — no fabricated matches, reminders or chats,
 * so the badge counter always reflects genuine activity.
 */
export function generateDemoNotifications(): AppNotification[] {
  return [
    {
      id: 'notif-welcome',
      title: 'Добро пожаловать в SportBuddy78! 🎉',
      message:
        'Заполните профиль, добавьте фото и найдите первого напарника ' +
        'для тренировки в Санкт-Петербурге.',
      type: 'system',
      time: 'только что',
      read: false
    }
  ];
}
