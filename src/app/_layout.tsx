import { AlumniSansSC_400Regular, AlumniSansSC_500Medium } from '@expo-google-fonts/alumni-sans-sc';
import { Manrope_400Regular, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Unbounded_500Medium } from '@expo-google-fonts/unbounded';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Paywall } from '../components/Premium';
import { useReminders, useReminderTaps } from '../components/reminders';
import { StoreProvider } from '../components/store';
import { useTheme } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    AlumniSansSC_400Regular,
    AlumniSansSC_500Medium,
    Unbounded_500Medium,
    Manrope_400Regular,
    Manrope_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#232323' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </GestureHandlerRootView>
  );
}

const openUrl = (url: string) => router.push(url as any);

function Root() {
  const t = useTheme();
  useReminders();
  useReminderTaps(openUrl);
  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg[1] } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="diary" />
        <Stack.Screen name="map" />
        <Stack.Screen name="login" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack>
      <Paywall />
    </>
  );
}
