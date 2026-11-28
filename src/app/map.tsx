import { router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { MARKETS_HTML } from '../data/marketsMap';
import { font, fontMedium } from '../theme';
import { useScale } from '../components/scale';

// Map of supermarkets (ATB, Varus, METRO). Prices are coming; for now the points with addresses and hours.
export default function MapScreen() {
  const k = useScale();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#111111' }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 * k, paddingBottom: 10 * k, flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="назад">
          <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: '#FFFFFF' }}>‹</Text>
        </Pressable>
        <View>
          <Text style={{ fontFamily: fontMedium, fontSize: 24 * k, color: '#FFFFFF' }}>карта поруч</Text>
          <Text style={{ fontFamily: font, fontSize: 15 * k, color: 'rgba(255,255,255,0.6)' }}>заклади з меню й цінами · магазини</Text>
        </View>
      </View>
      {Platform.OS === 'web' ? (
        <iframe srcDoc={MARKETS_HTML} style={{ flex: 1, border: 0, width: '100%', height: '100%' }} />
      ) : (
        <WebView source={{ html: MARKETS_HTML }} originWhitelist={['*']} style={{ flex: 1, backgroundColor: '#111111' }} />
      )}
    </View>
  );
}
