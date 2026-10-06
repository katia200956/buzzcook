import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Recipe } from '../data';
import { useTheme } from '../theme';
import { Plaque } from './Plaque';
import { Lock } from './Premium';
import { Plate } from './Plate';
import { useScale } from './scale';
import { useStore } from './store';

export const ROW_H = 212;

const LEVELS: Record<string, number> = { легко: 1, середньо: 2, складно: 3 };

// One dish: the plate rides the belt on the left and a frosted nameplate sits to its right,
// where the Figma frame has its cards (Apple-style dark material: blur, hairline rim, soft
// shadow). Shows the name, minutes, difficulty and calories.
export function DishRow({ recipe }: { recipe: Recipe }) {
  const k = useScale();
  const t = useTheme();
  const level = LEVELS[recipe.diff.toLowerCase()] ?? 1;
  const { premium } = useStore();

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityLabel={`${recipe.name}, ${recipe.total} хвилин, ${recipe.diff.toLowerCase()}`}
      style={({ pressed }) => ({ height: ROW_H * k, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ position: 'absolute', left: 30 * k, top: 0 }}>
        <Plate recipe={recipe} size={199 * k} />
      </View>

      <Plaque radius={20 * k} style={{ position: 'absolute', left: 246 * k, top: 42 * k, width: 144 * k }}>
        <View style={{ paddingHorizontal: 14 * k, paddingTop: 11 * k, paddingBottom: 12 * k }}>
          <Text style={[s.name, { fontFamily: t.display, fontSize: (t.poster ? 15 : 24) * k, lineHeight: (t.poster ? 19 : 25) * k }]} numberOfLines={t.poster ? 4 : 3}>
            {recipe.name}
          </Text>
          <View style={[s.meta, { marginTop: 8 * k, gap: 8 * k }]}>
            <View style={[s.chip, { gap: 5 * k }]}>
              <View style={[s.clock, { width: 11 * k, height: 11 * k, borderRadius: 6 * k }]}>
                <View style={[s.hand, { height: 4 * k, top: 1.5 * k, left: 4 * k }]} />
              </View>
              <Text style={[s.metaT, { fontFamily: t.font, fontSize: 17 * k }]}>{recipe.total} хв</Text>
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
              <Text style={[s.metaT, { fontFamily: t.font, fontSize: 17 * k }]}>{recipe.diff.toLowerCase()}</Text>
            </View>
          </View>
          {/* Calories are premium: a plain lock stands in for the number. */}
          <View style={{ marginTop: 4 * k }}>
            {premium ? <Text style={[s.kcal, { fontFamily: t.font, fontSize: 16 * k }]}>{recipe.kcal} ккал</Text> : <Lock label="ккал" size={13} color="rgba(255,255,255,0.6)" />}
          </View>
        </View>
      </Plaque>
    </Pressable>
  );
}

const s = StyleSheet.create({
  name: { color: '#FFFFFF', letterSpacing: 0.2 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center' },
  metaT: { color: 'rgba(255,255,255,0.85)' },
  kcal: { color: 'rgba(255,255,255,0.6)' },
  dot: { borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  clock: { borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.72)' },
  hand: { position: 'absolute', width: 1.4, backgroundColor: 'rgba(255,255,255,0.72)' },
});
