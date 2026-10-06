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
  panel: '#FFF1DC',
  panelText: '#3B1607',
  titleShadow: '#3B1607',
  swirl: 1,
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
  panel: '#FFF1DC', // the flyer's cream cards behind the dishes
  panelText: '#3B1607',
  titleShadow: '#3B1607',
  swirl: 1, // opacity of the swirl-line texture
};

// The same poster on black: the orange moves to the accents, the cream panels stay.
const posterBlack = {
  ...poster,
  mode: 'dark' as const,
  bg: ['#000000', '#151110', '#151110', '#000000'] as const,
  text: '#FFF1DC',
  textSoft: 'rgba(255,241,220,0.6)',
  glass: '#1E1A18',
  glassStrong: '#2C2622',
  border: 'rgba(255,241,220,0.14)',
  blurTint: 'dark' as const,
  accent: '#FFF1DC',
  cta: '#E4601A',
  tabTint: '#FFF1DC',
  plaque: 'rgba(38,32,29,0.96)',
  sheet: '#171311',
  group: '#26201D',
  titleShadow: '#E4601A',
  swirl: 0.35,
};

export type Palette = typeof light | typeof dark | typeof stage | typeof poster | typeof posterBlack;

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
  if (mode === 'posterBlack') return posterBlack;
  return mode === 'dark' ? dark : light;
}

// Screen title. The poster look sets it in the chunky display face, white with a hard brown
// drop like the flyer's headline (orange on the black poster); on a cream sheet it stays brown.
export function titleStyle(t: Palette, size: number, onSheet = false) {
  if (!t.poster) return { fontFamily: t.fontMedium, fontSize: size, lineHeight: size * 1.12, color: t.text };
  const fs = size * t.displayK;
  if (onSheet) return { fontFamily: t.display, fontSize: fs, lineHeight: fs * 1.25, color: t.text };
  return { fontFamily: t.display, fontSize: fs, lineHeight: fs * 1.25, color: '#FFFFFF', textShadow: `0px 3px 0px ${t.titleShadow}` };
}
