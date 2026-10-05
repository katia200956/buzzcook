import { useWindowDimensions } from 'react-native';

// The Figma frames are 402pt wide; scale every measurement to the device width.
export const FRAME_W = 402;

export function useScale() {
  const { width } = useWindowDimensions();
  return Math.min(width, 520) / FRAME_W;
}
