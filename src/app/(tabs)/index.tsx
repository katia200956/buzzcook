import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../components/Header';
import { CoverTile, Dish, StripDish } from '../../components/Cover';
import { Menu } from '../../components/Menu';
import { Screen } from '../../components/Screen';
import { useStore } from '../../components/store';
import { useScale } from '../../components/scale';
import { Recipe, recipes } from '../../data';
import { haveOf, needsOf } from '../../data/pantry';
import { swipeRecipe } from '../../data/swipe';
import { font, fontMedium, shelf, useTheme } from '../../theme';

const CATS: [string, string][] = [
  ['Сніданок', 'сніданки'],
  ['Обід', 'на обід'],
  ['Вечеря', 'на вечерю'],
];

// Home in the Apple Music layout: a big bold title with round buttons, a search field, then
// shelves of album-style recipe covers that scroll sideways. Search turns it into a plain result list.
export default function Home() {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const { rank, fridge, saved } = useStore();

  const ranked = rank(recipes);
  const n = q.trim().toLowerCase();
  const found = ranked.filter(
    ({ r }) => r.name.toLowerCase().includes(n) || r.cat.toLowerCase().includes(n) || r.tags.some((x) => x.includes(n)) || r.ing.some(([, x]) => x.toLowerCase().includes(n)),
  );
  const meta = (r: Recipe) => `${r.total} хв · ${r.diff.toLowerCase()}`;

  // Shelves, each from the ranked feed so the best match always comes first.
  const top = ranked.slice(0, 6);
  const photo = ['tortillasoup', 'cookies', 'mochi', 'chococheese', 'pizzacaesar', 'pizzamush', 'pizzaphila', 'tomatopasta', 'troutbake', 'tatin', 'poppybuns', 'udon', 'tuna', 'alfredo', 'pita', 'syrvanilla', 'syrchoc', 'syrlemon', 'syrpist', 'pankamer', 'pankjapan', 'shortribs', 'crepes', 'carrotrings', 'eggplanttofu', 'salmonmango', 'oatmeal', 'syrnyky', 'tost', 'pasta', 'omlet'].map((id) => recipes.find((r) => r.id === id)).filter((r) => !!r && !!swipeRecipe(r.id)) as Recipe[];
  const quick = ranked.filter(({ r }) => r.total <= 20).map(({ r }) => r);
  const fromHome = ranked
    .map(({ r }) => {
      const needs = needsOf(r.id);
      const have = needs.filter(([key]) => haveOf(fridge, key) > 0).length;
      return { r, have, all: needs.length };
    })
    .filter((x) => x.have > 0)
    .sort((a, b) => b.have / b.all - a.have / a.all)
    .slice(0, 10);
  const liked = recipes.filter((r) => saved.includes(r.id));
  const side = 20 * k;
  const big = 250 * k;
  const tile = 150 * k;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(insets.top + 6, 59 * k) + 112 * k, paddingBottom: 160 * k }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {n ? (
          <View style={{ paddingHorizontal: side, marginTop: 14 * k }}>
            {found.map(({ r }) => (
              <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12 * k, paddingVertical: 7 * k, opacity: pressed ? 0.6 : 1 })}>
                <Dish recipe={r} size={56 * k} />
                <View style={{ flex: 1, borderBottomWidth: 0.5, borderBottomColor: t.textSoft, paddingBottom: 8 * k }}>
                  <Text numberOfLines={1} style={{ fontFamily: fontMedium, fontSize: 20 * k, color: t.text }}>{r.name}</Text>
                  <Text style={{ fontFamily: font, fontSize: 16 * k, color: t.textSoft }}>
                    {r.cat.toLowerCase()} · {meta(r)}
                  </Text>
                </View>
              </Pressable>
            ))}
            {!found.length && <Text style={{ fontFamily: font, fontSize: 20 * k, color: t.textSoft, marginTop: 20 * k, textAlign: 'center' }}>нічого не знайшлося</Text>}
          </View>
        ) : (
          <>
            <Shelf title="найкраще для тебе" sub="за твоїм профілем і холодильником" band>
              {top.map(({ r }) => (
                <StripDish key={r.id} recipe={r} width={big} />
              ))}
            </Shelf>
            {!!photo.length && (
              <Shelf title="нове: фото-рецепти" sub="кожен крок як на фото, з таймерами">
                {photo.map((r) => (
                  <CoverTile key={r.id} recipe={r} size={tile} sub={meta(r)} />
                ))}
              </Shelf>
            )}
            {!!fromHome.length && (
              <Shelf title="з того, що вдома" sub="більшість продуктів уже є">
                {fromHome.map(({ r, have, all }) => (
                  <CoverTile key={r.id} recipe={r} size={tile} sub={`вдома ${have} з ${all}`} />
                ))}
              </Shelf>
            )}
            <Shelf title="швидко, до 20 хв">
              {quick.map((r) => (
                <CoverTile key={r.id} recipe={r} size={tile} sub={meta(r)} />
              ))}
            </Shelf>
            {CATS.map(([cat, title]) => {
              const list = ranked.filter(({ r }) => r.cat === cat).map(({ r }) => r);
              return list.length ? (
                <Shelf key={cat} title={title}>
                  {list.map((r) => (
                    <CoverTile key={r.id} recipe={r} size={tile} sub={meta(r)} />
                  ))}
                </Shelf>
              ) : null;
            })}
            {!!liked.length && (
              <Shelf title="збережене">
                {liked.map((r) => (
                  <CoverTile key={r.id} recipe={r} size={tile} sub={meta(r)} />
                ))}
              </Shelf>
            )}
          </>
        )}
      </ScrollView>
      <Header query={q} onQuery={setQ} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}

// A titled shelf that scrolls sideways, like Apple Music's rows.
// `band`: the shelf rides on a black strip across the whole screen width, so the dishes swipe along it.
function Shelf({ title, sub, band, children }: { title: string; sub?: string; band?: boolean; children: ReactNode }) {
  const k = useScale();
  const t = useTheme();
  return (
    <View style={{ marginTop: (band ? 10 : 26) * k }}>
      <View style={{ paddingHorizontal: 20 * k, marginBottom: 10 * k }}>
        <Text style={{ fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 30 * k, color: t.text }}>
          {title} <Text style={{ color: t.textSoft }}>›</Text>
        </Text>
        {!!sub && <Text style={{ fontFamily: font, fontSize: 17 * k, lineHeight: 19 * k, color: t.textSoft }}>{sub}</Text>}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={band ? { backgroundColor: shelf } : undefined}
        contentContainerStyle={{ paddingHorizontal: 20 * k, gap: (band ? 28 : 12) * k, paddingVertical: band ? 18 * k : 0 }}
        decelerationRate="fast"
      >
        {children}
      </ScrollView>
    </View>
  );
}

