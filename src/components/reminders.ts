import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { byId, DAYS, weekDates, weekKey } from '../data';
import { haveOf, INGREDIENTS, needsOf, slotId } from '../data/pantry';
import { currentPlace, uah } from '../data/prices';
import { DINNER } from '../data/weekplan';
import { useStore } from './store';

// One reminder a day at 17:00, when people start thinking about ordering delivery, naming
// tonight's dinner; and a Sunday 19:00 summary of what the week saved. Local notifications only
// (they work in Expo Go too). Everything is rescheduled whenever the plan, fridge or savings change,
// so the texts stay true.
const ON = Platform.OS !== 'web';
const TAG = 'buzzcook';

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

const at = (d: Date, h: number) => {
  const x = new Date(d);
  x.setHours(h, 0, 0, 0);
  return x;
};

export function useReminders() {
  const { ready, remind, plan, cooked, fridge, savings, savedSince } = useStore();
  const w = weekKey(0);
  const done = cooked[w];

  useEffect(() => {
    if (!ON || !ready) return;
    const timer = setTimeout(async () => {
      try {
        await cancelOurs();
        if (!remind) return;
        const now = new Date();
        const dates = weekDates(0);
        for (let i = 0; i < DAYS.length; i++) {
          const when = at(dates[i], 17);
          if (when <= now) continue;
          const p = plan.find((x) => x.day === DAYS[i] && x.meal === DINNER) ?? plan.find((x) => x.day === DAYS[i]);
          const r = p && byId(p.recipe);
          if (!p || !r || (done ?? []).includes(slotId(p))) continue;
          const missing = needsOf(r.id).filter(([key, n]) => INGREDIENTS[key] && INGREDIENTS[key].unit !== 'є' && haveOf(fridge, key) < n - 0.01).length;
          await Notifications.scheduleNotificationAsync({
            identifier: `${TAG}-day-${i}`,
            content: {
              title: `Сьогодні в плані: ${r.name.toLowerCase()}`,
              body: `${r.total} хв. ${missing ? `Треба докупити ${missing} ${missing === 1 ? 'продукт' : 'продукти'}.` : 'Усе є в холодильнику.'}`,
              data: { url: `/recipe/${r.id}` },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
          });
        }
        const sunday = at(dates[6], 19);
        if (sunday > now) {
          const { saved, dinners } = savedSince(at(dates[0], 0).getTime());
          await Notifications.scheduleNotificationAsync({
            identifier: `${TAG}-week`,
            content: {
              title: 'Підсумок тижня',
              body: dinners
                ? `${dinners} вечер${dinners === 1 ? 'я' : dinners < 5 ? 'і' : 'ь'} вдома ${currentPlace().instead}: ${uah(saved)} зекономлено.`
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
    // savedSince reads savings, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, remind, plan, done, fridge, savings, w]);
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
