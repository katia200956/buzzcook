import { Image } from 'expo-image';
import { View } from 'react-native';
import { img, plateCutout, Recipe } from '../data';

// A dish on the belt: two soft plate shadows under a round photo, placed as in the
// Figma plates (199pt photo, shadows offset by their own blur padding).
export function Plate({ recipe, size }: { recipe: Recipe; size: number }) {
  const u = size / 199;
  const cut = plateCutout(recipe.id);
  if (cut) {
    // Background-free photo: the real bowl sits straight on the belt, no crop or shading needed.
    return <Image source={cut} style={{ width: size, height: size, transform: [{ scale: 1.08 }] }} contentFit="contain" transition={200} />;
  }
  return (
    <View style={{ width: size, height: size }}>
      <Image
        source={require('../../assets/figma/plate-shadow-a.svg')}
        style={{ position: 'absolute', left: 6 * u, top: 8 * u, width: 193 * u, height: 193 * u }}
        contentFit="fill"
      />
      <Image
        source={require('../../assets/figma/plate-shadow-b.svg')}
        style={{ position: 'absolute', left: 10 * u, top: 15 * u, width: 193 * u, height: 188 * u }}
        contentFit="fill"
      />
      {/* The photos have a white studio background; zoom in slightly so only the plate shows. */}
      <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <Image
          source={img(recipe.img)}
          style={{ width: size, height: size, transform: [{ scale: 1.1 }] }}
          contentFit="cover"
          transition={200}
        />
        {/* Darken the white plate so it sits on the black belt like the dark bowls in Figma:
            a dim over the whole photo plus a heavier shaded rim. */}
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.14)' } as any} />
        <View
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: size / 2,
            borderWidth: size * 0.075,
            borderColor: 'rgba(28,24,22,0.72)',
          } as any}
        />
        <View
          style={{
            position: 'absolute',
            inset: size * 0.075,
            borderRadius: size / 2,
            borderWidth: size * 0.035,
            borderColor: 'rgba(28,24,22,0.35)',
          } as any}
        />
      </View>
    </View>
  );
}
