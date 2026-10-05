import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, fontMedium, sage, useTheme } from '../theme';
import { useScale } from './scale';
import { Sheet } from './Sheet';
import { useStore } from './store';

const lock = require('../../assets/icons/lock.svg');

// A plain padlock in place of a premium value (calories, audio). Tapping it opens the paywall.
export function Lock({ label, size = 14, color = 'rgba(255,255,255,0.7)' }: { label?: string; size?: number; color?: string }) {
  const k = useScale();
  const { showPaywall } = useStore();
  return (
    <Pressable
      onPress={() => showPaywall(true)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`${label ?? 'Premium'}: доступно в premium`}
      style={({ pressed }) => [s.lock, { gap: 4 * k, opacity: pressed ? 0.6 : 1 }]}
    >
      <Image source={lock} style={{ width: size * k, height: size * k }} tintColor={color} />
      {label ? <Text style={{ fontFamily: font, fontSize: (size + 2) * k, color }}>{label}</Text> : null}
    </Pressable>
  );
}

const perks: [string, string][] = [
  ['калорії', 'ккал і білки, жири, вуглеводи для кожної страви та дня'],
  ['аудіо', 'озвучення кроків, поки руки зайняті готуванням'],
];

// What premium unlocks. Payments are not wired yet, so the button flips a local flag.
export function Paywall() {
  const k = useScale();
  const t = useTheme();
  const { paywall, showPaywall, premium, setPremium } = useStore();
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };

  return (
    <Sheet open={paywall} onClose={() => showPaywall(false)}>
      <View style={[s.badge, { width: 52 * k, height: 52 * k, borderRadius: 16 * k, marginBottom: 12 * k }]}>
        <Image source={lock} style={{ width: 26 * k, height: 26 * k }} />
      </View>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 32 * k, lineHeight: 34 * k }]}>buzzcook premium</Text>
      <Text style={[txt, { color: t.textSoft, marginBottom: 16 * k }]}>все, що вже є, лишається безкоштовним. premium додає:</Text>
      {perks.map(([title, body]) => (
        <View key={title} style={{ flexDirection: 'row', gap: 12 * k, marginBottom: 12 * k }}>
          <View style={{ width: 8 * k, height: 8 * k, borderRadius: 4 * k, backgroundColor: sage, marginTop: 8 * k }} />
          <View style={{ flex: 1 }}>
            <Text style={[txt, { fontFamily: fontMedium }]}>{title}</Text>
            <Text style={[txt, { color: t.textSoft, fontSize: 18 * k, lineHeight: 22 * k }]}>{body}</Text>
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => {
          setPremium(!premium);
          showPaywall(false);
        }}
        accessibilityRole="button"
        style={({ pressed }) => [s.cta, { height: 54 * k, marginTop: 8 * k, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: '#FFFFFF' }}>{premium ? 'вимкнути premium' : 'увімкнути premium'}</Text>
      </Pressable>
      <Text style={[txt, { fontSize: 15 * k, color: t.textSoft, textAlign: 'center', marginTop: 8 * k }]}>демо: оплати поки немає, це перемикач</Text>
    </Sheet>
  );
}

const s = StyleSheet.create({
  lock: { flexDirection: 'row', alignItems: 'center' },
  badge: { backgroundColor: sage, alignItems: 'center', justifyContent: 'center' },
  cta: { borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center' },
});
