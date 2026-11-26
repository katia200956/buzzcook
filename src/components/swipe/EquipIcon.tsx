import { View } from 'react-native';
import type { Equip } from '../../data/swipe';

// Two-tone equipment icons drawn with plain views (the app has no SVG library).
// `fill` is the solid tone, `face` the inner tone; both flip when the button is selected.
export function EquipIcon({ kind, fill, face, size = 34 }: { kind: Equip; fill: string; face: string; size?: number }) {
  const u = size / 34;
  if (kind === 'pan') {
    return (
      <View style={{ width: size, height: size }}>
        {/* pan wall seen from 45°, then the rim with the cooking surface, then the handle */}
        <View style={{ position: 'absolute', left: 1 * u, top: 4 * u, width: 26 * u, height: 26 * u, borderRadius: 13 * u, backgroundColor: fill, transform: [{ scaleY: 0.6 }, { translateY: 5 * u }] }} />
        <View style={{ position: 'absolute', left: 1 * u, top: 4 * u, width: 26 * u, height: 26 * u, borderRadius: 13 * u, backgroundColor: face, borderWidth: 2.4 * u, borderColor: fill, transform: [{ scaleY: 0.56 }] }} />
        <View style={{ position: 'absolute', left: 24 * u, top: 12 * u, width: 11 * u, height: 3.6 * u, borderRadius: 2 * u, backgroundColor: fill, transform: [{ rotate: '-24deg' }] }} />
      </View>
    );
  }
  if (kind === 'toaster') {
    return (
      <View style={{ width: size, height: size }}>
        {[8, 17].map((x) => (
          <View key={x} style={{ position: 'absolute', left: x * u, top: 5 * u, width: 8 * u, height: 9 * u, borderTopLeftRadius: 4 * u, borderTopRightRadius: 4 * u, backgroundColor: face, borderWidth: 2 * u, borderColor: fill }} />
        ))}
        <View style={{ position: 'absolute', left: 3 * u, top: 12 * u, width: 27 * u, height: 18 * u, borderRadius: 6 * u, backgroundColor: face, borderWidth: 2.2 * u, borderColor: fill }} />
        {[8, 17].map((x) => (
          <View key={x} style={{ position: 'absolute', left: x * u, top: 11 * u, width: 8 * u, height: 3 * u, borderRadius: 1.5 * u, backgroundColor: fill }} />
        ))}
        <View style={{ position: 'absolute', left: 29 * u, top: 17 * u, width: 4 * u, height: 3.4 * u, borderRadius: 1 * u, backgroundColor: fill }} />
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', left: 4 * u, top: 5 * u, width: 26 * u, height: 25 * u, borderRadius: 4 * u, backgroundColor: face, borderWidth: 2.2 * u, borderColor: fill }} />
      <View style={{ position: 'absolute', left: 9 * u, top: 13 * u, width: 16 * u, height: 12 * u, borderRadius: 2 * u, backgroundColor: fill }} />
      {[10, 15].map((x) => (
        <View key={x} style={{ position: 'absolute', left: x * u, top: 8 * u, width: 3 * u, height: 3 * u, borderRadius: 2 * u, backgroundColor: fill }} />
      ))}
    </View>
  );
}
