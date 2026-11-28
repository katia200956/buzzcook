import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { font, fontMedium, useTheme } from '../theme';
import { useScale } from './scale';
import { Sheet } from './Sheet';

// The open fridge from the "Розробити холодильник" prototype: an empty fridge photo with metal trim,
// every product its own cut-out layer standing in a slot. Tap a product to set how much is left,
// remove it, or swap it for one of yours from the catalog; a "+" on a free slot puts a product there.
// Demo data, kept on the phone between launches; "повернути як було" resets it.

const W = 880;
const H = 1168;
const KEY = 'buzzcook-fridge-stage-v1';
const DAY = 864e5;
const OK = '#4FC27A';
const LOW = '#F2C14E';
const NONE = '#EF5B52';
const ink = '#111111';

const SPRITE: Record<string, number> = {
  apples: require("../../assets/fridge/sp/apples.webp"),
  avocado: require("../../assets/fridge/sp/avocado.webp"),
  bananas: require("../../assets/fridge/sp/bananas.webp"),
  beets: require("../../assets/fridge/sp/beets.webp"),
  berries: require("../../assets/fridge/sp/berries.webp"),
  broccoli: require("../../assets/fridge/sp/broccoli.webp"),
  butter: require("../../assets/fridge/sp/butter.webp"),
  cabbage: require("../../assets/fridge/sp/cabbage.webp"),
  carrot: require("../../assets/fridge/sp/carrot.webp"),
  cheese: require("../../assets/fridge/sp/cheese.webp"),
  chicken: require("../../assets/fridge/sp/chicken.webp"),
  cucumber: require("../../assets/fridge/sp/cucumber.webp"),
  dill: require("../../assets/fridge/sp/dill.webp"),
  eggs: require("../../assets/fridge/sp/eggs.webp"),
  fish: require("../../assets/fridge/sp/fish.webp"),
  garlic: require("../../assets/fridge/sp/garlic.webp"),
  greenonion: require("../../assets/fridge/sp/greenonion.webp"),
  ham: require("../../assets/fridge/sp/ham.webp"),
  hotdogs: require("../../assets/fridge/sp/hotdogs.webp"),
  icecream: require("../../assets/fridge/sp/icecream.webp"),
  icetray: require("../../assets/fridge/sp/icetray.webp"),
  juice: require("../../assets/fridge/sp/juice.webp"),
  kefir: require("../../assets/fridge/sp/kefir.webp"),
  ketchup: require("../../assets/fridge/sp/ketchup.webp"),
  lemon: require("../../assets/fridge/sp/lemon.webp"),
  mayo: require("../../assets/fridge/sp/mayo.webp"),
  milk: require("../../assets/fridge/sp/milk.webp"),
  mince: require("../../assets/fridge/sp/mince.webp"),
  mushrooms: require("../../assets/fridge/sp/mushrooms.webp"),
  mustard: require("../../assets/fridge/sp/mustard.webp"),
  oil: require("../../assets/fridge/sp/oil.webp"),
  onion: require("../../assets/fridge/sp/onion.webp"),
  peas: require("../../assets/fridge/sp/peas.webp"),
  pelmeni: require("../../assets/fridge/sp/pelmeni.webp"),
  pepper: require("../../assets/fridge/sp/pepper.webp"),
  potato: require("../../assets/fridge/sp/potato.webp"),
  sausage: require("../../assets/fridge/sp/sausage.webp"),
  sourcream: require("../../assets/fridge/sp/sourcream.webp"),
  tomato: require("../../assets/fridge/sp/tomato.webp"),
  tvorog: require("../../assets/fridge/sp/tvorog.webp"),
  varenyky: require("../../assets/fridge/sp/varenyky.webp"),
  water: require("../../assets/fridge/sp/water.webp"),
  yogurt: require("../../assets/fridge/sp/yogurt.webp"),
};
const EMPTY = require('../../assets/fridge/empty.webp');

