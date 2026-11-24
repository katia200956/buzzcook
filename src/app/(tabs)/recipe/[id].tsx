import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Belt } from '../../../components/Belt';
import { Header } from '../../../components/Header';
import { Menu } from '../../../components/Menu';
import { Plaque } from '../../../components/Plaque';
import { Plate } from '../../../components/Plate';
import { Lock } from '../../../components/Premium';
import { Screen } from '../../../components/Screen';
import { useScale } from '../../../components/scale';
import { useStore } from '../../../components/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoFx } from '../../../components/PhotoFx';
import { byId, heroPhoto, Recipe } from '../../../data';
import { fmtQty, haveOf, INGREDIENTS, needsOf } from '../../../data/pantry';
import { font, fontMedium, sage, useTheme } from '../../../theme';

// Figma "recipe going": the chosen plate on the belt, a tall info card and START.
// v2: calories and macros up top as tiles, clearer section labels, a solid START.
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = byId(id);
  const k = useScale();
  const [menu, setMenu] = useState(false);
  const { saved, toggleSaved, done, premium, fridge } = useStore();

  if (!r) return null;
  if (heroPhoto(r.id)) return <PhotoRecipe r={r} />;
  const txt = { fontFamily: font, fontSize: 19 * k, lineHeight: 23 * k, color: '#FFFFFF' };
  const head = { fontFamily: fontMedium, fontSize: 15 * k, letterSpacing: 1.2 * k, color: 'rgba(255,255,255,0.55)', marginTop: 16 * k, marginBottom: 4 * k };
  const canCook = !!r.steps?.length;
  const progress = done[r.id] ?? 0;
  const isSaved = saved.includes(r.id);
  // What the fridge already covers, per ingredient line (the needs list follows the recipe's order).
  const home = needsOf(r.id).map(([key, n]) => {
    const have = haveOf(fridge, key);
    const unit = INGREDIENTS[key].unit;
    return { full: unit === 'є' ? have > 0 : have >= n - 0.01, some: have > 0 && unit !== 'є' ? fmtQty(have, unit) : null };
  });
  const atHome = home.filter((x) => x.full).length;

  return (
    <Screen>
      <Belt />
      <View style={{ position: 'absolute', left: 31 * k, top: 140 * k }}>
        <Plate recipe={r} size={199 * k} />
      </View>

      {/* v2: the info column sits on dark plaques with white text, a little wider than before. */}
      <View style={{ position: 'absolute', left: 246 * k, top: 140 * k, width: 144 * k, bottom: 170 * k }}>
        <Plaque radius={18 * k} style={{ paddingHorizontal: 14 * k, paddingVertical: 10 * k }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 24 * k, lineHeight: 25 * k, color: '#FFFFFF' }}>{r.name}</Text>
          <Text style={{ fontFamily: font, fontSize: 16 * k, color: 'rgba(255,255,255,0.65)', marginTop: 4 * k }}>
            {r.total} хв · {r.diff.toLowerCase()}
          </Text>
        </Plaque>

        <Plaque radius={18 * k} style={{ marginTop: 10 * k, flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 14 * k, paddingTop: 12 * k, paddingBottom: 18 * k }} showsVerticalScrollIndicator={false}>
            {/* Calories and macros as small tiles, so the numbers read at a glance. Premium only. */}
            {premium ? (
              <>
                <Text style={[txt, { fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k }]}>
                  {r.kcal}
                  <Text style={{ fontFamily: font, fontSize: 17 * k, color: 'rgba(255,255,255,0.65)' }}> ккал</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 5 * k, marginTop: 8 * k }}>
                  {[
                    ['білки', r.p],
                    ['вуглев.', r.c],
                    ['жири', r.f],
                  ].map(([label, g]) => (
                    <View key={label} style={{ flex: 1, borderRadius: 10 * k, paddingVertical: 5 * k, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={[txt, { fontFamily: fontMedium, fontSize: 18 * k, lineHeight: 20 * k }]}>{g}</Text>
                      <Text style={{ fontFamily: font, fontSize: 13 * k, color: 'rgba(255,255,255,0.6)' }}>{label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={{ borderRadius: 12 * k, padding: 10 * k, backgroundColor: 'rgba(255,255,255,0.08)', gap: 4 * k }}>
                <Lock label="калорії і бжу" size={15} color="#FFFFFF" />
                <Text style={{ fontFamily: font, fontSize: 14 * k, lineHeight: 16 * k, color: 'rgba(255,255,255,0.6)' }}>доступно в premium</Text>
              </View>
            )}

            <Text style={head}>ІНГРЕДІЄНТИ{atHome ? `  ·  ВДОМА ${atHome} З ${r.ing.length}` : ''}</Text>
            {r.ing.map(([qty, name], i) => {
              const h = home[i];
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 6 * k, marginBottom: 3 * k }} accessibilityLabel={h?.full ? `${qty} ${name}, є вдома` : undefined}>
                  {h?.full ? (
                    <Text style={[txt, { width: 12 * k, marginLeft: -3 * k, color: '#9DB57A', fontFamily: fontMedium }]}>✓</Text>
                  ) : (
                    <View style={{ width: 4 * k, height: 4 * k, borderRadius: 2 * k, marginTop: 9 * k, backgroundColor: sage, transform: [{ scale: 1.4 }] }} />
                  )}
                  <Text style={[txt, { flex: 1 }, h?.full && { opacity: 0.6 }]}>
                    {qty ? <Text style={{ fontFamily: fontMedium }}>{qty} </Text> : null}
                    {name}
                    {!h?.full && h?.some ? <Text style={{ color: 'rgba(255,255,255,0.6)' }}> · вдома {h.some}</Text> : null}
                  </Text>
                </View>
              );
            })}
            <Text style={head}>ЧАС</Text>
            <Text style={txt}>
              {r.prep} хв підготовка{'\n'}
              {r.cook} хв готування
            </Text>
            {!!r.tools?.length && (
              <>
                <Text style={head}>ІНСТРУМЕНТИ</Text>
                <Text style={txt}>{r.tools.join(', ')}</Text>
              </>
            )}
            <Pressable
              onPress={() => toggleSaved(r.id)}
              accessibilityLabel={isSaved ? 'Прибрати зі збережених' : 'Зберегти рецепт'}
              style={{ marginTop: 16 * k, alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 12 * k, paddingVertical: 4 * k, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: isSaved ? 'rgba(255,255,255,0.15)' : 'transparent' }}
            >
              <Text style={txt}>{isSaved ? '♥ збережено' : '♡ зберегти'}</Text>
            </Pressable>
          </ScrollView>
        </Plaque>
      </View>

      {/* v2: START is a solid sage pill, the one clear action on the screen. */}
      <Pressable
        onPress={() => canCook && router.push(`/cook/${r.id}`)}
        disabled={!canCook}
        accessibilityLabel={canCook ? 'Почати готувати' : 'Покроковий режим готується'}
        style={({ pressed }) => ({ position: 'absolute', left: 50 * k, bottom: 102 * k, opacity: canCook ? 1 : 0.5, transform: [{ scale: pressed ? 0.96 : 1 }] })}
      >
        <View
          style={{
            minWidth: 160 * k,
            height: 56 * k,
            paddingHorizontal: 24 * k,
            borderRadius: 100,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: canCook ? sage : 'rgba(24,24,27,0.7)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            boxShadow: '0px 10px 24px rgba(0,0,0,0.4)',
          }}
        >
          <Text style={{ fontFamily: fontMedium, fontSize: 38 * k, lineHeight: 46 * k, color: '#FFFFFF' }}>
            {canCook ? (progress > 0 && progress < r.steps!.length ? 'далі' : 'старт') : 'скоро'}
          </Text>
        </View>
      </Pressable>

      <Header onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}

