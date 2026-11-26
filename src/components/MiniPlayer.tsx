import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { byId, recipes } from '../data';
import { swipeRecipe } from '../data/swipe';
import { font, fontMedium } from '../theme';
import { CoverArt } from './Cover';
import { useScale } from './scale';
import { useStore } from './store';

// The mini player that floats above the tab bar, as in Apple Music. While a dish is being cooked
// it shows that dish and the step you are on; play reopens the cooking screen and » skips a step.
// With nothing on the stove it offers tonight's best match, and play starts it.
export function MiniPlayer({ width }: { width: number }) {
  const k = useScale();
  const { current, done, setDone, rank } = useStore();
  const cooking = current ? byId(current) : undefined;
  const total = cooking?.steps?.length ?? 0;
  const at = cooking ? (done[cooking.id] ?? 0) : 0;
  const live = !!cooking && total > 0 && at < total;
  const pick = live ? cooking! : rank(recipes).find((p) => p.r.steps?.length || swipeRecipe(p.r.id))?.r;
  if (!pick) return null;

  const open = () => router.push(`/recipe/${pick.id}`);
  const play = () => router.push(live || pick.steps?.length ? `/cook/${pick.id}` : `/recipe/${pick.id}`);
  const sub = live ? `крок ${at + 1} з ${total}` : `на сьогодні · ${pick.total} хв`;

  return (
    <View style={{ width, height: 56 * k, borderRadius: 100, overflow: 'hidden' }}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 100, backgroundColor: 'rgba(17,17,17,0.78)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)' }]} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 8 * k, paddingRight: 6 * k, gap: 4 * k }}>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${live ? 'Зараз готуєш' : 'Пропозиція'}: ${pick.name}, ${sub}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
          <CoverArt recipe={pick} size={40 * k} radius={100} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontMedium, fontSize: 18 * k, lineHeight: 20 * k, color: '#FFFFFF' }}>{pick.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font, fontSize: 15 * k, lineHeight: 17 * k, color: 'rgba(255,255,255,0.6)' }}>{sub}</Text>
          </View>
        </Pressable>
        <Pressable onPress={play} hitSlop={6} accessibilityRole="button" accessibilityLabel={live ? 'Продовжити готувати' : 'Почати готувати'} style={({ pressed }) => ({ width: 40 * k, height: 40 * k, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ fontSize: 22 * k, color: '#FFFFFF' }}>▶︎</Text>
        </Pressable>
        <Pressable
          onPress={() => (live ? setDone(pick.id, at + 1) : open())}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={live ? 'Наступний крок' : 'Відкрити рецепт'}
          style={({ pressed }) => ({ width: 40 * k, height: 40 * k, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={{ fontSize: 20 * k, color: '#FFFFFF' }}>{'⏭︎'}</Text>
        </Pressable>
      </View>
      {live && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 24 * k, right: 24 * k, bottom: 4 * k, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <View style={{ width: `${(at / total) * 100}%`, height: 2, borderRadius: 1, backgroundColor: '#FFFFFF' }} />
        </View>
      )}
    </View>
  );
}
