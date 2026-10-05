import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { font, fontMedium, useTheme } from '../theme';
import { useScale } from './scale';
import { Sheet } from './Sheet';
import { ThemeMode, useStore } from './store';

const themes: [ThemeMode, string][] = [
  ['system', 'авто'],
  ['light', 'світла'],
  ['dark', 'темна'],
];

// Menu from the square header button, shown as an Apple-style sheet with grouped rows.
export function Menu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const k = useScale();
  const t = useTheme();
  const { themeMode, setThemeMode } = useStore();
  const go = (href: '/' | '/process' | '/cart' | '/profile') => {
    onClose();
    router.navigate(href);
  };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k, overflow: 'hidden' as const };
  const row = { paddingHorizontal: 16 * k, paddingVertical: 12 * k, flexDirection: 'row' as const, justifyContent: 'space-between' as const };
  const txt = { fontFamily: font, fontSize: 22 * k, color: t.text };
  const sep = { height: StyleSheet.hairlineWidth, backgroundColor: t.textSoft, marginLeft: 16 * k, opacity: 0.5 };
  const items: [string, '/' | '/process' | '/cart' | '/profile'][] = [
    ['стрічка страв', '/'],
    ['етапи готовки', '/process'],
    ['список покупок', '/cart'],
    ['профіль', '/profile'],
  ];

  return (
    <Sheet open={open} onClose={onClose}>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 30 * k, marginBottom: 14 * k }]}>меню</Text>
      <View style={group}>
        {items.map(([label, href], i) => (
          <View key={href}>
            {i > 0 && <View style={sep} />}
            <Pressable onPress={() => go(href)} style={({ pressed }) => [row, pressed && { opacity: 0.5 }]}>
              <Text style={txt}>{label}</Text>
              <Text style={[txt, { color: t.textSoft }]}>›</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={[txt, { fontSize: 16 * k, color: t.textSoft, marginTop: 22 * k, marginBottom: 8 * k, marginLeft: 16 * k }]}>ТЕМА</Text>
      <View style={[group, { flexDirection: 'row', padding: 3 * k }]}>
        {themes.map(([m, label]) => {
          const on = themeMode === m;
          return (
            <Pressable
              key={m}
              onPress={() => setThemeMode(m)}
              style={{
                flex: 1,
                paddingVertical: 7 * k,
                alignItems: 'center',
                borderRadius: 13 * k,
                backgroundColor: on ? (t.mode === 'dark' ? 'rgba(255,255,255,0.22)' : '#FFFFFF') : 'transparent',
                boxShadow: on ? '0px 2px 6px rgba(0,0,0,0.12)' : undefined,
              }}
            >
              <Text style={[txt, { fontSize: 19 * k }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
