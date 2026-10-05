import type { SportVenue } from './venues';
import photos from './venuePhotos.json';

export type VenueCoverKind = 'real' | 'missing';

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

/** No generic stock photo: an unknown venue must not look like another venue. */
const MISSING_COVER: VenueCover = {
  url: '', kind: 'missing', sourceUrl: '', sourceLabel: '', credit: '', license: ''
};

export function venueCover(venue: SportVenue): VenueCover {
  const photo = photos[venue.id as keyof typeof photos];
  if (photo) return {
    url: photo.url, kind: 'real', sourceUrl: photo.sourceUrl,
    sourceLabel: photo.sourceLabel, credit: '', license: ''
  };
  return REAL_COVERS[venue.id] ?? MISSING_COVER;
}
