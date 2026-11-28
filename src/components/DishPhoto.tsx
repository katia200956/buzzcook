import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DishGuess, readDish } from '../data/vision';
import { font, fontMedium, sage, useTheme } from '../theme';
import { pickPhoto } from './photo';
import { useScale } from './scale';
import { Sheet } from './Sheet';

type Draft = { name: string; grams: string; kcal: string; p: string; f: string; c: string };
type Mode = { at: 'pick' } | { at: 'reading' } | { at: 'failed'; why: string } | { at: 'draft'; guess: DishGuess; v: Draft };
export type DishEntry = { name: string; grams: number; kcal: number; p: number; f: number; c: number };

const SURE = { low: 'оцінка дуже приблизна', medium: 'оцінка приблизна', high: 'оцінка досить певна' };
const r0 = (n: number) => String(Math.round(n));

// Calories from a photo of a plate: Claude guesses, the person corrects the draft, then it goes into the diary.
export function DishPhotoSheet({ meal, onClose, onAdd }: { meal: string | null; onClose: () => void; onAdd: (meal: string, x: DishEntry) => void }) {
  const k = useScale();
  const t = useTheme();
  const [mode, setMode] = useState<Mode>({ at: 'pick' });
  const [hidden, setHidden] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  if (meal && meal !== last) {
    setLast(meal);
    setMode({ at: 'pick' });
  }
  const cur = meal ?? last;
  if (!cur) return null;

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const soft = { color: t.textSoft };
  const small = [txt, soft, { fontSize: 14 * k, lineHeight: 17 * k }];
  const pill = [s.pill, { height: 52 * k, backgroundColor: sage }];
  const pillT = [s.pillT, { fontSize: 24 * k }];
  const field = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 12 * k, height: 44 * k, paddingHorizontal: 12 * k, outlineStyle: 'none' } as any;

  const read = async (from: 'camera' | 'library') => {
    // iOS can't show the camera over an open sheet: hide it while the photo is taken.
    setHidden(true);
    await new Promise((r) => setTimeout(r, 400));
    let image: string | null = null;
    try {
      image = await pickPhoto(from);
    } catch {
      setMode({ at: 'failed', why: 'не вдалося відкрити фото.' });
    }
    setHidden(false);
    if (!image) return;
    setMode({ at: 'reading' });
    try {
      const g = await readDish(image);
      if (!g.food) return setMode({ at: 'failed', why: 'не бачу на фото їжі. спробуй ще раз згори, щоб було видно всю тарілку.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMode({ at: 'draft', guess: g, v: { name: g.name, grams: r0(g.grams), kcal: r0(g.kcal), p: r0(g.p), f: r0(g.f), c: r0(g.c) } });
    } catch {
      setMode({ at: 'failed', why: 'не вдалося порахувати. перевір інтернет і спробуй ще.' });
    }
  };

  const num = (x: string) => Number(x.replace(',', '.'));
  const valid = mode.at === 'draft' && mode.v.name.trim() !== '' && num(mode.v.kcal) > 0 && ['grams', 'p', 'f', 'c'].every((key) => num(mode.v[key as keyof Draft]) >= 0);

  return (
    <Sheet open={!!meal && !hidden} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[txt, soft, { fontSize: 18 * k }]}>фото страви · {cur.toLowerCase()}</Text>

        {mode.at === 'pick' && (
          <View style={{ gap: 10 * k, marginTop: 8 * k }}>
            <Text style={txt}>сфотографуй тарілку згори, і я прикину калорії. перед додаванням зможеш виправити.</Text>
            <Pressable onPress={() => read('camera')} accessibilityRole="button" style={({ pressed }) => [pill, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <Text style={pillT}>сфотографувати</Text>
            </Pressable>
            <Pressable onPress={() => read('library')} accessibilityRole="button" style={({ pressed }) => [s.pill, s.ghost, { height: 52 * k, borderColor: t.textSoft, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
              <Text style={[pillT, { color: t.text }]}>вибрати з галереї</Text>
            </Pressable>
            <Text style={small}>калорії за фото — це приблизна оцінка: олію, соуси й те, що під іншими продуктами, на фото не видно. ми не гарантуємо точність.</Text>
          </View>
        )}

        {mode.at === 'reading' && (
          <View style={{ alignItems: 'center', gap: 12 * k, paddingVertical: 30 * k }}>
            <ActivityIndicator color={t.text} size="large" />
            <Text style={[txt, soft]}>дивлюсь на тарілку...</Text>
          </View>
        )}

        {mode.at === 'failed' && (
          <View style={{ gap: 12 * k, marginTop: 8 * k }}>
            <Text style={txt}>{mode.why}</Text>
            <Pressable onPress={() => setMode({ at: 'pick' })} accessibilityRole="button" style={pill}>
              <Text style={pillT}>спробувати ще</Text>
            </Pressable>
          </View>
        )}

        {mode.at === 'draft' && (
          <View style={{ marginTop: 8 * k }}>
            <Text style={[txt, { color: '#E0A060', fontSize: 17 * k }]}>чернетка · {SURE[mode.guess.sure]}</Text>
            <TextInput
              value={mode.v.name}
              onChangeText={(name) => setMode({ ...mode, v: { ...mode.v, name } })}
              accessibilityLabel="Назва страви"
              style={[txt, field, { marginTop: 8 * k }]}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 8 * k }}>
              {(
                [
                  ['grams', 'вага, г'],
                  ['kcal', 'ккал'],
                  ['p', 'білки'],
                  ['f', 'жири'],
                  ['c', 'вуглев.'],
                ] as const
              ).map(([key, label]) => (
                <View key={key} style={{ width: key === 'grams' || key === 'kcal' ? '48%' : '31%' }}>
                  <Text style={[txt, soft, { fontSize: 15 * k }]}>{label}</Text>
                  <TextInput
                    value={mode.v[key]}
                    onChangeText={(x) => setMode({ ...mode, v: { ...mode.v, [key]: x } })}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    accessibilityLabel={label}
                    style={[txt, field, { fontSize: 22 * k }]}
                  />
                </View>
              ))}
            </View>
            {!!mode.guess.note && <Text style={[txt, soft, { fontSize: 16 * k, lineHeight: 19 * k, marginTop: 8 * k }]}>{mode.guess.note}</Text>}
            <Pressable
              disabled={!valid}
              onPress={() => {
                const v = mode.v;
                onAdd(cur, { name: v.name.trim(), grams: Math.round(num(v.grams)), kcal: Math.round(num(v.kcal)), p: num(v.p), f: num(v.f), c: num(v.c) });
                onClose();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [pill, { marginTop: 12 * k, opacity: valid ? 1 : 0.4, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Text style={pillT}>додати в щоденник</Text>
            </Pressable>
            <Text style={[small, { marginTop: 8 * k, textAlign: 'center' }]}>оцінка за фото приблизна, ми не гарантуємо точність</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1, backgroundColor: 'transparent' },
  pillT: { fontFamily: fontMedium, color: '#FFFFFF' },
});
