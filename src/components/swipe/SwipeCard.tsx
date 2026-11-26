import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Equip, SwipeRecipe } from '../../data/swipe';
import { font, fontMedium } from '../../theme';
import { useScale } from '../scale';
import { EquipIcon } from './EquipIcon';

// Recipe card for photo-swipe recipes: everything you decide before cooking lives here
// (time, portion, price, what you cook with, ingredients, what can go wrong). Cooking itself
// opens a separate screen. Dark grey #222222 is the same grey as the photos' background.
export const BG = '#222222';
const LINE = '#3a3a3c';
const MUTED = '#a3a3a1';
const FG = '#f5f5f4';
const INK = '#1f1f20';

export function SwipeCard({ r }: { r: SwipeRecipe }) {
  const k = useScale();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Equip>('pan');
  const [open, setOpen] = useState<number | null>(null);
  const m = r.modes.find((x) => x.key === mode)!;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const body = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: '#d6d6d4' };
  const label = { fontFamily: fontMedium, fontSize: 14 * k, letterSpacing: 1.4 * k, color: MUTED, marginTop: 18 * k, marginBottom: 6 * k };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8 * k, paddingHorizontal: 16 * k, paddingBottom: 150 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
          <Pressable onPress={back} accessibilityLabel="До списку рецептів" hitSlop={8}
            style={{ width: 40 * k, height: 40 * k, borderRadius: 100, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: FG, marginTop: -3 * k }}>‹</Text>
          </Pressable>
          <Text style={{ flex: 1, fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, color: FG }}>{r.name}</Text>
        </View>

        <Image source={r.hero} contentFit="cover" contentPosition={{ top: '45%' }} style={{ width: '100%', aspectRatio: 720 / 600, marginTop: 8 * k }} />

        <View style={{ flexDirection: 'row', gap: 18 * k, marginTop: 4 * k }}>
          <Text style={[body, { color: MUTED }]}><Text style={{ color: FG, fontFamily: fontMedium }}>{m.time}</Text> всього</Text>
          <Text style={[body, { color: MUTED }]}>{r.portion}</Text>
          <Text style={[body, { color: FG, fontFamily: fontMedium }]}>{r.price}</Text>
        </View>
        <Text style={[body, { marginTop: 10 * k }]}>{r.lead}</Text>

        <Text style={label}>ЧИМ ГОТУЄШ</Text>
        <View style={{ flexDirection: 'row', gap: 10 * k }}>
          {r.modes.map((x) => {
            const on = x.key === mode;
            return (
              <Pressable key={x.key} onPress={() => setMode(x.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 * k, paddingVertical: 10 * k, paddingHorizontal: 12 * k, borderRadius: 14 * k, borderWidth: 1, borderColor: on ? FG : LINE, backgroundColor: on ? FG : 'transparent' }}>
                <EquipIcon kind={x.key} fill={on ? INK : MUTED} face={on ? FG : '#2a2a2b'} size={34 * k} />
                <Text style={{ fontFamily: fontMedium, fontSize: 20 * k, color: on ? INK : MUTED }}>{x.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={label}>ЩО ТРЕБА</Text>
        {r.ing.map((x) => (
          <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 * k, paddingVertical: 9 * k, borderBottomWidth: 1, borderBottomColor: LINE }}>
            <Text style={[body, { color: FG, flex: 1 }]}>{x.name}</Text>
            <Text style={[body, { color: MUTED, textAlign: 'right', maxWidth: '50%' }]}>{typeof x.qty === 'string' ? x.qty : x.qty[mode] ?? x.qty.pan}</Text>
          </View>
        ))}

        <Text style={label}>ЩО МОЖЕ ПІТИ НЕ ТАК</Text>
        {r.warn.map(([q, a], i) => (
          <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} style={{ paddingVertical: 10 * k, borderBottomWidth: 1, borderBottomColor: LINE }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={[body, { color: FG }]}>{q}</Text>
              <Text style={[body, { color: MUTED }]}>{open === i ? '−' : '+'}</Text>
            </View>
            {open === i && <Text style={[body, { color: MUTED, marginTop: 6 * k }]}>{a}</Text>}
          </Pressable>
        ))}

        <Pressable onPress={() => router.push({ pathname: '/cook/[id]', params: { id: r.id, mode } })} accessibilityLabel="Готувати"
          style={({ pressed }) => ({ marginTop: 22 * k, borderRadius: 14 * k, backgroundColor: FG, paddingVertical: 14 * k, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontFamily: fontMedium, fontSize: 24 * k, color: INK }}>Готувати</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
