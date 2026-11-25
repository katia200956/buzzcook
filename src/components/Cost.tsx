import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { byId } from '../data';
import { INGREDIENTS, needsOf } from '../data/pantry';
import { currentPlace, isMyOut, isMyPrice, ourOutPrice, ourPrice, outPrice, PLACES, portionCost, priceOf, priceUnit, uah } from '../data/prices';
import { font, fontMedium, sage, useTheme } from '../theme';
import { Chip } from './ProfileForm';
import { Plaque } from './Plaque';
import { useScale } from './scale';
import { Sheet } from './Sheet';
import { useStore } from './store';

// The savings counter around a recipe: what a portion costs at home, what it would cost where the
// person usually eats, the difference, and a sheet to type in their own prices.

// Ingredient lines that have a real price (salt, oil and spices are a flat few hryvnias).
const priced = (recipe: string) => [...new Set(needsOf(recipe).map(([key]) => key))].filter((key) => INGREDIENTS[key] && INGREDIENTS[key].unit !== 'є');

export function useCost(recipe: string) {
  useStore(); // re-render when prices or the place change
  const home = portionCost(recipe);
  const out = outPrice(recipe);
  return { home, out, saved: Math.max(0, out - home), place: currentPlace() };
}

// Three numbers in a row (or stacked, for the narrow column on the belt recipe) and "свої ціни".
export function CostBlock({ recipe, color, soft, stacked }: { recipe: string; color: string; soft: string; stacked?: boolean }) {
  const k = useScale();
  const [open, setOpen] = useState(false);
  const { home, out, saved, place } = useCost(recipe);
  const label = { fontFamily: fontMedium, fontSize: 13 * k, letterSpacing: 1.1 * k, color: soft };
  const num = { fontFamily: fontMedium, fontSize: 24 * k, lineHeight: 27 * k, color };
  const cell = (name: string, value: string, tint?: string) => (
    <View key={name} style={stacked ? { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' } : { flex: 1 }}>
      <Text style={label}>{name}</Text>
      <Text style={[num, stacked && { fontSize: 20 * k, lineHeight: 23 * k }, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
  return (
    <View accessibilityLabel={`Порція вдома ${home} грн, ${place.at} ${out} грн, економія ${saved} грн`}>
      <View style={{ flexDirection: stacked ? 'column' : 'row', gap: stacked ? 2 * k : 10 * k }}>
        {cell('ВДОМА', uah(home))}
        {cell(place.at.toUpperCase(), uah(out))}
        {cell('ЕКОНОМІЯ', uah(saved), '#9DB57A')}
      </View>
      <Text style={{ fontFamily: font, fontSize: 14 * k, color: soft, marginTop: 2 * k }}>за одну порцію</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Вписати свої ціни"
        hitSlop={6}
        style={{ alignSelf: 'flex-start', marginTop: 6 * k, borderRadius: 100, borderWidth: 1, borderColor: soft, paddingHorizontal: 12 * k, paddingVertical: 3 * k }}
      >
        <Text style={{ fontFamily: font, fontSize: 17 * k, color }}>✎ свої ціни</Text>
      </Pressable>
      <PriceSheet recipe={recipe} open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

// A price box: empty means "use ours" (shown as the placeholder); a number is the person's own.
function PriceField({ value, ours, mine, onChange, label }: { value: number; ours: number; mine: boolean; onChange: (n?: number) => void; label: string }) {
  const k = useScale();
  const t = useTheme();
  const [text, setText] = useState(mine ? String(value) : '');
  return (
    <TextInput
      value={text}
      onChangeText={(x) => {
        setText(x);
        const n = Number(x.replace(',', '.'));
        onChange(x.trim() && Number.isFinite(n) && n > 0 && n < 100000 ? n : undefined);
      }}
      keyboardType="decimal-pad"
      placeholder={String(Math.round(ours * 10) / 10)}
      placeholderTextColor={t.textSoft}
      accessibilityLabel={label}
      style={
        {
          width: 86 * k,
          height: 40 * k,
          borderRadius: 12 * k,
          paddingHorizontal: 10 * k,
          textAlign: 'right',
          fontFamily: fontMedium,
          fontSize: 21 * k,
          color: mine ? sage : t.text,
          backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
          outlineStyle: 'none',
        } as any
      }
    />
  );
}

// "Свої ціни": where they eat, what a portion costs them there, and the price of each ingredient.
// Leaving a box empty keeps our suggestion.
export function PriceSheet({ recipe, open, onClose }: { recipe: string; open: boolean; onClose: () => void }) {
  const k = useScale();
  const t = useTheme();
  const { height } = useWindowDimensions();
  const { profile, setProfile, setMyPrice, setMyOut, resetMyPrices } = useStore();
  const { home, out, saved, place } = useCost(recipe);
  const r = byId(recipe);
  const keys = priced(recipe);
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };
  const soft = { fontFamily: font, fontSize: 16 * k, color: t.textSoft };
  const [gen, setGen] = useState(0); // bumped on "повернути наші ціни" so the boxes start empty again
  const anyMine = isMyOut(recipe) || keys.some(isMyPrice);
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 * k, paddingVertical: 6 * k };

  return (
    <Sheet open={open} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={{ maxHeight: height * 0.72 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 30 * k, lineHeight: 33 * k }]}>свої ціни</Text>
          <Text style={soft}>{r?.name.toLowerCase()} · впиши, скільки платиш ти, або лиши нашу ціну (сіра цифра)</Text>

          <Text style={[soft, { marginTop: 16 * k }]}>коли не готую, зазвичай їм</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 6 * k }}>
            {PLACES.map((p) => (
              <Chip key={p.id} on={profile.eatOut === p.id} label={p.label} onPress={() => setProfile({ eatOut: p.id })} />
            ))}
          </View>

          <View style={[row, { marginTop: 10 * k }]}>
            <Text style={[txt, { flex: 1 }]}>порція {place.at}</Text>
            <PriceField key={`out-${place.id}-${gen}`} value={out} ours={ourOutPrice(recipe)} mine={isMyOut(recipe)} onChange={(n) => setMyOut(recipe, n)} label={`Порція ${place.at}, гривень`} />
            <Text style={[soft, { width: 52 * k }]}>грн</Text>
          </View>

          <Text style={[soft, { marginTop: 14 * k }]}>продукти в магазині</Text>
          {keys.map((key) => (
            <View key={`${key}-${gen}`} style={row}>
              <Text style={[txt, { flex: 1 }]} numberOfLines={1}>{INGREDIENTS[key].name}</Text>
              <PriceField value={priceOf(key)} ours={ourPrice(key)} mine={isMyPrice(key)} onChange={(n) => setMyPrice(key, n)} label={`${INGREDIENTS[key].name}, ${priceUnit(key)}`} />
              <Text style={[soft, { width: 52 * k }]}>{priceUnit(key)}</Text>
            </View>
          ))}
          <Text style={[soft, { marginTop: 4 * k }]}>сіль, олія і спеції рахуються по 3 грн на страву</Text>

          <View style={{ marginTop: 14 * k, padding: 14 * k, borderRadius: 16 * k, backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)' }}>
            <Text style={txt}>вдома {uah(home)} · {place.at} {uah(out)}</Text>
            <Text style={[txt, { fontFamily: fontMedium, color: sage }]}>економія {uah(saved)} на порції</Text>
          </View>

          {anyMine && (
            <Pressable onPress={() => {
                resetMyPrices(recipe, keys);
                setGen(gen + 1);
              }} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 12 * k }}>
              <Text style={[soft, { fontSize: 18 * k, textDecorationLine: 'underline' }]}>повернути наші ціни</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

// The little glowing counter at the side of the screen: all the money saved so far. It pulses when
// the sum grows (after a dinner) and opens the profile with the weekly card.
export function SavedBadge({ top, right }: { top: number; right: number }) {
  const k = useScale();
  const { savedSince } = useStore();
  const total = Math.round(savedSince(0).saved);
  const [pulse] = useState(() => new Animated.Value(1));
  const last = useRef(total);
  useEffect(() => {
    if (total > last.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.18, useNativeDriver: true, speed: 30, bounciness: 12 }),
        Animated.spring(pulse, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }),
      ]).start();
    }
    last.current = total;
  }, [total, pulse]);

  return (
    <Animated.View style={{ position: 'absolute', top, right, zIndex: 11, transform: [{ scale: pulse }] }}>
      <Pressable onPress={() => router.navigate('/profile')} accessibilityRole="button" accessibilityLabel={`Зекономлено ${total} гривень. Відкрити підсумок`} hitSlop={6}>
        <Plaque radius={100} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 * k, height: 32 * k, paddingLeft: 8 * k, paddingRight: 12 * k, boxShadow: `0px 0px ${14 * k}px rgba(157,181,122,0.75)` } as any}>
          <View style={{ width: 18 * k, height: 18 * k, borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center', boxShadow: `0px 0px ${8 * k}px ${sage}` }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 13 * k, lineHeight: 15 * k, color: '#FFFFFF' }}>₴</Text>
          </View>
          <Text style={{ fontFamily: fontMedium, fontSize: 18 * k, lineHeight: 21 * k, color: '#FFFFFF' }}>{uah(total)}</Text>
        </Plaque>
      </Pressable>
    </Animated.View>
  );
}
