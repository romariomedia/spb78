// Retired legacy SMTP relay. Password recovery uses Firebase Auth directly.
// Keep a fail-closed response for outdated clients; never accept client-made links.
export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return res.status(410).json({
    code: 'LEGACY_PASSWORD_RESET_DISABLED',
    error: 'Обновите приложение и используйте «Забыли пароль?» на экране входа.'
  });
}