type Box = [number, number, number, number];
const SLOTS: Record<string, Box> = {
  eggs: [141, 211, 176, 98], milk: [345, 159, 56, 147], butter: [411, 248, 133, 56], cheese: [129, 356, 90, 81], chicken: [219, 371, 158, 68],
  sourcream: [383, 351, 76, 86], yogurt: [467, 376, 50, 61], tomato: [129, 463, 128, 88], cucumber: [253, 493, 128, 58], dill: [369, 453, 150, 98],
  lemon: [483, 493, 64, 58], carrot: [136, 581, 145, 90], onion: [279, 581, 134, 88], potato: [401, 569, 138, 100], oil: [585, 297, 62, 192],
  mustard: [637, 414, 60, 77], kefir: [706, 337, 55, 160], peas: [133, 753, 132, 116], varenyky: [271, 753, 140, 116], berries: [416, 768, 123, 101],
  fish: [129, 904, 186, 103], icecream: [319, 901, 94, 110], door1: [600, 150, 150, 80], door2: [600, 530, 150, 95],
};
const ICETRAY: Box = [423, 909, 114, 96];
const inFreezer = (slot: string) => SLOTS[slot][1] > 720;

type Cat = { n: string; s: string; q: number | null; u: string; step: number; d: number };
const CAT: Record<string, Cat> = {
  eggs: { n: 'яйця', s: 'молочне й яйця', q: 10, u: 'шт', step: 1, d: 18 },
  milk: { n: 'молоко', s: 'молочне й яйця', q: 1, u: 'л', step: 0.5, d: 5 },
  butter: { n: 'вершкове масло', s: 'молочне й яйця', q: 180, u: 'г', step: 20, d: 20 },
  cheese: { n: 'твердий сир', s: 'молочне й яйця', q: 250, u: 'г', step: 50, d: 12 },
  chicken: { n: 'куряче філе', s: 'м’ясо й риба', q: 600, u: 'г', step: 100, d: 2 },
  sourcream: { n: 'сметана', s: 'молочне й яйця', q: 300, u: 'г', step: 50, d: 5 },
  yogurt: { n: 'грецький йогурт', s: 'молочне й яйця', q: 2, u: 'шт', step: 1, d: 6 },
  tomato: { n: 'помідори', s: 'овочі й фрукти', q: 3, u: 'шт', step: 1, d: 5 },
  cucumber: { n: 'огірки', s: 'овочі й фрукти', q: 2, u: 'шт', step: 1, d: 5 },
  dill: { n: 'кріп', s: 'зелень, соуси, спеції', q: 1, u: 'пучок', step: 1, d: 4 },
  lemon: { n: 'лимон', s: 'овочі й фрукти', q: 1, u: 'шт', step: 0.5, d: 14 },
  carrot: { n: 'морква', s: 'овочі й фрукти', q: 500, u: 'г', step: 100, d: 21 },
  onion: { n: 'цибуля', s: 'овочі й фрукти', q: 4, u: 'шт', step: 1, d: 30 },
  potato: { n: 'картопля', s: 'овочі й фрукти', q: 1.5, u: 'кг', step: 0.5, d: 30 },
  oil: { n: 'соняшникова олія', s: 'зелень, соуси, спеції', q: 1, u: 'л', step: 0.25, d: 180 },
  mustard: { n: 'гірчиця', s: 'зелень, соуси, спеції', q: null, u: '', step: 0, d: 60 },
  kefir: { n: 'кефір', s: 'молочне й яйця', q: 900, u: 'мл', step: 100, d: 5 },
  peas: { n: 'зелений горошок', s: 'морозилка', q: 400, u: 'г', step: 100, d: 240 },
  varenyky: { n: 'вареники з картоплею', s: 'морозилка', q: 12, u: 'шт', step: 2, d: 60 },
  berries: { n: 'ягідна суміш', s: 'морозилка', q: 300, u: 'г', step: 100, d: 240 },
  fish: { n: 'філе хека', s: 'морозилка', q: 500, u: 'г', step: 100, d: 90 },
  icecream: { n: 'пломбір', s: 'морозилка', q: 1, u: 'шт', step: 1, d: 120 },
  sausage: { n: 'варена ковбаса', s: 'м’ясо й риба', q: 500, u: 'г', step: 100, d: 7 },
  hotdogs: { n: 'сосиски', s: 'м’ясо й риба', q: 6, u: 'шт', step: 1, d: 10 },
  tvorog: { n: 'кисломолочний сир', s: 'молочне й яйця', q: 400, u: 'г', step: 100, d: 5 },
  apples: { n: 'яблука', s: 'овочі й фрукти', q: 4, u: 'шт', step: 1, d: 21 },
  bananas: { n: 'банани', s: 'овочі й фрукти', q: 5, u: 'шт', step: 1, d: 5 },
  beets: { n: 'буряк', s: 'овочі й фрукти', q: 3, u: 'шт', step: 1, d: 30 },
  cabbage: { n: 'капуста', s: 'овочі й фрукти', q: 1, u: 'шт', step: 1, d: 30 },
  pepper: { n: 'болгарський перець', s: 'овочі й фрукти', q: 2, u: 'шт', step: 1, d: 7 },
  garlic: { n: 'часник', s: 'зелень, соуси, спеції', q: 1, u: 'головка', step: 1, d: 60 },
  mushrooms: { n: 'печериці', s: 'овочі й фрукти', q: 300, u: 'г', step: 100, d: 4 },
  mayo: { n: 'майонез', s: 'зелень, соуси, спеції', q: 300, u: 'г', step: 50, d: 30 },
  ketchup: { n: 'кетчуп', s: 'зелень, соуси, спеції', q: 350, u: 'г', step: 50, d: 60 },
  mince: { n: 'фарш', s: 'м’ясо й риба', q: 500, u: 'г', step: 100, d: 2 },
  ham: { n: 'шинка', s: 'м’ясо й риба', q: 200, u: 'г', step: 50, d: 5 },
  juice: { n: 'апельсиновий сік', s: 'інше', q: 1, u: 'л', step: 0.5, d: 7 },
  pelmeni: { n: 'пельмені', s: 'морозилка', q: 800, u: 'г', step: 100, d: 90 },
  avocado: { n: 'авокадо', s: 'овочі й фрукти', q: 2, u: 'шт', step: 1, d: 4 },
  broccoli: { n: 'броколі', s: 'овочі й фрукти', q: 400, u: 'г', step: 100, d: 6 },
  greenonion: { n: 'зелена цибуля', s: 'зелень, соуси, спеції', q: 1, u: 'пучок', step: 1, d: 5 },
  water: { n: 'вода', s: 'інше', q: 1.5, u: 'л', step: 0.5, d: 180 },
};
// Natural size of the catalog cut-outs, to scale them into someone else's slot.
const SIZE: Record<string, [number, number]> = {
  sausage: [170, 150], hotdogs: [175, 149], tvorog: [161, 166], apples: [165, 172], bananas: [176, 183], beets: [164, 180], cabbage: [158, 171],
  pepper: [169, 188], garlic: [131, 154], mushrooms: [176, 160], mayo: [101, 223], ketchup: [98, 219], mince: [175, 155], ham: [175, 159],
  juice: [106, 230], pelmeni: [174, 197], avocado: [158, 146], broccoli: [166, 192], greenonion: [171, 227], water: [85, 233],
};
const sizeOf = (key: string): [number, number] => SIZE[key] ?? (SLOTS[key] ? [SLOTS[key][2], SLOTS[key][3]] : [150, 150]);

