import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plate } from '../components/Plate';
import { BodyFields, FoodFields, GoalFields, NormCard } from '../components/ProfileForm';
import { Screen } from '../components/Screen';
import { useScale } from '../components/scale';
import { useStore } from '../components/store';
import { byId } from '../data';
import { dailyNorm } from '../data/profile';
import { font, fontMedium, sage, useTheme } from '../theme';

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
  const { profile, finishOnboarding } = useStore();
  const [step, setStep] = useState(edit ? 1 : 0);
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
  const last = step === STEPS.length - 1;
  const next = () => (last ? done() : setStep(step + 1));
  const { title, sub } = STEPS[step];
  const txt = { fontFamily: font, color: t.text };
  const norm = dailyNorm(profile);

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top + 14 * k, paddingHorizontal: 22 * k, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 * k }}>
            {STEPS.map((_, i) => (
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
            {(step === 0 || (last && !norm)) && (
              <View style={{ alignItems: 'center', marginTop: 40 * k }}>
                <Plate recipe={byId(last ? 'bowl' : 'salat')!} size={240 * k} />
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
            <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: '#FFFFFF' }}>{step === 0 ? 'почати' : last ? (edit ? 'зберегти' : 'до страв') : 'далі'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
