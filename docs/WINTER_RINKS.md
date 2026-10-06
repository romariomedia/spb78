# Winter rinks in Active Leisure

## Product rule

Rinks are a category inside Active Leisure, not a training type. A rink card is primarily a navigation/contact tool: address, phone, official website, rink type, rental availability and seasonal status.

Prices are optional. If the current season price has not been verified, the UI must say that the price should be confirmed with the rink. Never carry last season's tariff forward as current.

## Initial curated set

The first release contains seven high-confidence venues with official contact sources checked on 2026-10-06:

- Каток у Флагштока
- Каток в Новой Голландии
- Каток у моря · Севкабель Порт
- Большой каток ЦПКиО · Елагин остров
- Лазерный каток · Брусницын
- Лесной каток · Охта Парк
- Ледовая Арена «Пулковские высоты»

The 2026/27 season opening dates and tariffs were not yet uniformly published, so the seed intentionally uses “уточняется” rather than stale 2025/26 prices.

## CMS fields

Rinks use the existing leisureDestinations collection with category=rink and optional fields:

- rinkType: outdoor | indoor
- rental
- address
- phone
- website
- hours
- priceText
- priceStatus
- priceCheckedAt
- seasonStatus
- season

Admins can add/edit rinks in Control Center → Отдых. Seed import is create-only and does not overwrite administrator edits.

## Media

The initial seed uses a branded SportBuddy78 fallback cover. Replace it in CMS with a rights-cleared real venue photo when available. The UI must not imply that the fallback is a real photo of the rink.
