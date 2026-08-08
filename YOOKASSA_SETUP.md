# ЮKassa — Premium-платежи SportBuddy78

## Архитектура

```text
PricingSection (клиент)
  → Firebase Callable Function createYooKassaPayment
  → YooKassa redirect checkout
  → https://sportbuddy78.pro/success
  → YooKassa webhook Cloud Function
  → повторная проверка Payment API
  → Firestore users/<uid>.premiumUntil
```

Клиент **не передаёт userId, цену или количество дней**: сервер получает UID
из Firebase Auth и выбирает план из собственного списка.

| План | Цена | Срок |
|---|---:|---:|
| `monthly` | 490 ₽ | 30 дней |
| `yearly` | 4900 ₽ | 365 дней |

## Секреты Firebase Functions

```bash
firebase functions:secrets:set YOOKASSA_SHOP_ID
firebase functions:secrets:set YOOKASSA_SECRET_KEY
firebase deploy --only functions,firestore:rules
```

Никогда не добавляйте Shop ID/Secret Key в `.env`, `src/`, `api` публичного
репозитория или мобильное приложение.

## Webhook ЮKassa

После деплоя задайте в личном кабинете ЮKassa webhook для события:

```text
payment.succeeded
```

URL функции:

```text
https://europe-west1-sportbuddy-spb.cloudfunctions.net/yooKassaWebhook
```

Webhook не доверяет входящему JSON: он повторно запрашивает платёж у API
ЮKassa по `payment.id`, проверяет статус, `paid`, сумму, валюту, plan и UID
из metadata, а затем проводит транзакцию Firestore. Повторные webhook
безопасны: документ `payments/<paymentId>.processed` делает обработку
идемпотентной.

## Адаптеры `api/`

В проекте также есть:

```text
api/create-payment.js
api/payment-webhook.js
```

Они совместимы с Vercel/Node serverless. Vite + Capacitor не исполняет папку
`api/`, поэтому мобильное приложение использует Firebase Functions. Не
разворачивайте оба webhook одновременно для одного и того же события —
выберите Firebase Function как основной production endpoint.

## Важно для 54-ФЗ

Перед реальными продажами согласуйте с бухгалтерией и ЮKassa настройку
фискальных чеков (`receipt`, номенклатура услуги, ставка НДС, система
налогообложения). Эти параметры зависят от вашего юридического статуса и не
должны быть захардкожены без подтверждения.