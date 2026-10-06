import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from './components/store';

export const font = 'AlumniSansSC_400Regular';
export const fontMedium = 'AlumniSansSC_500Medium';

// v2 accent for the main call to action: sage from the design brief (white text 5.8:1).
export const sage = '#5B6B45';

// Fields shared by the original light and dark looks.
const classic = {
  poster: false,
  font,
  fontMedium,
  display: fontMedium,
  displayK: 1,
  cta: sage,
  tabTint: '#FFFFFF',
  plaque: 'rgba(24,24,27,0.58)',
};

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
  ...classic,
  sheet: 'rgba(235,235,237,0.78)',
  group: 'rgba(255,255,255,0.7)',
};

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
  ...classic,
  sheet: 'rgba(30,30,32,0.72)',
  group: 'rgba(255,255,255,0.08)',
};

// "Poster" theme, after the orange ramen-restaurant flyer: warm orange ground with faint
// swirl lines, cream cards, chocolate-brown text and plaques, chunky display headlines.
const poster = {
  mode: 'light' as const,
  bg: ['#E4601A', '#F28A2E', '#F28A2E', '#E4601A'] as const,
  text: '#3B1607',
  textSoft: 'rgba(59,22,7,0.62)',
  glass: '#FFF1DC',
  glassStrong: '#FFFFFF',
  border: 'rgba(59,22,7,0.10)',
  blurTint: 'light' as const,
  logoBg: '#000000',
  accent: '#3B1607',
  poster: true,
  font: 'AlumniSansSC_600SemiBold',
  fontMedium: 'AlumniSansSC_800ExtraBold',
  display: 'DelaGothicOne_400Regular',
  displayK: 0.72, // Dela is much wider than Alumni Sans, so headlines shrink to fit the same boxes
  cta: '#D7341D',
  tabTint: '#3B1607',
  plaque: 'rgba(59,22,7,0.93)',
  sheet: '#FFF1DC',
  group: '#FFFFFF',
};

export type Palette = typeof light | typeof dark | typeof stage | typeof poster;

export const bgStops = [0, 0.13942, 0.86058, 1] as const;

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
  if (mode === 'poster') return poster;
  return mode === 'dark' ? dark : light;
}

// Screen title. The poster look sets it in the chunky display face, white with a hard brown
// drop like the flyer's headline; on a cream sheet it stays brown.
export function titleStyle(t: Palette, size: number, onSheet = false) {
  if (!t.poster) return { fontFamily: t.fontMedium, fontSize: size, lineHeight: size * 1.12, color: t.text };
  const fs = size * t.displayK;
  if (onSheet) return { fontFamily: t.display, fontSize: fs, lineHeight: fs * 1.25, color: t.text };
  return { fontFamily: t.display, fontSize: fs, lineHeight: fs * 1.25, color: '#FFFFFF', textShadow: '0px 3px 0px #3B1607' };
}
