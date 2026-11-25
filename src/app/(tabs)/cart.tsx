import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, LayoutAnimation, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Glass } from '../../components/Glass';
import { Page } from '../../components/Page';
import { ReceiptSheet } from '../../components/Receipt';
import { Scanner } from '../../components/Scanner';
import { Sheet } from '../../components/Sheet';
import { useScale } from '../../components/scale';
import { useStore } from '../../components/store';
import { dayKey } from '../../data';
import { expiryLabel, FridgeItem, fmtQty, guessKey, INGREDIENTS, Section, SECTIONS, ShopItem, Unit } from '../../data/pantry';
import { uah } from '../../data/prices';
import { itemKcal, itemPrice, shareText, totals } from '../../data/shoplist';
import { font, fontMedium, sage, useTheme } from '../../theme';

const white = '#FFFFFF';
const warn = '#E0803C';
const buzz = () => Haptics.selectionAsync().catch(() => {});
const ease = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
// 1 продукт, 3 продукти, 5 продуктів, 21 продукт.
const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'продукт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'продукти' : 'продуктів');
const secOf = (x: FridgeItem): Section => (x.key ? INGREDIENTS[x.key].sec : 'інше');

// "Холодильник" tab: what is at home, and the shopping list counted from the week plan minus the fridge.
export default function Fridge() {
  const k = useScale();
  const t = useTheme();
  const [tab, setTab] = useState<'fridge' | 'shop'>('fridge');
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };

  return (
    <Page>
      <View style={{ flexDirection: 'row', gap: 8 * k, marginBottom: 18 * k }}>
        {(
          [
            ['fridge', 'холодильник'],
            ['shop', 'покупки'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => {
              buzz();
              setTab(id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
          >
            <Glass radius={100} strong={tab === id} style={{ paddingHorizontal: 16 * k, height: 36 * k, justifyContent: 'center' }}>
              <Text style={[txt, { opacity: tab === id ? 1 : 0.6 }, tab === id && { fontFamily: fontMedium }]}>{label}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>
      {tab === 'fridge' ? <FridgeList /> : <ShopList />}
    </Page>
  );
}

// Sage pill for the main action; `ghost` is the frosted glass pill used for the second one.
function Button({ label, onPress, ghost }: { label: string; onPress: () => void; ghost?: boolean }) {
  const k = useScale();
  const t = useTheme();
  const body = { height: 44 * k, paddingHorizontal: 18 * k, alignItems: 'center' as const, justifyContent: 'center' as const };
  const text = <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: ghost ? t.text : white }}>{label}</Text>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
      {ghost ? (
        <Glass radius={100} style={body}>
          {text}
        </Glass>
      ) : (
        <View style={[s.pill, body, { backgroundColor: sage }]}>{text}</View>
      )}
    </Pressable>
  );
}

function FridgeList() {
  const k = useScale();
  const t = useTheme();
  const { fridge, addFridge, premium, showPaywall } = useStore();
  const [edit, setEdit] = useState<FridgeItem | 'new' | null>(null);
  const [scan, setScan] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };

  const byExpiry = (a: FridgeItem, b: FridgeItem) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999') || a.name.localeCompare(b.name, 'uk');
  const soon = fridge.filter((x) => expiryLabel(x.expires)?.soon).sort(byExpiry);
  const rest = fridge.filter((x) => !soon.includes(x));
  const groups: [string, FridgeItem[]][] = [
    ['скоро зіпсується', soon],
    ...SECTIONS.map((sec): [string, FridgeItem[]] => [sec, rest.filter((x) => secOf(x) === sec).sort(byExpiry)]),
  ];

  return (
    <>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k }]}>холодильник</Text>
      <Text style={[txt, { opacity: 0.6 }]}>
        {fridge.length ? `${fridge.length} ${plural(fridge.length)}${soon.length ? ` · ${soon.length} скоро зіпсується` : ''}` : 'поки порожньо'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 12 * k }}>
        <Button label="+ додати" onPress={() => setEdit('new')} />
        <Button label="▥ штрихкод" ghost onPress={() => setScan(true)} />
        <Button label="чек" ghost onPress={() => (premium ? setReceipt(true) : showPaywall(true))} />
      </View>

      {!fridge.length && (
        <Text style={[txt, { opacity: 0.6, marginTop: 16 * k }]}>тут буде все, що є вдома. постав галочку в покупках, і продукт з’явиться тут сам.</Text>
      )}

      {groups.map(([title, list]) =>
        list.length ? (
          <View key={title} style={{ marginTop: 18 * k }}>
            <Text style={[txt, { opacity: 0.6, marginBottom: 2 * k }, title === 'скоро зіпсується' && { color: warn, opacity: 1 }]}>{title}</Text>
            {list.map((x) => {
              const exp = expiryLabel(x.expires);
              return (
                <Pressable
                  key={x.id}
                  onPress={() => setEdit(x)}
                  accessibilityRole="button"
                  accessibilityLabel={`${x.name}, змінити`}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 10 * k, paddingVertical: 4 * k, opacity: pressed ? 0.5 : 1 })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={txt}>{x.name.toLowerCase()}</Text>
                    {exp && <Text style={[txt, { fontSize: 16 * k, lineHeight: 18 * k }, exp.soon ? { color: warn } : { opacity: 0.6 }]}>{exp.text}</Text>}
                  </View>
                  <Text style={[txt, { opacity: 0.8 }]}>{fmtQty(x.qty, x.unit) || 'є'}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null,
      )}

      <ItemSheet item={edit} onClose={() => setEdit(null)} />
      <ReceiptSheet open={receipt} onClose={() => setReceipt(false)} />
      <Scanner
        open={scan}
        onClose={() => setScan(false)}
        onAdd={(x, grams) => {
          setScan(false);
          const item = { key: guessKey(x.name), name: x.name, qty: grams, unit: 'г' as Unit };
          const id = addFridge(item);
          // Ask for the expiry date right away; iOS can't show the sheet while the camera is sliding away.
          setTimeout(() => setEdit({ ...item, id }), 450);
        }}
      />
    </>
  );
}

const UNITS: [Unit, string][] = [
  ['г', 'г'],
  ['мл', 'мл'],
  ['шт', 'шт'],
  ['є', 'без кількості'],
];
const EXPIRY: [number | null, string][] = [
  [null, 'без дати'],
  [1, 'завтра'],
  [3, '3 дні'],
  [7, 'тиждень'],
  [14, '2 тижні'],
  [30, 'місяць'],
];
const inDays = (n: number) => {
  const d = new Date();
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

// Add a product by hand, or change one: amount, unit and when it goes off.
function ItemSheet({ item, onClose }: { item: FridgeItem | 'new' | null; onClose: () => void }) {
  const k = useScale();
  const t = useTheme();
  const { addFridge, updateFridge, removeFridge } = useStore();
  const [v, setV] = useState({ name: '', qty: '', unit: 'г' as Unit, expires: undefined as string | undefined, key: undefined as string | undefined });
  const [last, setLast] = useState<FridgeItem | 'new' | null>(null);
  const [was, setWas] = useState(false);
  if (item && !was) {
    setWas(true);
    setLast(item);
    setV(item === 'new' ? { name: '', qty: '', unit: 'г', expires: undefined, key: undefined } : { name: item.name, qty: item.unit === 'є' ? '' : String(Math.round(item.qty * 10) / 10), unit: item.unit, expires: item.expires, key: item.key });
  }
  if (!item && was) setWas(false);
  const cur = item ?? last;
  if (!cur) return null;
  const isNew = cur === 'new';

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k };
  const input = [txt, group, { paddingHorizontal: 16 * k, height: 48 * k, outlineStyle: 'none' } as any];
  const chip = (on: boolean) => [s.chip, { height: 34 * k, paddingHorizontal: 14 * k, backgroundColor: on ? sage : 'transparent', borderColor: on ? sage : t.textSoft }];
  const chipT = (on: boolean) => [txt, { fontSize: 18 * k }, on && { color: white, fontFamily: fontMedium }];

  const qty = Number(v.qty.replace(',', '.'));
  const valid = v.name.trim() !== '' && (v.unit === 'є' || (Number.isFinite(qty) && qty > 0));
  const q = v.name.trim().toLowerCase();
  const hints = isNew && q && !v.key ? Object.entries(INGREDIENTS).filter(([, x]) => x.name.includes(q) && x.name !== q).slice(0, 4) : [];
  const exp = expiryLabel(v.expires);

  const save = () => {
    const data = { key: v.key ?? guessKey(v.name), name: v.name.trim(), qty: v.unit === 'є' ? 1 : qty, unit: v.unit, expires: v.expires };
    ease();
    if (isNew) addFridge(data);
    else updateFridge(cur.id, data);
    buzz();
    onClose();
  };

  return (
    <Sheet open={!!item} onClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k, marginBottom: 10 * k }]}>{isNew ? 'додати в холодильник' : v.name.toLowerCase()}</Text>

        {isNew && (
          <>
            <TextInput
              value={v.name}
              onChangeText={(name) => setV({ ...v, name, key: undefined })}
              placeholder="що це? напр. авокадо"
              placeholderTextColor={t.textSoft}
              autoCorrect={false}
              accessibilityLabel="Назва продукту"
              style={input}
            />
            {hints.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 * k, marginTop: 8 * k }}>
                {hints.map(([key, x]) => (
                  <Pressable key={key} onPress={() => setV({ ...v, name: x.name, key, unit: x.unit })} accessibilityRole="button" style={chip(false)}>
                    <Text style={chipT(false)}>{x.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={[txt, { color: t.textSoft, fontSize: 18 * k, marginTop: 14 * k, marginBottom: 6 * k }]}>скільки</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 * k }}>
          {v.unit !== 'є' && (
            <TextInput
              value={v.qty}
              onChangeText={(x) => setV({ ...v, qty: x })}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={t.textSoft}
              selectTextOnFocus
              accessibilityLabel="Кількість"
              style={[...input, { width: 96 * k, height: 40 * k }]}
            />
          )}
          {UNITS.map(([u, label]) => (
            <Pressable key={u} onPress={() => setV({ ...v, unit: u })} accessibilityRole="radio" accessibilityState={{ selected: v.unit === u }} style={chip(v.unit === u)}>
              <Text style={chipT(v.unit === u)}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[txt, { color: t.textSoft, fontSize: 18 * k, marginTop: 14 * k, marginBottom: 6 * k }]}>
          придатний {exp ? `· ${exp.text}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 * k }}>
          {EXPIRY.map(([n, label]) => {
            const on = n === null ? !v.expires : v.expires === inDays(n);
            return (
              <Pressable key={label} onPress={() => setV({ ...v, expires: n === null ? undefined : inDays(n) })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={chip(on)}>
                <Text style={chipT(on)}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={save}
          disabled={!valid}
          accessibilityRole="button"
          style={({ pressed }) => [s.pill, { height: 54 * k, marginTop: 18 * k, backgroundColor: sage, opacity: valid ? 1 : 0.4, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Text style={{ fontFamily: fontMedium, fontSize: 26 * k, color: white }}>{isNew ? 'додати' : 'зберегти'}</Text>
        </Pressable>
        {!isNew && (
          <Pressable
            onPress={() => {
              ease();
              removeFridge(cur.id);
              onClose();
            }}
            accessibilityRole="button"
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: 14 * k }}
          >
            <Text style={[txt, { color: t.textSoft }]}>закінчилось, прибрати</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </Sheet>
  );
}

function ShopList() {
  const k = useScale();
  const t = useTheme();
  const { shop, makeList, toggleShop, addShop, removeShop, premium, showPaywall } = useStore();
  const [week, setWeek] = useState<0 | 1>(0);
  const [typed, setTyped] = useState('');
  const [receipt, setReceipt] = useState(false);
  const sum = totals(shop);
  const share = () => {
    buzz();
    // The system share sheet lists Telegram, Viber, WhatsApp, Messages and the rest.
    Share.share({ message: shareText(shop) }).catch(() => {});
  };
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 26 * k, color: t.text };
  const left = shop.filter((x) => !x.done).length;
  const bought = shop.length - left;

  const groups = SECTIONS.map((sec): [Section, ShopItem[]] => [sec, shop.filter((x) => x.sec === sec)]).filter(([, l]) => l.length);
  const chip = (on: boolean) => [s.chip, { height: 32 * k, paddingHorizontal: 12 * k, backgroundColor: on ? sage : 'transparent', borderColor: on ? sage : t.textSoft }];

  return (
    <>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k }]}>список покупок</Text>
      <Text style={[txt, { opacity: 0.6 }]}>{shop.length ? `купити ${left}${bought ? ` · куплено ${bought}` : ''}` : 'порахую все для плану тижня'}</Text>

      <View style={{ flexDirection: 'row', gap: 6 * k, marginTop: 12 * k }}>
        {(
          [
            [0, 'цей тиждень'],
            [1, 'наступний'],
          ] as const
        ).map(([w, label]) => (
          <Pressable key={w} onPress={() => setWeek(w)} accessibilityRole="radio" accessibilityState={{ selected: week === w }} style={chip(week === w)}>
            <Text style={[txt, { fontSize: 18 * k }, week === w && { color: white, fontFamily: fontMedium }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 10 * k }}>
        <Button
          label={shop.some((x) => x.key) ? 'перерахувати' : 'згенерувати список'}
          onPress={() => {
            ease();
            makeList(week);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
        />
      </View>
      <Text style={[txt, { fontSize: 16 * k, lineHeight: 19 * k, opacity: 0.6, marginTop: 6 * k }]}>
        страви, які ще попереду, мінус те, що вже є в холодильнику
      </Text>

      {shop.length > 0 && (
        <Glass radius={22} style={{ marginTop: 16 * k, padding: 16 * k, gap: 4 * k }}>
          <Text style={[txt, { opacity: 0.6, fontSize: 18 * k }]}>{sum.left < sum.all ? 'залишилось купити' : 'тиждень обійдеться'}</Text>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 34 * k, lineHeight: 38 * k }]}>~{uah(sum.left)}</Text>
          {sum.left < sum.all && <Text style={[txt, { fontSize: 16 * k, opacity: 0.6 }]}>увесь список ~{uah(sum.all)}</Text>}
          {premium ? (
            sum.kcal > 0 && <Text style={[txt, { fontSize: 16 * k, opacity: 0.6 }]}>у списку ~{Math.round(sum.kcal).toLocaleString('uk-UA')} ккал</Text>
          ) : (
            <Pressable onPress={() => showPaywall(true)} accessibilityRole="button" hitSlop={6}>
              <Text style={[txt, { fontSize: 16 * k, color: sage }]}>калорійність продуктів · Buzzcook+</Text>
            </Pressable>
          )}
          {sum.unpriced > 0 && (
            <Text style={[txt, { fontSize: 14 * k, lineHeight: 17 * k, opacity: 0.5 }]}>без спецій, олії й того, що дописано вручну</Text>
          )}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 * k, marginTop: 8 * k }}>
            <Button label="поділитися" onPress={share} />
            <Button label={premium ? 'сфоткати чек' : 'чек · Buzzcook+'} ghost onPress={() => (premium ? setReceipt(true) : showPaywall(true))} />
          </View>
        </Glass>
      )}

      {groups.map(([sec, list]) => (
        <View key={sec} style={{ marginTop: 18 * k }}>
          <Text style={[txt, { opacity: 0.6 }]}>{sec}</Text>
          {list.map((x) => (
            <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
              <Pressable
                onPress={() => {
                  buzz();
                  toggleShop(x.id);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: x.done }}
                accessibilityLabel={x.name}
                style={{ flex: 1, flexDirection: 'row', gap: 10 * k, paddingVertical: 3 * k }}
              >
                <Text style={[txt, { width: 18 * k }]}>{x.done ? '✓' : '○'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[txt, x.done && { opacity: 0.45, textDecorationLine: 'line-through' }]}>{x.name.toLowerCase()}</Text>
                  {premium && itemKcal(x) !== null && (
                    <Text style={[txt, { fontSize: 14 * k, lineHeight: 17 * k, opacity: 0.5 }]}>~{itemKcal(x)} ккал</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[txt, { opacity: x.done ? 0.45 : 0.8 }]}>{fmtQty(x.qty, x.unit)}</Text>
                  {itemPrice(x) !== null && (
                    <Text style={[txt, { fontSize: 15 * k, lineHeight: 18 * k, opacity: x.done ? 0.35 : 0.55 }]}>~{uah(itemPrice(x)!)}</Text>
                  )}
                </View>
              </Pressable>
              {!x.key && !x.done && (
                <Pressable onPress={() => removeShop(x.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Видалити: ${x.name}`}>
                  <Text style={[txt, { opacity: 0.6 }]}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      ))}

      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder="+ додати своє"
        placeholderTextColor={t.textSoft}
        returnKeyType="done"
        accessibilityLabel="Додати в список"
        onSubmitEditing={() => {
          if (!typed.trim()) return;
          ease();
          addShop(typed.trim());
          setTyped('');
        }}
        style={[txt, { marginTop: 18 * k, height: 40 * k, outlineStyle: 'none' } as any]}
      />
      {bought > 0 && <Text style={[txt, { fontSize: 16 * k, opacity: 0.6, marginTop: 6 * k }]}>куплене вже в холодильнику</Text>}
      <ReceiptSheet open={receipt} onClose={() => setReceipt(false)} />
    </>
  );
}

const s = StyleSheet.create({
  pill: { borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
