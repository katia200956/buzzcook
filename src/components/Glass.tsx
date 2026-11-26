import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

// Frosted panel used for every card, pill and button in the Figma file:
// light fill, 6px backdrop blur, thin bright rim and a soft drop shadow.
export function Glass({
  children,
  style,
  radius = 15,
  strong,
  ink,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  strong?: boolean;
  ink?: boolean; // always a near-black capsule, for white icons (tab bar, header buttons)
}) {
  const t = useTheme();
  const fill = ink ? (strong ? 'rgba(17,17,17,0.95)' : 'rgba(17,17,17,0.82)') : strong ? t.glassStrong : t.glass;
  const rim = ink ? 'rgba(255,255,255,0.18)' : t.border;
  return (
    <View style={[s.shadow, { borderRadius: radius }, style]}>
      <BlurView intensity={18} tint={ink ? 'dark' : t.blurTint} style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: fill, borderWidth: 1, borderColor: rim },
        ]}
      />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  shadow: {
    boxShadow: '0px 2px 8px 2px rgba(0,0,0,0.10), inset 0px 0px 8px 0px rgba(0,0,0,0.20)',
  },
});
