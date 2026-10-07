const PLACEHOLDER_NAMES = new Set([
  'новый спортсмен',
  'спортсмен',
  'athlete',
  'user'
]);

export function normalizePersonName(value, max = 80) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function isUsablePersonName(value, email = '') {
  const name = normalizePersonName(value);
  if (name.length < 2 || name.includes('@')) return false;
  if (!/[A-Za-zА-Яа-яЁё]/.test(name)) return false;
  const lower = name.toLocaleLowerCase('ru-RU');
  const cleanEmail = String(email || '').trim().toLocaleLowerCase('ru-RU');
  if (cleanEmail && lower === cleanEmail) return false;
  if (PLACEHOLDER_NAMES.has(lower)) return false;
  return true;
}

export function chooseCanonicalPersonName({ currentName, firebaseName, candidateName, email } = {}) {
  if (isUsablePersonName(currentName, email)) return normalizePersonName(currentName);
  if (isUsablePersonName(firebaseName, email)) return normalizePersonName(firebaseName);
  if (isUsablePersonName(candidateName, email)) return normalizePersonName(candidateName);
  return 'Новый спортсмен';
}
