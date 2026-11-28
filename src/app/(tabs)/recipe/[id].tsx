import { router, useLocalSearchParams } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { CoverArt } from '../../../components/Cover';
import { SwipeCard } from '../../../components/swipe/SwipeCard';
import { swipeRecipe } from '../../../data/swipe';
import { CostBlock, useCost } from '../../../components/Cost';
import { Lock } from '../../../components/Premium';
import { useScale } from '../../../components/scale';
import { useStore } from '../../../components/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PhotoFx } from '../../../components/PhotoFx';
import { byId, heroPhoto, Recipe } from '../../../data';
import { fmtQty, haveOf, INGREDIENTS, needsOf } from '../../../data/pantry';
import { font, fontMedium, sage, useTheme } from '../../../theme';

// Recipe: the dish cover large, the name with a heart, then calories, cost, ingredients (with what is
// at home), time and tools, and one "готувати" button. Colours follow the app theme.
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = byId(id);
  // Photo-swipe recipes (syrnyky, avocado toast) have their own card with the equipment choice.
  const sw = swipeRecipe(id);
  if (sw) return <SwipeCard r={sw} />;
  if (!r) return null;
  if (heroPhoto(r.id)) return <PhotoRecipe r={r} />;
  return <NowPlaying r={r} />;
}