type St = 'ok' | 'low' | 'none';
type Item = { id: number; slot: string; key: string; st: St; q: number | null; exp: number; manual?: boolean };
const COLOR: Record<St, string> = { ok: OK, low: LOW, none: NONE };
const ST: Record<St, string> = { ok: 'є', low: 'мало', none: 'немає' };

const START: [string, St, number | null, number][] = [
  ['eggs', 'ok', 10, 18], ['milk', 'low', 0.25, 3], ['butter', 'ok', 180, 20], ['cheese', 'ok', 250, 12], ['chicken', 'ok', 600, 1],
  ['sourcream', 'low', 80, 4], ['yogurt', 'ok', 2, 6], ['tomato', 'ok', 3, 2], ['cucumber', 'ok', 2, 5], ['dill', 'low', 1, 3],
  ['lemon', 'ok', 0.5, 7], ['carrot', 'ok', 500, 21], ['onion', 'ok', 4, 30], ['potato', 'ok', 1.5, 30], ['oil', 'low', 0.25, 180],
  ['mustard', 'ok', null, 60], ['kefir', 'ok', 900, 5], ['peas', 'ok', 400, 240], ['varenyky', 'low', 6, 60], ['berries', 'ok', 300, 240],
  ['fish', 'ok', 500, 90], ['icecream', 'ok', 1, 120],
];
const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const startItems = (): Item[] => START.map(([key, st, q, d], i) => ({ id: i + 1, slot: key, key, st, q, exp: today() + d * DAY }));

