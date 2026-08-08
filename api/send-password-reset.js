// api/send-password-reset.js
// Serverless функция для отправки ссылки восстановления пароля через Яндекс.Почту

import nodemailer from 'nodemailer';
import crypto from 'crypto';

// Настройка транспорта Email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.yandex.ru',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export default async function handler(req, res) {
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, resetCode, resetUrl, expiresIn } = req.body;

  // Валидация
  if (!email || !resetCode || !resetUrl || !expiresIn) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@sportbuddy78.pro',
      to: email,
      subject: '🔐 Восстановление пароля SportBuddy',
      html: `
        <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px 20px; border-radius: 8px;">
          <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
            
            <h1 style="color: #10b981; margin: 0 0 20px 0; text-align: center; font-size: 24px;">
              🔐 Восстановление пароля
            </h1>
            
            <p style="color: #cbd5e1; margin: 0 0 15px 0; text-align: center; font-size: 14px;">
              Вы запросили восстановление пароля для аккаунта SportBuddy.
            </p>
            
            <div style="background: #0f172a; border: 2px solid #10b981; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center;">
              <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                Ваш код восстановления:
              </p>
              <p style="color: #10b981; margin: 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; font-family: 'Courier New', monospace;">
                ${resetCode}
              </p>
            </div>

            <a href="${resetUrl}" style="display: inline-block; width: 100%; padding: 14px 20px; background: linear-gradient(to right, #10b981, #059669); color: white; text-align: center; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; margin: 20px 0; cursor: pointer; transition: opacity 0.3s;">
              ✓ Восстановить пароль
            </a>

            <p style="color: #94a3b8; margin: 20px 0 0 0; font-size: 12px; text-align: center;">
              Или скопируйте код и введите его в приложение
            </p>

            <div style="background: #1e293b; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #f59e0b; margin: 0; font-size: 12px; font-weight: bold;">
                ⏱️ Код действителен ${expiresIn} минут(ы)
              </p>
              <p style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 11px;">
                Если вы не запрашивали восстановление пароля, игнорируйте это письмо и убедитесь, что ваш аккаунт в безопасности.
              </p>
            </div>

            <div style="background: #1e293b; border-left: 4px solid #06b6d4; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #06b6d4; margin: 0; font-size: 12px; font-weight: bold;">
                💡 Совет безопасности:
              </p>
              <p style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 11px;">
                Никогда не делитесь кодом восстановления с кем-либо. SportBuddy никогда не просит ваш пароль по письму.
              </p>
            </div>

            <p style="color: #64748b; margin: 25px 0 0 0; text-align: center; font-size: 11px; border-top: 1px solid #334155; padding-top: 15px;">
              SportBuddy © 2026 • Санкт-Петербург
            </p>
            
          </div>
        </div>
      `,
      text: `Код восстановления пароля: ${resetCode}\n\nДействителен ${expiresIn} минут(ы).\n\nОтрите ссылку: ${resetUrl}\n\nЕсли вы не запрашивали восстановление пароля, игнорируйте это письмо.`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      ok: true,
      message: 'Password reset email sent successfully'
    });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
