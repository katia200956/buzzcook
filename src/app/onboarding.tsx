import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plate } from '../components/Plate';
import { Glass } from '../components/Glass';
import { BodyFields, Chip, FoodFields, GoalFields, NormCard } from '../components/ProfileForm';
import { askReminders } from '../components/reminders';
import { Screen } from '../components/Screen';
import { useScale } from '../components/scale';
import { useStore } from '../components/store';
import { byId } from '../data';
import { dailyNorm } from '../data/profile';
import { currentPlace, outPrice, PLACES, portionCost, uah } from '../data/prices';
import { BUDGETS, TIMES } from '../data/weekplan';
import { font, fontMedium, sage, useTheme } from '../theme';

// First launch: four questions and the week's dinners are ready, about a minute in all.
// The calorie questions wait in the profile for whoever wants them.
const START = [
  { title: 'вечеря за хвилину', sub: 'чотири питання, і план вечерь на тиждень готовий. дешевше за доставку, і нічого не пропадає.' },
  { title: 'скільки на тиждень?', sub: 'бюджет на продукти для вечерь, для тебе одного. я вкладу план у цю суму.' },
  { title: 'чого не їси?', sub: 'страви з цим зникнуть зовсім. можна нічого не вибирати.' },
  { title: 'скільки часу на вечерю?', sub: 'разом із нарізкою і готуванням.' },
  { title: 'а коли не готуєш?', sub: 'де ти зазвичай їси. з цим я порівнюватиму, скільки ти зекономив.' },
  { title: 'твій тиждень', sub: 'страва на дві порції — це вечеря сьогодні і завтра. будь-яку можна замінити в плані.' },
];

// From the profile (?edit=1): body numbers for the calorie norm, then food rules.
const STEPS = [
  { title: 'давай знайомитись', sub: 'порахую твою норму калорій і підберу страви під тебе. це хвилина, і все можна пропустити.' },
  { title: 'про тебе', sub: 'для норми калорій. цифри бачиш лише ти.' },
  { title: 'ціль і рух', sub: 'від цього залежить, скільки тобі треба на день.' },
  { title: 'що ти їси', sub: 'дієта й алергії. страви, які не підходять, зникнуть зі стрічки.' },
  { title: 'готово', sub: 'далі я вчитимусь сама: що ти купуєш, готуєш і їси, те й підбиратиму частіше. змінити все можна в профілі.' },
];