const daysLeft = (it: Item) => Math.round((it.exp - today()) / DAY);
const soon = (it: Item) => it.st !== 'none' && daysLeft(it) <= 2;
const expText = (it: Item) => {
  const d = daysLeft(it);
  return d < 0 ? 'прострочено' : d === 0 ? 'сьогодні останній день' : d === 1 ? 'до завтра' : d <= 4 ? `ще ${d} дні` : d >= 60 ? `ще ~${Math.round(d / 30)} міс.` : `ще ${d} дн.`;
};
const fmt = (it: Item) => (it.q == null ? 'є' : `${String(it.q).replace('.', ',')} ${CAT[it.key].u}`);
const buzz = () => Haptics.selectionAsync().catch(() => {});

// Where a product stands on the photo: its own slot fits exactly, anything else is scaled in, standing on the shelf.
function boxOf(it: Item): Box {
  const r = SLOTS[it.slot];
  if (it.key === it.slot) return r;
  const [cw, ch] = sizeOf(it.key);
  const s = Math.min((r[2] * 1.1) / cw, (r[3] * 1.15) / ch);
  const w = cw * s;
  const h = ch * s;
  return [r[0] + r[2] / 2 - w / 2, r[1] + r[3] - h, w, h];
}

export function FridgeStage() {
  const k = useScale();
  const t = useTheme();
  const [items, setItems] = useState<Item[]>(startItems);
  const [ready, setReady] = useState(false);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [picker, setPicker] = useState<string | null>(null); // slot to fill, or '' for "first free one"
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => s && setItems(JSON.parse(s)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => {});
  }, [items, ready]);

  const have = items.filter((it) => it.st !== 'none');
  const freeSlots = Object.keys(SLOTS).filter((s) => !items.some((it) => it.slot === s && it.st !== 'none'));
  const late = have.filter(soon);
  const current = items.find((it) => it.id === open) ?? null;
  const patch = (id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id));
  const put = (slot: string, key: string) => {
    const c = CAT[key];
    setItems((xs) => [...xs.filter((x) => !(x.slot === slot && x.st === 'none')), { id: Date.now(), slot, key, st: 'ok', q: c.q, exp: today() + c.d * DAY }]);
  };

  const scale = width / W;
  const at = (b: Box) => ({ position: 'absolute' as const, left: b[0] * scale, top: b[1] * scale, width: b[2] * scale, height: b[3] * scale });

  return (
    <View style={{ marginTop: 16 * k }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[txt, { opacity: 0.7 }]}>
          {have.length} на полицях{late.length ? ` · ` : ''}
          {late.length ? <Text style={{ color: LOW }}>{late.length} скоро зіпсу{late.length === 1 ? 'ється' : 'ються'}</Text> : null}
        </Text>
        <Pressable onPress={() => setPicker('')} accessibilityRole="button" style={({ pressed }) => ({ borderWidth: 1, borderColor: t.text, borderRadius: 999, paddingHorizontal: 12 * k, paddingVertical: 4 * k, opacity: pressed ? 0.5 : 1 })}>
          <Text style={[txt, { fontSize: 18 * k }]}>+ свій продукт</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 14 * k, marginTop: 6 * k }}>
        {(['ok', 'low', 'none'] as St[]).map((s) => (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 * k }}>
            <View style={{ width: 9 * k, height: 9 * k, borderRadius: 5 * k, backgroundColor: COLOR[s] }} />
            <Text style={[txt, { fontSize: 16 * k, opacity: 0.7 }]}>{ST[s]}</Text>
          </View>
        ))}
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: W / H, marginTop: 10 * k, borderRadius: 18 * k, overflow: 'hidden', backgroundColor: '#1a1a1a' }}>
        {width > 0 && (
          <>
            <Image source={EMPTY} style={{ position: 'absolute', left: 0, top: 0, width, height: (width * H) / W }} contentFit="cover" accessibilityLabel="Відкритий холодильник з металевою окантовкою" />
            <Image source={SPRITE.icetray} style={at(ICETRAY)} contentFit="contain" />
            {have.map((it) => {
              const b = boxOf(it);
              return (
                <Pressable key={it.id} onPress={() => (buzz(), setOpen(it.id))} accessibilityRole="button" accessibilityLabel={`${CAT[it.key].n}: ${ST[it.st]}, ${fmt(it)}`} style={at(b)}>
                  <Image source={SPRITE[it.key]} style={{ width: '100%', height: '100%' }} contentFit="contain" contentPosition="bottom" />
                </Pressable>
              );
            })}
            {have.map((it) => {
              const b = boxOf(it);
              const d = 12 * k;
              return (
                <View
                  key={`p${it.id}`}
                  pointerEvents="none"
                  style={{ position: 'absolute', left: (b[0] + b[2] / 2) * scale - d / 2, top: (b[1] + b[3] * 0.45) * scale - d / 2, width: d, height: d, borderRadius: d, backgroundColor: COLOR[it.st], borderWidth: 2, borderColor: '#fff', ...(soon(it) ? { shadowColor: LOW, shadowOpacity: 1, shadowRadius: 6 } : null) }}
                />
              );
            })}
            {freeSlots.map((s) => {
              const r = SLOTS[s];
              const d = 30 * k;
              return (
                <Pressable
                  key={`s${s}`}
                  onPress={() => (buzz(), setPicker(s))}
                  accessibilityRole="button"
                  accessibilityLabel="поставити свій продукт сюди"
                  style={{ position: 'absolute', left: (r[0] + r[2] / 2) * scale - d / 2, top: (r[1] + r[3] / 2) * scale - d / 2, width: d, height: d, borderRadius: d, borderWidth: 2, borderStyle: 'dashed', borderColor: '#8d8d8b', backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: fontMedium, fontSize: 20 * k, color: '#3a3a3c', lineHeight: 22 * k }}>+</Text>
                </Pressable>
              );
            })}
          </>
        )}
      </View>
      <Text style={[txt, { fontSize: 16 * k, lineHeight: 19 * k, opacity: 0.6, textAlign: 'center', marginTop: 6 * k }]}>
        торкнись продукту: скільки лишилось, прибрати або замінити на свій. «+» ставить продукт на вільне місце.
      </Text>
      <Pressable onPress={() => (setItems(startItems()), setOpen(null))} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: 4 * k }}>
        <Text style={[txt, { fontSize: 16 * k, opacity: 0.6, textDecorationLine: 'underline' }]}>повернути як було</Text>
      </Pressable>

      <ItemSheet
        item={current}
        onClose={() => setOpen(null)}
        onPatch={(p) => current && patch(current.id, p)}
        onRemove={() => current && (remove(current.id), setOpen(null))}
        onSwap={() => {
          if (!current) return;
          const slot = current.slot;
          remove(current.id);
          setOpen(null);
          setTimeout(() => setPicker(slot), 300);
        }}
      />
      <Picker
        slot={picker}
        freeSlots={freeSlots}
        taken={have.map((x) => x.key)}
        onClose={() => setPicker(null)}
        onPick={(slot, key) => {
          put(slot, key);
          setPicker(null);
        }}
      />
    </View>
  );
}

