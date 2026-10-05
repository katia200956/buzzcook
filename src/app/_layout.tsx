import { AlumniSansSC_400Regular, AlumniSansSC_500Medium } from '@expo-google-fonts/alumni-sans-sc';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StoreProvider } from '../components/store';
import { useTheme } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    AlumniSansSC_400Regular,
    AlumniSansSC_500Medium,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: '#232323' }} />;

  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}

function Root() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg[1] } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cook/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}
