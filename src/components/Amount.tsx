import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Recipe } from '../data';
import type { Food } from '../data/foods';
import { font, fontMedium, sage, useTheme } from '../theme';
import { useScale } from './scale';

export type Pick = { kind: 'recipe'; r: Recipe } | { kind: 'food'; x: Food };

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

// How much was eaten: portions of a dish or grams of a product, with the calories before adding.
// Used in the diary's add sheet and right inside the barcode scanner. Give it a `key` per item so it starts fresh.
export function Amount({ pick, onAdd, onBack, backLabel = 'назад' }: { pick: Pick; onAdd: (n: number) => void; onBack: () => void; backLabel?: string }) {
  const k = useScale();
  const t = useTheme();
  const recipe = pick.kind === 'recipe';
  const per = recipe ? pick.r : pick.x;
  const [amount, setAmount] = useState(recipe ? '1' : String(pick.x.portion));

  const n = Number(amount.replace(',', '.'));
  const valid = Number.isFinite(n) && n > 0;
  const factor = recipe ? n : n / 100;
  const preview = valid ? { kcal: r0(per.kcal * factor), p: r0(per.p * factor), f: r0(per.f * factor), c: r0(per.c * factor) } : null;
  const step = (d: number) => setAmount(String(r1(Math.max(recipe ? 0.5 : 5, (valid ? n : 0) + d))));

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k };

  return (
    <>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k, marginTop: 4 * k }]}>{recipe ? pick.r.name : pick.x.name}</Text>
      <Text style={[txt, { color: t.textSoft, fontSize: 18 * k, marginBottom: 12 * k }]}>{recipe ? `${pick.r.kcal} ккал за порцію` : `${pick.x.kcal} ккал на 100 г`}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
        <Pressable onPress={() => step(recipe ? -0.5 : -10)} accessibilityRole="button" accessibilityLabel="Менше" style={[s.round, group, { width: 48 * k, height: 48 * k }]}>
          <Text style={[txt, { fontSize: 28 * k, lineHeight: 30 * k }]}>−</Text>
        </Pressable>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel={recipe ? 'Порції' : 'Грами'}
          style={[txt, group, { flex: 1, height: 48 * k, textAlign: 'center', fontSize: 26 * k, outlineStyle: 'none' } as any]}
        />
        <Pressable onPress={() => step(recipe ? 0.5 : 10)} accessibilityRole="button" accessibilityLabel="Більше" style={[s.round, group, { width: 48 * k, height: 48 * k }]}>
          <Text style={[txt, { fontSize: 28 * k, lineHeight: 30 * k }]}>+</Text>
        </Pressable>
        <Text style={[txt, { width: 58 * k }]}>{recipe ? 'порц.' : 'г'}</Text>
      </View>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 34 * k, marginTop: 14 * k }]}>{preview ? `${preview.kcal} ккал` : '—'}</Text>
      {preview && (
        <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>
          білки {preview.p} г · жири {preview.f} г · вуглеводи {preview.c} г
        </Text>
      )}
      <Pressable
        onPress={() => valid && onAdd(n)}
        disabled={!valid}
        accessibilityRole="button"
        style={({ pressed }) => [s.pill, { height: 54 * k, marginTop: 16 * k, opacity: valid ? 1 : 0.4, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
      >
        <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: '#FFFFFF' }}>додати</Text>
      </Pressable>
      <Pressable onPress={onBack} style={{ alignSelf: 'center', marginTop: 12 * k }} hitSlop={8} accessibilityRole="button">
        <Text style={[txt, { color: t.textSoft }]}>{backLabel}</Text>
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  round: { alignItems: 'center', justifyContent: 'center' },
});
