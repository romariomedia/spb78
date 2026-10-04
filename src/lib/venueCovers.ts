import type { SportVenue } from './venues';

export type VenueCoverKind = 'real' | 'illustrative';

export interface VenueCover {
  url: string;
  kind: VenueCoverKind;
  sourceUrl: string;
  sourceLabel: string;
  credit: string;
  license: string;
}

function commonsFile(fileName: string, width = 1400): string {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}?width=${width}`;
}

function commonsPage(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, '_')}`;
}

const REAL_COVERS: Record<string, VenueCover> = {
  'siburb-arena': {
    url: commonsFile('6559.2. St. Petersburg. Sibur Arena Complex.jpg'),
    kind: 'real',
    sourceUrl: commonsPage('6559.2. St. Petersburg. Sibur Arena Complex.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'GAlexandrova',
    license: 'CC BY-SA 4.0'
  },
  'ice-palace': {
    url: commonsFile('Ice Palace Saint Petersburg.jpg'),
    kind: 'real',
    sourceUrl: commonsPage('Ice Palace Saint Petersburg.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Anton Kudris / mmultipass',
    license: 'CC BY 2.0'
  },
  'hockey-city': {
    url: commonsFile('Хоккейный город (главный фасад).jpg'),
    kind: 'real',
    sourceUrl: commonsPage('Хоккейный город (главный фасад).jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Wikimedia Commons contributor',
    license: 'см. страницу источника'
  }
};

const ILLUSTRATIVE: Record<string, VenueCover> = {
  'Футбол': {
    url: commonsFile('FIFA approved football pitch.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('FIFA approved football pitch.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'ARKSDiyar',
    license: 'CC BY-SA 4.0'
  },
  'Баскетбол': {
    url: commonsFile('Indoor Basketball Court in Karlovasi, Samos.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('Indoor Basketball Court in Karlovasi, Samos.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Samosatwikipedia',
    license: 'CC BY-SA 4.0'
  },
  'Волейбол': {
    url: commonsFile('The Eastern Command Volleyball Championship 2014-15 being held at the ENC Indoor Volleyball court (3).JPG'),
    kind: 'illustrative',
    sourceUrl: commonsPage('The Eastern Command Volleyball Championship 2014-15 being held at the ENC Indoor Volleyball court (3).JPG'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Indian Navy',
    license: 'GODL-India'
  },
  'Теннис': {
    url: commonsFile('The Indoor Tennis Court.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('The Indoor Tennis Court.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Triplph10',
    license: 'CC BY-SA 4.0'
  },
  'Падел': {
    url: commonsFile('University of Cambridge Padel Courts.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('University of Cambridge Padel Courts.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'OCHAPPS',
    license: 'CC BY-SA 4.0'
  },
  'Настольный теннис': {
    url: commonsFile('Indoor Game Table Tennis.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('Indoor Game Table Tennis.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'ManoBV16',
    license: 'CC0 1.0'
  },
  'Хоккей': {
    url: commonsFile('ICE ARENA Letňany interiér.jpg'),
    kind: 'illustrative',
    sourceUrl: commonsPage('ICE ARENA Letňany interiér.jpg'),
    sourceLabel: 'Wikimedia Commons',
    credit: 'Wikimedia Commons contributor',
    license: 'CC BY-SA 4.0'
  }
};

export const REAL_COVER_PRIORITY_IDS = new Set([
  'ice-palace',
  'siburb-arena',
  'hockey-city',
  'nova-arena',
  'fabrika-futbola',
  'pesok',
  'alekseev',
  'top-spin',
  'plyazh-fuchika',
  'athletics-manege'
]);

export function venueCover(venue: SportVenue): VenueCover {
  const exact = REAL_COVERS[venue.id];
  if (exact) return exact;

  const primary = venue.sports[0] || 'Футбол';
  return ILLUSTRATIVE[primary] || ILLUSTRATIVE['Футбол'];
}
