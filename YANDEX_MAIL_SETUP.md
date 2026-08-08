# Настройка OTP-авторизации администратора с Яндекс.Почтой

## 📧 Шаг 1: Создание почтового аккаунта (если его нет)

### Вариант 1: Создать новый аккаунт на Яндексе
1. Откройте https://yandex.ru/
2. Нажмите **"Завести аккаунт"** или **"Вход"** → **"Создать аккаунт"**
3. Заполните данные (например, `admin-sportbuddy` или `support-sportbuddy`)
4. Подтвердите номер телефона

### Вариант 2: Использовать существующий аккаунт
Если у вас уже есть аккаунт Яндекс — можно сразу перейти к шагу 2.

---

## 🔑 Шаг 2: Создание пароля приложения (App Password)

Яндекс требует создать специальный пароль для приложений (не основной пароль).

### Инструкция:

1. **Перейдите в аккаунт Яндекса:**
   - https://passport.yandex.ru/profile

2. **В левом меню выберите: "Безопасность"**
   - Или прямая ссылка: https://passport.yandex.ru/profile/sec

3. **Прокрутите вниз до раздела "Пароли приложений"**

4. **Нажмите кнопку "Создать пароль приложения"**

5. **В диалоге:**
   - **Приложение:** выберите **"Другое"**
   - **Название:** напишите `SportBuddy Admin` или `SportBuddy OTP`
   - **Нажмите:** "Создать"

6. **Скопируйте полученный пароль:**
   ```
   Пароль будет выглядеть так: abcd efgh ijkl mnop
   (16 символов с пробелами)
   ```
   ⚠️ **Важно:** этот пароль больше не будет показан! Сохраните его.

---

## 🛠️ Шаг 3: Добавление SMTP-параметров в проект

### На локальном компьютере:

1. **Откройте файл `.env` (или создайте его в корне проекта):**
   ```bash
   touch .env
   ```

2. **Добавьте эти строки:**
   ```bash
   # Яндекс SMTP для отправки OTP кодов администратору
   SMTP_HOST=smtp.yandex.ru
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@yandex.ru
   SMTP_PASS=abcd efgh ijkl mnop
   SMTP_FROM=your-email@yandex.ru
   ```

   **Замените:**
   - `your-email@yandex.ru` на ваш email Яндекса
   - `abcd efgh ijkl mnop` на скопированный пароль приложения

3. **Пример с реальными данными:**
   ```bash
   SMTP_HOST=smtp.yandex.ru
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=admin-sportbuddy@yandex.ru
   SMTP_PASS=abcd efgh ijkl mnop
   SMTP_FROM=admin-sportbuddy@yandex.ru
   ```

---

## ☁️ Шаг 4: Добавление переменных на Vercel (продакшн)

Если вы деплоите на **Vercel**:

1. **Откройте проект на vercel.com:**
   - https://vercel.com/dashboard

2. **Выберите ваш проект `sportbuddy`**

3. **Перейдите в: Settings → Environment Variables**

4. **Добавьте переменные:**

   | Name | Value |
   |------|-------|
   | `SMTP_HOST` | `smtp.yandex.ru` |
   | `SMTP_PORT` | `587` |
   | `SMTP_SECURE` | `false` |
   | `SMTP_USER` | `admin-sportbuddy@yandex.ru` |
   | `SMTP_PASS` | `abcd efgh ijkl mnop` |
   | `SMTP_FROM` | `admin-sportbuddy@yandex.ru` |

5. **Нажмите "Save"**

6. **Перейдите в: Deployments → Redeploy**
   - Нажмите три точки на последнем деплою → **"Redeploy"**

---

## 📧 Шаг 5: Настройка адреса получателя кода

**Важно:** Код всегда отправляется на `support@sportbuddy78.ru`

Если вы хотите получать коды на другой адрес, отредактируйте файл:

**`src/services/adminAuth.ts`:**
```typescript
// Найдите эту строку (около строки 13):
const ADMIN_EMAIL = 'support@sportbuddy78.ru';

// Замените на вашу почту:
const ADMIN_EMAIL = 'your-email@yandex.ru';
```

И в `api/send-admin-otp.js`:
```javascript
// Найдите эту строку (около строки 30):
if (email !== 'support@sportbuddy78.ru') {

// Замените на вашу почту:
if (email !== 'your-email@yandex.ru') {
```

---

## 🧪 Шаг 6: Локальное тестирование

### На локальном компьютере:

1. **Убедитесь, что зависимости установлены:**
   ```bash
   npm install
   ```

2. **Запустите dev сервер:**
   ```bash
   npm run dev
   ```

3. **Откройте приложение в браузере:**
   ```
   http://localhost:5173
   ```

4. **Найдите кнопку администратора:**
   - Профиль → **"🗝️ Кабинет администратора"**

5. **Нажмите "📧 Отправить код"**

6. **Проверьте почту на Яндексе:**
   - https://mail.yandex.ru/
   - Должно придти письмо с кодом
   - Скопируйте 6-значный код

7. **Вернитесь в приложение и введите код**

---

## ✅ Проверка после деплоя

После деплоя на Vercel:

1. **Откройте production версию приложения**
2. **Нажмите кнопку администратора**
3. **Отправьте код**
4. **Проверьте почту**
5. **Если письмо пришло — всё работает!** ✓

---

## ❌ Решение проблем

### **Проблема: Письмо не приходит**

**1. Проверьте SMTP-параметры:**
```bash
# Убедитесь, что .env содержит:
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=587
SMTP_SECURE=false
```

**2. Проверьте пароль приложения:**
- Откройте https://passport.yandex.ru/profile/sec
- Убедитесь, что пароль скопирован правильно (16 символов с пробелами)

**3. Проверьте логи Vercel:**
- https://vercel.com/dashboard
- Выберите проект
- Перейдите в **Deployments** → выберите деплой → **Logs**
- Ищите сообщение об ошибке

**4. Проверьте спам-фильтр:**
- На Яндекс.Почте перейдите в **Спам**
- Может быть письмо там

**5. Проверьте адрес отправителя:**
- Письмо отправляется **от** `admin-sportbuddy@yandex.ru`
- И **на** `support@sportbuddy78.ru` (или что вы указали)
- Убедитесь, что оба адреса указаны правильно

---

### **Проблема: Ошибка "Invalid credentials"**

Это значит, что пароль неправильный или SMTP_USER указан с опечаткой.

**Проверьте:**
1. Скопируйте пароль **точно**, включая пробелы
2. Убедитесь, что SMTP_USER это **ваш email на Яндексе**
3. На Vercel переразверните проект после исправления переменных

---

### **Проблема: Ошибка "ENOTFOUND smtp.yandex.ru"**

Это редко, но может быть проблемой с DNS.

**Решение:**
- На Vercel иногда требуется перезагрузка
- Нажмите **Redeploy** в разделе Deployments

---

## 📋 Конфигурация для разных почтовых сервисов

Если в будущем захотите переключиться на другой сервис:

### **Gmail:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM=noreply@sportbuddy78.pro
```

### **SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxx
SMTP_FROM=noreply@sportbuddy78.pro
```

### **Mail.ru:**
```bash
SMTP_HOST=smtp.mail.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@mail.ru
SMTP_PASS=password
SMTP_FROM=your-email@mail.ru
```

---

## 🎯 Итого

После всех шагов:
- ✅ Яндекс-почта настроена
- ✅ Пароль приложения создан
- ✅ SMTP-параметры добавлены в .env и Vercel
- ✅ Письма с кодами приходят на почту
- ✅ Администратор может авторизоваться через OTP

**Готово к работе!** 🚀
