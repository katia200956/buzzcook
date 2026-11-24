import { DAYS, PlanItem, Recipe } from '.';
import { expiryLabel, FridgeItem, INGREDIENTS, needsOf } from './pantry';
import { dishCostLeft, savedPerPortion } from './prices';
import { Pick } from './recommend';

// Dinners for the week inside a budget, built for one person:
// - a dish that makes two or more portions covers tonight and tomorrow (cook once, eat twice);
// - dishes that share ingredients go together, so a pack bought on Monday is used up by Friday;
// - what is at home, above all what spoils soon, pulls its dishes in and costs nothing extra.
export const DINNER = 'Вечеря';
const MAIN = new Set(['Вечеря', 'Обід']);

export type WeekOptions = {
  budget: number; // hryvnias for the week's shopping
  maxTime: number; // minutes per dish, 0 = no limit
  fridge: FridgeItem[];
  fromDay?: number; // 0 = Monday; days before it have passed and stay empty
};

export type Week = { plan: PlanItem[]; cost: number; saved: number; dinners: number; fromFridge: string[] };

const weighed = (id: string) => needsOf(id).filter(([key]) => INGREDIENTS[key] && INGREDIENTS[key].unit !== 'є').map(([key]) => key);

// Ingredients at home that spoil within three days.
const spoiling = (fridge: FridgeItem[]) =>
  new Set(fridge.filter((f) => f.key && (expiryLabel(f.expires)?.days ?? 99) <= 3).map((f) => f.key!));

// `ranked` is the recommender's order for this person (already filtered by diet and allergies).
export function makeWeek(ranked: Pick[], o: WeekOptions): Week {
  const soon = spoiling(o.fridge);
  const pool = ranked.filter(({ r }) => MAIN.has(r.cat) && (!o.maxTime || r.total <= o.maxTime) && needsOf(r.id).length);
  const plan: PlanItem[] = [];
  const used = new Set<string>(); // ingredients already bought for earlier dinners
  const picked = new Set<string>();
  const fromFridge = new Set<string>();
  let cost = 0;
  let saved = 0;
  let day = o.fromDay ?? 0;

  while (day < DAYS.length) {
    const left = o.budget - cost;
    const daysLeft = DAYS.length - day;
    let best: { r: Recipe; score: number; price: number; days: number } | undefined;
    for (const { r, score } of pool) {
      if (picked.has(r.id)) continue;
      const days = Math.min(r.serv >= 2 ? 2 : 1, daysLeft);
      // Ingredients already on the list cost (roughly) nothing more.
      const keys = weighed(r.id);
      const shared = keys.filter((k) => used.has(k)).length;
      const share = keys.length ? shared / keys.length : 0;
      const price = dishCostLeft(r.id, o.fridge) * (1 - share * 0.5);
      if (price > left) continue;
      const rescue = keys.filter((k) => soon.has(k)).length;
      // Cheaper per dinner than the budget allows is better; sharing and rescuing food is better still.
      const s = score + share * 2 + rescue * 3 - (price / days) / (o.budget / DAYS.length);
      if (!best || s > best.score) best = { r, score: s, price, days };
    }
    if (!best) break;
    picked.add(best.r.id);
    for (const k of weighed(best.r.id)) {
      if (soon.has(k)) fromFridge.add(INGREDIENTS[k].name);
      used.add(k);
    }
    cost += best.price;
    for (let i = 0; i < best.days; i++) {
      plan.push({ day: DAYS[day + i], meal: DINNER, recipe: best.r.id });
      saved += savedPerPortion(best.r.id);
    }
    day += best.days;
  }

  return { plan, cost: Math.round(cost), saved: Math.round(saved), dinners: plan.length, fromFridge: [...fromFridge] };
}

export const BUDGETS = [400, 600, 800, 1000, 1500];
export const TIMES: [number, string][] = [
  [20, 'до 20 хв'],
  [40, 'до 40 хв'],
  [0, 'без різниці'],
];
