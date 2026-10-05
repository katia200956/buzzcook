import { Image } from 'expo-image';
import { Animated, View, useWindowDimensions } from 'react-native';
import { useScale } from './scale';

// Belt artwork from the Figma file (node "sushi-conveyor-top-vertical 1"): 230x874pt,
// with a slat pattern that repeats every 36pt. We use 24 slats (864pt) per tile so tiles
// join without a seam, and slide the tiles by the scroll offset modulo one slat, so the
// belt looks like it moves endlessly with the plates.
const SLAT = 36;
// The belt runs down the left side, 13pt from the edge, as in the Figma frame.
export const BELT_X = 13;
const TILE = SLAT * 24;

export function Belt({ scrollY }: { scrollY?: Animated.Value }) {
  const k = useScale();
  const { height } = useWindowDimensions();
  const tiles = Math.ceil((height + SLAT * k) / (TILE * k)) + 1;
  const shift = scrollY
    ? Animated.multiply(Animated.modulo(scrollY, SLAT * k), -1)
    : 0;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: BELT_X * k, width: 230 * k, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: shift }] }}>
        {Array.from({ length: tiles }, (_, i) => (
          <View key={i} style={{ height: TILE * k, overflow: 'hidden' }}>
            <Image source={require('../../assets/figma/belt.png')} style={{ width: 230 * k, height: 874 * k }} contentFit="fill" />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
