import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fmtQty, guessKey, INGREDIENTS } from '../data/pantry';
import { ReceiptLine, readReceipt } from '../data/vision';
import { font, fontMedium, sage, useTheme } from '../theme';
import { pickPhoto } from './photo';
import { useScale } from './scale';
import { Sheet } from './Sheet';
import { useStore } from './store';

type Mode = { at: 'pick' } | { at: 'reading' } | { at: 'failed'; why: string } | { at: 'list'; items: (ReceiptLine & { on: boolean })[] };

// Photo of a shop receipt → Claude reads the lines → the person checks the list → it goes into the fridge
// (and ticks off the same things on the shopping list).
export function ReceiptSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const k = useScale();
  const t = useTheme();
  const { addBought } = useStore();
  const [mode, setMode] = useState<Mode>({ at: 'pick' });
  const [hidden, setHidden] = useState(false);
  const [was, setWas] = useState(false);
  if (open && !was) {
    setWas(true);
    setMode({ at: 'pick' });
  }
  if (!open && was) setWas(false);

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const soft = { color: t.textSoft };
  const pill = [s.pill, { height: 52 * k, backgroundColor: sage }];

  const read = async (from: 'camera' | 'library') => {
    // iOS can't show the camera over an open sheet: hide it while the photo is taken.
    setHidden(true);
    await new Promise((r) => setTimeout(r, 400));
    let image: string | null = null;
    try {
      image = await pickPhoto(from);
    } catch {
      image = null;
      setMode({ at: 'failed', why: 'не вдалося відкрити фото.' });
    }
    setHidden(false);
    if (!image) return;
    setMode({ at: 'reading' });
    try {
      const lines = await readReceipt(image);
      const items = lines.filter((x) => x.qty > 0).map((x) => ({ ...x, on: x.food }));
      if (!items.length) return setMode({ at: 'failed', why: 'не бачу на фото рядків чека. спробуй ближче й рівніше.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setMode({ at: 'list', items });
    } catch {
      setMode({ at: 'failed', why: 'не вдалося прочитати чек. перевір інтернет і спробуй ще.' });
    }
  };

  const add = () => {
    if (mode.at !== 'list') return;
    addBought(
      mode.items
        .filter((x) => x.on)
        .map((x) => {
          const key = guessKey(x.match) ?? guessKey(x.name);
          return { key, name: key && x.match ? INGREDIENTS[key].name : x.name, qty: x.qty, unit: x.unit };
        }),
    );
    onClose();
  };

  return (
    <Sheet open={open && !hidden} onClose={onClose}>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k, marginBottom: 8 * k }]}>чек у холодильник</Text>

      {mode.at === 'pick' && (
        <View style={{ gap: 10 * k }}>
          <Text style={[txt, soft]}>сфотографуй чек цілком і рівно. я виберу з нього продукти, а ти перевіриш перед додаванням.</Text>
          <Pressable onPress={() => read('camera')} accessibilityRole="button" style={({ pressed }) => [pill, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={[s.pillT, { fontSize: 24 * k }]}>сфотографувати</Text>
          </Pressable>
          <Pressable onPress={() => read('library')} accessibilityRole="button" style={({ pressed }) => [s.pill, s.ghost, { height: 52 * k, borderColor: t.textSoft, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={[s.pillT, { fontSize: 24 * k, color: t.text }]}>вибрати з галереї</Text>
          </Pressable>
          <Text style={[txt, soft, { fontSize: 14 * k, lineHeight: 17 * k }]}>фото чека надсилається на розпізнавання і не зберігається. ми не гарантуємо, що всі рядки прочитаються правильно.</Text>
        </View>
      )}

      {mode.at === 'reading' && (
        <View style={{ alignItems: 'center', gap: 12 * k, paddingVertical: 30 * k }}>
          <ActivityIndicator color={t.text} size="large" />
          <Text style={[txt, soft]}>читаю чек...</Text>
        </View>
      )}

      {mode.at === 'failed' && (
        <View style={{ gap: 12 * k }}>
          <Text style={txt}>{mode.why}</Text>
          <Pressable onPress={() => setMode({ at: 'pick' })} accessibilityRole="button" style={pill}>
            <Text style={[s.pillT, { fontSize: 24 * k }]}>спробувати ще</Text>
          </Pressable>
        </View>
      )}

      {mode.at === 'list' && (
        <>
          <Text style={[txt, soft, { fontSize: 18 * k }]}>зніми галочку з того, що не треба класти в холодильник</Text>
          <ScrollView style={{ maxHeight: 380 * k, marginTop: 8 * k }} showsVerticalScrollIndicator={false}>
            {mode.items.map((x, i) => (
              <Pressable
                key={i}
                onPress={() => setMode({ ...mode, items: mode.items.map((y, j) => (j === i ? { ...y, on: !y.on } : y)) })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: x.on }}
                style={{ flexDirection: 'row', gap: 10 * k, paddingVertical: 5 * k, opacity: x.on ? 1 : 0.45 }}
              >
                <Text style={[txt, { width: 20 * k }]}>{x.on ? '✓' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={txt}>{x.name}</Text>
                  <Text style={[txt, soft, { fontSize: 15 * k, lineHeight: 17 * k }]} numberOfLines={1}>
                    {x.line}
                  </Text>
                </View>
                <Text style={txt}>{fmtQty(x.qty, x.unit)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={add} accessibilityRole="button" style={({ pressed }) => [pill, { marginTop: 12 * k, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <Text style={[s.pillT, { fontSize: 24 * k }]}>додати {mode.items.filter((x) => x.on).length} у холодильник</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 1, backgroundColor: 'transparent' },
  pillT: { fontFamily: fontMedium, color: '#FFFFFF' },
});
