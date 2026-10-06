import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Glass } from '../../components/Glass';
import { Page } from '../../components/Page';
import { useScale } from '../../components/scale';
import { useStore } from '../../components/store';
import { byId } from '../../data';
import { titleStyle, useTheme } from '../../theme';

// Figma "recipe process": the cooking steps you have already done.
export default function Process() {
  const k = useScale();
  const t = useTheme();
  const { current, done } = useStore();
  const r = current ? byId(current) : undefined;
  const txt = { fontFamily: t.font, fontSize: 20 * k, lineHeight: 24 * k, color: t.text };

  if (!r?.steps) {
    return (
      <Page>
        <Text style={txt}>тут з’являться етапи готовки, які ти вже зробив.</Text>
        <Text style={[txt, { opacity: 0.6, marginTop: 12 * k }]}>обери страву на головній і натисни «старт».</Text>
      </Page>
    );
  }

  const n = done[r.id] ?? 0;
  const finished = n >= r.steps.length;

  return (
    <Page>
      <Text style={titleStyle(t, 28 * k)}>{r.name}</Text>
      <Text style={[txt, { opacity: 0.6, marginBottom: 16 * k }]}>
        {finished ? 'готово, смачного!' : `зроблено ${n} з ${r.steps.length}`}
      </Text>
      {r.steps.map((st, i) => {
        const isDone = i < n;
        const isNow = i === n;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12 * k, marginBottom: 12 * k, opacity: isDone || isNow ? 1 : 0.45 }}>
            <Text style={[txt, { width: 24 * k }]}>{isDone ? '✓' : String(i + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[txt, isDone && { textDecorationLine: 'line-through' }]}>{st.title.toLowerCase()}</Text>
              {isNow && <Text style={[txt, { opacity: 0.6 }]}>≈ {st.min} хв</Text>}
            </View>
          </View>
        );
      })}
      {!finished && (
        <Pressable onPress={() => router.push(`/cook/${r.id}`)} style={{ alignSelf: 'flex-start', marginTop: 12 * k }}>
          <Glass radius={100} style={{ paddingHorizontal: 22 * k, height: 44 * k, justifyContent: 'center' }}>
            <Text style={{ fontFamily: t.font, fontSize: 28 * k, color: t.poster ? t.text : '#FFFFFF' }}>продовжити</Text>
          </Glass>
        </Pressable>
      )}
    </Page>
  );
}
