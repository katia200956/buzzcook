import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { bgStops, useTheme } from '../theme';

// Full-screen background gradient from the Figma frames.
export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={t.bg} locations={bgStops} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
