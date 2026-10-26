# SportBuddy78 — Business Economy 2027

## Purpose

This subsystem manages paid publication for commercial participants without mixing business access with athlete Premium.

Supported commercial subjects:

- `trainer` — verified personal trainer profile
- `venue` — sports venue / studio card
- `massage` — massage / wellness card

The commercial launch is pinned server-side to **2027-01-01 00:00 Moscow time**.

## Safety before launch

`billingConfig/main.enabled` is a second kill switch. Both conditions must be true before a YooKassa B2B checkout can be created:

1. current time is on or after 2027-01-01 00:00 +03:00;
2. admin explicitly enabled commercial subscriptions.

This allows prices, ownership and free periods to be configured during 2026 without charging users.

## Firestore collections

### billingConfig/main

Stores the admin-controlled price catalog and enabled flag.

Default launch prices:

- trainer: 500 RUB / month, 5,000 RUB / year
- venue: 1,000 RUB / month, 10,000 RUB / year
- massage/wellness: 1,500 RUB / month, 15,000 RUB / year

All prices are editable from Admin → Economy.

### businessSubscriptions/{subjectType}:{subjectId}

Server-authoritative entitlement and ownership record.

Important fields:

- subjectType
- subjectId
- subjectLabel
- ownerUserId
- activeUntil
- paidUntil
- complimentaryUntil
- lastPaymentAt / lastPaymentId
- lastGrantedAt / lastGrantedBy

A trainer owns their own trainer subject. Venue and massage cards are linked to an owner by an administrator.

### billingLedger/{eventId}

Immutable-style financial/admin event journal for:

- YooKassa payment activation
- admin complimentary grants
- owner assignment / unlink

### businessPaymentRequests/{idempotenceHash}

Retry-safe checkout intent. The same request cannot silently change subject, tariff or owner.

### payments/{yookassaPaymentId}

Existing SportBuddy78 provider-payment collection. Business payments use:

`product: business_subscription`

## YooKassa flow

1. Authenticated owner selects month or year.
2. SportBuddy78 resolves the current price on the server.
3. Server creates an idempotent YooKassa payment.
4. User completes payment at YooKassa.
5. YooKassa sends `payment.succeeded` to the existing payment webhook.
6. SportBuddy78 independently fetches the payment from YooKassa and verifies:
   - payment id
   - paid/succeeded state
   - owner UID
   - subject type and id
   - interval / months
   - exact amount and RUB currency
7. Firestore transaction extends the subscription exactly once and writes the billing ledger.
8. Duplicate webhook delivery is harmless because the payment is marked processed transactionally.

The redirect back to `/success` never grants access by itself.

## Commercial visibility

Before commercial billing is enabled, existing behavior remains unchanged.

After launch + enable:

- personal trainers require active paid or complimentary access to appear in the trainer catalog and receive new booking requests;
- venue and massage cards that have been linked to an owner require active access;
- unclaimed editorial venue/massage catalog entries remain public, so enabling monetization cannot wipe the city catalog.

## Founding Coach

The private `userAdmin.foundingCoachFreeUntil` benefit is included in the effective trainer entitlement.

If a Founding Coach buys or receives an extension before that free period expires, the new period starts after the existing free entitlement rather than replacing it.

## Admin capabilities

Admin → Economy provides:

- edit monthly/yearly prices;
- keep commercial billing disabled/enabled;
- find trainers / venues / massage cards;
- assign or unlink an owner UID;
- grant 1–730 free days without payment;
- inspect active/paid/complimentary dates;
- inspect recent billing ledger events.

## User capabilities

Profile → Business subscriptions shows all commercial services owned by the signed-in user.

The owner can:

- see current publication status;
- see Founding Coach / complimentary period;
- choose monthly or annual renewal;
- open YooKassa checkout after commercial launch.

## Recurring payments

Automatic recurring card charging is intentionally **not enabled for the first release**.

YooKassa supports saved payment methods and repeat payments, but this requires explicit recurring-payment enablement and a clear user-consent / cancellation UX. The current data model supports adding that later without changing subscription ownership or entitlement logic.

## Launch checklist

Before enabling paid publication in 2027:

1. Verify production YooKassa shop credentials.
2. Verify the existing HTTPS webhook receives `payment.succeeded`.
3. Run one test-mode business payment with `YOOKASSA_ALLOW_TEST_PAYMENTS=true`.
4. Verify duplicate webhook delivery does not extend twice.
5. Review Admin → Economy prices.
6. Confirm owner links for venue/massage businesses.
7. Confirm Founding Coach free periods.
8. Keep `billingConfig/main.enabled=false` until the commercial launch decision.
9. After 2027-01-01, enable commercial subscriptions from the admin panel.
10. Monitor `billingLedger`, failed payment logs and catalog visibility.
