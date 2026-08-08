export type ThemeId =
  | 'emerald'
  | 'neva'
  | 'sunset'
  | 'royal'
  | 'crimson'
  | 'gold'
  | 'arctic'
  | 'mint';

export type SurfaceId = 'midnight' | 'graphite' | 'ocean' | 'plum';

export interface AccentTheme {
  id: ThemeId;
  name: string;
  description: string;
  emoji: string;
  /** Tailwind-compatible HEX values injected as CSS variables */
  accent: string;      // main accent (buttons, active states)
  accentSoft: string;  // hover / lighter tone
  accentDeep: string;  // gradients, pressed states
  glow: string;        // rgba shadow colour
  premium: boolean;    // requires Premium subscription
}

export interface SurfaceTheme {
  id: SurfaceId;
  name: string;
  emoji: string;
  bg: string;        // app background
  surface: string;   // cards
  surfaceAlt: string;// inputs / nested blocks
  border: string;
  premium: boolean;
}

export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: 'emerald',
    name: 'SportBuddy',
    description: 'Фирменный изумрудный',
    emoji: '💚',
    accent: '#34d399',
    accentSoft: '#6ee7b7',
    accentDeep: '#059669',
    glow: '16, 185, 129',
    premium: false
  },
  {
    id: 'neva',
    name: 'Нева',
    description: 'Холодная синь залива',
    emoji: '🌊',
    accent: '#38bdf8',
    accentSoft: '#7dd3fc',
    accentDeep: '#0284c7',
    glow: '56, 189, 248',
    premium: true
  },
  {
    id: 'sunset',
    name: 'Белые ночи',
    description: 'Закат над Невой',
    emoji: '🌇',
    accent: '#fb923c',
    accentSoft: '#fdba74',
    accentDeep: '#ea580c',
    glow: '251, 146, 60',
    premium: true
  },
  {
    id: 'royal',
    name: 'Эрмитаж',
    description: 'Королевский пурпур',
    emoji: '👑',
    accent: '#a78bfa',
    accentSoft: '#c4b5fd',
    accentDeep: '#7c3aed',
    glow: '167, 139, 250',
    premium: true
  },
  {
    id: 'crimson',
    name: 'Зенит',
    description: 'Энергия чемпионов',
    emoji: '🔥',
    accent: '#fb7185',
    accentSoft: '#fda4af',
    accentDeep: '#e11d48',
    glow: '251, 113, 133',
    premium: true
  },
  {
    id: 'gold',
    name: 'Золото',
    description: 'Для чемпионов',
    emoji: '🥇',
    accent: '#fbbf24',
    accentSoft: '#fcd34d',
    accentDeep: '#d97706',
    glow: '251, 191, 36',
    premium: true
  },
  {
    id: 'arctic',
    name: 'Арктика',
    description: 'Ледяная свежесть',
    emoji: '❄️',
    accent: '#67e8f9',
    accentSoft: '#a5f3fc',
    accentDeep: '#0891b2',
    glow: '103, 232, 249',
    premium: true
  },
  {
    id: 'mint',
    name: 'Лайм',
    description: 'Максимальный заряд',
    emoji: '🍋',
    accent: '#a3e635',
    accentSoft: '#bef264',
    accentDeep: '#65a30d',
    glow: '163, 230, 53',
    premium: true
  }
];

export const SURFACE_THEMES: SurfaceTheme[] = [
  {
    id: 'midnight',
    name: 'Полночь',
    emoji: '🌑',
    bg: '#020617',
    surface: '#0f172a',
    surfaceAlt: '#020617',
    border: '#1e293b',
    premium: false
  },
  {
    id: 'graphite',
    name: 'Графит',
    emoji: '🌫',
    bg: '#0c0a09',
    surface: '#1c1917',
    surfaceAlt: '#0c0a09',
    border: '#292524',
    premium: true
  },
  {
    id: 'ocean',
    name: 'Глубина',
    emoji: '🌌',
    bg: '#04121f',
    surface: '#0b2337',
    surfaceAlt: '#061a29',
    border: '#14405c',
    premium: true
  },
  {
    id: 'plum',
    name: 'Ночная слива',
    emoji: '🍇',
    bg: '#100818',
    surface: '#1e1229',
    surfaceAlt: '#150c1e',
    border: '#3b2153',
    premium: true
  }
];

export interface ThemePreferences {
  accent: ThemeId;
  surface: SurfaceId;
  reducedMotion: boolean;
  compactMode: boolean;
}

export const DEFAULT_THEME: ThemePreferences = {
  accent: 'emerald',
  surface: 'midnight',
  reducedMotion: false,
  compactMode: false
};

export function getAccentTheme(id: ThemeId): AccentTheme {
  return ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0]!;
}

export function getSurfaceTheme(id: SurfaceId): SurfaceTheme {
  return SURFACE_THEMES.find((t) => t.id === id) ?? SURFACE_THEMES[0]!;
}
