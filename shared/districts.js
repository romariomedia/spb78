// Regional territories; stable IDs distinguish names shared by city and oblast.
// Sources: https://www.gov.spb.ru/gov/terr/
// https://budget.lenobl.ru/budget/num/region/compare/ (checked 2026-10-06).
export const DISTRICTS = [
  {
    "id": "spb-admiralteysky",
    "name": "Адмиралтейский",
    "region": "spb"
  },
  {
    "id": "spb-vasileostrovsky",
    "name": "Василеостровский",
    "region": "spb"
  },
  {
    "id": "spb-vyborgsky",
    "name": "Выборгский",
    "region": "spb"
  },
  {
    "id": "spb-kalininsky",
    "name": "Калининский",
    "region": "spb"
  },
  {
    "id": "spb-kirovsky",
    "name": "Кировский",
    "region": "spb"
  },
  {
    "id": "spb-kolpinsky",
    "name": "Колпинский",
    "region": "spb"
  },
  {
    "id": "spb-krasnogvardeysky",
    "name": "Красногвардейский",
    "region": "spb"
  },
  {
    "id": "spb-krasnoselsky",
    "name": "Красносельский",
    "region": "spb"
  },
  {
    "id": "spb-kronshtadtsky",
    "name": "Кронштадтский",
    "region": "spb"
  },
  {
    "id": "spb-kurortny",
    "name": "Курортный",
    "region": "spb"
  },
  {
    "id": "spb-moskovsky",
    "name": "Московский",
    "region": "spb"
  },
  {
    "id": "spb-nevsky",
    "name": "Невский",
    "region": "spb"
  },
  {
    "id": "spb-petrogradsky",
    "name": "Петроградский",
    "region": "spb"
  },
  {
    "id": "spb-petrodvortsovy",
    "name": "Петродворцовый",
    "region": "spb"
  },
  {
    "id": "spb-primorsky",
    "name": "Приморский",
    "region": "spb"
  },
  {
    "id": "spb-pushkinsky",
    "name": "Пушкинский",
    "region": "spb"
  },
  {
    "id": "spb-frunzensky",
    "name": "Фрунзенский",
    "region": "spb"
  },
  {
    "id": "spb-tsentralny",
    "name": "Центральный",
    "region": "spb"
  },
  {
    "id": "lo-boksitogorsky",
    "name": "Бокситогорский",
    "region": "lo"
  },
  {
    "id": "lo-volosovsky",
    "name": "Волосовский",
    "region": "lo"
  },
  {
    "id": "lo-volkhovsky",
    "name": "Волховский",
    "region": "lo"
  },
  {
    "id": "lo-vsevolozhsky",
    "name": "Всеволожский",
    "region": "lo"
  },
  {
    "id": "lo-vyborgsky",
    "name": "Выборгский",
    "region": "lo"
  },
  {
    "id": "lo-gatchinsky",
    "name": "Гатчинский",
    "region": "lo"
  },
  {
    "id": "lo-kingiseppsky",
    "name": "Кингисеппский",
    "region": "lo"
  },
  {
    "id": "lo-kirishsky",
    "name": "Киришский",
    "region": "lo"
  },
  {
    "id": "lo-kirovsky",
    "name": "Кировский",
    "region": "lo"
  },
  {
    "id": "lo-lodeynopolsky",
    "name": "Лодейнопольский",
    "region": "lo"
  },
  {
    "id": "lo-lomonosovsky",
    "name": "Ломоносовский",
    "region": "lo"
  },
  {
    "id": "lo-luzhsky",
    "name": "Лужский",
    "region": "lo"
  },
  {
    "id": "lo-podporozhsky",
    "name": "Подпорожский",
    "region": "lo"
  },
  {
    "id": "lo-priozersky",
    "name": "Приозерский",
    "region": "lo"
  },
  {
    "id": "lo-slantsevsky",
    "name": "Сланцевский",
    "region": "lo"
  },
  {
    "id": "lo-tikhvinsky",
    "name": "Тихвинский",
    "region": "lo"
  },
  {
    "id": "lo-tosnensky",
    "name": "Тосненский",
    "region": "lo"
  },
  {
    "id": "lo-sosnovoborsky",
    "name": "Сосновый Бор",
    "region": "lo"
  }
];
export function getDistrict(id) { return DISTRICTS.find(item => item.id === id); }
export function districtLabel(id) {
  const item = getDistrict(id);
  return item ? `${item.name} · ${item.region === 'spb' ? 'Санкт-Петербург' : 'Ленинградская область'}` : '';
}
export function validateDistrictId(value) {
  if (value === '' || value === null) return '';
  if (typeof value !== 'string' || !getDistrict(value)) {
    throw Object.assign(new Error('Выберите район из списка'), {status:400});
  }
  return value;
}
export function matchesDistrict(training, filter) {
  return !filter || training.districtId === filter;
}
