import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from './components/store';

// Palettes taken from the Figma frames "white homepage" and "black homepage".
const light = {
  mode: 'light' as const,
  // v2: the same light/shade rhythm, warmed from grey to a soft clay so the food reads warmer.
  bg: ['#7E7266', '#DCD3C6', '#DCD3C6', '#7E7266'] as const,
  text: '#000000',
  textSoft: 'rgba(0,0,0,0.55)',
  glass: 'rgba(255,255,255,0.10)',
  glassStrong: 'rgba(255,255,255,0.22)',
  border: 'rgba(255,255,255,0.55)',
  blurTint: 'light' as const,
  logoBg: '#000000',
  accent: '#000000',
};

// v2 accent for the main call to action: sage from the design brief (white text 5.8:1).
export const sage = '#5B6B45';

const dark = {
  mode: 'dark' as const,
  bg: ['#000000', '#232323', '#232323', '#000000'] as const,
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
