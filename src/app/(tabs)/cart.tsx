import { Pressable, Text, View } from 'react-native';
import { Page } from '../../components/Page';
import { useScale } from '../../components/scale';
import { useStore } from '../../components/store';
import { byId, sortPlan } from '../../data';
import { titleStyle, useTheme } from '../../theme';

// Shopping list for the week's plan; ticks are remembered per dish.
export default function Cart() {
  const k = useScale();
  const t = useTheme();
  const { checked, toggleChecked, plan } = useStore();
  const txt = { fontFamily: t.font, fontSize: 20 * k, lineHeight: 26 * k, color: t.text };
  const ids = Array.from(new Set(sortPlan(plan).map((p) => p.recipe)));

  return (
    <Page>
      <Text style={[titleStyle(t, 28 * k), { marginBottom: 8 * k }]}>список покупок</Text>
      {ids.map((id) => {
        const r = byId(id)!;
        const got = checked[id] ?? [];
        return (
          <View key={id} style={{ marginTop: 14 * k }}>
            <Text style={[txt, { opacity: 0.6 }]}>{r.name.toLowerCase()}</Text>
            {r.ing.map(([qty, name], i) => {
              const on = got.includes(i);
              return (
                <Pressable key={i} onPress={() => toggleChecked(id, i)} style={{ flexDirection: 'row', gap: 10 * k }}>
                  <Text style={[txt, { width: 18 * k }]}>{on ? '✓' : '○'}</Text>
                  <Text style={[txt, { flex: 1 }, on && { opacity: 0.45, textDecorationLine: 'line-through' }]}>
                    {qty ? `${qty} ` : ''}
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Page>
  );
}
