import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Animated, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { img, Recipe } from '../data';
import { useTheme } from '../theme';
import { Lock } from './Premium';
import { useScale } from './scale';
import { useStore } from './store';

export const POSTER_ROW_H = 236;

// A black bowl seen from the side at an angle, like the ramen bowls on the flyer. The top-down
// dish photo is zoomed past its white plate and squashed into the bowl's opening (an ellipse);
// a shallow black ellipse with a soft sheen under it reads as the bowl's outer wall.
function PosterBowl({ recipe, width }: { recipe: Recipe; width: number }) {
  const w = width;
  const squash = 0.5; // opening height / width at this viewing angle
  return (
    <View style={{ width: w, height: w * 0.7 }}>
      {/* Wall: a wider, deeper ellipse whose lower edge shows below the opening. */}
      <View
        style={{
          position: 'absolute',
          left: w * 0.02,
          top: w * 0.06,
          width: w * 0.96,
          height: w * 0.62,
          borderRadius: w,
          overflow: 'hidden',
          boxShadow: `0px ${w * 0.04}px ${w * 0.05}px rgba(30,10,2,0.45)`,
        }}
      >
        <LinearGradient colors={['#3A3A3A', '#121212', '#050505', '#1C1C1C']} locations={[0, 0.35, 0.75, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </View>
      {/* Opening: rim, then the food, flattened by the viewing angle. */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: w, height: w, transform: [{ translateY: -(w * (1 - squash)) / 2 }, { scaleY: squash }] }}>
        <View style={{ width: w, height: w, borderRadius: w / 2, backgroundColor: '#0B0B0B', borderWidth: w * 0.012, borderColor: '#4A4A4A', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', inset: w * 0.05, borderRadius: w, overflow: 'hidden' } as object}>
            <Image source={img(recipe.img)} style={{ width: '100%', height: '100%', transform: [{ scale: 1.45 }] }} contentFit="cover" transition={200} />
            {/* Inner shadow where the food meets the bowl's inside wall. */}
            <View style={{ position: 'absolute', inset: 0, borderRadius: w, boxShadow: `inset 0px ${w * 0.04}px ${w * 0.06}px rgba(0,0,0,0.65)` } as object} />
          </View>
        </View>
      </View>
    </View>
  );
}

// Poster-theme dish row, in place of the belt, after the cards on the ramen flyer: a cream card
// cut on a rising slant, so stacked rows leave a diagonal stripe between them; the bowl sits
// half off the card, alternating sides down the feed, with the name in chunky type opposite.
// As the feed scrolls the bowls drift up and down a little.
export function PosterRow({ recipe, index, scrollY, top }: { recipe: Recipe; index: number; scrollY: Animated.Value; top: number }) {
  const k = useScale();
  const t = useTheme();
  const { height } = useWindowDimensions();
  const { premium } = useStore();
  const right = index % 2 === 0; // bowl on the right breaking out of the top, text on the left
  const H = POSTER_ROW_H * k;
  const bowl = 206 * k;

  // Where this row sits in the scroll content; the bowl moves from +16 to -16 while it crosses the screen.
  const y = top + index * H;
  const drift = scrollY.interpolate({ inputRange: [y - height, y + H], outputRange: [16 * k, -16 * k], extrapolate: 'clamp' });

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityLabel={`${recipe.name}, ${recipe.total} хвилин, ${recipe.diff.toLowerCase()}`}
      style={({ pressed }) => ({ height: H, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <Image source={require('../../assets/poster/panel.svg')} style={{ position: 'absolute', left: 0, top: 0, width: 402 * k, height: H }} tintColor={t.panel} />

      <Animated.View
        style={{
          position: 'absolute',
          top: right ? -4 * k : 96 * k,
          [right ? 'right' : 'left']: 2 * k,
          transform: [{ translateY: drift }],
        }}
      >
        <PosterBowl recipe={recipe} width={bowl} />
      </Animated.View>

      <View
        style={{
          position: 'absolute',
          top: right ? 78 * k : 62 * k,
          width: 168 * k,
          [right ? 'left' : 'right']: 36 * k,
          alignItems: right ? 'flex-start' : 'flex-end',
        }}
      >
        <Text
          numberOfLines={4}
          style={{ fontFamily: t.display, fontSize: 21 * k, lineHeight: 24 * k, color: t.panelText, textAlign: right ? 'left' : 'right' }}
        >
          {recipe.name}
        </Text>
        <Text style={{ fontFamily: t.font, fontSize: 18 * k, color: t.panelText, opacity: 0.62, marginTop: 6 * k }}>
          {recipe.total} хв · {recipe.diff.toLowerCase()}
        </Text>
        <View style={{ marginTop: 2 * k, opacity: 0.62 }}>
          {premium ? (
            <Text style={{ fontFamily: t.font, fontSize: 17 * k, color: t.panelText }}>{recipe.kcal} ккал</Text>
          ) : (
            <Lock label="ккал" size={13} color={t.panelText} />
          )}
        </View>
      </View>
    </Pressable>
  );
}
