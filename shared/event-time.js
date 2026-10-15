export function eventStart(value) {
  if (typeof value.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.dateKey) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time || '')) {
    const day = new Date(`${value.dateKey}T00:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0,10) !== value.dateKey) return NaN;
    return Date.parse(`${value.dateKey}T${value.time}:00+03:00`);
  }
  return typeof value.startsAt === 'number' && Number.isFinite(value.startsAt) && value.startsAt > 0 ? value.startsAt : NaN;
}
