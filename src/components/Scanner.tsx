import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { canSendToOFF, lookupBarcode, sendToOFF } from '../data/barcode';
import { addShared, hasShared, lookupShared } from '../data/shared';
import type { Food } from '../data/foods';
import { font, fontMedium, ForceDark, sage } from '../theme';
import { Amount } from './Amount';
import { useScale } from './scale';
import { useStore } from './store';

const white = '#FFFFFF';
const soft = 'rgba(255,255,255,0.65)';
const field = 'rgba(255,255,255,0.1)';

type Sent = 'sending' | 'sent' | 'failed' | undefined;
type Mode = { at: 'scan' } | { at: 'amount'; x: Food; sent?: Sent } | { at: 'loading'; code: string } | { at: 'missing'; code: string } | { at: 'offline'; code: string };

// Full-screen barcode scanner for the calorie diary. A scanned code is looked up in Open Food Facts;
// a product it doesn't know is typed in from the label once and remembered on the phone.
// The grams are chosen right here, so the diary gets the finished entry in one step.
export function Scanner({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (x: Food, grams: number) => void }) {
  const k = useScale();
  const insets = useSafeAreaInsets();
  const { products, saveProduct } = useStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>({ at: 'scan' });
  const [typed, setTyped] = useState('');
  const busy = useRef(false);
  const [was, setWas] = useState(false);
  if (open && !was) {
    setWas(true);
    setMode({ at: 'scan' });
    setTyped('');
  }
  if (!open && was) setWas(false);

  const found = (x: Food) => {
    saveProduct(x);
    setMode({ at: 'amount', x });
  };

  // A product typed in from the label: keep it on the phone and share it with everyone
  // through our Supabase list and/or Open Food Facts, whichever is set up in .env.local.
  const typedIn = (code: string, x: Food) => {
    saveProduct(x);
    const sends = [hasShared && addShared(code, x), canSendToOFF && sendToOFF(code, x)].filter((p): p is Promise<void> => !!p);
    if (!sends.length) return setMode({ at: 'amount', x });
    setMode({ at: 'amount', x, sent: 'sending' });
    Promise.allSettled(sends).then((rs) => {
      const sent: Sent = rs.some((r) => r.status === 'fulfilled') ? 'sent' : 'failed';
      setMode((m) => (m.at === 'amount' && m.x.id === x.id ? { ...m, sent } : m));
    });
  };

  const check = async (raw: string) => {
    const code = raw.replace(/\D/g, '');
    if (busy.current || code.length < 8) return;
    busy.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // Scanned before (or typed in by hand): no need to ask the internet again.
    const known = products[`bc:${code}`];
    if (known) {
      busy.current = false;
      return found(known);
    }
    setMode({ at: 'loading', code });
    try {
      // Our own list first (products Buzzcook users typed in), then Open Food Facts.
      const x = (await lookupShared(code).catch(() => null)) ?? (await lookupBarcode(code));
      if (x) found(x);
      else setMode({ at: 'missing', code });
    } catch {
      setMode({ at: 'offline', code });
    } finally {
      busy.current = false;
    }
  };

  const txt = { fontFamily: font, color: white };
  const pill = [s.pill, { height: 52 * k, paddingHorizontal: 22 * k }];

  return (
    <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top + 10 * k, paddingBottom: insets.bottom + 16 * k }]}>
        <View style={[s.row, { paddingHorizontal: 18 * k, marginBottom: 12 * k }]}>
          <Text style={[txt, { flex: 1, fontFamily: fontMedium, fontSize: 30 * k }]}>сканувати штрихкод</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Закрити сканер">
            <Text style={[txt, { fontSize: 26 * k }]}>✕</Text>
          </Pressable>
        </View>

        {mode.at === 'scan' && (
          <>
            <View style={[s.frame, { marginHorizontal: 18 * k, borderRadius: 24 * k }]}>
              {permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={(r) => check(r.data)}
                />
              ) : (
                <View style={[s.center, { padding: 24 * k, gap: 14 * k }]}>
                  <Text style={[txt, { fontSize: 21 * k, lineHeight: 25 * k, textAlign: 'center' }]}>
                    {permission && !permission.canAskAgain
                      ? 'доступ до камери вимкнено. увімкни його в налаштуваннях телефону або введи код нижче.'
                      : 'потрібен доступ до камери, щоб читати штрихкоди'}
                  </Text>
                  {(!permission || permission.canAskAgain) && (
                    <Pressable onPress={requestPermission} accessibilityRole="button" style={pill}>
                      <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k }]}>дозволити камеру</Text>
                    </Pressable>
                  )}
                </View>
              )}
              {permission?.granted && <View pointerEvents="none" style={[s.aim, { left: '12%', right: '12%', height: 120 * k, borderRadius: 16 * k }]} />}
            </View>
            <Text style={[txt, { color: soft, fontSize: 18 * k, textAlign: 'center', marginTop: 10 * k }]}>наведи камеру на штрихкод на упаковці</Text>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={[s.row, { gap: 8 * k, paddingHorizontal: 18 * k, marginTop: 14 * k }]}>
                <TextInput
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="або введи код вручну"
                  placeholderTextColor={soft}
                  keyboardType="number-pad"
                  accessibilityLabel="Код штрихкоду"
                  onSubmitEditing={() => check(typed)}
                  style={[txt, s.input, { flex: 1, height: 48 * k, fontSize: 20 * k, paddingHorizontal: 16 * k, borderRadius: 14 * k }] as any}
                />
                <Pressable onPress={() => check(typed)} accessibilityRole="button" style={[s.pill, { height: 48 * k, paddingHorizontal: 18 * k }]}>
                  <Text style={[txt, { fontFamily: fontMedium, fontSize: 20 * k }]}>знайти</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </>
        )}

        {mode.at === 'loading' && (
          <View style={[s.center, { flex: 1, gap: 12 * k }]}>
            <ActivityIndicator color={white} size="large" />
            <Text style={[txt, { fontSize: 20 * k, color: soft }]}>шукаю {mode.code}...</Text>
          </View>
        )}

        {mode.at === 'offline' && (
          <View style={[s.center, { flex: 1, gap: 14 * k, paddingHorizontal: 24 * k }]}>
            <Text style={[txt, { fontSize: 22 * k, lineHeight: 26 * k, textAlign: 'center' }]}>не вдалося з’єднатися з базою продуктів. перевір інтернет.</Text>
            <Pressable onPress={() => check(mode.code)} accessibilityRole="button" style={pill}>
              <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k }]}>спробувати ще</Text>
            </Pressable>
            <Pressable onPress={() => setMode({ at: 'missing', code: mode.code })} accessibilityRole="button" hitSlop={8}>
              <Text style={[txt, { fontSize: 19 * k, color: soft }]}>ввести з етикетки</Text>
            </Pressable>
          </View>
        )}

        {mode.at === 'amount' && (
          <ForceDark.Provider value>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18 * k, paddingTop: 8 * k }} keyboardShouldPersistTaps="handled">
              {mode.sent && (
                <Text style={[txt, { fontSize: 17 * k, color: mode.sent === 'failed' ? '#F2A65A' : soft, marginBottom: 6 * k }]}>
                  {mode.sent === 'sending' && 'надсилаю в спільну базу...'}
                  {mode.sent === 'sent' && '✓ додано в спільну базу, тепер його знайде кожен'}
                  {mode.sent === 'failed' && 'не вдалося надіслати в спільну базу. на телефоні продукт збережено.'}
                </Text>
              )}
              <Amount key={mode.x.id} pick={{ kind: 'food', x: mode.x }} onAdd={(g) => onAdd(mode.x, g)} onBack={() => setMode({ at: 'scan' })} backLabel="сканувати інший" />
            </ScrollView>
          </ForceDark.Provider>
        )}

        {mode.at === 'missing' && <LabelForm code={mode.code} onSave={(x) => typedIn(mode.code, x)} onRescan={() => setMode({ at: 'scan' })} />}
      </View>
    </Modal>
  );
}

