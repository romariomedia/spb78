export function androidUpdatePolicy(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  const raw = String(value.minimumAndroidVersion ?? '').trim();
  const code = /^\d+$/.test(raw) ? Number(raw) : 0;
  let url = '';
  try {
    const parsed = new URL(String(value.ruStoreUrl || '').trim());
    if (parsed.protocol === 'https:' && ['rustore.ru','www.rustore.ru'].includes(parsed.hostname)
      && !parsed.username && !parsed.password && !parsed.port
      && parsed.pathname.replace(/\/$/,'') === '/catalog/app/ru.sportbuddy.mobile') url = parsed.origin + parsed.pathname;
  } catch {}
  return {minimumAndroidVersion:Number.isSafeInteger(code) && code > 0 && code <= 2100000000 ? String(code) : '', ruStoreUrl:url};
}
export function needsAndroidUpdate(build, value) {
  const policy = androidUpdatePolicy(value);
  const current = /^\d+$/.test(String(build)) ? Number(build) : 0;
  return Number.isSafeInteger(current) && current > 0 && !!policy.ruStoreUrl && !!policy.minimumAndroidVersion && current < Number(policy.minimumAndroidVersion);
}
