import {
  ThemePreferences, DEFAULT_THEME, ThemeId, SurfaceId,
  getAccentTheme, getSurfaceTheme
} from '../lib/themes';
import { updateProfile } from './repository';

const THEME_KEY = 'sportbuddy_theme_v1';

export function loadTheme(): ThemePreferences {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<ThemePreferences>) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(prefs: ThemePreferences): void {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

/**
 * Injects the palette into the document as CSS custom properties.
 * Tailwind utilities keep working; only the accent/surface tokens change.
 */
export function applyTheme(prefs: ThemePreferences): void {
  if (typeof document === 'undefined') return;

  const accent = getAccentTheme(prefs.accent);
  const surface = getSurfaceTheme(prefs.surface);
  const root = document.documentElement;

  root.style.setProperty('--sb-accent', accent.accent);
  root.style.setProperty('--sb-accent-soft', accent.accentSoft);
  root.style.setProperty('--sb-accent-deep', accent.accentDeep);
  root.style.setProperty('--sb-accent-glow', accent.glow);

  root.style.setProperty('--sb-bg', surface.bg);
  root.style.setProperty('--sb-surface', surface.surface);
  root.style.setProperty('--sb-surface-alt', surface.surfaceAlt);
  root.style.setProperty('--sb-border', surface.border);

  root.dataset.accent = prefs.accent;
  root.dataset.surface = prefs.surface;
  root.classList.toggle('sb-reduced-motion', prefs.reducedMotion);
  root.classList.toggle('sb-compact', prefs.compactMode);

  // Native status bar / browser chrome colour
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', surface.bg);
}

/** Applies the saved theme on app start */
export function initTheme(): ThemePreferences {
  const prefs = loadTheme();
  applyTheme(prefs);
  return prefs;
}

export async function persistTheme(prefs: ThemePreferences): Promise<void> {
  saveTheme(prefs);
  applyTheme(prefs);
  // Keep the choice on the profile so it follows the account
  await updateProfile({ themeAccent: prefs.accent, themeSurface: prefs.surface });
}

export function resetTheme(): ThemePreferences {
  saveTheme(DEFAULT_THEME);
  applyTheme(DEFAULT_THEME);
  return DEFAULT_THEME;
}

export type { ThemeId, SurfaceId };
