import { useMemo, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Belt } from '../../components/Belt';
import { DishRow } from '../../components/DishRow';
import { Header } from '../../components/Header';
import { Menu } from '../../components/Menu';
import { PosterRow } from '../../components/PosterRow';
import { Screen } from '../../components/Screen';
import { useScale } from '../../components/scale';
import { recipes } from '../../data';
import { titleStyle, useTheme } from '../../theme';

export default function Home() {
  const k = useScale();
  const t = useTheme();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [scrollY] = useState(() => new Animated.Value(0));

  // Content offset of the first poster row: list padding plus the two-line headline above it.
  const posterTop = (128 + 6 + 54 * 0.72 * 1.25 * 2) * k;

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

  return (
    <Screen>
      {!t.poster && <Belt scrollY={scrollY} />}
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: 128 * k, paddingBottom: 150 * k }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* The poster theme swaps the belt for the flyer's tilted cream panels, sides alternating. */}
        {t.poster && <Text style={[titleStyle(t, 54 * k), { textAlign: 'center', marginTop: 6 * k }]}>{'страви\nтижня'}</Text>}
        {rows.map((r, i) =>
          t.poster ? <PosterRow key={r.id} recipe={r} index={i} scrollY={scrollY} top={posterTop} /> : <DishRow key={r.id} recipe={r} />,
        )}
        {rows.length === 0 && (
          <View style={{ marginLeft: 40 * k, width: 180 * k }}>
            <Text style={{ fontFamily: t.font, fontSize: 22 * k, color: t.poster ? t.text : '#FFFFFF', textAlign: 'center' }}>нічого не знайшлося</Text>
          </View>
        )}
      </Animated.ScrollView>
      <Header query={q} onQuery={setQ} onLogo={() => setQ('')} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}
