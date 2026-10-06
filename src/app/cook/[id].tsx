import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BowlStage, type BowlItem, type Flight } from '../../components/BowlStage';
import { Glass } from '../../components/Glass';
import { Plate } from '../../components/Plate';
import { Lock } from '../../components/Premium';
import { Screen } from '../../components/Screen';
import { useScale } from '../../components/scale';
import { useStore } from '../../components/store';
import { StageScene } from '../../components/StageScene';
import { StepVideo } from '../../components/StepVideo';
import { useNarration } from '../../components/useNarration';
import { byId, img, nextInPlan, stepClip, stepCutout } from '../../data';
import { isAction, narratedScene, servedDish, stepLines } from '../../data/narration';
import { stepScene } from '../../data/scenes';
import { font, fontMedium, ForceDark, useTheme } from '../../theme';

// Step-by-step cooking. Steps page vertically (swipe up for the next one); each step shows
// an animated scene of background-free cutouts on the left (or a single cutout when the
// recipe has no scenes) and its text on the right. "готово" records the step
// for the "етапи готовки" tab.
// Recipes with narration (src/data/narration.ts) read each step a sentence at a time: the named
// ingredient comes forward in the scene, hands-on sentences wait for "готово", and what they make
// flies into a bowl under the scene that fills up over the whole recipe. The screen stays awake.
// Cooking always runs on the black stage, whatever the app theme is.
export default function CookScreen() {
  return (
    <ForceDark.Provider value>
      <Cook />
    </ForceDark.Provider>
  );
}

