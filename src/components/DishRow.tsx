import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Recipe } from '../data';
import { font, fontMedium, sage } from '../theme';
import { Plaque } from './Plaque';
import { Lock } from './Premium';
import { Plate } from './Plate';
import { useScale } from './scale';
import { useStore } from './store';

export const ROW_H = 212;

const LEVELS: Record<string, number> = { легко: 1, середньо: 2, складно: 3 };

// One dish: the plate rides the belt on the left and a frosted nameplate sits to its right,
// where the Figma frame has its cards (Apple-style dark material: blur, hairline rim, soft
// shadow). Shows the name, minutes, difficulty and calories. `picked` marks the dish the
// spinning belt stopped on: the plate pops and the nameplate gets a sage rim.
export function DishRow({ recipe, picked = false }: { recipe: Recipe; picked?: boolean }) {
  const k = useScale();
  const level = LEVELS[recipe.diff.toLowerCase()] ?? 1;
  const { premium } = useStore();
  const [pop] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.spring(pop, { toValue: picked ? 1 : 0, useNativeDriver: true, damping: 9, stiffness: 180, mass: 0.7 }).start();
  }, [picked, pop]);
  const plateScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityLabel={`${recipe.name}, ${recipe.total} хвилин, ${recipe.diff.toLowerCase()}`}
      style={({ pressed }) => ({ height: ROW_H * k, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <Animated.View style={{ position: 'absolute', left: 30 * k, top: 0, transform: [{ scale: plateScale }] }}>
        <Plate recipe={recipe} size={199 * k} />
      </Animated.View>

      <Plaque radius={20 * k} style={{ position: 'absolute', left: 246 * k, top: 42 * k, width: 144 * k }}>
        {picked && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20 * k, borderWidth: 2, borderColor: sage, backgroundColor: 'rgba(91,107,69,0.22)' }]} />}
        <View style={{ paddingHorizontal: 14 * k, paddingTop: 11 * k, paddingBottom: 12 * k }}>
          {picked && <Text style={[s.pick, { fontSize: 14 * k, marginBottom: 3 * k }]}>ТВІЙ ВИБІР</Text>}
          <Text style={[s.name, { fontSize: 24 * k, lineHeight: 25 * k }]} numberOfLines={3}>
            {recipe.name}
          </Text>
          <View style={[s.meta, { marginTop: 8 * k, gap: 8 * k }]}>
            <View style={[s.chip, { gap: 5 * k }]}>
              <View style={[s.clock, { width: 11 * k, height: 11 * k, borderRadius: 6 * k }]}>
                <View style={[s.hand, { height: 4 * k, top: 1.5 * k, left: 4 * k }]} />
              </View>
              <Text style={[s.metaT, { fontSize: 17 * k }]}>{recipe.total} хв</Text>
            </View>
            <View style={[s.dot, { width: 3 * k, height: 3 * k }]} />
            <View style={[s.chip, { gap: 5 * k }]}>
              <View style={{ flexDirection: 'row', gap: 2 * k, alignItems: 'flex-end' }}>
                {[1, 2, 3].map((n) => (
                  <View
                    key={n}
                    style={{ width: 3 * k, height: (4 + n * 2.5) * k, borderRadius: 1.5 * k, backgroundColor: n <= level ? '#FFFFFF' : 'rgba(255,255,255,0.28)' }}
                  />
                ))}
              </View>
              <Text style={[s.metaT, { fontSize: 17 * k }]}>{recipe.diff.toLowerCase()}</Text>
            </View>
          </View>
          {/* Calories are premium: a plain lock stands in for the number. */}
          <View style={{ marginTop: 4 * k }}>
            {premium ? <Text style={[s.kcal, { fontSize: 16 * k }]}>{recipe.kcal} ккал</Text> : <Lock label="ккал" size={13} color="rgba(255,255,255,0.6)" />}
          </View>
        </View>
      </Plaque>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pick: { fontFamily: fontMedium, color: '#C9D6B4', letterSpacing: 1.2 },
  name: { fontFamily: fontMedium, color: '#FFFFFF', letterSpacing: 0.2 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center' },
  metaT: { fontFamily: font, color: 'rgba(255,255,255,0.85)' },
  kcal: { fontFamily: font, color: 'rgba(255,255,255,0.6)' },
  dot: { borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  clock: { borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.72)' },
  hand: { position: 'absolute', width: 1.4, backgroundColor: 'rgba(255,255,255,0.72)' },
});
