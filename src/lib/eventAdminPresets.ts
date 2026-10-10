// Admin presets: season 2026/27. Editable fallback remains available.
// The selected arena is a proposed location; verify each fixture's venue.
export const LEAGUE_TEAMS = {
  'КХЛ': ['СКА','Шанхайские Драконы','Авангард','Автомобилист','Адмирал','Ак Барс','Амур','Барыс','Динамо Минск','Динамо Москва','Лада','Локомотив','Металлург Магнитогорск','Нефтехимик','Салават Юлаев','Северсталь','Сибирь','Спартак Москва','Торпедо','Трактор','ЦСКА','Сочи'],
  'Единая лига ВТБ': ['Зенит','Автодор','Астана','Динамо Владивосток','Енисей','Локомотив-Кубань','МБА-МАИ','ПАРМА','Самара','УНИКС','Уралмаш','ЦСКА'],
  'РПЛ': ['Зенит','Спартак','ЦСКА','Локомотив','Динамо Москва','Краснодар','Балтика','Ростов','Рубин','Ахмат','Акрон','Крылья Советов','Оренбург','Пари Нижний Новгород','Сочи','Динамо Махачкала']
} as const;
export type LeaguePreset=keyof typeof LEAGUE_TEAMS;
export const LEAGUE_SPORT:Record<LeaguePreset,string>={'КХЛ':'Хоккей','РПЛ':'Футбол','Единая лига ВТБ':'Баскетбол'};
export const LEAGUE_VENUES = [
  {id:'ice',name:'Ледовый дворец',address:'Санкт-Петербург, проспект Пятилеток, 1',lat:59.91913,lng:30.46617,leagues:['КХЛ']},
  {id:'ska',name:'СКА Арена',address:'Санкт-Петербург, проспект Юрия Гагарина, 8',lat:59.86921,lng:30.34115,leagues:['КХЛ']},
  {id:'gazprom',name:'Газпром Арена',address:'Санкт-Петербург, Футбольная аллея, 1',lat:59.9729,lng:30.2213,leagues:['РПЛ']},
  {id:'petrovsky',name:'Стадион «Петровский»',address:'Санкт-Петербург, Петровский остров, 2',lat:59.9512,lng:30.2868,leagues:['РПЛ']},
  {id:'ksk',name:'КСК «Арена»',address:'Санкт-Петербург, Футбольная аллея, 8',lat:59.971547,lng:30.226710,leagues:['Единая лига ВТБ']}
] as const;
export function teamsForLeague(league:string):readonly string[]{return Object.prototype.hasOwnProperty.call(LEAGUE_TEAMS,league)?LEAGUE_TEAMS[league as LeaguePreset]:[];}
export function venuesForLeague(league:string){return LEAGUE_VENUES.filter(v=>v.leagues.some(x=>x===league));}
export function eventMatchTitle(home:string,away:string){return home&&away&&home!==away?`${home} — ${away}`:'';}