function Btn({ label, onPress, main, danger }: { label: string; onPress: () => void; main?: boolean; danger?: boolean }) {
  const k = useScale();
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, height: 48 * k, borderRadius: 14 * k, borderWidth: 1, borderColor: main ? t.text : 'rgba(127,127,127,0.4)', backgroundColor: main ? t.text : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ fontFamily: fontMedium, fontSize: 20 * k, color: main ? (t.text === '#FFFFFF' ? ink : '#FFFFFF') : danger ? NONE : t.text }}>{label}</Text>
    </Pressable>
  );
}

function Tile({ k: key, size, ring }: { k: string; size: number; ring?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: '#F1F1EF', padding: size * 0.11, borderWidth: ring ? 2 : 0, borderColor: ring }}>
      <Image source={SPRITE[key]} style={{ width: '100%', height: '100%' }} contentFit="contain" />
    </View>
  );
}

function ItemSheet({ item, onClose, onPatch, onRemove, onSwap }: { item: Item | null; onClose: () => void; onPatch: (p: Partial<Item>) => void; onRemove: () => void; onSwap: () => void }) {
  const k = useScale();
  const t = useTheme();
  const [last, setLast] = useState<Item | null>(item);
  // Keep the last item while the sheet slides away, so it does not go blank mid-animation.
  if (item && item !== last) setLast(item);
  const it = item ?? last;
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };
  if (!it) return null;
  const c = CAT[it.key];
  const step = (dir: number) => {
    if (it.q == null) return;
    const q = Math.max(0, Math.round((it.q + dir * c.step) * 100) / 100);
    buzz();
    onPatch(q === 0 ? { q, st: 'none' } : { q });
  };
  const shift = (days: number) => onPatch({ exp: it.exp + days * DAY, manual: true });
  return (
    <Sheet open={!!item} onClose={onClose}>
      <View style={{ gap: 14 * k }}>
        <View style={{ flexDirection: 'row', gap: 14 * k, alignItems: 'center' }}>
          <Tile k={it.key} size={60 * k} ring={COLOR[it.st]} />
          <View>
            <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k }]}>{c.n}</Text>
            <Text style={[txt, { opacity: 0.6, fontSize: 17 * k }]}>{inFreezer(it.slot) ? 'морозилка' : c.s}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 * k }}>
          {(['ok', 'low', 'none'] as St[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => (buzz(), onPatch({ st: s }))}
              accessibilityRole="button"
              accessibilityState={{ selected: it.st === s }}
              style={{ flex: 1, height: 42 * k, borderRadius: 12 * k, borderWidth: 1, borderColor: it.st === s ? COLOR[s] : 'rgba(127,127,127,0.4)', flexDirection: 'row', gap: 6 * k, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{ width: 9 * k, height: 9 * k, borderRadius: 5 * k, backgroundColor: COLOR[s] }} />
              <Text style={[txt, { opacity: it.st === s ? 1 : 0.6 }]}>{ST[s]}</Text>
            </Pressable>
          ))}
        </View>
        {it.q != null && it.st !== 'none' && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[txt, { opacity: 0.6 }]}>скільки</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
              <Round label="−" onPress={() => step(-1)} />
              <Text style={[txt, { fontFamily: fontMedium, minWidth: 70 * k, textAlign: 'center' }]}>{fmt(it)}</Text>
              <Round label="+" onPress={() => step(1)} />
            </View>
          </View>
        )}
        {it.st !== 'none' && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[txt, { opacity: 0.6 }]}>термін</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k }}>
              <Round label="−" onPress={() => shift(-1)} />
              <Text style={[txt, { fontFamily: fontMedium, minWidth: 110 * k, textAlign: 'center' }, soon(it) && { color: LOW }]}>{expText(it)}</Text>
              <Round label="+" onPress={() => shift(1)} />
            </View>
          </View>
        )}
        <Text style={[txt, { fontSize: 16 * k, opacity: 0.55 }]}>
          {it.manual ? 'термін змінено вручну' : `типовий термін для «${c.n}»: ${c.d >= 60 ? `~${Math.round(c.d / 30)} міс.` : `${c.d} дн.`} від покупки`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 * k }}>
          <Btn label="замінити на свій" onPress={onSwap} />
          <Btn label="прибрати" danger onPress={onRemove} />
        </View>
        <Btn label="готово" main onPress={onClose} />
      </View>
    </Sheet>
  );
}

