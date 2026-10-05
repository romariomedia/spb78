import prices from './venuePrices.json';
import { SPB_VENUES, type SportVenue } from './venues';

export interface VenuePrice {
  text: string;
  condition: string;
  note?: string;
  sourceUrl?: string;
  checkedAt?: string;
}

/** Render-time enrichment also works for previously seeded Firestore and cached cards.
 * A distinct administrator price always wins; never attribute it to our research. */
export function venuePrice(venue: SportVenue): VenuePrice {
  const seed = SPB_VENUES.find(item => item.id === venue.id);
  if (venue.priceText && (!seed || venue.priceText !== seed.priceText)) {
    return { text: venue.priceText, condition: 'Условия уточняйте у площадки' };
  }
  const price = prices[venue.id as keyof typeof prices];
  if (price) {
    return {
      text: `от ${price.amount.toLocaleString('ru-RU')} ₽ / ${price.unit}`,
      condition: price.condition,
      note: price.note,
      sourceUrl: price.sourceUrl,
      checkedAt: price.checkedAt
    };
  }
  // Old seed prices had no tariff evidence. Do not present them as current prices.
  return { text: 'Цена по запросу', condition: 'Уточните стоимость выбранного времени' };
}