// Open Food Facts doesn't know this code: take the numbers from the "на 100 г" table on the pack.
function LabelForm({ code, onSave, onRescan }: { code: string; onSave: (x: Food) => void; onRescan: () => void }) {
  const k = useScale();
  const [v, setV] = useState({ name: '', kcal: '', p: '', f: '', c: '' });
  const n = (x: string) => Number(x.replace(',', '.'));
  const opt = (x: string) => (x.trim() === '' ? 0 : n(x));
  const valid = v.name.trim() !== '' && n(v.kcal) > 0 && n(v.kcal) < 1000 && [v.p, v.f, v.c].every((x) => Number.isFinite(opt(x)) && opt(x) >= 0);
  const txt = { fontFamily: font, color: white };
  const input = [txt, s.input, { height: 48 * k, fontSize: 20 * k, paddingHorizontal: 16 * k, borderRadius: 14 * k }] as any;

  const rows: [keyof typeof v, string][] = [
    ['kcal', 'ккал'],
    ['p', 'білки, г'],
    ['f', 'жири, г'],
    ['c', 'вуглеводи, г'],
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18 * k, gap: 10 * k, paddingBottom: 20 * k }} keyboardShouldPersistTaps="handled">
        <Text style={[txt, { fontSize: 21 * k, lineHeight: 25 * k }]}>цього продукту ще немає в базі ({code}). введи дані з етикетки, на 100 г. я запам’ятаю їх.</Text>
        <TextInput value={v.name} onChangeText={(name) => setV({ ...v, name })} placeholder="назва" placeholderTextColor={soft} accessibilityLabel="Назва" style={input} />
        {rows.map(([key, label]) => (
          <View key={key} style={[s.row, { gap: 10 * k }]}>
            <Text style={[txt, { width: 130 * k, fontSize: 20 * k }]}>{label}</Text>
            <TextInput
              value={v[key]}
              onChangeText={(x) => setV({ ...v, [key]: x })}
              keyboardType="decimal-pad"
              placeholder={key === 'kcal' ? 'обов’язково' : '0'}
              placeholderTextColor={soft}
              accessibilityLabel={label}
              style={[...input, { flex: 1 }]}
            />
          </View>
        ))}
        <Pressable
          disabled={!valid}
          onPress={() =>
            onSave({ id: `bc:${code}`, name: v.name.trim(), cat: 'мої продукти', kcal: Math.round(n(v.kcal)), p: opt(v.p), f: opt(v.f), c: opt(v.c), portion: 100 })
          }
          accessibilityRole="button"
          style={[s.pill, { height: 52 * k, marginTop: 6 * k, opacity: valid ? 1 : 0.4 }]}
        >
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k }]}>зберегти продукт</Text>
        </Pressable>
        <Pressable onPress={onRescan} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center' }}>
          <Text style={[txt, { fontSize: 19 * k, color: soft }]}>сканувати інший</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, overflow: 'hidden', backgroundColor: '#161616', justifyContent: 'center' },
  aim: { position: 'absolute', alignSelf: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)' },
  pill: { borderRadius: 100, backgroundColor: sage, alignItems: 'center', justifyContent: 'center' },
  input: { backgroundColor: field, outlineStyle: 'none' } as any,
});
