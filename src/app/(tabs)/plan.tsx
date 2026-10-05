import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Header } from '../../components/Header';
import { Menu } from '../../components/Menu';
import { Plaque } from '../../components/Plaque';
import { Plate } from '../../components/Plate';
import { Lock } from '../../components/Premium';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useScale } from '../../components/scale';
import { Slot, useStore } from '../../components/store';
import { byId, DAYS, MEALS, recipes } from '../../data';
import { font, fontMedium, sage, useTheme } from '../../theme';

const SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
const HEADS = ['сніданок', 'обід', 'вечеря'];
const today = (new Date().getDay() + 6) % 7;
const line = 'rgba(255,255,255,0.14)';

// The week as a table: a row per day, a column per meal. A skipped meal is an empty cell.
// Tapping a cell opens its actions (open, replace, swap, skip); "swap" then waits for a second cell.
export default function Plan() {
  const k = useScale();
  const t = useTheme();
  const { plan, premium, swapMeals, resetPlan } = useStore();
  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState<Slot | null>(null);
  const [swapFrom, setSwapFrom] = useState<Slot | null>(null);

  const at = (day: string, meal: string) => plan.find((p) => p.day === day && p.meal === meal);
  const isFrom = (s: Slot) => swapFrom?.day === s.day && swapFrom?.meal === s.meal;
  const fromRecipe = swapFrom && byId(at(swapFrom.day, swapFrom.meal)?.recipe ?? '');

  const tap = (slot: Slot) => {
    if (!swapFrom) return setOpen(slot);
    if (!isFrom(slot)) swapMeals(swapFrom, slot);
    setSwapFrom(null);
  };

  const txt = { fontFamily: font, color: '#FFFFFF' };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: 128 * k, paddingBottom: 150 * k, paddingHorizontal: 14 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 6 * k, marginBottom: 12 * k }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 34 * k, lineHeight: 36 * k, color: t.text }}>план тижня</Text>
          <Text style={{ fontFamily: font, fontSize: 18 * k, color: t.textSoft }}>натисни на страву, щоб змінити її</Text>
        </View>

        {swapFrom && (
          <Plaque radius={16 * k} style={{ marginBottom: 10 * k, borderWidth: 1.5, borderColor: sage }}>
            <View style={[s.row, { paddingHorizontal: 14 * k, paddingVertical: 10 * k, gap: 10 * k }]}>
              <Text style={[txt, { flex: 1, fontSize: 18 * k, lineHeight: 21 * k }]}>
                обери клітинку, з якою поміняти «{fromRecipe?.name.toLowerCase()}»
              </Text>
              <Pressable onPress={() => setSwapFrom(null)} hitSlop={10} accessibilityRole="button">
                <Text style={[txt, { fontFamily: fontMedium, fontSize: 18 * k, opacity: 0.8 }]}>скасувати</Text>
              </Pressable>
            </View>
          </Plaque>
        )}

        <Plaque radius={20 * k}>
          <View style={[s.row, { borderBottomWidth: 1, borderColor: line }]}>
            <View style={{ width: 50 * k }} />
            {HEADS.map((h) => (
              <Text key={h} style={[txt, s.head, { fontSize: 15 * k, paddingVertical: 10 * k, letterSpacing: 0.6 * k }]}>
                {h}
              </Text>
            ))}
          </View>

          {DAYS.map((day, d) => {
            const dishes = MEALS.map((m) => byId(at(day, m)?.recipe ?? '')).filter((r) => !!r);
            const kcal = dishes.reduce((sum, r) => sum + r!.kcal, 0);
            const isToday = d === today;
            return (
              <View key={day} style={[s.row, d < DAYS.length - 1 && { borderBottomWidth: 1, borderColor: line }]}>
                <View style={{ width: 50 * k, alignItems: 'center', justifyContent: 'center', gap: 4 * k, paddingVertical: 8 * k }}>
                  <View style={{ paddingHorizontal: 7 * k, borderRadius: 100, backgroundColor: isToday ? sage : 'transparent' }}>
                    <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 26 * k }]}>{SHORT[d]}</Text>
                  </View>
                  {premium ? (
                    <Text style={[txt, { fontSize: 13 * k, opacity: 0.6, textAlign: 'center' }]}>{kcal}{'\n'}ккал</Text>
                  ) : (
                    <Lock size={12} />
                  )}
                </View>
                {MEALS.map((meal) => {
                  const slot = { day, meal };
                  const r = byId(at(day, meal)?.recipe ?? '');
                  const from = isFrom(slot);
                  return (
                    <Pressable
                      key={meal}
                      onPress={() => tap(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`${day}, ${meal.toLowerCase()}: ${r ? r.name : 'пропуск'}`}
                      style={({ pressed }) => [
                        s.cell,
                        { paddingVertical: 8 * k, paddingHorizontal: 4 * k, borderLeftWidth: 1, borderColor: line },
                        from && { backgroundColor: 'rgba(91,107,69,0.45)' },
                        swapFrom && !from && { backgroundColor: 'rgba(255,255,255,0.04)' },
                        { transform: [{ scale: pressed ? 0.95 : 1 }] },
                      ]}
                    >
                      {r ? (
                        <>
                          <Plate recipe={r} size={52 * k} />
                          <Text numberOfLines={2} style={[txt, { fontSize: 14 * k, lineHeight: 15 * k, textAlign: 'center', marginTop: 4 * k }]}>
                            {r.name.toLowerCase()}
                          </Text>
                        </>
                      ) : (
                        <View style={[s.empty, { width: 52 * k, height: 52 * k, borderRadius: 26 * k }]}>
                          <Text style={[txt, { fontSize: 24 * k, opacity: 0.45 }]}>+</Text>
                        </View>
                      )}
                      {!r && <Text style={[txt, { fontSize: 14 * k, opacity: 0.45, marginTop: 4 * k }]}>пропуск</Text>}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </Plaque>

        <Pressable onPress={resetPlan} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 * k }} accessibilityRole="button">
          <Text style={{ fontFamily: font, fontSize: 18 * k, color: t.textSoft }}>повернути план за замовчуванням</Text>
        </Pressable>
      </ScrollView>

      <Header logo={false} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
      <CellSheet
        slot={open}
        onClose={() => setOpen(null)}
        onSwap={(slot) => {
          setOpen(null);
          setSwapFrom(slot);
        }}
      />
    </Screen>
  );
}

// Actions for one cell. "замінити" and an empty cell show the dish picker in the same sheet.
function CellSheet({ slot, onClose, onSwap }: { slot: Slot | null; onClose: () => void; onSwap: (s: Slot) => void }) {
  const k = useScale();
  const t = useTheme();
  const { plan, premium, setMeal } = useStore();
  const [picking, setPicking] = useState(false);
  const [last, setLast] = useState<Slot | null>(null);
  // Keep the last slot so the content stays put while the sheet slides away.
  if (slot && slot !== last) {
    setLast(slot);
    setPicking(false);
  }
  const cur = slot ?? last;
  if (!cur) return null;
  const r = byId(plan.find((p) => p.day === cur.day && p.meal === cur.meal)?.recipe ?? '');
  const showPicker = picking || !r;

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k, overflow: 'hidden' as const };
  const sep = { height: StyleSheet.hairlineWidth, backgroundColor: t.textSoft, marginLeft: 16 * k, opacity: 0.5 };
  const rowS = { paddingHorizontal: 16 * k, paddingVertical: 12 * k, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 * k };

  // Same-meal dishes first (breakfast ideas for breakfast), then the rest.
  const options = [...recipes].sort((a, b) => Number(b.cat === cur.meal) - Number(a.cat === cur.meal)).filter((x) => x.id !== r?.id);

  const actions: [string, () => void, boolean?][] = r
    ? [
        ['відкрити рецепт', () => {
          onClose();
          router.push(`/recipe/${r.id}`);
        }],
        ['замінити страву', () => setPicking(true)],
        ['поміняти місцями з іншою', () => onSwap(cur)],
        ['пропустити цей прийом', () => {
          setMeal(cur, null);
          onClose();
        }, true],
      ]
    : [];

  return (
    <Sheet open={!!slot} onClose={onClose}>
      <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>
        {cur.day.toLowerCase()} · {cur.meal.toLowerCase()}
      </Text>
      {r && !showPicker && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, marginTop: 6 * k, marginBottom: 14 * k }}>
          <Plate recipe={r} size={64 * k} />
          <View style={{ flex: 1 }}>
            <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k }]}>{r.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
              <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>{r.total} хв ·</Text>
              {premium ? <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>{r.kcal} ккал</Text> : <Lock label="ккал" size={13} color={t.textSoft} />}
            </View>
          </View>
        </View>
      )}

      {!showPicker && (
        <View style={group}>
          {actions.map(([label, run, danger], i) => (
            <View key={label}>
              {i > 0 && <View style={sep} />}
              <Pressable onPress={run} style={({ pressed }) => [rowS, pressed && { opacity: 0.5 }]} accessibilityRole="button">
                <Text style={[txt, { flex: 1 }, danger && { color: t.mode === 'dark' ? '#FB923C' : '#B42318' }]}>{label}</Text>
                <Text style={[txt, { color: t.textSoft }]}>›</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {showPicker && (
        <>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k, marginTop: 4 * k, marginBottom: 10 * k }]}>
            {r ? 'на що замінити?' : 'додати страву'}
          </Text>
          <ScrollView style={{ maxHeight: 380 * k }} showsVerticalScrollIndicator={false}>
            <View style={group}>
              {options.map((o, i) => (
                <View key={o.id}>
                  {i > 0 && <View style={sep} />}
                  <Pressable
                    onPress={() => {
                      setMeal(cur, o.id);
                      onClose();
                    }}
                    style={({ pressed }) => [rowS, { paddingVertical: 8 * k }, pressed && { opacity: 0.5 }]}
                    accessibilityRole="button"
                  >
                    <Plate recipe={o} size={44 * k} />
                    <View style={{ flex: 1 }}>
                      <Text style={txt} numberOfLines={1}>{o.name}</Text>
                      <Text style={[txt, { fontSize: 16 * k, lineHeight: 18 * k, color: t.textSoft }]}>
                        {o.cat.toLowerCase()} · {o.total} хв
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
          {r && (
            <Pressable onPress={() => setPicking(false)} style={{ alignSelf: 'center', marginTop: 12 * k }} hitSlop={8}>
              <Text style={[txt, { color: t.textSoft }]}>назад</Text>
            </Pressable>
          )}
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  head: { flex: 1, textAlign: 'center', opacity: 0.6, textTransform: 'uppercase' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
});
