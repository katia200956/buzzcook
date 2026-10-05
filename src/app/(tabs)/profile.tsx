import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Glass } from '../../components/Glass';
import { Page } from '../../components/Page';
import { Plate } from '../../components/Plate';
import { useScale } from '../../components/scale';
import { ThemeMode, useStore } from '../../components/store';
import { byId } from '../../data';
import { font, fontMedium, useTheme } from '../../theme';

const themes: [ThemeMode, string][] = [
  ['system', 'авто'],
  ['light', 'світла'],
  ['dark', 'темна'],
];

export default function Profile() {
  const k = useScale();
  const t = useTheme();
  const { saved, themeMode, setThemeMode } = useStore();
  const txt = { fontFamily: font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };
  const list = saved.map(byId).filter((r) => !!r);

  return (
    <Page>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k }]}>профіль</Text>

      <Text style={[txt, { opacity: 0.6, marginTop: 20 * k, marginBottom: 8 * k }]}>тема</Text>
      <View style={{ flexDirection: 'row', gap: 8 * k }}>
        {themes.map(([m, label]) => (
          <Pressable key={m} onPress={() => setThemeMode(m)}>
            <Glass radius={100} strong={themeMode === m} style={{ paddingHorizontal: 16 * k, height: 34 * k, justifyContent: 'center', opacity: themeMode === m ? 1 : 0.55 }}>
              <Text style={txt}>{label}</Text>
            </Glass>
          </Pressable>
        ))}
      </View>

      <Text style={[txt, { opacity: 0.6, marginTop: 24 * k, marginBottom: 8 * k }]}>збережені страви</Text>
      {list.length === 0 && <Text style={txt}>поки порожньо. на сторінці страви натисни «зберегти».</Text>}
      {list.map((r) => (
        <Pressable key={r!.id} onPress={() => router.push(`/recipe/${r!.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, marginBottom: 10 * k }}>
          <Plate recipe={r!} size={56 * k} />
          <Text style={[txt, { flex: 1 }]}>{r!.name}</Text>
        </Pressable>
      ))}
    </Page>
  );
}
