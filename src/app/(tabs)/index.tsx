import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SavedBadge } from '../../components/Cost';
import { CoverArt, CoverTile } from '../../components/Cover';
import { Menu } from '../../components/Menu';
import { Screen } from '../../components/Screen';
import { useStore } from '../../components/store';
import { useScale } from '../../components/scale';
import { Recipe, recipes } from '../../data';
import { haveOf, needsOf } from '../../data/pantry';
import { swipeRecipe } from '../../data/swipe';
import { font, fontMedium, useTheme } from '../../theme';

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
  const { rank, fridge, saved, premium, showPaywall } = useStore();

  const ranked = rank(recipes);
  const n = q.trim().toLowerCase();
  const found = ranked.filter(
    ({ r }) => r.name.toLowerCase().includes(n) || r.cat.toLowerCase().includes(n) || r.tags.some((x) => x.includes(n)) || r.ing.some(([, x]) => x.toLowerCase().includes(n)),
  );
  const meta = (r: Recipe) => `${r.total} хв · ${r.diff.toLowerCase()}`;

  // Shelves, each from the ranked feed so the best match always comes first.
  const top = ranked.slice(0, 6);
  const photo = ['syrnyky', 'tost'].map((id) => recipes.find((r) => r.id === id)).filter((r) => !!r && !!swipeRecipe(r.id)) as Recipe[];
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
  const big = 300 * k;
  const tile = 150 * k;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14 * k, paddingBottom: 230 * k }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: side, flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
          <Text style={{ flex: 1, fontFamily: fontMedium, fontSize: 44 * k, lineHeight: 48 * k, color: t.text }}>головна</Text>
          <Round label="Щоденник калорій" onPress={() => (premium ? router.push('/diary') : showPaywall(true))}>
            <Text style={{ fontFamily: fontMedium, fontSize: 15 * k, color: '#FFFFFF' }}>ккал</Text>
          </Round>
          <Round label="Меню" onPress={() => setMenu(true)}>
            <Image source={require('../../../assets/figma/menu.svg')} style={{ width: 26 * k, height: 26 * k }} />
          </Round>
          <Round label="Профіль" onPress={() => router.navigate('/profile')}>
            <Image source={require('../../../assets/figma/user.svg')} style={{ width: 20 * k, height: 20 * k }} />
          </Round>
        </View>

        <View style={{ marginHorizontal: side, marginTop: 12 * k, height: 40 * k, borderRadius: 12 * k, backgroundColor: t.mode === 'dark' ? '#1C1C1E' : '#EFEFEF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 * k, gap: 8 * k }}>
          <Text style={{ fontSize: 15 * k, color: t.textSoft }}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="страви, продукти, категорії"
            placeholderTextColor={t.textSoft}
            returnKeyType="search"
            style={{ flex: 1, fontFamily: font, fontSize: 20 * k, color: t.text, paddingVertical: 0, outlineStyle: 'none' } as any}
          />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Очистити пошук">
              <Text style={{ fontSize: 16 * k, color: t.textSoft }}>✕</Text>
            </Pressable>
          )}
        </View>

        {n ? (
          <View style={{ paddingHorizontal: side, marginTop: 14 * k }}>
            {found.map(({ r }) => (
              <Pressable key={r.id} onPress={() => router.push(`/recipe/${r.id}`)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12 * k, paddingVertical: 7 * k, opacity: pressed ? 0.6 : 1 })}>
                <CoverArt recipe={r} size={56 * k} radius={8 * k} />
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
            <Shelf title="найкраще для тебе" sub="за твоїм профілем і холодильником">
              {top.map(({ r, why }) => (
                <Feature key={r.id} r={r} width={big} note={why ?? meta(r)} />
              ))}
            </Shelf>
            {!!photo.length && (
              <Shelf title="нове: фото-рецепти" sub="кожен крок як на фото, з таймерами">
                {photo.map((r) => (
                  <CoverTile key={r.id} recipe={r} size={tile * 1.25} sub={meta(r)} />
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
      <SavedBadge top={insets.top + 132 * k} right={20 * k} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}

function Round({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  const k = useScale();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: 40 * k, height: 40 * k, borderRadius: 100, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      {children}
    </Pressable>
  );
}

// A titled shelf that scrolls sideways, like Apple Music's rows.
function Shelf({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  const k = useScale();
  const t = useTheme();
  return (
    <View style={{ marginTop: 26 * k }}>
      <View style={{ paddingHorizontal: 20 * k, marginBottom: 10 * k }}>
        <Text style={{ fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 30 * k, color: t.text }}>
          {title} <Text style={{ color: t.textSoft }}>›</Text>
        </Text>
        {!!sub && <Text style={{ fontFamily: font, fontSize: 17 * k, lineHeight: 19 * k, color: t.textSoft }}>{sub}</Text>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 * k, gap: 12 * k }} decelerationRate="fast">
        {children}
      </ScrollView>
    </View>
  );
}

// The big top card: a wide cover with the reason above it, like the "Top Picks" row.
function Feature({ r, width, note }: { r: Recipe; width: number; note: string }) {
  const k = useScale();
  const t = useTheme();
  return (
    <Pressable onPress={() => router.push(`/recipe/${r.id}`)} accessibilityRole="button" accessibilityLabel={`${r.name}. ${note}`} style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Text numberOfLines={1} style={{ fontFamily: font, fontSize: 15 * k, letterSpacing: 0.8 * k, color: t.textSoft, marginBottom: 4 * k }}>
        {note.toUpperCase()}
      </Text>
      <View style={{ borderRadius: 14 * k, overflow: 'hidden', backgroundColor: '#1C1C1E' }}>
        <CoverArt recipe={r} size={width} radius={0} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14 * k, backgroundColor: 'rgba(17,17,17,0.86)' }}>
          <Text numberOfLines={1} style={{ fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k, color: '#FFFFFF' }}>{r.name}</Text>
          <Text style={{ fontFamily: font, fontSize: 17 * k, color: 'rgba(255,255,255,0.7)' }}>
            {r.total} хв · {r.kcal} ккал · {r.diff.toLowerCase()}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
