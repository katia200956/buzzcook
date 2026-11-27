import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, Fragment } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Equip, SwipeRecipe } from '../../data/swipe';
import { display } from '../../theme';

import { useScale } from '../scale';
import { EquipIcon } from './EquipIcon';

// The recipe pages keep the look of the original recipe prototypes: Unbounded for titles, Manrope for text.
const body400 = 'Manrope_400Regular';
const body700 = 'Manrope_700Bold';

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
  const [picked, setMode] = useState<Equip>(r.modes[0].key);
  const [open, setOpen] = useState<number | null>(null);
  // The screen can be reused for another recipe; fall back to its first way of cooking.
  const m = r.modes.find((x) => x.key === picked) ?? r.modes[0];
  const mode = m.key;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const body = { fontFamily: body400, fontSize: 15 * k, lineHeight: 21 * k, color: '#d6d6d4' };
  const label = { fontFamily: body700, fontSize: 11 * k, letterSpacing: 1.2 * k, color: MUTED, marginTop: 18 * k, marginBottom: 6 * k };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8 * k, paddingHorizontal: 16 * k, paddingBottom: 230 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
          <Pressable onPress={back} accessibilityLabel="До списку рецептів" hitSlop={8}
            style={{ width: 40 * k, height: 40 * k, borderRadius: 100, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: body700, fontSize: 22 * k, color: FG, marginTop: -3 * k }}>‹</Text>
          </Pressable>
          <Text style={{ flex: 1, fontFamily: display, fontSize: 20 * k, lineHeight: 25 * k, color: FG }}>{r.name}</Text>
        </View>

        <Image source={r.hero} contentFit="cover" contentPosition={{ top: '45%' }} style={{ width: '100%', aspectRatio: 720 / 600, marginTop: 8 * k }} />

        <View style={{ flexDirection: 'row', gap: 18 * k, marginTop: 4 * k }}>
          <Text style={[body, { color: MUTED }]}><Text style={{ color: FG, fontFamily: body700 }}>{m.time}</Text> всього</Text>
          <Text style={[body, { color: MUTED }]}>{r.portion}</Text>
          <Text style={[body, { color: FG, fontFamily: body700 }]}>{r.price}</Text>
        </View>
        <Text style={[body, { marginTop: 10 * k }]}>{r.lead}</Text>

        <Text style={label}>ЧИМ ГОТУЄШ</Text>
        {/* All ways of cooking in one strip, split by a slash: tap one to see its steps. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16 * k, borderWidth: 1, borderColor: LINE, padding: 4 * k }}>
          {r.modes.map((x, i) => {
            const on = x.key === mode;
            return (
              <Fragment key={x.key}>
                {i > 0 && <Text style={{ fontFamily: body400, fontSize: 26 * k, color: MUTED, marginHorizontal: 4 * k }}>/</Text>}
                <Pressable onPress={() => setMode(x.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 * k, paddingVertical: 8 * k, paddingHorizontal: 8 * k, borderRadius: 12 * k, backgroundColor: on ? FG : 'transparent' }}>
                  {(x.uses ?? [x.key]).map((u, j) => (
                    <Fragment key={u}>
                      {j > 0 && <Text style={{ fontFamily: body400, fontSize: 22 * k, color: on ? INK : MUTED }}>/</Text>}
                      <EquipIcon kind={u} fill={on ? INK : MUTED} face={on ? FG : '#2a2a2b'} size={30 * k} />
                    </Fragment>
                  ))}
                  <Text style={{ fontFamily: body700, fontSize: 14 * k, color: on ? INK : MUTED }}>{x.label}</Text>
                </Pressable>
              </Fragment>
            );
          })}
        </View>

        <Text style={label}>ЩО ТРЕБА</Text>
        {r.ing.map((x) => (
          <View key={x.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 * k, paddingVertical: 9 * k, borderBottomWidth: 1, borderBottomColor: LINE }}>
            <Text style={[body, { color: FG, flex: 1 }]}>{x.name}</Text>
            <Text style={[body, { color: MUTED, textAlign: 'right', maxWidth: '50%' }]}>{typeof x.qty === 'string' ? x.qty : x.qty[mode] ?? x.qty.pan ?? Object.values(x.qty)[0]}</Text>
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
          <Text style={{ fontFamily: body700, fontSize: 16 * k, color: INK }}>Готувати</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
