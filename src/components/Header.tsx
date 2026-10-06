import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Glass } from './Glass';
import { Plaque } from './Plaque';
import { useScale } from './scale';

// Top row from the Figma frames: round logo button, search pill, square menu button.
export function Header({
  query,
  onQuery,
  logo = true,
  onLogo,
  onMenu,
}: {
  query?: string;
  onQuery?: (q: string) => void;
  logo?: boolean;
  onLogo?: () => void;
  onMenu?: () => void;
}) {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top + 6, 59 * k);

  return (
    <View style={[s.row, { top, left: 18 * k, width: 368 * k, height: 52 * k }]} pointerEvents="box-none">
      <Pressable onPress={onLogo ?? (() => router.navigate('/'))} accessibilityLabel="На головну">
        <Glass radius={100} style={{ width: 52 * k, height: 52 * k, alignItems: 'center', justifyContent: 'center' }}>
          {logo && <View style={[StyleSheet.absoluteFill, { borderRadius: 100, backgroundColor: '#000' }]} />}
          {logo && <Image source={require('../../assets/figma/target.svg')} style={{ width: 36 * k, height: 36 * k }} />}
        </Glass>
      </Pressable>

      {/* v2: the search sits on the dark plaque so the white text reads on any background. */}
      <Plaque radius={100} style={{ width: 224 * k, height: 38 * k, flexDirection: 'row', alignItems: 'center' }}>
        <Image source={require('../../assets/figma/search.svg')} style={{ width: 19 * k, height: 19 * k, marginLeft: 8 * k }} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          onFocus={() => !onQuery && router.navigate('/')}
          placeholder="пошук..."
          placeholderTextColor="rgba(255,255,255,0.7)"
          style={[s.input, { fontFamily: t.font, fontSize: 20 * k, marginLeft: 8 * k }]}
          returnKeyType="search"
        />
      </Plaque>

      <Pressable onPress={onMenu} accessibilityLabel="Меню">
        <Glass radius={15} style={{ width: 52 * k, height: 52 * k, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../assets/figma/menu.svg')} tintColor={t.poster ? t.text : undefined} style={{ width: 35 * k, height: 35 * k }} />
        </Glass>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  row: { position: 'absolute', zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { flex: 1, color: '#FFFFFF', paddingVertical: 0, position: 'relative', zIndex: 1, outlineStyle: 'none' } as any,
});
