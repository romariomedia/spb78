export const SPORTBUDDY_PUBLIC_URL = 'https://sportbuddy78.pro';

function clean(value: unknown, max = 180): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildSportBuddyShareUrl(kind: 'training' | 'leisure', id: string): string {
  const safeId = encodeURIComponent(clean(id, 200));
  const campaign = kind === 'training' ? 'training_share' : 'leisure_share';
  return `${SPORTBUDDY_PUBLIC_URL}/?utm_source=sportbuddy&utm_medium=share&utm_campaign=${campaign}#${kind}=${safeId}`;
}

export function trainingShareCopy(input: {
  id: string;
  title: string;
  sport: string;
  locationName: string;
  dateLabel: string;
  isOfficial?: boolean;
}): { title: string; text: string; url: string } {
  const title = clean(input.title, 120) || 'Тренировка';
  const sport = clean(input.sport, 60) || 'спорт';
  const location = clean(input.locationName, 120) || 'Санкт-Петербург';
  const date = clean(input.dateLabel, 120);
  return {
    title: `${input.isOfficial ? 'SportBuddy78' : 'Тренировка SportBuddy78'}: ${title}`,
    text: `Присоединяйся: ${title} · ${sport} · ${location}${date ? ` · ${date}` : ''}. Открой SportBuddy78 и запишись на тренировку.`,
    url: buildSportBuddyShareUrl('training', input.id)
  };
}

export function leisureShareCopy(input: {
  id: string;
  title: string;
  destinationName?: string;
  meetingPoint: string;
  startsAt: number;
}): { title: string; text: string; url: string } {
  const title = clean(input.title, 120) || 'Активный отдых';
  const destination = clean(input.destinationName, 120);
  const meetingPoint = clean(input.meetingPoint, 140);
  const when = Number.isFinite(input.startsAt)
    ? new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Moscow'
      }).format(input.startsAt) + ' МСК'
    : '';
  return {
    title: `Активный отдых SportBuddy78: ${title}`,
    text: `Собираем компанию: ${title}${destination ? ` · ${destination}` : ''}${meetingPoint ? ` · встречаемся: ${meetingPoint}` : ''}${when ? ` · ${when}` : ''}. Присоединяйся в SportBuddy78.`,
    url: buildSportBuddyShareUrl('leisure', input.id)
  };
}