function Round({ label, onPress }: { label: string; onPress: () => void }) {
  const k = useScale();
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label === '+' ? 'більше' : 'менше'} style={({ pressed }) => ({ width: 36 * k, height: 36 * k, borderRadius: 18 * k, borderWidth: 1, borderColor: 'rgba(127,127,127,0.5)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: t.text, lineHeight: 24 * k }}>{label}</Text>
    </Pressable>
  );
}

function Picker({ slot, freeSlots, taken, onClose, onPick }: { slot: string | null; freeSlots: string[]; taken: string[]; onClose: () => void; onPick: (slot: string, key: string) => void }) {
  const k = useScale();
  const t = useTheme();
  const [q, setQ] = useState('');
  const target = slot === '' ? freeSlots[0] : slot;
  const freezer = target ? inFreezer(target) : false;
  const keys = useMemo(
    () =>
      Object.keys(CAT)
        .filter((x) => !taken.includes(x))
        .sort((a, b) => Number((CAT[b].s === 'морозилка') === freezer) - Number((CAT[a].s === 'морозилка') === freezer) || CAT[a].n.localeCompare(CAT[b].n, 'uk')),
    [taken, freezer],
  );
  const shown = keys.filter((x) => !q.trim() || CAT[x].n.includes(q.trim().toLowerCase()));
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };
  const tile = 70 * k;
  return (
    <Sheet open={slot !== null} onClose={() => (setQ(''), onClose())}>
      {!target ? (
        <View style={{ gap: 12 * k }}>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k }]}>немає вільного місця</Text>
          <Text style={[txt, { opacity: 0.6 }]}>прибери або заміни якийсь продукт, і на його місці з’явиться «+».</Text>
          <Btn label="зрозуміло" main onPress={onClose} />
        </View>
      ) : (
        <View style={{ gap: 12 * k }}>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k }]}>що в тебе є?</Text>
          <Text style={[txt, { opacity: 0.6, fontSize: 17 * k }]}>{freezer ? 'місце в морозилці' : 'місце в холодильнику'} · вибери продукт, і він стане сюди з типовим терміном</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="пошук: ковбаса, сир, яблука…"
            placeholderTextColor="rgba(127,127,127,0.8)"
            autoCorrect={false}
            style={{ fontFamily: font, fontSize: 20 * k, color: t.text, borderWidth: 1, borderColor: 'rgba(127,127,127,0.4)', borderRadius: 12 * k, paddingHorizontal: 12 * k, height: 44 * k }}
          />
          <ScrollView style={{ maxHeight: 360 * k }} keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 * k }}>
              {shown.map((x) => (
                <Pressable key={x} onPress={() => (buzz(), setQ(''), onPick(target, x))} accessibilityRole="button" style={({ pressed }) => ({ width: tile, alignItems: 'center', gap: 4 * k, opacity: pressed ? 0.5 : 1 })}>
                  <Tile k={x} size={tile} />
                  <Text numberOfLines={2} style={[txt, { fontSize: 15 * k, lineHeight: 16 * k, textAlign: 'center' }]}>{CAT[x].n}</Text>
                </Pressable>
              ))}
              {!shown.length && <Text style={[txt, { opacity: 0.6 }]}>такого поки немає в каталозі.</Text>}
            </View>
          </ScrollView>
          <Btn label="скасувати" onPress={() => (setQ(''), onClose())} />
        </View>
      )}
    </Sheet>
  );
}
