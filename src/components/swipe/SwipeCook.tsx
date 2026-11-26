import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Equip, SwipeRecipe, SwipeStep, swipeSteps } from '../../data/swipe';
import { font, fontMedium } from '../../theme';
import { useScale } from '../scale';
import { Rich } from './Rich';
import { Steam } from './Steam';
import { BG } from './SwipeCard';

const LINE = '#3a3a3c';
const MUTED = '#a3a3a1';
const FG = '#f5f5f4';
const INK = '#1f1f20';
const GAP = 8; // the tiny gap between steps while swiping (Петя's choice)
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Cook mode: back arrow + dish name, then a carousel of steps. Picture and text move together,
// the next step follows the finger right behind the current one, "Далі" does the same.
export function SwipeCook({ r, mode }: { r: SwipeRecipe; mode: Equip }) {
  const k = useScale();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const steps = useMemo(() => swipeSteps(r, mode), [r, mode]);
  const [idx, setIdx] = useState(0);
  const [arrived, setArrived] = useState(0); // bumps on each forward arrival to replay step motion
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);
  const PW = width - 32 * k + GAP;
  const IW = width - 32 * k;
  const IH = IW * (955 / 720);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(e.nativeEvent.contentOffset.x / PW);
    if (n !== idx) {
      if (n > idx) setArrived((a) => a + 1);
      setIdx(n);
    }
  };
  const next = () => {
    if (idx >= steps.length - 1) return back();
    pager.current?.scrollTo({ x: (idx + 1) * PW, animated: true });
    setArrived((a) => a + 1);
    setIdx(idx + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <View style={{ paddingTop: insets.top + 8 * k, paddingHorizontal: 16 * k, gap: 10 * k }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
          <Pressable onPress={back} accessibilityLabel="Назад до рецепта" hitSlop={8}
            style={{ width: 40 * k, height: 40 * k, borderRadius: 100, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: FG, marginTop: -3 * k }}>‹</Text>
          </Pressable>
          <Text style={{ flex: 1, fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, color: FG }}>{r.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {steps.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= idx ? FG : LINE }} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 * k }} showsVerticalScrollIndicator={false}>
        <ScrollView
          ref={pager}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={PW}
          decelerationRate="fast"
          disableIntervalMomentum
          onMomentumScrollEnd={onEnd}
          contentContainerStyle={{ paddingHorizontal: 16 * k }}
        >
          {steps.map((s, i) => (
            <View key={i} style={{ width: PW, paddingRight: GAP }}>
              <StepPane r={r} s={s} prev={steps[i - 1]} i={i} n={steps.length} w={IW} h={IH} cur={i === idx} arrived={i === idx ? arrived : -1} />
            </View>
          ))}
        </ScrollView>
      </ScrollView>

      <View style={{ position: 'absolute', left: 16 * k, right: 16 * k, bottom: insets.bottom + 16 * k }}>
        <Pressable onPress={next} accessibilityLabel={idx === steps.length - 1 ? 'До рецепта' : 'Далі'}
          style={({ pressed }) => ({ borderRadius: 14 * k, backgroundColor: FG, paddingVertical: 14 * k, alignItems: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontFamily: fontMedium, fontSize: 24 * k, color: INK }}>{idx === steps.length - 1 ? 'До рецепта' : 'Далі'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StepPane({ r, s, prev, i, n, w, h, cur, arrived }: { r: SwipeRecipe; s: SwipeStep; prev?: SwipeStep; i: number; n: number; w: number; h: number; cur: boolean; arrived: number }) {
  const k = useScale();
  const frame = r.frames[s.f];
  // Steps with `dur` (browning) start on the previous photo and slowly turn into the new one.
  const base = s.dur && prev ? r.frames[prev.f] : frame;
  const [top] = useState(() => new Animated.Value(s.dur ? 1 : 0));
  const [breathe] = useState(() => new Animated.Value(0));
  const [jolt] = useState(() => new Animated.Value(0));
  const [left, setLeft] = useState(s.timer ?? 0);

  useEffect(() => {
    if (!cur) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start();
    return () => b.stop();
  }, [cur, breathe]);

  useEffect(() => {
    if (arrived < 1) return; // only when we move forward onto this step
    if (s.dur) {
      top.setValue(0);
      Animated.timing(top, { toValue: 1, duration: s.dur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    }
    if (s.jolt) {
      jolt.setValue(0);
      Animated.timing(jolt, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    }
  }, [arrived, s.dur, s.jolt, top, jolt]);

  useEffect(() => {
    if (!cur || !s.timer) return;
    const t0 = Date.now();
    const tick = () => {
      const l = Math.max(0, s.timer! - Math.floor((Date.now() - t0) / 1000));
      setLeft(l);
      if (!l) clearInterval(id);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [cur, s.timer]);

  const body = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: '#d6d6d4' };
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ty = Animated.add(
    breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }),
    jolt.interpolate({ inputRange: [0, 0.3, 0.6, 1], outputRange: [0, -7, 2, 0] }),
  );
  const cy = s.f.startsWith('t') && !s.f.startsWith('tray') ? 0.34 : 0.45;

  return (
    <View style={{ gap: 12 * k }}>
      <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: BG }}>
        <Animated.View style={{ width: w, height: h, transform: [{ translateY: ty }, { scale }] }}>
          <Image source={base.src} style={{ position: 'absolute', width: w, height: h }} contentFit="cover" />
          {!!s.dur && (
            <Animated.View style={{ position: 'absolute', width: w, height: h, opacity: top }}>
              <Image source={frame.src} style={{ width: w, height: h }} contentFit="cover" />
            </Animated.View>
          )}
        </Animated.View>
        <Steam width={w} height={h} heat={frame.heat ?? 0} glow={frame.glow} active={cur} cy={cy} />
      </View>
      <View style={{ gap: 4 * k }}>
        <Text style={{ fontFamily: font, fontSize: 15 * k, letterSpacing: 1.4 * k, color: MUTED }}>{i + 1} / {n}</Text>
        <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k, color: FG }}>{s.t}</Text>
        <Text style={body}>{s.p}</Text>
        {!!s.d && (
          <Text style={[body, { color: MUTED }]}>
            <Rich text={s.d} style={{}} bold={{ color: FG, fontFamily: fontMedium }} />
            {s.timer ? <Text style={{ color: FG, fontFamily: fontMedium }}>  {fmt(left)}</Text> : null}
          </Text>
        )}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12 * k, flexDirection: 'row', gap: 10 * k }}>
        <Text style={{ fontSize: 16 * k, color: FG }}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 14 * k, letterSpacing: 1.2 * k, color: MUTED }}>НА ЩО ДИВИТИСЬ</Text>
          <Text style={[body, { color: FG }]}>{s.tip}</Text>
        </View>
      </View>
    </View>
  );
}
