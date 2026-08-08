// api/send-admin-otp.js
// Serverless функция для отправки OTP кода на почту администратора

import nodemailer from 'nodemailer';

// Настройка транспорта Email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true для 465, false для остальных портов
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

  const { email, code, expiresIn } = req.body;

  // Валидация
  if (!email || !code || !expiresIn) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Только для админ-почты
  if (email !== 'support@sportbuddy78.ru') {
    return res.status(403).json({ error: 'Unauthorized email' });
  }

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@sportbuddy78.pro',
      to: email,
      subject: '🔐 Код входа в кабинет администратора SportBuddy',
      html: `
        <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f1f5f9; padding: 40px 20px; border-radius: 8px;">
          <div style="max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155;">
            
            <h1 style="color: #10b981; margin: 0 0 20px 0; text-align: center; font-size: 24px;">
              🔐 SportBuddy Администратор
            </h1>
            
            <p style="color: #cbd5e1; margin: 0 0 15px 0; text-align: center; font-size: 14px;">
              Вы запросили код входа в кабинет администратора.
            </p>
            
            <div style="background: #0f172a; border: 2px solid #10b981; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center;">
              <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                Ваш одноразовый код:
              </p>
              <p style="color: #10b981; margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                ${code}
              </p>
            </div>
            
            <div style="background: #1e293b; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="color: #f59e0b; margin: 0; font-size: 12px; font-weight: bold;">
                ⏱️ Код действителен ${expiresIn} минут(ы)
              </p>
              <p style="color: #cbd5e1; margin: 5px 0 0 0; font-size: 11px;">
                Если вы не запрашивали этот код, игнорируйте это письмо.
              </p>
            </div>
            
            <p style="color: #64748b; margin: 25px 0 0 0; text-align: center; font-size: 11px; border-top: 1px solid #334155; padding-top: 15px;">
              SportBuddy © 2026 • Санкт-Петербург
            </p>
            
          </div>
        </div>
      `,
      text: `Код входа в кабинет администратора: ${code}\n\nДействителен ${expiresIn} минут(ы).\n\nЕсли вы не запрашивали этот код, игнорируйте это письмо.`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      ok: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
