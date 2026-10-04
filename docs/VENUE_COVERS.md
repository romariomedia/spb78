# SportBuddy Places — cover images

The Places catalogue uses a separate cover registry in `src/lib/venueCovers.ts`.
This changes only the face of each card. Venue galleries in `venue.photos` remain independent and can be replaced gradually by administrators.

## Rules
- A cover marked **Фото объекта** is an exact photograph of that venue.
- A cover marked **Иллюстративное фото** is a representative image for the sport and must not be presented as a photograph of that specific venue.
- Venue-owned gallery photos always take priority over the fallback cover.
- External reusable images are loaded from Wikimedia Commons and the detail view links back to the source/license.
- Do not add images scraped from Yandex/Google/2GIS or commercial listing sites without explicit reuse rights.

## Exact venue covers currently cleared for use
- `siburb-arena` — “6559.2. St. Petersburg. Sibur Arena Complex.jpg”, GAlexandrova, CC BY-SA 4.0.
- `ice-palace` — “Ice Palace Saint Petersburg.jpg”, Anton Kudris / mmultipass, CC BY 2.0.
- `hockey-city` — “Хоккейный город (главный фасад).jpg”, Wikimedia Commons; keep the source link visible and verify the file-page license before any local redistribution.

## Top-10 target for exact photography
1. Ледовый дворец
2. Сибур Арена
3. Хоккейный город
4. NOVA ARENA
5. Фабрика Футбола
6. Песок
7. МСК им. В. И. Алексеева
8. Топ-Спин
9. Пляж — центр пляжных видов спорта
10. Легкоатлетический манеж

For targets without a clearly reusable exact photo, the app deliberately keeps a labelled illustrative cover until the venue supplies/permits a real image. This avoids presenting a different facility as the real object and avoids unlicensed commercial reuse.

## Representative cover sources
The registry currently contains freely reusable Wikimedia Commons images for football, basketball, volleyball, tennis, padel, table tennis and ice hockey. Attribution and license metadata are stored alongside each URL.
