import { Text, View } from 'react-native';
import { weekStart } from '../data';
import { currentPlace, uah } from '../data/prices';
import { font, fontMedium, sage, useTheme } from '../theme';
import { Glass } from './Glass';
import { useScale } from './scale';
import { useStore } from './store';

// The money counter: dinners cooked at home this week instead of eaten out, and what that saved.
// This is the number people come back for, so it sits on the profile and after every dinner.
export function SavingsCard({ compact }: { compact?: boolean }) {
  const k = useScale();
  const t = useTheme();
  const { savedSince } = useStore();
  const week = savedSince(weekStart(0).getTime());
  const all = savedSince(0);
  const txt = { fontFamily: font, color: t.text };
  return (
    <Glass radius={15} style={{ padding: 16 * k }}>
      <Text style={[txt, { fontSize: 18 * k, color: t.textSoft }]}>зекономлено цього тижня</Text>
      <Text style={[txt, { fontFamily: fontMedium, fontSize: 40 * k, lineHeight: 44 * k, color: sage }]}>{uah(week.saved)}</Text>
      <Text style={[txt, { fontSize: 19 * k }]}>
        {week.dinners ? `${week.dinners} вечер${week.dinners === 1 ? 'я' : week.dinners < 5 ? 'і' : 'ь'} вдома ${currentPlace().instead}` : 'приготуй вечерю з плану, і тут з’явиться перша сума'}
      </Text>
      {!compact && all.saved > week.saved && (
        <View style={{ marginTop: 6 * k }}>
          <Text style={[txt, { fontSize: 18 * k, color: t.textSoft }]}>за весь час: {uah(all.saved)}</Text>
        </View>
      )}
    </Glass>
  );
}
