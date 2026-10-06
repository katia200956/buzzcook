import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { bgStops, useTheme } from '../theme';

// Full-screen background gradient from the Figma frames. The poster theme adds the flyer's faint swirl lines.
export function Screen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={t.bg} locations={bgStops} style={StyleSheet.absoluteFill} />
      {t.poster && <Image source={require('../../assets/poster/swirl.svg')} style={[StyleSheet.absoluteFill, { opacity: t.swirl }]} contentFit="cover" />}
      {children}
    </View>
  );
}
