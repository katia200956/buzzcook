import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { img, plateCutout, Recipe } from '../data';
import { portionCost, uah } from '../data/prices';
import { swipeRecipe } from '../data/swipe';
import { display, font, fontMedium, shelf, useTheme } from '../theme';
import { Plate } from './Plate';
import { useScale } from './scale';

// Dishes on the home screen are shown as cut-outs: the background-free plate where there is one,
// otherwise the round plate cropped from the photo, with a soft shadow. Same size everywhere, so
// every dish reads at the same scale.
export function Dish({ recipe, size }: { recipe: Recipe; size: number }) {
  const cut = plateCutout(recipe.id);
  const photo = img(recipe.img);
  // Photo-swipe recipes show the very plate their recipe ends with. It is shot on the same dark grey
  // as the strip and tiles, so the frame melts into them; crop to the square around the plate.
  // A background-free plate of the photo recipe's last frame, where we have one: it lies on any
  // background with its own shadow, like the cut-out dishes.
  const own = HERO_CUT[recipe.id];
  if (own)
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: size * 0.94, height: size * 0.94 * (HERO_ASPECT[recipe.id] ?? 1), borderRadius: size, backgroundColor: '#000', opacity: 0.35, transform: [{ translateY: size * 0.035 }], boxShadow: `0px ${size * 0.04}px ${size * 0.08}px rgba(0,0,0,0.9)` } as any} />
        <Image source={own} style={{ width: size, height: size }} contentFit="contain" transition={200} />
      </View>
    );
  const hero = swipeRecipe(recipe.id)?.hero;
  if (hero) return <Image source={hero} style={{ width: size, height: size, transform: [{ scale: 1.12 }] }} contentFit="cover" contentPosition="center" transition={200} />;
  if (cut) return <Image source={cut} style={{ width: size, height: size, transform: [{ scale: 0.9 }] }} contentFit="contain" transition={200} />;
  if (!photo) return <Plate recipe={recipe} size={size} />;
  // The studio photos have a white background around a round plate: crop to the plate itself.
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, boxShadow: `0px ${size * 0.05}px ${size * 0.1}px rgba(0,0,0,0.6)` } as any}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image source={photo} style={{ width: size, height: size, transform: [{ scale: 1.16 }] }} contentFit="cover" transition={200} />
      </View>
    </View>
  );
}

const HERO_CUT: Record<string, number> = {
  pasta: require('../../assets/recipes/pasta/cut.png'),
  syrnyky: require('../../assets/recipes/syrnyky/cut.png'),
  tost: require('../../assets/recipes/tost/cut.png'),
  omlet: require('../../assets/recipes/omlet/cut.png'),
  oatmeal: require('../../assets/recipes/oatmeal/cut.png'),
  salmonmango: require('../../assets/recipes/salmonmango/cut.png'),
};
// Height of each cut-out plate against its width (the photo plates are seen at a slight angle).
const HERO_ASPECT: Record<string, number> = { pasta: 1, syrnyky: 0.92, tost: 0.93, omlet: 1, oatmeal: 0.98, salmonmango: 0.97 };

const LEVEL: Record<string, number> = { легко: 1, середньо: 3, складно: 5 };

// Five little bars, as many lit as the dish is hard.
export function Level({ diff, color = '#FFFFFF' }: { diff: string; color?: string }) {
  const k = useScale();
  const n = LEVEL[diff.toLowerCase()] ?? 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 * k }} accessibilityLabel={`складність ${n} з 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: 3 * k, height: (6 + i * 2) * k, borderRadius: 1, backgroundColor: color, opacity: i < n ? 1 : 0.25 }} />
      ))}
    </View>
  );
}

// One dish on the dark strip: minutes top left, difficulty top right, the cut-out dish, its name
// under it, and calories and the portion's cost at the bottom.
export function StripDish({ recipe, width }: { recipe: Recipe; width: number }) {
  const k = useScale();
  const soft = 'rgba(255,255,255,0.6)';
  const meta = { fontFamily: fontMedium, fontSize: 18 * k, lineHeight: 20 * k, color: '#FFFFFF' };
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}, ${recipe.total} хвилин, ${recipe.diff.toLowerCase()}`}
      style={({ pressed }) => ({ width, alignItems: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={meta}>{recipe.total} хв</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * k }}>
          <Text style={meta}>{recipe.diff.toLowerCase()}</Text>
          <Level diff={recipe.diff} />
        </View>
      </View>
      <View style={{ marginTop: 10 * k }}>
        <Dish recipe={recipe} size={width * 0.82} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: display, fontSize: 17 * k, lineHeight: 22 * k, color: '#FFFFFF', textAlign: 'center', marginTop: 14 * k }}>
        {recipe.name}
      </Text>
      <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 * k }}>
        <Text style={[meta, { color: soft }]}>{recipe.kcal} ккал</Text>
        <Text style={[meta, { color: soft }]}>≈ {uah(portionCost(recipe.id))}</Text>
      </View>
    </Pressable>
  );
}

// A tile in a lower shelf: a dark grey square with the dish at the same scale as everywhere,
// the name under it in the display face, and a short grey line.
export function CoverTile({ recipe, size, sub }: { recipe: Recipe; size: number; sub?: string }) {
  const k = useScale();
  const t = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${recipe.name}, ${sub}` : recipe.name}
      style={({ pressed }) => ({ width: size, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ width: size, height: size, borderRadius: 14 * k, backgroundColor: shelf, alignItems: 'center', justifyContent: 'center' }}>
        <Dish recipe={recipe} size={size * 0.78} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: display, fontSize: 14 * k, lineHeight: 18 * k, color: t.text, marginTop: 8 * k }}>
        {recipe.name}
      </Text>
      {!!sub && (
        <Text numberOfLines={1} style={{ fontFamily: font, fontSize: 16 * k, lineHeight: 18 * k, color: t.textSoft, marginTop: 2 * k }}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

// Square cover used on the recipe page: the same cut-out dish on the dark grey square.
export function CoverArt({ recipe, size, radius = 10 }: { recipe: Recipe; size: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: shelf, alignItems: 'center', justifyContent: 'center' }}>
      <Dish recipe={recipe} size={size * 0.8} />
    </View>
  );
}
