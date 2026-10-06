import { router } from 'expo-router';
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Recipe } from '../data';
import { useTheme } from '../theme';
import { Lock } from './Premium';
import { Plate } from './Plate';
import { useScale } from './scale';
import { useStore } from './store';

export const POSTER_ROW_H = 236;

// Cream panel tilted like the cards on the ramen flyer. Shared with the recipe and sign-in screens.
export function PosterPanel({ tilt, style }: { tilt: number; style: object }) {
  const t = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          backgroundColor: t.glass,
          borderRadius: 26,
          transform: [{ rotate: `${tilt}deg` }],
          boxShadow: '0px 6px 0px rgba(59,22,7,0.18)',
        },
        style,
      ]}
    />
  );
}

// Poster-theme dish row, in place of the belt: a tilted cream panel with the bowl breaking out
// of one end and the name in chunky type on the other. Sides alternate down the feed like the
// two dishes on the flyer, and as the feed scrolls each bowl drifts and turns a little.
export function PosterRow({ recipe, index, scrollY, top }: { recipe: Recipe; index: number; scrollY: Animated.Value; top: number }) {
  const k = useScale();
  const t = useTheme();
  const { height } = useWindowDimensions();
  const { premium } = useStore();
  const right = index % 2 === 0; // bowl on the right, text on the left
  const H = POSTER_ROW_H * k;
  const plate = 196 * k;

  // Where this row sits in the scroll content; the bowl moves from +18 to -18 while it crosses the screen.
  const y = top + index * H;
  const range = [y - height, y + H];
  const drift = scrollY.interpolate({ inputRange: range, outputRange: [18 * k, -18 * k], extrapolate: 'clamp' });
  const spin = scrollY.interpolate({ inputRange: range, outputRange: right ? ['-14deg', '14deg'] : ['14deg', '-14deg'], extrapolate: 'clamp' });

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityLabel={`${recipe.name}, ${recipe.total} хвилин, ${recipe.diff.toLowerCase()}`}
      style={({ pressed }) => ({ height: H, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <PosterPanel tilt={right ? -3 : 3} style={{ left: 18 * k, right: 18 * k, top: 46 * k, height: 158 * k, borderRadius: 26 * k }} />

      <Animated.View
        style={{
          position: 'absolute',
          top: 22 * k,
          [right ? 'right' : 'left']: 4 * k,
          transform: [{ translateY: drift }, { rotate: spin }],
        }}
      >
        <Plate recipe={recipe} size={plate} />
      </Animated.View>

      <View
        style={{
          position: 'absolute',
          top: 70 * k,
          width: 170 * k,
          [right ? 'left' : 'right']: 36 * k,
          alignItems: right ? 'flex-start' : 'flex-end',
        }}
      >
        <Text
          numberOfLines={4}
          style={{ fontFamily: t.display, fontSize: 21 * k, lineHeight: 24 * k, color: t.text, textAlign: right ? 'left' : 'right' }}
        >
          {recipe.name}
        </Text>
        <Text style={{ fontFamily: t.font, fontSize: 18 * k, color: t.textSoft, marginTop: 6 * k }}>
          {recipe.total} хв · {recipe.diff.toLowerCase()}
        </Text>
        <View style={{ marginTop: 2 * k }}>
          {premium ? (
            <Text style={{ fontFamily: t.font, fontSize: 17 * k, color: t.textSoft }}>{recipe.kcal} ккал</Text>
          ) : (
            <Lock label="ккал" size={13} color={t.textSoft} />
          )}
        </View>
      </View>
    </Pressable>
  );
}
