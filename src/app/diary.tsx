import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Amount, Pick } from '../components/Amount';
import { DishPhotoSheet } from '../components/DishPhoto';
import { Glass } from '../components/Glass';
import { Plaque } from '../components/Plaque';
import { Plate } from '../components/Plate';
import { Scanner } from '../components/Scanner';
import { Lock } from '../components/Premium';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { useScale } from '../components/scale';
import { Entry, useStore } from '../components/store';
import { byId, DAYS, DIARY_MEALS, dayKey, MONTHS, Recipe, recipes, weekKey } from '../data';
import { Food, searchFoods } from '../data/foods';
import { font, fontMedium, sage, useTheme } from '../theme';

const white = '#FFFFFF';
const soft = 'rgba(255,255,255,0.65)';
const line = 'rgba(255,255,255,0.14)';
const buzz = () => Haptics.selectionAsync().catch(() => {});
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;

const shift = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const dayName = (d: Date) => {
  const diff = Math.round((d.getTime() - shift(new Date(), 0).getTime()) / 86400000);
  if (diff === 0) return 'сьогодні';
  if (diff === -1) return 'вчора';
  if (diff === 1) return 'завтра';
  return DAYS[(d.getDay() + 6) % 7].toLowerCase();
};

const sum = (list: Entry[]) =>
  list.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p, c: a.c + e.c, f: a.f + e.f }), { kcal: 0, p: 0, c: 0, f: 0 });

