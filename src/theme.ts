import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from './components/store';

// Palettes taken from the Figma frames "white homepage" and "black homepage".
const light = {
  mode: 'light' as const,
  // v2: the same light/shade rhythm, warmed from grey to a soft clay so the food reads warmer.
  // v3 (Apple Music look): only near-black and white. A flat white page with light grey controls;
  // the tab bar and the round header buttons are near-black capsules (Glass "ink").
  bg: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'] as const,
  text: '#000000',
  textSoft: 'rgba(0,0,0,0.55)',
  glass: 'rgba(0,0,0,0.05)',
  glassStrong: 'rgba(0,0,0,0.11)',
  border: 'rgba(0,0,0,0.10)',
  blurTint: 'light' as const,
  logoBg: '#000000',
  accent: '#000000',
};

// Main call to action. v3: the app uses only near-black and white, so the old sage accent is now
// near-black (white text on it reads in both themes; in dark mode buttons carry a light rim).
export const sage = '#1C1C1E';

const dark = {
  mode: 'dark' as const,
  bg: ['#0B0B0B', '#0B0B0B', '#0B0B0B', '#0B0B0B'] as const,
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.55)',
  glass: 'rgba(255,255,255,0.06)',
  glassStrong: 'rgba(255,255,255,0.14)',
  border: 'rgba(255,255,255,0.28)',
  blurTint: 'dark' as const,
  logoBg: '#000000',
  accent: '#FFFFFF',
};

export type Palette = typeof light | typeof dark | typeof stage;

export const bgStops = [0, 0.13942, 0.86058, 1] as const;

export const font = 'AlumniSansSC_400Regular';
export const fontMedium = 'AlumniSansSC_500Medium';
// Dish names on the home shelves: the display face of the recipe pages ("Сирники", "Тости з авокадо").
export const display = 'Unbounded_500Medium';
// The dish strip and tiles stay this dark grey in both themes.
export const shelf = '#1F1F21';

// Screens inside <ForceDark.Provider value> always use the dark palette.
export const ForceDark = createContext(false);

// The cooking "stage": pure black, so the black backdrop of the step videos disappears into it.
export const stage = { ...dark, bg: ['#000000', '#000000', '#000000', '#000000'] as const };

export function useTheme(): Palette {
  const forced = useContext(ForceDark);
  const system = useColorScheme();
  const { themeMode } = useStore();
  const mode = themeMode === 'system' ? (system === 'dark' ? 'dark' : 'light') : themeMode;
  if (forced) return stage;
  return mode === 'dark' ? dark : light;
}
