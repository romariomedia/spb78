export type VenueCatalogStatus = 'curated' | 'needs_confirmation' | 'restricted';

export interface SportVenue {
  id: string;
  name: string;
  sports: string[];
  address: string;
  phone?: string;
  hours?: string;
  priceText?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  status: VenueCatalogStatus;
  note?: string;
  photos?: string[];
}

export const VENUE_SPORT_FILTERS = [
  'Все',
  'Футбол',
  'Баскетбол',
  'Волейбол',
  'Теннис',
  'Падел',
  'Настольный теннис',
  'Хоккей'
] as const;

/**
 * Стартовый каталог SportBuddy Places для Санкт-Петербурга.
 * Это редакторский shortlist из открытых источников.
 * Наличие карточки НЕ означает договор или подтвержденную бронь.
 * Статус "verified" появится только после прямого подтверждения площадкой.
 */
export const SPB_VENUES: SportVenue[] = [
  { id:'fabrika-futbola', name:'Фабрика Футбола', sports:['Футбол'], address:'Софийская ул., 14, Санкт-Петербург', phone:'+7 812 322-65-55', hours:'24/7', rating:4.7, reviews:1088, website:'https://xn--80aaacb4bok0apzlgg.xn--p1ai/', status:'curated', note:'Аренда футбольных и мини-футбольных полей.' },
  { id:'arena-krasny-treugolnik', name:'Арена Красный треугольник', sports:['Футбол'], address:'наб. Обводного канала, 136, Санкт-Петербург', phone:'+7 931 002-25-69', hours:'06:00–23:00', rating:4.4, reviews:477, status:'curated' },
  { id:'forward', name:'Футбольный центр Форвард', sports:['Футбол'], address:'просп. Обуховской Обороны, 105, Санкт-Петербург', phone:'+7 812 941-32-84', hours:'24/7', rating:4.4, reviews:381, status:'curated' },
  { id:'f-base', name:'F-Base', sports:['Футбол'], address:'ул. Латышских Стрелков, 19, Санкт-Петербург', phone:'+7 812 777-92-22', hours:'24/7', priceText:'от 4 000 ₽/ч', rating:4.6, reviews:169, status:'curated' },
  { id:'molniya', name:'Футбольный центр Молния', sports:['Футбол'], address:'пр. Стачек, 45к2, Санкт-Петербург', phone:'+7 812 200-87-15', hours:'24/7', rating:4.3, reviews:193, status:'curated' },
  { id:'liga5', name:'Лига5', sports:['Футбол'], address:'ул. Шкапина, 52, Санкт-Петербург', phone:'+7 812 980-25-52', hours:'24/7', rating:4.8, reviews:108, status:'curated' },
  { id:'federaciya', name:'Федерация — футбольный комплекс', sports:['Футбол'], address:'просп. Обуховской Обороны, 149в, Санкт-Петербург', phone:'+7 812 919-86-15', hours:'24/7', rating:4.3, reviews:143, status:'curated' },
  { id:'voskhodyashaya-zvezda', name:'Восходящая звезда', sports:['Футбол'], address:'просп. КИМа, 1-а, Санкт-Петербург', phone:'+7 812 954-21-80', rating:4.4, reviews:98, status:'needs_confirmation' },
  { id:'fc-orlovsky', name:'ФЦ Орловский', sports:['Футбол'], address:'Суздальское ш., 62, Санкт-Петербург', phone:'+7 931 541-00-01', priceText:'от 4 700 ₽/ч', status:'curated', note:'Крытый манеж; условия уточняйте у площадки.' },
  { id:'sosnovka-park', name:'Сосновка Парк', sports:['Футбол'], address:'ул. Жака Дюкло, 22П, Санкт-Петербург', hours:'Пн–Пт 09:00–01:00; Сб–Вс 08:00–01:00', priceText:'от 4 600 ₽/ч', status:'curated' },
  { id:'ozerki-arena', name:'Озерки Арена', sports:['Футбол'], address:'пр-т М. Тореза, 71а, Санкт-Петербург', hours:'24/7', priceText:'от 4 400 ₽/ч', status:'curated' },
  { id:'marshal-arena', name:'Маршал Арена', sports:['Футбол','Баскетбол','Волейбол'], address:'Автобусная ул., 4 к2, Санкт-Петербург', phone:'+7 921 952-99-19', hours:'24/7', priceText:'от 1 700 ₽/ч', rating:4.0, reviews:1, status:'needs_confirmation' },
  { id:'urban-gaming', name:'Urban Gaming', sports:['Футбол','Волейбол'], address:'Арсенальная наб., 1, Санкт-Петербург', phone:'+7 812 926-35-28', hours:'24/7', priceText:'от 1 500 ₽/ч', rating:4.5, reviews:323, status:'curated' },
  { id:'nova-arena', name:'NOVA ARENA', sports:['Футбол','Баскетбол','Волейбол'], address:'Гражданский пр-т., 100, Санкт-Петербург', phone:'+7 812 308-99-88', hours:'09:00–22:30', rating:4.5, reviews:1292, status:'needs_confirmation', note:'Крупный спортивный комплекс; условия любительской аренды уточняйте напрямую.' },
  { id:'siburb-arena', name:'Сибур Арена', sports:['Баскетбол'], address:'Футбольная ал., 8, Санкт-Петербург', phone:'+7 812 456-08-00', hours:'08:00–23:00', rating:4.6, reviews:4318, status:'restricted', note:'Перед использованием необходимо подтвердить доступность аренды для частных организаторов.' },
  { id:'alekseev', name:'МСК им. В. И. Алексеева', sports:['Футбол','Баскетбол','Волейбол','Теннис','Настольный теннис'], address:'пр. Раевского, 16, Санкт-Петербург', phone:'+7 812 223-47-78', hours:'06:00–01:00', rating:4.5, reviews:887, website:'https://alexclub.ru/volleyball-arenda/', status:'curated' },
  { id:'foc-rzd', name:'ФОЦ ОАО «РЖД»', sports:['Баскетбол','Волейбол'], address:'ул. Константина Заслонова, 23, к.4, Санкт-Петербург', phone:'+7 812 764-46-10', rating:4.5, reviews:678, status:'needs_confirmation' },
  { id:'metropolis-arena', name:'Метрополис Арена', sports:['Футбол','Баскетбол','Волейбол'], address:'Глиняная ул., 5 к.1, Санкт-Петербург', phone:'+7 812 565-21-42', hours:'24/7', rating:4.5, reviews:370, status:'curated' },
  { id:'spartak', name:'ФСК «Спартак»', sports:['Баскетбол','Волейбол'], address:'ул. Чайковского, 63б, Санкт-Петербург', phone:'+7 812 273-61-68', hours:'08:00–23:00', rating:4.7, reviews:67, status:'needs_confirmation' },
  { id:'vasileostrovsky', name:'ЦФКСЗ Василеостровского района', sports:['Баскетбол','Волейбол'], address:'Малый пр. В.О., 66, Санкт-Петербург', phone:'+7 812 322-68-15', hours:'08:00–23:00', rating:4.5, reviews:558, status:'restricted' },
  { id:'basket-hall', name:'Basket Hall', sports:['Баскетбол'], address:'ул. Решетникова, 15, Санкт-Петербург', phone:'+7 911 239-83-25', rating:4.4, reviews:55, status:'curated' },
  { id:'urbo', name:'URBO', sports:['Баскетбол','Волейбол'], address:'Бассейная ул., 38К, Санкт-Петербург', phone:'+7 931 100-06-84', hours:'24/7', priceText:'от 2 000 ₽/ч', rating:4.2, reviews:254, status:'curated' },
  { id:'game-tower', name:'GAME TOWER', sports:['Баскетбол'], address:'ул. Газовая, 10Ж, Санкт-Петербург', priceText:'от 2 500 ₽/ч', status:'needs_confirmation' },
  { id:'arena-300', name:'Арена 300', sports:['Баскетбол','Волейбол'], address:'Приморский район, Санкт-Петербург', hours:'до 22:00', website:'https://arena300.ru/spotrzal', status:'curated' },
  { id:'vmyach', name:'ВМЯЧ', sports:['Падел','Волейбол','Настольный теннис'], address:'ул. Передовиков, 18к2, Санкт-Петербург', phone:'+7 812 645-19-81', priceText:'падел от 2 000 ₽/ч; волейбол от 3 000 ₽/ч', rating:5.0, reviews:165, website:'https://vball.ru/', status:'curated' },
  { id:'dinamo-beach', name:'Центр пляжного спорта «Динамо»', sports:['Волейбол'], address:'пр. Динамо, 44б, Санкт-Петербург', phone:'+7 931 599-05-31', hours:'07:00–23:00', rating:4.5, reviews:8, status:'curated' },
  { id:'rio-beach', name:'Площадка пляжного волейбола клуба RIO', sports:['Волейбол'], address:'Санкт-Петербург, 197110', phone:'+7 965 081-04-62', rating:4.9, reviews:28, status:'needs_confirmation' },
  { id:'pesok', name:'Песок', sports:['Волейбол'], address:'Октябрьская наб., 6 корпус 3, Санкт-Петербург', phone:'+7 812 779-10-29', hours:'09:00–00:00', rating:4.8, reviews:921, status:'curated' },
  { id:'plyazh-fuchika', name:'Пляж — центр пляжных видов спорта', sports:['Волейбол'], address:'ул. Фучика, 2а, Санкт-Петербург', phone:'+7 812 911-70-77', hours:'10:00–23:00', rating:4.6, reviews:498, status:'curated' },
  { id:'nikiforov-tennis', name:'Петербургский теннисный клуб им. В. И. Никифорова', sports:['Теннис'], address:'наб. Мартынова, 40, Санкт-Петербург', phone:'+7 921 941-32-19', hours:'07:00–00:00', rating:4.8, reviews:77, status:'curated' },
  { id:'hasansky', name:'Теннисный клуб «Хасанский»', sports:['Теннис'], address:'Хасанская ул., 19, Санкт-Петербург', phone:'+7 812 991-00-19', hours:'07:00–00:00', rating:4.8, reviews:176, status:'curated' },
  { id:'volna-tennis', name:'Теннисный корт «ВОЛНА»', sports:['Теннис'], address:'Авиационная ул., 19, Санкт-Петербург', phone:'+7 812 373-33-66', hours:'07:00–23:00', rating:4.6, reviews:250, status:'curated' },
  { id:'vysota', name:'ПСК «ВЫСОТА»', sports:['Теннис','Футбол','Баскетбол','Волейбол'], address:'пос. Шушары, территория Пулковское, 34А, Санкт-Петербург', phone:'+7 812 380-88-33', rating:4.8, reviews:222, status:'curated' },
  { id:'ozerki-tennis', name:'Теннисный клуб «ОЗЕРКИ»', sports:['Теннис'], address:'Эриванская ул., 5, к.2, Санкт-Петербург', phone:'+7 812 969-17-28', hours:'07:00–00:00', rating:4.5, reviews:145, status:'curated' },
  { id:'luzhaika', name:'Теннисный клуб «Лужайка»', sports:['Теннис'], address:'пр. Стачек, 45 корпус 2, Санкт-Петербург', phone:'+7 921 650-17-22', hours:'08:00–23:00', rating:4.3, reviews:74, status:'curated' },
  { id:'tennis-group', name:'Tennis Group', sports:['Теннис'], address:'Спортивная ул., 8, Санкт-Петербург', phone:'+7 812 921-25-79', hours:'07:00–22:00', rating:5.0, reviews:10, status:'curated' },
  { id:'white-lightning', name:'БЕЛЫЕ МОЛНИИ | VB PRO SPORT', sports:['Теннис','Настольный теннис'], address:'Сабировская ул., 37в, Санкт-Петербург', phone:'+7 952 288-98-50', hours:'10:00–22:00', rating:4.5, reviews:98, status:'needs_confirmation' },
  { id:'kult-padel', name:'Культ Падел', sports:['Падел'], address:'ул. Фучика, 2, Санкт-Петербург', phone:'+7 921 398-03-34', hours:'08:00–23:00', rating:5.0, reviews:6, status:'curated' },
  { id:'win-win-padel', name:'Падел Клуб WIN WIN', sports:['Падел'], address:'ул. Савушкина, 116, Санкт-Петербург', phone:'+7 921 782-06-27', hours:'07:00–00:00', status:'needs_confirmation' },
  { id:'gazpadel', name:'GAZPADEL', sports:['Падел'], address:'Газовая ул., 10, Санкт-Петербург', phone:'+7 916 032-29-46', hours:'07:00–23:00', status:'needs_confirmation' },
  { id:'top-spin', name:'Топ-Спин', sports:['Настольный теннис'], address:'Левашовский пр., 13А, Санкт-Петербург', phone:'+7 812 942-81-40', rating:4.6, reviews:142, status:'curated' },
  { id:'matchball', name:'МАТЧБОЛ', sports:['Настольный теннис'], address:'Пионерская ул., 21, Санкт-Петербург', phone:'+7 921 998-39-12', rating:4.5, reviews:61, status:'curated' },
  { id:'ice-arena-peredovikov', name:'Ледовая Арена', sports:['Хоккей'], address:'ул. Передовиков, 14к2, Санкт-Петербург', phone:'+7 812 416-44-94', rating:4.6, reviews:613, status:'needs_confirmation' },
  { id:'nevsky-ice', name:'Ледовая арена Невского района', sports:['Хоккей'], address:'ул. Бабушкина, 30, Санкт-Петербург', phone:'+7 812 495-49-37', rating:4.6, reviews:560, status:'restricted' },
  { id:'ozerki-ice', name:'Ледовая арена «Озерки»', sports:['Хоккей'], address:'Большая Озёрная ул., 56, Санкт-Петербург', phone:'+7 812 929-49-79', hours:'06:30–00:00', rating:4.3, reviews:323, status:'needs_confirmation' },
  { id:'ice-palace', name:'Ледовый дворец', sports:['Хоккей'], address:'пр. Пятилеток, 1, лит. А, Санкт-Петербург', phone:'+7 812 718-66-20', rating:4.7, reviews:7763, status:'restricted' },
  { id:'ska-palace', name:'Дворец спорта СКА', sports:['Хоккей'], address:'Ждановская ул., 2, Санкт-Петербург', phone:'+7 812 237-00-73', rating:4.5, reviews:319, status:'restricted' },
  { id:'hockey-city', name:'Хоккейный город', sports:['Хоккей'], address:'Российский пр., 6, Санкт-Петербург', phone:'+7 812 245-15-29', hours:'07:00–00:00', rating:4.7, reviews:1601, status:'needs_confirmation' },
  { id:'energy-arena', name:'ENERGY Arena', sports:['Футбол','Теннис','Настольный теннис'], address:'Санкт-Петербург', hours:'24/7', website:'https://energyarena.ru/', status:'curated' },
  { id:'athletics-manege', name:'Легкоатлетический манеж', sports:['Теннис'], address:'Теннисная ал., 3а, Санкт-Петербург', phone:'+7 812 384-20-35', rating:4.6, reviews:378, status:'restricted' },
  { id:'primorsky-multisport', name:'Спортивный комплекс Приморского района', sports:['Баскетбол','Волейбол'], address:'Приморский район, Санкт-Петербург', status:'needs_confirmation', note:'Резервная карточка: публиковать только после проверки точного объекта и контакта.' }
];

export function venueMapUrl(venue: SportVenue): string {
  return `https://yandex.ru/maps/?text=${encodeURIComponent(`${venue.name} ${venue.address}`)}`;
}

export function venueScore(venue: SportVenue): number {
  const rating = venue.rating ?? 0;
  const reviews = venue.reviews ?? 0;
  return rating * Math.log(reviews + 1);
}
