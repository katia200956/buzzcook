import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { byId, DAYS, dayKey, MEALS, weekDates, weekKey } from '../data';
import { buildList, haveOf, needOf, slotId } from '../data/pantry';
import { uah } from '../data/prices';
import { DEFAULT_MEAL_TIMES, hhmm } from '../data/profile';
import { useStore } from './store';

// Three kinds of local notifications (they work in Expo Go too), each its own message:
// - before every planned meal, an hour or an hour and a half ahead (the person picks), naming the dish;
//   a tap opens the recipe with everything it needs;
// - at 17:00, what to buy for tomorrow's meals that is not at home; a tap opens the shopping list;
// - on Sunday at 19:00, what the week saved.
// Everything is rescheduled whenever the plan, fridge, meal times or savings change, so the texts stay true.
const ON = Platform.OS !== 'web';
const TAG = 'buzzcook';
const SHOP_HOUR = 17;
const DAYS_AHEAD = 7; // iOS keeps at most 64 scheduled; 7 days × (3 meals + 1) + 1 stays well under

if (ON) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

export async function askReminders() {
  if (!ON) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function cancelOurs() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith(TAG)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

const at = (d: Date, minutes: number) => {
  const x = new Date(d);
  x.setHours(0, minutes, 0, 0);
  return x;
};
const dayName = (d: Date) => DAYS[(d.getDay() + 6) % 7];
const MEAL_WORD: Record<string, string> = { Сніданок: 'сніданок', Обід: 'обід', Вечеря: 'вечеря' };
const leadWords = (m: number) => (m === 90 ? 'півтори години' : m === 60 ? 'годину' : `${m} хв`);

// "Через годину вечеря: паста з куркою" / body says when to start so it is ready on time.
export function mealText(meal: string, recipe: { name: string; total: number }, mealAt: number, lead: number) {
  const startAt = mealAt - recipe.total;
  return {
    title: `Через ${leadWords(lead)} ${MEAL_WORD[meal] ?? meal.toLowerCase()}: ${recipe.name.toLowerCase()}`,
    body: `${recipe.total} хв. Почни о ${hhmm(Math.max(0, startAt))}, щоб встигнути до ${hhmm(mealAt)}. Що треба, є в рецепті.`,
  };
}

// "Купи на завтра: сметана, яйця, кріп" or nothing when everything is at home.
export function shopText(names: string[]) {
  const shown = names.slice(0, 4).join(', ');
  const more = names.length > 4 ? ` і ще ${names.length - 4}` : '';
  return { title: 'Купи на завтра', body: `${shown}${more}. Відкрий список, там кількість.` };
}

export function useReminders() {
  const { ready, remind, planOf, plans, cooked, fridge, savings, savedSince, profile } = useStore();
  const times = { ...DEFAULT_MEAL_TIMES, ...profile.mealTimes };
  const lead = profile.lead || 60;

  useEffect(() => {
    if (!ON || !ready) return;
    const timer = setTimeout(async () => {
      try {
        await cancelOurs();
        if (!remind) return;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayMeals = (d: Date) => {
          const w = weekKey(0, d);
          const done = cooked[w] ?? [];
          return planOf(w).filter((p) => p.day === dayName(d) && !done.includes(slotId(p)) && byId(p.recipe));
        };

        for (let i = 0; i <= DAYS_AHEAD; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);

          // Before each meal of this day.
          for (const p of dayMeals(d)) {
            const r = byId(p.recipe)!;
            const mealAt = times[p.meal] ?? DEFAULT_MEAL_TIMES.Вечеря;
            const when = at(d, mealAt - lead);
            if (when <= now) continue;
            await Notifications.scheduleNotificationAsync({
              identifier: `${TAG}-meal-${dayKey(d)}-${MEALS.indexOf(p.meal)}`,
              content: { ...mealText(p.meal, r, mealAt, lead), data: { url: `/recipe/${r.id}` } },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
            });
          }

          // At 17:00, what tomorrow's meals still need.
          const shopAt = at(d, SHOP_HOUR * 60);
          if (shopAt <= now || i === DAYS_AHEAD) continue;
          const next = new Date(d);
          next.setDate(next.getDate() + 1);
          const missing = buildList(needOf(dayMeals(next)), (key) => haveOf(fridge, key)).map((x) => x.name.toLowerCase());
          if (missing.length === 0) continue;
          await Notifications.scheduleNotificationAsync({
            identifier: `${TAG}-shop-${dayKey(d)}`,
            content: { ...shopText(missing), data: { url: '/cart' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: shopAt },
          });
        }

        const dates = weekDates(0);
        const sunday = at(dates[6], 19 * 60);
        if (sunday > now) {
          const { saved, dinners } = savedSince(at(dates[0], 0).getTime());
          await Notifications.scheduleNotificationAsync({
            identifier: `${TAG}-week`,
            content: {
              title: 'Підсумок тижня',
              body: dinners
                ? `${dinners} вечер${dinners === 1 ? 'я' : dinners < 5 ? 'і' : 'ь'} вдома замість доставки: ${uah(saved)} зекономлено.`
                : 'Цього тижня ще жодної вечері вдома. Подивись план на наступний.',
              data: { url: '/plan' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: sunday },
          });
        }
      } catch {
        // Notifications are a nicety; never break the app over them.
      }
    }, 800);
    return () => clearTimeout(timer);
    // planOf reads plans and savedSince reads savings, both listed; times are listed by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, remind, plans, cooked, fridge, savings, times.Сніданок, times.Обід, times.Вечеря, lead]);
}

// Opens the screen a tapped reminder points to.
export function useReminderTaps(open: (url: string) => void) {
  useEffect(() => {
    if (!ON) return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const url = r.notification.request.content.data?.url;
      if (typeof url === 'string') open(url);
    });
    return () => sub.remove();
  }, [open]);
}
