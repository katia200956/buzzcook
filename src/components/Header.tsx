import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, fontMedium, sage } from '../theme';
import { SavedBadge } from './Cost';
import { Glass } from './Glass';
import { Plaque } from './Plaque';
import { useScale } from './scale';
import { useStore } from './store';

// Top row from the Figma frames: round calorie button (in place of the logo), search pill, square menu button.
export function Header({
  query,
  onQuery,
  onMenu,
}: {
  query?: string;
  onQuery?: (q: string) => void;
  onMenu?: () => void;
}) {
  const k = useScale();
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top + 6, 59 * k);
  const { premium, showPaywall } = useStore();

  return (
    <>
    {/* The money saved so far, glowing quietly under the menu button on every main screen. */}
    <SavedBadge top={top + 60 * k} right={18 * k} />
    <View style={[s.row, { top, left: 18 * k, width: 368 * k, height: 52 * k }]} pointerEvents="box-none">
      {/* Premium calorie diary in the black ring circle (where the logo was). On free it carries a lock and opens the paywall. */}
      <Pressable
        onPress={() => (premium ? router.push('/diary') : showPaywall(true))}
        accessibilityRole="button"
        accessibilityLabel={premium ? 'Щоденник калорій' : 'Щоденник калорій: доступно в premium'}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
      >
        <View style={[s.kcal, { width: 52 * k, height: 52 * k }]}>
          <View style={[s.ring, { width: 42 * k, height: 42 * k }]}>
            <Text style={{ fontFamily: fontMedium, fontSize: 17 * k, lineHeight: 18 * k, color: '#FFFFFF' }}>ккал</Text>
          </View>
          {!premium && (
            <View style={[s.badge, { width: 20 * k, height: 20 * k, top: -2 * k, right: -2 * k }]}>
              <Image source={require('../../assets/icons/lock.svg')} style={{ width: 11 * k, height: 11 * k }} tintColor="#FFFFFF" />
            </View>
          )}
        </View>
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
          style={[s.input, { fontSize: 20 * k, marginLeft: 8 * k }]}
          returnKeyType="search"
        />
      </Plaque>

      <Pressable onPress={onMenu} accessibilityRole="button" accessibilityLabel="Меню">
        <Glass radius={15} style={{ width: 52 * k, height: 52 * k, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../../assets/figma/menu.svg')} style={{ width: 35 * k, height: 35 * k }} />
        </Glass>
      </Pressable>
    </View>
    </>
  );
}

const s = StyleSheet.create({
  row: { position: 'absolute', zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kcal: { borderRadius: 100, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', boxShadow: '0px 2px 8px 2px rgba(0,0,0,0.15)' },
  ring: { borderRadius: 100, borderWidth: 2, borderColor: sage, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, fontFamily: font, color: '#FFFFFF', paddingVertical: 0, position: 'relative', zIndex: 1, outlineStyle: 'none' } as any,
});