function Cook() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = byId(id);
  const insets = useSafeAreaInsets();
  const k = useScale();
  const t = useTheme();
  const { done, setDone, plan, premium, showPaywall } = useStore();
  const [y] = useState(() => new Animated.Value(0));
  const [pageH, setPageH] = useState(0);
  const pager = useRef<ScrollView>(null);
  const steps = r?.steps ?? [];
  const startAt = Math.min(done[id] ?? 0, steps.length);
  const [page, setPage] = useState(startAt);
  const opened = useRef(false);
  // Premium audio: reads the open step aloud, and the next one as you move on.
  const [audio, setAudio] = useState(false);
  const step = steps[page];
  const lines = stepLines(id, page);
  useEffect(() => {
    Speech.stop();
    if (audio && premium && step && !lines) Speech.speak(`${step.title}. ${step.txt.replace(/\*\*/g, '')}`, { language: 'uk-UA' });
  }, [audio, premium, step, lines]);
  useEffect(() => () => void Speech.stop(), []);
  useKeepAwake();

  // Narration: which hands-on lines are done ("step.line" → when), across the whole recipe.
  const [confirmed, setConfirmed] = useState<Record<string, number>>({});
  const [flight, setFlight] = useState<Flight & { step: number }>();
  const [stir, setStir] = useState(0);
  const [fresh, setFresh] = useState(0);
  // Without premium audio the lines still play, held for their reading time.
  const narr = useNarration(lines, page, audio && premium, (li) => confirmed[`${page}.${li}`] !== undefined);
  const pulse = usePulse(narr.waiting);

  if (!r || !steps.length) return null;
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };
  const next = nextInPlan(plan, r.id);
  const nextRecipe = next && byId(next.recipe);

  const go = (i: number) => {
    setPage(i);
    pager.current?.scrollTo({ y: i * pageH, animated: true });
  };
  // Everything confirmed so far goes in the bowl; the last line swaps it for the real dish.
  const bowl: BowlItem[] = [];
  let served = false;
  steps.forEach((_, si) =>
    stepLines(r.id, si)?.forEach((l, li) => {
      const born = confirmed[`${si}.${li}`];
      if (born === undefined) return;
      l.add?.forEach((bit, n) => bowl.push({ key: `${si}.${li}.${n}`, bit, born }));
      if (l.serve) served = true;
    }),
  );
  const dish = served ? servedDish(r.id) : undefined;

  const confirm = (li: number) => {
    const l = lines![li];
    const key = fresh + 1;
    setConfirmed((c) => ({ ...c, [`${page}.${li}`]: key }));
    setFresh(key);
    const bits = l.add?.filter((b) => b.src !== undefined) ?? [];
    setFlight(bits.length && l.focus !== undefined ? { key, step: page, from: l.focus, bits } : undefined);
    if (l.stir) setStir(key);
    if (l.serve) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else if (!bits.length || l.focus === undefined) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    narr.jump(li + 1);
  };
  // "готово" first confirms the step's next hands-on line; once they are all done it finishes the step.
  const finishStep = () => {
    const li = lines?.findIndex((l, j) => isAction(l) && confirmed[`${page}.${j}`] === undefined) ?? -1;
    if (li >= 0) return confirm(li);
    setDone(r.id, Math.max(done[r.id] ?? 0, page + 1));
    go(page + 1);
  };
  const close = () => (router.canGoBack() ? router.back() : router.replace(`/recipe/${r.id}`));

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8 * k }}>
        <View style={[s.top, { paddingHorizontal: 18 * k }]}>
          <Pressable onPress={close} accessibilityLabel="Закрити">
            <Glass radius={100} style={{ width: 44 * k, height: 44 * k, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: font, fontSize: 26 * k, color: '#FFFFFF' }}>✕</Text>
            </Glass>
          </Pressable>
          <Text style={[txt, { fontSize: 22 * k, opacity: 0.7 }]}>
            {page < steps.length ? `крок ${page + 1} з ${steps.length}` : 'готово'}
          </Text>
          <Pressable
            onPress={() => (premium ? setAudio((a) => !a) : showPaywall(true))}
            accessibilityRole="switch"
            accessibilityState={{ checked: audio }}
            accessibilityLabel={premium ? 'Озвучувати кроки' : 'Озвучування кроків: доступно в premium'}
          >
            <Glass radius={100} strong={audio} style={{ width: 44 * k, height: 44 * k, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={require('../../../assets/icons/speaker.svg')} style={{ width: 22 * k, height: 22 * k, opacity: premium ? (audio ? 1 : 0.6) : 0.35 }} />
              {!premium && (
                <View pointerEvents="none" style={{ position: 'absolute', right: -2 * k, bottom: -2 * k, width: 20 * k, height: 20 * k, borderRadius: 10 * k, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={11} color="#FFFFFF" />
                </View>
              )}
            </Glass>
          </Pressable>
        </View>
        <View style={[s.progress, { gap: 6 * k, paddingHorizontal: 18 * k }]}>
          {steps.map((_, i) => (
            <Pressable key={i} onPress={() => go(i)} style={{ flex: 1 }} hitSlop={8}>
              <View style={[s.seg, { backgroundColor: t.border }]}>
                <Animated.View
                  style={[
                    s.segFill,
                    { backgroundColor: t.accent },
                    pageH > 0 && {
                      transform: [
                        { scaleX: y.interpolate({ inputRange: [(i - 1) * pageH, i * pageH], outputRange: [0, 1], extrapolate: 'clamp' }) },
                      ],
                    },
                  ]}
                />
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <View
        style={{ flex: 1 }}
        onLayout={(e) => {
          setPageH(e.nativeEvent.layout.height);
        }}
      >
        {pageH > 0 && (
          <Animated.ScrollView
            ref={pager as any}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              // Reopen on the first unfinished step.
              if (opened.current) return;
              opened.current = true;
              if (startAt > 0) pager.current?.scrollTo({ y: startAt * pageH, animated: false });
            }}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
              useNativeDriver: true,
              listener: (e: any) => {
                const p = Math.round(e.nativeEvent.contentOffset.y / pageH);
                setPage((cur) => (cur === p ? cur : p));
              },
            })}
            scrollEventThrottle={16}
          >
            {steps.map((st, i) => {
              const range = [(i - 1) * pageH, i * pageH, (i + 1) * pageH];
              // The cutout drifts in from below and settles, then rises away, a little slower than the text.
              const art = {
                opacity: y.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
                transform: [
                  { translateY: y.interpolate({ inputRange: range, outputRange: [pageH * 0.35, 0, -pageH * 0.35], extrapolate: 'clamp' }) },
                  { scale: y.interpolate({ inputRange: range, outputRange: [0.85, 1, 0.85], extrapolate: 'clamp' }) },
                  { rotate: y.interpolate({ inputRange: range, outputRange: ['-8deg', '0deg', '8deg'], extrapolate: 'clamp' }) },
                ],
              };
              const cut = stepCutout(r.id, i);
              const clip = stepClip(r.id, i);
              const said = stepLines(r.id, i);
              const scene = (said && narratedScene(r.id, i)) || stepScene(r.id, i);
              return (
                <View key={i} style={{ height: pageH, flexDirection: 'row', alignItems: 'center', paddingBottom: 90 * k }}>
                  <Animated.View style={[{ width: 240 * k, height: 300 * k, marginLeft: -34 * k }, art]}>
                    {scene && said ? (
                      <View style={{ position: 'absolute', left: 42 * k, top: 0 }}>
                        <BowlStage
                          layers={scene}
                          size={190 * k}
                          active={page === i}
                          focus={page === i ? narr.focus : undefined}
                          items={bowl}
                          fresh={fresh}
                          flight={flight?.step === i ? flight : undefined}
                          stir={stir}
                          served={dish}
                        />
                      </View>
                    ) : scene ? (
                      // The column hangs 34pt off the left edge; keep the whole scene on screen.
                      <View style={{ position: 'absolute', left: 34 * k, top: 47 * k }}>
                        <StageScene layers={scene} size={206 * k} active={page === i} />
                      </View>
                    ) : clip ? (
                      <StepVideo source={clip} active={page === i} style={{ position: 'absolute', left: 0, top: 30 * k, width: 240 * k, height: 240 * k }} />
                    ) : (
                      <Image
                        source={cut ?? img(st.still)}
                        style={[StyleSheet.absoluteFill, !cut && { borderRadius: 200 }]}
                        contentFit="contain"
                      />
                    )}
                  </Animated.View>
                  <ScrollView
                    style={{ flex: 1, maxHeight: pageH - 110 * k }}
                    contentContainerStyle={{ paddingLeft: 14 * k, paddingRight: 18 * k, justifyContent: 'center', flexGrow: 1 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={[txt, { opacity: 0.6 }]}>{String(i + 1).padStart(2, '0')}</Text>
                    <Text style={[txt, { fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, marginBottom: 8 * k }]}>
                      {st.title.toLowerCase()}
                    </Text>
                    {said ? (
                      <View style={{ gap: 6 * k }}>
                        {said.map((l, li) => {
                          const now = page === i && narr.idx === li;
                          const ok = confirmed[`${i}.${li}`] !== undefined;
                          return (
                            <Pressable key={li} onPress={() => page === i && narr.jump(li, true)} accessibilityHint="Прочитати ще раз">
                              <Text style={[txt, { opacity: now ? 1 : ok ? 0.4 : 0.65 }]}>
                                {ok ? '✓ ' : ''}
                                {l.text.split('**').map((part, n) =>
                                  n % 2 ? (
                                    <Text key={n} style={{ fontFamily: fontMedium }}>
                                      {part}
                                    </Text>
                                  ) : (
                                    part
                                  ),
                                )}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={txt}>{st.txt.replace(/\*\*/g, '')}</Text>
                    )}
                    <Text style={[txt, { opacity: 0.6, marginTop: 8 * k }]}>≈ {st.min} хв</Text>
                    <Text style={[txt, { opacity: 0.6 }]}>{st.uses.join(', ')}</Text>
                    <Text style={[txt, { opacity: 0.6, marginTop: 12 * k }]}>порада</Text>
                    <Text style={txt}>{st.tip}</Text>
                  </ScrollView>
                </View>
              );
            })}

            <View style={{ height: pageH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 * k, paddingBottom: 90 * k, gap: 10 * k }}>
              <Plate recipe={r} size={200 * k} />
              <Text style={[txt, { fontFamily: fontMedium, fontSize: 56 * k, lineHeight: 60 * k, marginTop: 12 * k }]}>смачного!</Text>
              <Text style={txt}>{r.name.toLowerCase()} готовий.</Text>
              {nextRecipe && (
                <Pressable onPress={() => router.replace(`/recipe/${nextRecipe.id}`)} style={{ alignSelf: 'stretch', marginTop: 16 * k }}>
                  <Glass radius={15} style={{ padding: 18 * k }}>
                    <Text style={[txt, { opacity: 0.6 }]}>
                      далі в плані · {next!.day.toLowerCase()}, {next!.meal.toLowerCase()}
                    </Text>
                    <Text style={txt}>{nextRecipe.name} →</Text>
                  </Glass>
                </Pressable>
              )}
            </View>
          </Animated.ScrollView>
        )}
      </View>

      <View style={[s.nav, { gap: 10 * k, paddingHorizontal: 18 * k, bottom: insets.bottom + 20 * k }]}>
        <Pressable onPress={() => go(page - 1)} disabled={page === 0} style={{ flex: 1, opacity: page === 0 ? 0.4 : 1 }}>
          <Glass radius={100} style={s.btn}>
            <Text style={[s.btnT, { fontSize: 28 * k }]}>назад</Text>
          </Glass>
        </Pressable>
        <Pressable onPress={page < steps.length ? finishStep : close} style={{ flex: 2 }}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <Glass radius={100} strong style={s.btn}>
              <Text style={[s.btnT, { fontSize: 28 * k }]}>{page < steps.length ? 'готово' : 'до рецепта'}</Text>
            </Glass>
          </Animated.View>
        </Pressable>
      </View>
    </Screen>
  );
}

// A gentle breathing on "готово" while the narration waits for the cook.
function usePulse(on: boolean) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!on) return v.setValue(0);
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [on, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', paddingTop: 12, paddingBottom: 8 },
  seg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  segFill: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, transformOrigin: 'left' },
  nav: { position: 'absolute', left: 0, right: 0, flexDirection: 'row' },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnT: { fontFamily: font, color: '#FFFFFF' },
});
