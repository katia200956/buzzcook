import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { products } from '../products/catalog';
import { ProductView } from '../products/ProductView';
import { font, fontMedium, useTheme } from '../theme';

// The 3D product library at a glance: the chosen product big (drag it to turn it any way),
// and the whole library underneath to pick from. Open it at /products.
export default function Products() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [current, setCurrent] = useState(products[0]);
  const big = Math.min(width - 32, 420);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg[1] }}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fontMedium, fontSize: 32, color: t.text }}>продукти в 3D</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={{ fontFamily: font, fontSize: 20, color: t.textSoft }}>закрити</Text>
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <ProductView key={current.id} product={current} size={big} />
        <Text style={{ fontFamily: fontMedium, fontSize: 26, color: t.text }}>{current.name.uk}</Text>
        <Text style={{ fontFamily: font, fontSize: 16, color: t.textSoft }}>потягни, щоб покрутити</Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24, justifyContent: 'center' }}>
        {products.map((p) => {
          const on = p.id === current.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setCurrent(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? t.text : t.border,
                backgroundColor: on ? t.glassStrong : t.glass,
              }}
            >
              <Text style={{ fontFamily: font, fontSize: 20, color: t.text }}>{p.name.uk}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}