// Photo recipes (syrnyky first): no belt and no gradient. The dish photo has no background, so it
// sits straight on the app's own white or black. Back arrow and the dish name on top, the living
// photo on the left, the facts on the right, ingredients below, and one "готувати" button.
function PhotoRecipe({ r }: { r: Recipe }) {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { saved, toggleSaved, done, premium } = useStore();
  const hero = heroPhoto(r.id)!;
  const dark = t.mode === 'dark';
  const bg = dark ? '#000000' : '#FFFFFF';
  const soft = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const line = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';
  const txt = { fontFamily: font, fontSize: 19 * k, lineHeight: 22 * k, color: t.text };
  const label = { fontFamily: fontMedium, fontSize: 13 * k, letterSpacing: 1.2 * k, color: soft };
  const value = { fontFamily: fontMedium, fontSize: 24 * k, lineHeight: 26 * k, color: t.text };
  const steps = r.steps?.length ?? 0;
  const progress = done[r.id] ?? 0;
  const isSaved = saved.includes(r.id);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));

  const fact = (name: string, children: ReactNode) => (
    <View key={name} style={{ paddingVertical: 7 * k, borderBottomWidth: 1, borderBottomColor: line }}>
      <Text style={label}>{name}</Text>
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingTop: insets.top + 8 * k, paddingHorizontal: 16 * k, flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
        <Pressable onPress={back} accessibilityLabel="Назад" hitSlop={8}
          style={{ width: 44 * k, height: 44 * k, borderRadius: 100, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, color: t.text, marginTop: -3 * k }}>←</Text>
        </Pressable>
        <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 27 * k, color: t.text }}>{r.name}</Text>
        <Pressable onPress={() => toggleSaved(r.id)} hitSlop={8} accessibilityLabel={isSaved ? 'Прибрати зі збережених' : 'Зберегти рецепт'}>
          <Text style={{ fontFamily: font, fontSize: 30 * k, color: isSaved ? sage : t.text }}>{isSaved ? '♥' : '♡'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 * k }}>
          <View style={{ marginLeft: -22 * k, marginTop: 6 * k }}>
            <PhotoFx step={hero} width={224 * k} />
          </View>
          <View style={{ flex: 1, paddingLeft: 10 * k, paddingRight: 16 * k }}>
            {fact('ЧАС', <>
              <Text style={value}>{r.total} хв</Text>
              <Text style={[txt, { fontSize: 15 * k, lineHeight: 17 * k, color: soft }]}>{r.prep} підготовка · {r.cook} смаження</Text>
            </>)}
            {fact('СКЛАДНІСТЬ', <>
              <Text style={value}>{r.diff.toLowerCase()}</Text>
            </>)}
            {fact('ПОРЦІЇ', <>
              <Text style={value}>{r.serv}</Text>
            </>)}
            {fact('НА ПОРЦІЮ', <>
              {premium ? (
                <>
                  <Text style={value}>{r.kcal} ккал</Text>
                  <Text style={[txt, { fontSize: 15 * k, lineHeight: 17 * k, color: soft }]}>б {r.p} · ж {r.f} · в {r.c}</Text>
                </>
              ) : (
                <Lock label="калорії і бжу" size={14} color={soft} />
              )}
            </>)}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 * k, marginTop: 14 * k, gap: 6 * k }}>
          <Text style={[txt, { color: soft }]}>{r.desc}</Text>
          {!!r.tools?.length && (
            <>
              <Text style={[label, { marginTop: 12 * k }]}>ОБЛАДНАННЯ</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 * k }}>
                {r.tools.map((x) => (
                  <View key={x} style={{ borderRadius: 100, borderWidth: 1, borderColor: line, paddingHorizontal: 12 * k, paddingVertical: 3 * k }}>
                    <Text style={txt}>{x}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          <Text style={[label, { marginTop: 12 * k }]}>ІНГРЕДІЄНТИ</Text>
          {r.ing.map(([qty, name], i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 6 * k, borderBottomWidth: 1, borderBottomColor: line }}>
              <Text style={[txt, { width: 90 * k, fontFamily: fontMedium }]}>{qty}</Text>
              <Text style={[txt, { flex: 1 }]}>{name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => steps && router.push(`/cook/${r.id}`)}
        accessibilityLabel="Почати готувати"
        style={({ pressed }) => ({ position: 'absolute', alignSelf: 'center', bottom: 104 * k, transform: [{ scale: pressed ? 0.96 : 1 }] })}
      >
        <View style={{ minWidth: 200 * k, height: 54 * k, paddingHorizontal: 26 * k, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: sage, boxShadow: '0px 10px 24px rgba(0,0,0,0.25)' }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 32 * k, lineHeight: 38 * k, color: '#FFFFFF' }}>
            {progress > 0 && progress < steps ? 'далі' : 'готувати'}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
