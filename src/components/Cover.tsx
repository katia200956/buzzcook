import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { img, plateCutout, Recipe } from '../data';
import { swipeRecipe } from '../data/swipe';
import { font, fontMedium, useTheme } from '../theme';
import { useScale } from './scale';

// Album-art style cover for a recipe, as in Apple Music: a square with soft rounded corners.
// Swipe recipes use their plated hero, cut-out dishes stand on near-black, the rest use their photo.
export function CoverArt({ recipe, size, radius = 10 }: { recipe: Pick<Recipe, 'id' | 'name'> & { img?: string }; size: number; radius?: number }) {
  const sw = swipeRecipe(recipe.id);
  const cut = plateCutout(recipe.id);
  const photo = recipe.img ? img(recipe.img) : undefined;
  const src = sw?.hero ?? cut ?? photo;
  const onBlack = !!(sw || cut);
  return (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' }}>
      {src ? (
        <Image source={src} style={{ width: size, height: size, transform: [{ scale: onBlack ? 0.92 : 1.08 }] }} contentFit={onBlack ? 'contain' : 'cover'} transition={200} />
      ) : (
        <Text style={{ fontFamily: fontMedium, fontSize: Math.max(12, size * 0.13), color: '#FFFFFF', textAlign: 'center', paddingHorizontal: size * 0.1 }} numberOfLines={3}>
          {recipe.name.toLowerCase()}
        </Text>
      )}
    </View>
  );
}

// A tile in a horizontal shelf: cover on top, title and a grey subtitle under it.
export function CoverTile({ recipe, size, sub }: { recipe: Pick<Recipe, 'id' | 'name'> & { img?: string }; size: number; sub?: string }) {
  const k = useScale();
  const t = useTheme();
  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${recipe.name}, ${sub}` : recipe.name}
      style={({ pressed }) => ({ width: size, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <CoverArt recipe={recipe} size={size} radius={10 * k} />
      <Text numberOfLines={1} style={{ fontFamily: fontMedium, fontSize: 18 * k, lineHeight: 21 * k, color: t.text, marginTop: 6 * k }}>
        {recipe.name}
      </Text>
      {!!sub && (
        <Text numberOfLines={1} style={{ fontFamily: font, fontSize: 16 * k, lineHeight: 18 * k, color: t.textSoft }}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}
