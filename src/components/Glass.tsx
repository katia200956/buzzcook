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
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  strong?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[s.shadow, { borderRadius: radius }, style]}>
      <BlurView intensity={18} tint={t.blurTint} style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, backgroundColor: strong ? t.glassStrong : t.glass, borderWidth: 1, borderColor: t.border },
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
