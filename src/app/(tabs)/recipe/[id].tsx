import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Belt } from '../../../components/Belt';
import { Header } from '../../../components/Header';
import { Menu } from '../../../components/Menu';
import { Plaque } from '../../../components/Plaque';
import { PosterPanel } from '../../../components/PosterRow';
import { Plate } from '../../../components/Plate';
import { Lock } from '../../../components/Premium';
import { Screen } from '../../../components/Screen';
import { useScale } from '../../../components/scale';
import { useStore } from '../../../components/store';
import { byId } from '../../../data';
import { useTheme } from '../../../theme';

// Figma "recipe going": the chosen plate on the belt, a tall info card and START.
// v2: calories and macros up top as tiles, clearer section labels, a solid START.
export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = byId(id);
  const k = useScale();
  const t = useTheme();
  const [menu, setMenu] = useState(false);
  const { saved, toggleSaved, done, premium } = useStore();

  if (!r) return null;
  const txt = { fontFamily: t.font, fontSize: 19 * k, lineHeight: 23 * k, color: '#FFFFFF' };
  const head = { fontFamily: t.fontMedium, fontSize: 15 * k, letterSpacing: 1.2 * k, color: 'rgba(255,255,255,0.55)', marginTop: 16 * k, marginBottom: 4 * k };
  const canCook = !!r.steps?.length;
  const progress = done[r.id] ?? 0;
  const back = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  const isSaved = saved.includes(r.id);

  return (
    <Screen>
      {t.poster ? <PosterPanel tilt={-4} style={{ left: 14 * k, top: 186 * k, width: 236 * k, height: 128 * k, borderRadius: 26 * k }} /> : <Belt />}
      <View style={{ position: 'absolute', left: 31 * k, top: 140 * k }}>
        <Plate recipe={r} size={199 * k} />
      </View>

      {/* v2: the info column sits on dark plaques with white text, a little wider than before. */}
      <View style={{ position: 'absolute', left: 246 * k, top: 140 * k, width: 144 * k, bottom: 170 * k }}>
        <Plaque radius={18 * k} style={{ paddingHorizontal: 14 * k, paddingVertical: 10 * k }}>
          <Text style={{ fontFamily: t.display, fontSize: (t.poster ? 15 : 24) * k, lineHeight: (t.poster ? 19 : 25) * k, color: '#FFFFFF' }}>{r.name}</Text>
          <Text style={{ fontFamily: t.font, fontSize: 16 * k, color: 'rgba(255,255,255,0.65)', marginTop: 4 * k }}>
            {r.total} хв · {r.diff.toLowerCase()}
          </Text>
        </Plaque>

        <Plaque radius={18 * k} style={{ marginTop: 10 * k, flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 14 * k, paddingTop: 12 * k, paddingBottom: 18 * k }} showsVerticalScrollIndicator={false}>
            {/* Calories and macros as small tiles, so the numbers read at a glance. Premium only. */}
            {premium ? (
              <>
                <Text style={[txt, { fontFamily: t.fontMedium, fontSize: 30 * k, lineHeight: 32 * k }]}>
                  {r.kcal}
                  <Text style={{ fontFamily: t.font, fontSize: 17 * k, color: 'rgba(255,255,255,0.65)' }}> ккал</Text>
                </Text>
                <View style={{ flexDirection: 'row', gap: 5 * k, marginTop: 8 * k }}>
                  {[
                    ['білки', r.p],
                    ['вуглев.', r.c],
                    ['жири', r.f],
                  ].map(([label, g]) => (
                    <View key={label} style={{ flex: 1, borderRadius: 10 * k, paddingVertical: 5 * k, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <Text style={[txt, { fontFamily: t.fontMedium, fontSize: 18 * k, lineHeight: 20 * k }]}>{g}</Text>
                      <Text style={{ fontFamily: t.font, fontSize: 13 * k, color: 'rgba(255,255,255,0.6)' }}>{label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={{ borderRadius: 12 * k, padding: 10 * k, backgroundColor: 'rgba(255,255,255,0.08)', gap: 4 * k }}>
                <Lock label="калорії і бжу" size={15} color="#FFFFFF" />
                <Text style={{ fontFamily: t.font, fontSize: 14 * k, lineHeight: 16 * k, color: 'rgba(255,255,255,0.6)' }}>доступно в premium</Text>
              </View>
            )}

            <Text style={head}>ІНГРЕДІЄНТИ</Text>
            {r.ing.map(([qty, name], i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 6 * k, marginBottom: 3 * k }}>
                <View style={{ width: 4 * k, height: 4 * k, borderRadius: 2 * k, marginTop: 9 * k, backgroundColor: t.cta, transform: [{ scale: 1.4 }] }} />
                <Text style={[txt, { flex: 1 }]}>
                  {qty ? <Text style={{ fontFamily: t.fontMedium }}>{qty} </Text> : null}
                  {name}
                </Text>
              </View>
            ))}
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

      {/* v2: START is a solid t.cta pill, the one clear action on the screen. */}
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
            backgroundColor: canCook ? t.cta : 'rgba(24,24,27,0.7)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.3)',
            boxShadow: '0px 10px 24px rgba(0,0,0,0.4)',
          }}
        >
          <Text style={{ fontFamily: t.display, fontSize: 38 * k * t.displayK, lineHeight: 46 * k, color: '#FFFFFF' }}>
            {canCook ? (progress > 0 && progress < r.steps!.length ? 'далі' : 'старт') : 'скоро'}
          </Text>
        </View>
      </Pressable>

      <Header logo={false} onLogo={back} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}
