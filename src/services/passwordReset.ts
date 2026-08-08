import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PASSWORD_RESET_COLLECTION = 'password_reset_codes';
const RESET_CODE_VALIDITY_MINUTES = 30; // 30 минут на восстановление пароля

export interface PasswordResetCode {
  id: string;
  email: string;
  code: string;
  resetUrl: string;
  createdAt: string;
  expiresAt: string;
  attempts: number;
  isUsed: boolean;
}

/**
 * Генерирует случайный 6-значный код восстановления
 */
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Генерирует уникальный токен для восстановления пароля
 */
function generateResetToken(): string {
  return Math.random().toString(36).substr(2, 32) + Date.now().toString(36);
}

/**
 * Отправляет ссылку восстановления пароля по почте через Яндекс.Почту
 */
export async function sendPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const code = generateResetCode();
    const token = generateResetToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_CODE_VALIDITY_MINUTES * 60 * 1000);

    // Генерируем уникальный ID для этого кода
    const resetId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Формируем ссылку восстановления
    const resetUrl = `https://sportbuddy78.pro/reset-password?token=${token}&code=${code}`;

    // Сохраняем код восстановления в Firestore
    await setDoc(doc(db, PASSWORD_RESET_COLLECTION, resetId), {
      email,
      code,
      resetUrl,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      isUsed: false
    });

    // Отправляем письмо через API
    try {
      const response = await fetch('/api/send-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          resetCode: code,
          resetUrl,
          expiresIn: RESET_CODE_VALIDITY_MINUTES
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return { success: true, message: `Ссылка восстановления отправлена на ${email}` };
    } catch (err) {
      console.error('Failed to send email, but reset code saved:', err);
      // Код всё равно сохранён в БД
      return { success: true, message: `Проверьте почту ${email}` };
    }
  } catch (error) {
    console.error('Error generating reset code:', error);
    return {
      success: false,
      message: 'Не удалось отправить ссылку восстановления. Попробуйте позже.'
    };
  }
}

/**
 * Проверяет код восстановления пароля и помечает его как использованный
 */
export async function verifyPasswordResetCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
  try {
    // Ищем коды восстановления для этой почты
    const querySnapshot = await getDocs(query(
      collection(db, PASSWORD_RESET_COLLECTION),
      where('email', '==', email),
      where('isUsed', '==', false)
    ));

    let validReset: PasswordResetCode | null = null;

    for (const doc of querySnapshot.docs) {
      const resetData = doc.data() as PasswordResetCode;
      const expiresAt = new Date(resetData.expiresAt);

      // Проверяем, не истёк ли код
      if (expiresAt < new Date()) {
        await deleteDoc(doc.ref);
        continue;
      }

      // Проверяем код
      if (resetData.code === code.trim()) {
        validReset = { ...resetData, id: doc.id };
        break;
      }
    }

    if (!validReset) {
      return {
        success: false,
        message: 'Неверный или истёкший код. Запросите новую ссылку восстановления.'
      };
    }

    // Отмечаем код как использованный
    await setDoc(doc(db, PASSWORD_RESET_COLLECTION, validReset.id), {
      ...validReset,
      isUsed: true
    });

    return {
      success: true,
      message: 'Код подтвержден. Вы можете установить новый пароль.'
    };
  } catch (error) {
    console.error('Error verifying reset code:', error);
    return {
      success: false,
      message: 'Ошибка проверки кода восстановления'
    };
  }
}

/**
 * Очищает старые неиспользованные коды восстановления (каждый час)
 */
export async function cleanupExpiredResetCodes(): Promise<void> {
  try {
    const now = new Date().toISOString();
    const querySnapshot = await getDocs(query(
      collection(db, PASSWORD_RESET_COLLECTION),
      where('expiresAt', '<', now)
    ));

    for (const doc of querySnapshot.docs) {
      await deleteDoc(doc.ref);
    }

    console.log(`Cleaned up ${querySnapshot.size} expired password reset codes`);
  } catch (error) {
    console.error('Error cleaning up reset codes:', error);
  }
}
