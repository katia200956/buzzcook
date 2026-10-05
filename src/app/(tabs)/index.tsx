import { useMemo, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { Belt } from '../../components/Belt';
import { DishRow } from '../../components/DishRow';
import { Header } from '../../components/Header';
import { Menu } from '../../components/Menu';
import { Screen } from '../../components/Screen';
import { useScale } from '../../components/scale';
import { recipes } from '../../data';
import { font } from '../../theme';

export default function Home() {
  const k = useScale();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const [scrollY] = useState(() => new Animated.Value(0));

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
      <Belt scrollY={scrollY} />
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: 128 * k, paddingBottom: 150 * k }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {rows.map((r) => (
          <DishRow key={r.id} recipe={r} />
        ))}
        {rows.length === 0 && (
          <View style={{ marginLeft: 40 * k, width: 180 * k }}>
            <Text style={{ fontFamily: font, fontSize: 22 * k, color: '#FFFFFF', textAlign: 'center' }}>нічого не знайшлося</Text>
          </View>
        )}
      </Animated.ScrollView>
      <Header query={q} onQuery={setQ} onLogo={() => setQ('')} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}