// First-launch questions, one step at a time; each step slides in from the right.
// From the profile tab (?edit=1) it opens on the body numbers and goes back when finished.
export default function Onboarding() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, finishOnboarding, previewWeek, planWeek, setRemind } = useStore();
  const [step, setStep] = useState(edit ? 1 : 0);
  const [remind, setRemindLocal] = useState(true);
  const steps = edit ? STEPS : START;
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
  }, [step, anim]);

  const done = () => {
    finishOnboarding();
    if (edit && router.canGoBack()) router.back();
    else router.replace('/');
  };
  // "до плану": the week goes into the plan with its shopping list; the reminder asks for permission once.
  const start = async () => {
    planWeek();
    finishOnboarding();
    router.replace('/plan');
    if (remind) setRemind(await askReminders().catch(() => false));
  };
  const last = step === steps.length - 1;
  const next = () => (last ? (edit ? done() : start()) : setStep(step + 1));
  const { title, sub } = steps[step];
  const week = !edit && last ? previewWeek() : null;
  const txt = { fontFamily: font, color: t.text };
  const norm = dailyNorm(profile);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 14 * k, paddingHorizontal: 22 * k, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 * k }}>
            {steps.map((_, i) => (
              <View key={i} style={{ height: 4 * k, flex: 1, borderRadius: 2, backgroundColor: i <= step ? sage : t.textSoft, opacity: i <= step ? 1 : 0.35 }} />
            ))}
          </View>
          {!last && (
            <Pressable onPress={done} hitSlop={10} accessibilityRole="button" style={{ marginLeft: 16 * k }}>
              <Text style={[txt, { fontSize: 19 * k, color: t.textSoft }]}>пропустити</Text>
            </Pressable>
          )}
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 22 * k, paddingTop: 34 * k, paddingBottom: 30 * k }} keyboardShouldPersistTaps="handled">
          <Animated.View
            style={{
              opacity: anim,
              transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [40 * k, 0] }) }],
            }}
          >
            <Text style={[txt, { fontFamily: fontMedium, fontSize: 46 * k, lineHeight: 48 * k }]}>{title}</Text>
            <Text style={[txt, { fontSize: 21 * k, lineHeight: 25 * k, color: t.textSoft, marginTop: 6 * k }]}>{sub}</Text>
            {edit ? (
              <>
                {last && !norm && (
                  <View style={{ alignItems: 'center', marginTop: 40 * k }}>
                    <Plate recipe={byId('bowl')!} size={240 * k} />
                  </View>
                )}
                {step === 1 && <BodyFields />}
                {step === 2 && (
                  <>
                    <GoalFields />
                    <NormCard p={profile} />
                  </>
                )}
                {step === 3 && <FoodFields />}
                {step === 4 && norm && <NormCard p={profile} />}
              </>
            ) : (
              <>
                {step === 0 && (
                  <View style={{ alignItems: 'center', marginTop: 40 * k }}>
                    <Plate recipe={byId('salat')!} size={240 * k} />
                  </View>
                )}
                {step === 1 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 24 * k }}>
                    {BUDGETS.map((b) => (
                      <Chip key={b} on={profile.budget === b} label={uah(b)} onPress={() => setProfile({ budget: b })} />
                    ))}
                  </View>
                )}
                {step === 2 && <FoodFields />}
                {step === 3 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 24 * k }}>
                    {TIMES.map(([m, label]) => (
                      <Chip key={m} on={profile.maxTime === m} label={label} onPress={() => setProfile({ maxTime: m })} />
                    ))}
                  </View>
                )}
                {step === 4 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 24 * k }}>
                    {PLACES.map((p) => (
                      <Chip key={p.id} on={profile.eatOut === p.id} label={p.label} onPress={() => setProfile({ eatOut: p.id })} />
                    ))}
                  </View>
                )}
                {week && (
                  <View style={{ marginTop: 20 * k, gap: 6 * k }}>
                    {week.plan.length === 0 && (
                      <Text style={[txt, { fontSize: 21 * k }]}>у цей бюджет поки нічого не вкладається. збільш суму або час, і я спробую ще раз.</Text>
                    )}
                    {week.plan.map((p, i) => {
                      const r = byId(p.recipe)!;
                      const again = i > 0 && week.plan[i - 1].recipe === p.recipe;
                      return (
                        <View key={p.day} style={{ flexDirection: 'row', gap: 10 * k, alignItems: 'baseline' }}>
                          <Text style={[txt, { fontSize: 18 * k, color: t.textSoft, width: 82 * k }]}>{p.day.toLowerCase()}</Text>
                          <Text style={[txt, { fontSize: 21 * k, flex: 1, opacity: again ? 0.55 : 1 }]}>
                            {again ? 'те саме, друга порція' : r.name.toLowerCase()}
                          </Text>
                          <Text style={[txt, { fontSize: 18 * k, color: t.textSoft }]}>{again ? '' : `${portionCost(r.id)} грн/порц.`}</Text>
                        </View>
                      );
                    })}
                    {week.plan.length > 0 && (
                      <Glass radius={15} style={{ padding: 16 * k, marginTop: 12 * k }}>
                        <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k }]}>продукти ≈ {uah(week.cost)}</Text>
                        <Text style={[txt, { fontSize: 19 * k }]}>
                          {currentPlace().at} ці {week.dinners} вечер{week.dinners < 5 ? 'і' : 'ь'} коштували б ≈ {uah(week.plan.reduce((a, p) => a + outPrice(p.recipe), 0))}
                        </Text>
                        <Text style={[txt, { fontSize: 19 * k, color: sage }]}>економія ≈ {uah(week.saved)}</Text>
                        {week.fromFridge.length > 0 && (
                          <Text style={[txt, { fontSize: 17 * k, color: t.textSoft }]}>використає те, що скоро зіпсується: {week.fromFridge.join(', ')}</Text>
                        )}
                      </Glass>
                    )}
                    <View style={{ flexDirection: 'row', marginTop: 12 * k }}>
                      <Chip on={remind} label="нагадувати о 17:00, що на вечерю" onPress={() => setRemindLocal(!remind)} />
                    </View>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10 * k, paddingHorizontal: 22 * k, paddingBottom: insets.bottom + 18 * k }}>
          {step > (edit ? 1 : 0) && !last && (
            <Pressable onPress={() => setStep(step - 1)} accessibilityRole="button" style={{ height: 54 * k, paddingHorizontal: 22 * k, justifyContent: 'center' }}>
              <Text style={[txt, { fontSize: 24 * k, color: t.textSoft }]}>назад</Text>
            </Pressable>
          )}
          <Pressable
            onPress={next}
            accessibilityRole="button"
            style={({ pressed }) => ({ flex: 1, height: 54 * k, borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: '#FFFFFF' }}>{step === 0 ? 'почати' : last ? (edit ? 'зберегти' : 'до плану') : 'далі'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
