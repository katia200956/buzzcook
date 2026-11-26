import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MEALS } from '../data';
import { ACTIVITY, AIMS, ALLERGIES, dailyNorm, DEFAULT_MEAL_TIMES, DIETS, hhmm, LEADS, macroNorm, Profile } from '../data/profile';
import { font, fontMedium, sage, useTheme } from '../theme';
import { useScale } from './scale';
import { useStore } from './store';

// Pieces of "про тебе", shared by the first-launch questions and the profile tab.
const buzz = () => Haptics.selectionAsync().catch(() => {});

function useStyles() {
  const k = useScale();
  const t = useTheme();
  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const label = [txt, { color: t.textSoft, fontSize: 18 * k, marginTop: 14 * k, marginBottom: 6 * k }];
  const field = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 14 * k };
  const chip = (on: boolean) => [s.chip, { height: 36 * k, paddingHorizontal: 14 * k, backgroundColor: on ? sage : 'transparent', borderColor: on ? sage : t.textSoft }];
  const chipT = (on: boolean) => [txt, { fontSize: 19 * k }, on && { color: '#FFFFFF', fontFamily: fontMedium }];
  return { k, t, txt, label, field, chip, chipT };
}

export function Chip({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  const { chip, chipT } = useStyles();
  return (
    <Pressable
      onPress={() => {
        buzz();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [chip(on), { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
    >
      <Text style={chipT(on)}>{label}</Text>
    </Pressable>
  );
}

// A number box that only reports values inside the range; anything else is "not set".
function NumberField({ label, unit, value, min, max, onChange }: { label: string; unit: string; value?: number; min: number; max: number; onChange: (n?: number) => void }) {
  const st = useStyles();
  const [text, setText] = useState(value ? String(value) : '');
  return (
    <View style={{ flex: 1 }}>
      <Text style={st.label}>{label}</Text>
      <View style={[st.field, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 * st.k, height: 48 * st.k }]}>
        <TextInput
          value={text}
          onChangeText={(x) => {
            setText(x);
            const n = Number(x.replace(',', '.'));
            onChange(Number.isFinite(n) && n >= min && n <= max ? n : undefined);
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={st.t.textSoft}
          accessibilityLabel={label}
          style={[st.txt, { flex: 1, fontSize: 24 * st.k, outlineStyle: 'none' } as any]}
        />
        <Text style={[st.txt, { color: st.t.textSoft }]}>{unit}</Text>
      </View>
    </View>
  );
}

export function BodyFields() {
  const st = useStyles();
  const { profile, setProfile } = useStore();
  return (
    <View>
      <Text style={st.label}>стать</Text>
      <View style={{ flexDirection: 'row', gap: 8 * st.k }}>
        <Chip on={profile.sex === 'f'} label="жінка" onPress={() => setProfile({ sex: 'f' })} />
        <Chip on={profile.sex === 'm'} label="чоловік" onPress={() => setProfile({ sex: 'm' })} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 * st.k }}>
        <NumberField label="вік" unit="р." value={profile.age} min={14} max={100} onChange={(age) => setProfile({ age })} />
        <NumberField label="зріст" unit="см" value={profile.height} min={120} max={230} onChange={(height) => setProfile({ height })} />
        <NumberField label="вага" unit="кг" value={profile.weight} min={35} max={250} onChange={(weight) => setProfile({ weight })} />
      </View>
    </View>
  );
}

export function GoalFields() {
  const st = useStyles();
  const { profile, setProfile } = useStore();
  return (
    <View>
      <Text style={st.label}>ціль</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * st.k }}>
        {AIMS.map(([a, label]) => (
          <Chip key={a} on={profile.aim === a} label={label} onPress={() => setProfile({ aim: a })} />
        ))}
      </View>
      <Text style={st.label}>активність</Text>
      <View style={[st.field, { overflow: 'hidden' }]}>
        {ACTIVITY.map(([a, label, hint], i) => {
          const on = profile.activity === a;
          return (
            <Pressable
              key={a}
              onPress={() => {
                buzz();
                setProfile({ activity: a });
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 10 * st.k, paddingHorizontal: 14 * st.k, paddingVertical: 8 * st.k, opacity: pressed ? 0.6 : 1 },
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: st.t.textSoft },
              ]}
            >
              <View style={[s.radio, { width: 18 * st.k, height: 18 * st.k, borderColor: on ? sage : st.t.textSoft }]}>{on && <View style={[s.dot, { width: 10 * st.k, height: 10 * st.k }]} />}</View>
              <View style={{ flex: 1 }}>
                <Text style={st.txt}>{label}</Text>
                <Text style={[st.txt, { fontSize: 16 * st.k, lineHeight: 18 * st.k, color: st.t.textSoft }]}>{hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// The daily norm as a big number with the macro split; a hint while body numbers are missing.
export function NormCard({ p }: { p: Profile }) {
  const st = useStyles();
  const norm = dailyNorm(p);
  if (!norm) return <Text style={[st.txt, { color: st.t.textSoft, marginTop: 14 * st.k }]}>заповни стать, вік, зріст і вагу, і я порахую норму.</Text>;
  const m = macroNorm(p, norm);
  return (
    <View style={[st.field, { padding: 14 * st.k, marginTop: 14 * st.k }]}>
      <Text style={[st.txt, { color: st.t.textSoft, fontSize: 17 * st.k }]}>твоя норма на день</Text>
      <Text style={[st.txt, { fontFamily: fontMedium, fontSize: 44 * st.k, lineHeight: 46 * st.k }]}>
        {norm} <Text style={{ fontFamily: font, fontSize: 22 * st.k }}>ккал</Text>
      </Text>
      <Text style={[st.txt, { fontSize: 18 * st.k, color: st.t.textSoft }]}>
        білки {m.p} г · жири {m.f} г · вуглеводи {m.c} г
      </Text>
      <Text style={[st.txt, { fontSize: 14 * st.k, lineHeight: 16 * st.k, color: st.t.textSoft, marginTop: 6 * st.k }]}>
        формула Міффліна–Сан Жеора. це орієнтир, а не медична порада.
      </Text>
    </View>
  );
}

export function FoodFields() {
  const st = useStyles();
  const { profile, setProfile } = useStore();
  const toggle = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <View>
      <Text style={st.label}>харчування</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * st.k }}>
        {DIETS.map(([d, label]) => (
          <Chip key={d} on={profile.diets.includes(d)} label={label} onPress={() => setProfile({ diets: toggle(profile.diets, d) })} />
        ))}
      </View>
      <Text style={st.label}>алергія або не можна</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * st.k }}>
        {ALLERGIES.map(([a, label]) => (
          <Chip key={a} on={profile.allergies.includes(a)} label={label} onPress={() => setProfile({ allergies: toggle(profile.allergies, a) })} />
        ))}
      </View>
      <Text style={[st.txt, { fontSize: 15 * st.k, lineHeight: 18 * st.k, color: st.t.textSoft, marginTop: 8 * st.k }]}>
        страви з цим я не показуватиму зовсім. склад перевіряй на упаковці.
      </Text>
    </View>
  );
}

// When each meal is eaten (half-hour steps) and how early its reminder comes.
const MEAL_RANGE: Record<string, [number, number]> = { Сніданок: [5 * 60, 12 * 60], Обід: [11 * 60, 17 * 60], Вечеря: [16 * 60, 23 * 60] };

export function MealTimeFields() {
  const st = useStyles();
  const { k, t } = st;
  const { profile, setProfile } = useStore();
  const times = { ...DEFAULT_MEAL_TIMES, ...profile.mealTimes };
  const set = (meal: string, m: number) => setProfile({ mealTimes: { ...times, [meal]: m } });
  const btn = { width: 44 * k, height: 44 * k, borderRadius: 22 * k, borderWidth: 1, borderColor: t.textSoft, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ marginTop: 10 * k }}>
      {MEALS.map((meal) => {
        const [lo, hi] = MEAL_RANGE[meal];
        const m = times[meal];
        return (
          <View key={meal} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 * k }}>
            <Text style={[st.txt, { flex: 1 }]}>{meal.toLowerCase()}</Text>
            <Pressable
              onPress={() => {
                buzz();
                set(meal, Math.max(lo, m - 30));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${meal} раніше`}
              style={btn}
            >
              <Text style={[st.txt, { fontSize: 26 * k, lineHeight: 28 * k }]}>−</Text>
            </Pressable>
            <Text style={[st.txt, { fontFamily: fontMedium, fontSize: 26 * k, width: 86 * k, textAlign: 'center' }]} accessibilityLabel={`${meal} о ${hhmm(m)}`}>
              {hhmm(m)}
            </Text>
            <Pressable
              onPress={() => {
                buzz();
                set(meal, Math.min(hi, m + 30));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${meal} пізніше`}
              style={btn}
            >
              <Text style={[st.txt, { fontSize: 26 * k, lineHeight: 28 * k }]}>+</Text>
            </Pressable>
          </View>
        );
      })}
      <Text style={st.label}>нагадувати про страву</Text>
      <View style={{ flexDirection: 'row', gap: 8 * k }}>
        {LEADS.map(([m, label]) => (
          <Chip key={m} on={(profile.lead || 60) === m} label={label} onPress={() => setProfile({ lead: m })} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radio: { borderRadius: 100, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dot: { borderRadius: 100, backgroundColor: sage },
});