function NowPlaying({ r }: { r: Recipe }) {
  const k = useScale();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const t = useTheme();
  const { saved, toggleSaved, done, premium, fridge } = useStore();
  const white = t.text;
  const soft = t.textSoft;
  const line = t.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)';
  const txt = { fontFamily: font, fontSize: 19 * k, lineHeight: 23 * k, color: white };
  const head = { fontFamily: fontMedium, fontSize: 15 * k, letterSpacing: 1.2 * k, color: soft, marginTop: 22 * k, marginBottom: 6 * k };
  const steps = r.steps?.length ?? 0;
  const canCook = steps > 0;
  const progress = Math.min(done[r.id] ?? 0, steps);
  const isSaved = saved.includes(r.id);
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const art = Math.min(width - 56 * k, 360 * k);
  // What the fridge already covers, per ingredient line (the needs list follows the recipe's order).
  const home = needsOf(r.id).map(([key, n]) => {
    const have = haveOf(fridge, key);
    const unit = INGREDIENTS[key].unit;
    return { full: unit === 'є' ? have > 0 : have >= n - 0.01, some: have > 0 && unit !== 'є' ? fmtQty(have, unit) : null };
  });
  const atHome = home.filter((x) => x.full).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg[0] }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6 * k, paddingHorizontal: 28 * k, paddingBottom: 240 * k }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={back} hitSlop={8} accessibilityRole="button" accessibilityLabel="Назад"
            style={{ width: 44 * k, height: 44 * k, borderRadius: 100, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, color: white, marginTop: -3 * k }}>←</Text>
          </Pressable>
          <Text style={{ fontFamily: font, fontSize: 17 * k, color: soft, minWidth: 30 * k, textAlign: 'right' }}>{r.cat.toLowerCase()}</Text>
        </View>

        <View style={{ alignItems: 'center', marginTop: 18 * k, boxShadow: '0px 18px 40px rgba(0,0,0,0.55)' } as any}>
          <CoverArt recipe={r} size={art} radius={12 * k} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 24 * k, gap: 12 * k }}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 32 * k, color: white }}>{r.name}</Text>
            <Text style={{ fontFamily: font, fontSize: 19 * k, color: soft }}>
              {r.total} хв · {r.diff.toLowerCase()} · {r.serv} порц.
            </Text>
          </View>
          <Pressable onPress={() => toggleSaved(r.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={isSaved ? 'Прибрати зі збережених' : 'Зберегти рецепт'}
            style={{ width: 36 * k, height: 36 * k, borderRadius: 100, borderWidth: 1, borderColor: line, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 * k, color: white }}>{isSaved ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <Text style={head}>НА ПОРЦІЮ</Text>
        {premium ? (
          <View style={{ flexDirection: 'row', gap: 6 * k }}>
            {[
              ['ккал', r.kcal],
              ['білки', r.p],
              ['вуглев.', r.c],
              ['жири', r.f],
            ].map(([label, g]) => (
              <View key={label} style={{ flex: 1, borderRadius: 12 * k, paddingVertical: 8 * k, alignItems: 'center', backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 24 * k }]}>{g}</Text>
                <Text style={{ fontFamily: font, fontSize: 14 * k, color: soft }}>{label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Lock label="калорії і бжу в premium" size={15} color={white} />
        )}

        <View style={{ marginTop: 18 * k }}>
          <CostBlock recipe={r.id} color={white} soft={soft} />
        </View>

        <Text style={head}>ІНГРЕДІЄНТИ{atHome ? `  ·  ВДОМА ${atHome} З ${r.ing.length}` : ''}</Text>
        {r.ing.map(([qty, name], i) => {
          const h = home[i];
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10 * k, paddingVertical: 7 * k, borderBottomWidth: 1, borderBottomColor: line }} accessibilityLabel={h?.full ? `${qty} ${name}, є вдома` : undefined}>
              <Text style={[txt, { width: 16 * k, color: h?.full ? white : soft }]}>{h?.full ? '✓' : '·'}</Text>
              <Text style={[txt, { flex: 1 }, h?.full && { opacity: 0.6 }]}>
                {name}
                {!h?.full && h?.some ? <Text style={{ color: soft }}> · вдома {h.some}</Text> : null}
              </Text>
              <Text style={[txt, { fontFamily: fontMedium }]}>{qty}</Text>
            </View>
          );
        })}

        <Text style={head}>ЧАС</Text>
        <Text style={txt}>
          {r.prep} хв підготовка · {r.cook} хв готування
        </Text>
        {!!r.tools?.length && (
          <>
            <Text style={head}>ІНСТРУМЕНТИ</Text>
            <Text style={txt}>{r.tools.join(', ')}</Text>
          </>
        )}
        {!!r.desc && (
          <>
            <Text style={head}>ПРО СТРАВУ</Text>
            <Text style={[txt, { color: soft }]}>{r.desc}</Text>
          </>
        )}
      </ScrollView>

      <Pressable
        onPress={() => canCook && router.push(`/cook/${r.id}`)}
        disabled={!canCook}
        accessibilityRole="button"
        accessibilityLabel={canCook ? 'Почати готувати' : 'Покроковий режим готується'}
        style={({ pressed }) => ({ position: 'absolute', alignSelf: 'center', bottom: 104 * k, opacity: canCook ? 1 : 0.5, transform: [{ scale: pressed ? 0.96 : 1 }] })}
      >
        <View style={{ minWidth: 200 * k, height: 54 * k, paddingHorizontal: 26 * k, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: sage, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', boxShadow: '0px 10px 24px rgba(0,0,0,0.25)' }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 32 * k, lineHeight: 38 * k, color: '#FFFFFF' }}>
            {canCook ? (progress > 0 && progress < steps ? 'далі' : 'готувати') : 'скоро'}
          </Text>
        </View>
      </Pressable>
    </View>
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
  const cost = useCost(r.id);

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
          <Text style={{ fontFamily: font, fontSize: 30 * k, color: t.text }}>{isSaved ? '♥' : '♡'}</Text>
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
            {fact('ПОРЦІЯ ВДОМА', <>
              <Text style={value}>{cost.home} грн</Text>
              <Text style={[txt, { fontSize: 15 * k, lineHeight: 17 * k, color: soft }]}>{cost.place.at} {cost.out} грн</Text>
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
          <Text style={[label, { marginTop: 12 * k }]}>СКІЛЬКИ ЦЕ КОШТУЄ</Text>
          <CostBlock recipe={r.id} color={t.text} soft={soft} />
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
