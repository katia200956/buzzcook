import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Belt } from '../../components/Belt';
import { DishRow, ROW_H } from '../../components/DishRow';
import { Header } from '../../components/Header';
import { Menu } from '../../components/Menu';
import { Screen } from '../../components/Screen';
import { useScale } from '../../components/scale';
import { recipes } from '../../data';
import { font, fontMedium, sage } from '../../theme';

const tick = () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {});

export default function Home() {
  const k = useScale();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [scrollY] = useState(() => new Animated.Value(0));
  const list = useRef<ScrollView>(null);
  const offset = useRef(0);
  const box = useRef({ view: 0, content: 0 });
  const [spinning, setSpinning] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => (offset.current = value));
    return () => scrollY.removeListener(id);
  }, [scrollY]);

  // The belt is a feed of every dish; a query narrows it.
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return recipes.filter(
      (r) =>
        !n ||
        r.name.toLowerCase().includes(n) ||
        r.cat.toLowerCase().includes(n) ||
        r.tags.some((x) => x.includes(n)) ||
        r.ing.some(([, x]) => x.toLowerCase().includes(n)),
    );
  }, [q]);

  // "Крутнути": the belt runs on its own and slows down on a random dish, for when you
  // don't know what to cook. Each plate passing the line gives a light haptic tick.
  const spin = async () => {
    if (spinning || rows.length < 2) return;
    const row = ROW_H * k;
    const max = Math.max(0, box.current.content - box.current.view);
    const choices = rows.map((_, i) => i).filter((i) => rows[i].id !== picked && Math.abs(i * row - offset.current) > row / 2);
    const i = choices[Math.floor(Math.random() * choices.length)] ?? 0;
    const to = Math.min(i * row, max);
    setPicked(null);

    if (await AccessibilityInfo.isReduceMotionEnabled()) {
      list.current?.scrollTo({ y: to, animated: false });
      setPicked(rows[i].id);
      return;
    }

    setSpinning(true);
    // Spin past the target first (down to the end or back to the top) so even a near dish gets a real run.
    const from = offset.current;
    const far = to > max / 2 ? 0 : max;
    const pos = new Animated.Value(from);
    let slot = Math.round(from / row);
    pos.addListener(({ value }) => {
      list.current?.scrollTo({ y: value, animated: false });
      const s = Math.round(value / row);
      if (s !== slot) {
        slot = s;
        tick();
      }
    });
    const legA = Math.abs(far - from);
    const legB = Math.abs(far - to);
    Animated.sequence([
      Animated.timing(pos, { toValue: far, duration: Math.max(250, legA / k / 3.2), easing: Easing.in(Easing.quad), useNativeDriver: false }),
      Animated.timing(pos, { toValue: to, duration: 900 + legB / k / 1.4, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      pos.removeAllListeners();
      setSpinning(false);
      setPicked(rows[i].id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  };

  return (
    <Screen>
      <Belt scrollY={scrollY} />
      <Animated.ScrollView
        ref={list}
        scrollEnabled={!spinning}
        contentContainerStyle={{ paddingTop: 128 * k, paddingBottom: 150 * k }}
        showsVerticalScrollIndicator={false}
        onLayout={(e) => (box.current.view = e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => (box.current.content = h)}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        onScrollBeginDrag={() => setPicked(null)}
        scrollEventThrottle={16}
      >
        {rows.map((r) => (
          <DishRow key={r.id} recipe={r} picked={r.id === picked} />
        ))}
        {rows.length === 0 && (
          <View style={{ marginLeft: 40 * k, width: 180 * k }}>
            <Text style={{ fontFamily: font, fontSize: 22 * k, color: '#FFFFFF', textAlign: 'center' }}>нічого не знайшлося</Text>
          </View>
        )}
      </Animated.ScrollView>

      {rows.length > 1 && (
        <Pressable
          onPress={spin}
          disabled={spinning}
          accessibilityRole="button"
          accessibilityLabel="Крутнути стрічку і вибрати випадкову страву"
          style={({ pressed }) => ({ position: 'absolute', left: 50 * k, bottom: 102 * k, transform: [{ scale: pressed ? 0.96 : 1 }] })}
        >
          <View
            style={{
              minWidth: 160 * k,
              height: 56 * k,
              paddingHorizontal: 24 * k,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: sage,
              opacity: spinning ? 0.7 : 1,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.3)',
              boxShadow: '0px 10px 24px rgba(0,0,0,0.4)',
            }}
          >
            <Text style={{ fontFamily: fontMedium, fontSize: 34 * k, lineHeight: 42 * k, color: '#FFFFFF' }}>
              {spinning ? 'крутиться…' : picked ? 'ще раз' : 'крутнути'}
            </Text>
          </View>
        </Pressable>
      )}

      <Header query={q} onQuery={setQ} onLogo={() => setQ('')} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}
