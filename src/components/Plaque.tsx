import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

// Dark frosted plate (Apple-style material: blur, hairline rim, soft shadow). White text on it
// stays readable over the belt and over the light background alike.
export function Plaque({ children, radius = 20, style }: { children?: ReactNode; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.plaque, { borderRadius: radius }, style]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.fill, { borderRadius: radius }]} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  plaque: {
    overflow: 'hidden',
    boxShadow: '0px 10px 24px rgba(0,0,0,0.35), inset 0px 1px 0px rgba(255,255,255,0.22)',
  },
  fill: { backgroundColor: 'rgba(24,24,27,0.58)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' },
});