// Premium calorie diary: one day at a time, four meals, each with what was eaten.
// A dish from the week plan goes in with one tap; anything else comes from the recipes or the product list.
export default function Diary() {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { premium, showPaywall, diary, goal, planOf, addEntry, removeEntry } = useStore();
  const [date, setDate] = useState(() => shift(new Date(), 0));
  const [adding, setAdding] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [scanFor, setScanFor] = useState<string | null>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);

  const key = dayKey(date);
  const entries = diary[key] ?? [];
  const total = sum(entries);
  const left = goal - total.kcal;
  const plan = planOf(weekKey(0, date));
  const weekday = DAYS[(date.getDay() + 6) % 7];
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/plan'));

  const addRecipe = (meal: string, r: Recipe, portions: number) => {
    addEntry(key, { meal, kind: 'recipe', ref: r.id, name: r.name, amount: portions, kcal: r0(r.kcal * portions), p: r1(r.p * portions), c: r1(r.c * portions), f: r1(r.f * portions) });
    buzz();
  };
  const addFood = (meal: string, x: Food, grams: number) => {
    const q = grams / 100;
    addEntry(key, { meal, kind: 'food', ref: x.id, name: x.name, amount: grams, kcal: r0(x.kcal * q), p: r1(x.p * q), c: r1(x.c * q), f: r1(x.f * q) });
    buzz();
  };

  const txt = { fontFamily: font, color: white };
  const top = Math.max(insets.top + 6, 59 * k);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: top + 64 * k, paddingBottom: insets.bottom + 40 * k, paddingHorizontal: 14 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ paddingHorizontal: 6 * k, marginBottom: 10 * k }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 34 * k, lineHeight: 36 * k, color: t.text }}>щоденник калорій</Text>
          <Text style={{ fontFamily: font, fontSize: 18 * k, color: t.textSoft }}>що ти з’їла за день</Text>
        </View>

        {!premium ? (
          <Plaque radius={20 * k} style={{ padding: 18 * k, alignItems: 'flex-start', gap: 10 * k }}>
            <Lock still size={22} color={white} />
            <Text style={[txt, { fontSize: 21 * k, lineHeight: 25 * k }]}>щоденник калорій доступний у premium</Text>
            <Pressable onPress={() => showPaywall(true)} accessibilityRole="button" style={[s.pill, { height: 46 * k, paddingHorizontal: 22 * k }]}>
              <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k }]}>відкрити premium</Text>
            </Pressable>
          </Plaque>
        ) : (
          <>
            {/* Day switcher */}
            <View style={[s.row, { alignItems: 'center', gap: 8 * k, marginBottom: 10 * k }]}>
              <Arrow dir={-1} onPress={() => setDate(shift(date, -1))} />
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 24 * k, color: t.text }}>
                  {date.getDate()} {MONTHS[date.getMonth()]}
                </Text>
                <Text style={{ fontFamily: font, fontSize: 16 * k, color: t.textSoft }}>{dayName(date)}</Text>
              </View>
              <Arrow dir={1} onPress={() => setDate(shift(date, 1))} />
            </View>

            {/* Day total against the goal */}
            <Plaque radius={20 * k} style={{ padding: 16 * k, marginBottom: 12 * k }}>
              <View style={[s.row, { alignItems: 'flex-end', justifyContent: 'space-between' }]}>
                <Text style={[txt, { fontFamily: fontMedium, fontSize: 44 * k, lineHeight: 46 * k }]}>
                  {total.kcal}
                  <Text style={{ fontFamily: font, fontSize: 20 * k, color: soft }}> / {goal} ккал</Text>
                </Text>
                <Pressable onPress={() => setGoalOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Змінити ціль">
                  <Text style={[txt, { fontSize: 18 * k, color: soft, textDecorationLine: 'underline' }]}>ціль</Text>
                </Pressable>
              </View>
              <View style={[s.track, { height: 8 * k, marginVertical: 10 * k }]}>
                <View style={{ width: `${Math.min(100, (total.kcal / Math.max(goal, 1)) * 100)}%`, height: '100%', borderRadius: 100, backgroundColor: left < 0 ? '#E0803C' : sage }} />
              </View>
              <Text style={[txt, { fontSize: 18 * k, color: soft }]}>{left >= 0 ? `лишилось ${left} ккал` : `понад ціль на ${-left} ккал`}</Text>
              <View style={[s.row, { gap: 6 * k, marginTop: 10 * k }]}>
                {(
                  [
                    ['білки', total.p],
                    ['жири', total.f],
                    ['вуглеводи', total.c],
                  ] as const
                ).map(([label, v]) => (
                  <View key={label} style={[s.tile, { paddingVertical: 8 * k, borderRadius: 12 * k }]}>
                    <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 24 * k }]}>{r0(v)} г</Text>
                    <Text style={[txt, { fontSize: 15 * k, color: soft }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </Plaque>

            {DIARY_MEALS.map((meal) => {
              const list = entries.filter((e) => e.meal === meal);
              const planned = byId(plan.find((p) => p.day === weekday && p.meal === meal)?.recipe ?? '');
              const showPlanned = planned && !list.some((e) => e.kind === 'recipe' && e.ref === planned.id);
              return (
                <Plaque key={meal} radius={20 * k} style={{ marginBottom: 10 * k }}>
                  <View style={[s.row, { alignItems: 'center', paddingHorizontal: 14 * k, paddingTop: 12 * k, paddingBottom: 6 * k }]}>
                    <Text style={[txt, { flex: 1, fontFamily: fontMedium, fontSize: 22 * k }]}>{meal.toLowerCase()}</Text>
                    <Text style={[txt, { fontSize: 18 * k, color: soft }]}>{sum(list).kcal} ккал</Text>
                  </View>

                  {list.map((e) => (
                    <View key={e.id} style={[s.row, { alignItems: 'center', paddingHorizontal: 14 * k, paddingVertical: 8 * k, gap: 10 * k, borderTopWidth: 1, borderColor: line }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[txt, { fontSize: 19 * k, lineHeight: 22 * k }]} numberOfLines={1}>
                          {e.name.toLowerCase()}
                        </Text>
                        <Text style={[txt, { fontSize: 15 * k, color: soft }]}>
                          {e.kind === 'recipe' ? `${e.amount} порц.` : `${e.amount} г`} · б {r0(e.p)} · ж {r0(e.f)} · в {r0(e.c)}
                        </Text>
                      </View>
                      <Text style={[txt, { fontSize: 19 * k }]}>{e.kcal}</Text>
                      <Pressable onPress={() => removeEntry(key, e.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Видалити: ${e.name}`}>
                        <Text style={[txt, { fontSize: 18 * k, color: soft }]}>✕</Text>
                      </Pressable>
                    </View>
                  ))}

                  {showPlanned && (
                    <Pressable
                      onPress={() => addRecipe(meal, planned, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Додати з плану: ${planned.name}`}
                      style={({ pressed }) => [s.row, { alignItems: 'center', gap: 10 * k, marginHorizontal: 10 * k, marginTop: 4 * k, padding: 8 * k, borderRadius: 14 * k, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Plate recipe={planned} size={40 * k} />
                      <View style={{ flex: 1 }}>
                        <Text style={[txt, { fontSize: 15 * k, color: soft }]}>з плану</Text>
                        <Text style={[txt, { fontSize: 18 * k, lineHeight: 20 * k }]} numberOfLines={1}>
                          {planned.name.toLowerCase()} · {planned.kcal} ккал
                        </Text>
                      </View>
                      <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k, color: white }]}>+</Text>
                    </Pressable>
                  )}

                  <Pressable onPress={() => setAdding(meal)} accessibilityRole="button" accessibilityLabel={`Додати: ${meal.toLowerCase()}`} style={{ paddingHorizontal: 14 * k, paddingVertical: 12 * k }}>
                    <Text style={[txt, { fontSize: 19 * k, color: soft }]}>+ додати</Text>
                  </Pressable>
                </Plaque>
              );
            })}
            <Text style={{ fontFamily: font, fontSize: 15 * k, color: t.textSoft, textAlign: 'center', marginTop: 4 * k }}>
              калорії продуктів орієнтовні: USDA і Open Food Facts
            </Text>
          </>
        )}
      </ScrollView>

      {/* Back to where the diary was opened from */}
      <View style={{ position: 'absolute', top, left: 18 * k }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Назад">
          <Glass radius={100} style={{ height: 44 * k, paddingHorizontal: 16 * k, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: t.text }}>‹ назад</Text>
          </Glass>
        </Pressable>
      </View>

      <AddSheet
        meal={adding}
        onClose={() => setAdding(null)}
        onRecipe={addRecipe}
        onFood={addFood}
        onScan={(meal) => {
          setAdding(null);
          // iOS can't show the camera while the sheet is still sliding away.
          setTimeout(() => setScanFor(meal), 350);
        }}
        onPhoto={(meal) => {
          setAdding(null);
          setTimeout(() => setPhotoFor(meal), 350);
        }}
      />
      <DishPhotoSheet
        meal={photoFor}
        onClose={() => setPhotoFor(null)}
        onAdd={(meal, x) => {
          addEntry(key, { meal, kind: 'food', ref: 'photo', name: x.name, amount: x.grams, kcal: x.kcal, p: r1(x.p), c: r1(x.c), f: r1(x.f) });
          buzz();
        }}
      />
      <Scanner
        open={!!scanFor}
        onClose={() => setScanFor(null)}
        onAdd={(x, grams) => {
          if (scanFor) addFood(scanFor, x, grams);
          setScanFor(null);
        }}
      />
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
    </Screen>
  );
}

function Arrow({ dir, onPress }: { dir: 1 | -1; onPress: () => void }) {
  const k = useScale();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={dir < 0 ? 'Попередній день' : 'Наступний день'} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Plaque radius={100} style={{ width: 44 * k, height: 44 * k, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k, color: white }}>{dir < 0 ? '‹' : '›'}</Text>
      </Plaque>
    </Pressable>
  );
}

// Add to one meal: pick a dish or a product, then set portions or grams and see the calories before adding.
function AddSheet({
  meal,
  onClose,
  onRecipe,
  onFood,
  onScan,
  onPhoto,
}: {
  meal: string | null;
  onClose: () => void;
  onRecipe: (meal: string, r: Recipe, portions: number) => void;
  onFood: (meal: string, x: Food, grams: number) => void;
  onScan: (meal: string) => void;
  onPhoto: (meal: string) => void;
}) {
  const k = useScale();
  const t = useTheme();
  const { products } = useStore();
  const [tab, setTab] = useState<'food' | 'recipe'>('food');
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<Pick | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [was, setWas] = useState(false);
  // Start fresh each time the sheet opens; keep the last meal so the content stays while it slides away.
  if (meal && !was) {
    setWas(true);
    setLast(meal);
    setQuery('');
    setPick(null);
  }
  if (!meal && was) setWas(false);
  const cur = meal ?? last;
  if (!cur) return null;

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k, overflow: 'hidden' as const };
  const sep = { height: StyleSheet.hairlineWidth, backgroundColor: t.textSoft, marginLeft: 16 * k, opacity: 0.5 };
  const rowS = { paddingHorizontal: 16 * k, paddingVertical: 9 * k, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 * k };
  const input = [txt, group, { paddingHorizontal: 16 * k, height: 48 * k, outlineStyle: 'none' } as any];

  const choose = setPick;

  const mine = Object.values(products).reverse();
  const list = tab === 'food' ? searchFoods(query, mine) : recipes.filter((r) => r.name.toLowerCase().includes(query.toLowerCase().trim()));

  return (
    <Sheet open={!!meal} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>додати · {cur.toLowerCase()}</Text>

        {!pick ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 * k, marginVertical: 10 * k }}>
              {(
                [
                  ['food', 'продукти'],
                  ['recipe', 'страви'],
                ] as const
              ).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => setTab(id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === id }}
                  style={[s.seg, { height: 38 * k, paddingHorizontal: 18 * k, backgroundColor: tab === id ? sage : 'transparent', borderColor: tab === id ? sage : t.textSoft }]}
                >
                  <Text style={[txt, tab === id && { color: white, fontFamily: fontMedium }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {tab === 'food' && (
              <View style={{ flexDirection: 'row', gap: 8 * k, marginBottom: 10 * k }}>
                <Pressable
                  onPress={() => onScan(cur)}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.pill, { flex: 1, height: 48 * k, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: white }}>▥ штрихкод</Text>
                </Pressable>
                <Pressable
                  onPress={() => onPhoto(cur)}
                  accessibilityRole="button"
                  style={({ pressed }) => [s.pill, { flex: 1, height: 48 * k, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
                >
                  <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: white }}>фото страви</Text>
                </Pressable>
              </View>
            )}
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={tab === 'food' ? 'знайти продукт...' : 'знайти страву...'}
              placeholderTextColor={t.textSoft}
              style={input}
              autoCorrect={false}
              accessibilityLabel="Пошук"
            />
            <ScrollView style={{ maxHeight: 330 * k, marginTop: 10 * k }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={group}>
                {list.length === 0 && <Text style={[txt, { padding: 16 * k, color: t.textSoft }]}>нічого не знайшлося</Text>}
                {tab === 'food'
                  ? (list as Food[]).map((x, i) => (
                      <View key={x.id}>
                        {i > 0 && <View style={sep} />}
                        <Pressable onPress={() => choose({ kind: 'food', x })} style={({ pressed }) => [rowS, pressed && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`вибрати: ${x.name}`}>
                          <View style={{ flex: 1 }}>
                            <Text style={txt} numberOfLines={1}>{x.name}</Text>
                            <Text style={[txt, { fontSize: 16 * k, lineHeight: 18 * k, color: t.textSoft }]}>{x.cat}</Text>
                          </View>
                          <Text style={[txt, { fontSize: 17 * k, color: t.textSoft }]}>{x.kcal} ккал / 100 г</Text>
                        </Pressable>
                      </View>
                    ))
                  : (list as Recipe[]).map((r, i) => (
                      <View key={r.id}>
                        {i > 0 && <View style={sep} />}
                        <Pressable onPress={() => choose({ kind: 'recipe', r })} style={({ pressed }) => [rowS, pressed && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={`вибрати: ${r.name}`}>
                          <Plate recipe={r} size={40 * k} />
                          <Text style={[txt, { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                          <Text style={[txt, { fontSize: 17 * k, color: t.textSoft }]}>{r.kcal} ккал</Text>
                        </Pressable>
                      </View>
                    ))}
              </View>
            </ScrollView>
          </>
        ) : (
          <Amount
            key={pick.kind === 'recipe' ? pick.r.id : pick.x.id}
            pick={pick}
            onAdd={(n) => {
              if (pick.kind === 'recipe') onRecipe(cur, pick.r, n);
              else onFood(cur, pick.x, n);
              onClose();
            }}
            onBack={() => setPick(null)}
          />
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const k = useScale();
  const t = useTheme();
  const { goal, setGoal } = useStore();
  const [value, setValue] = useState('');
  const [was, setWas] = useState(false);
  if (open && !was) {
    setWas(true);
    setValue(String(goal));
  }
  if (!open && was) setWas(false);

  const n = Math.round(Number(value));
  const valid = Number.isFinite(n) && n >= 500 && n <= 10000;
  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k };

  return (
    <Sheet open={open} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k }]}>ціль на день</Text>
        <Text style={[txt, { color: t.textSoft, fontSize: 18 * k, marginBottom: 12 * k }]}>скільки ккал на день ти плануєш</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel="Ціль, ккал"
            style={[txt, group, { flex: 1, height: 52 * k, paddingHorizontal: 16 * k, fontSize: 28 * k, outlineStyle: 'none' } as any]}
          />
          <Text style={txt}>ккал</Text>
        </View>
        {!valid && <Text style={[txt, { fontSize: 16 * k, color: t.textSoft, marginTop: 6 * k }]}>від 500 до 10000</Text>}
        <Pressable
          onPress={() => {
            setGoal(n);
            onClose();
          }}
          disabled={!valid}
          accessibilityRole="button"
          style={({ pressed }) => [s.pill, { height: 54 * k, marginTop: 16 * k, opacity: valid ? 1 : 0.4, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: white }}>зберегти</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  pill: { borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  track: { borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  tile: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  seg: { borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  round: { alignItems: 'center', justifyContent: 'center' },
});
