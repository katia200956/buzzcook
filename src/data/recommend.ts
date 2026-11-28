import { Recipe } from '.';
import { FridgeItem, haveOf, INGREDIENTS, needsOf } from './pantry';
import { Profile } from './profile';

// What an ingredient rules out. Soy and teriyaki sauce carry wheat; granola often carries nuts.
type Flag = 'meat' | 'fish' | 'seafood' | 'egg' | 'milk' | 'gluten' | 'nuts' | 'sesame' | 'honey';
const FLAGS: Record<string, Flag[]> = {
  chicken: ['meat'],
  salmon: ['fish'],
  shrimp: ['seafood'],
  egg: ['egg'],
  feta: ['milk'],
  yogurt: ['milk'],
  cream: ['milk'],
  parmesan: ['milk'],
  butter: ['milk'],
  bread: ['gluten'],
  spaghetti: ['gluten'],
  granola: ['gluten', 'nuts'],
  soy: ['gluten'],
  teriyaki: ['gluten'],
  sesame: ['sesame'],
  tahini: ['sesame'],
  honey: ['honey'],
  cottage: ['milk'],
  sourcream: ['milk'],
  milk: ['milk'],
  chickenbreast: ['meat'],
  chickenmince: ['meat'],
  turkey: ['meat'],
  hake: ['fish'],
  tuna: ['fish'],
  flour: ['gluten'],
  bulgur: ['gluten'],
  lavash: ['gluten'],
  walnut: ['nuts'],
  peanutbutter: ['nuts'],
};

const flagsOf = (r: Recipe) => new Set(needsOf(r.id).flatMap(([key]) => FLAGS[key] ?? []));

// Diets and allergies are hard rules: a dish that breaks one never shows up.
export function allowed(r: Recipe, p: Profile) {
  const f = flagsOf(r);
  const no = new Set<Flag>();
  for (const d of p.diets) {
    if (d === 'veg') ['meat', 'fish', 'seafood'].forEach((x) => no.add(x as Flag));
    if (d === 'vegan') ['meat', 'fish', 'seafood', 'egg', 'milk', 'honey'].forEach((x) => no.add(x as Flag));
    if (d === 'pesc') no.add('meat');
    if (d === 'nogluten') no.add('gluten');
    if (d === 'nolactose') no.add('milk');
  }
  for (const a of p.allergies) no.add(a as Flag);
  return ![...no].some((x) => f.has(x));
}

// Everything the app has seen the person do. Nothing is asked: it's what they buy, cook, eat, keep and skip.
export type Signals = {
  liked: string[];
  saved: string[];
  cookLog: { id: string; at: number }[];
  eaten: string[]; // recipe ids from the calorie diary, one per entry
  skipped: Record<string, number>; // times a dish was taken out of the plan
  bought: Record<string, number>; // times an ingredient went into the fridge
  fridge: FridgeItem[];
  norm?: number;
};

export type Pick = { r: Recipe; score: number; why?: string };

const DAY = 86400000;

// Ranks dishes for this person. A plain weighted score, kept readable on purpose so the
// reason shown under a dish is the thing that actually lifted it.
export function rank(list: Recipe[], s: Signals, p: Profile, now = Date.now()): Pick[] {
  return list
    .filter((r) => allowed(r, p))
    .map((r) => {
      const parts: [number, string | undefined][] = [];
      const cooked = s.cookLog.filter((c) => c.id === r.id);
      const eaten = s.eaten.filter((x) => x === r.id).length;
      if (s.liked.includes(r.id)) parts.push([2, 'тобі сподобалось']);
      if (s.saved.includes(r.id)) parts.push([1.5, 'ти зберегла']);
      if (cooked.length) parts.push([Math.min(cooked.length, 4) * 0.8, 'ти це вже готувала']);
      if (eaten) parts.push([Math.min(eaten, 4) * 0.4, undefined]);

      // Ingredients the person keeps buying pull their dishes up.
      const keys = needsOf(r.id).filter(([key]) => INGREDIENTS[key].unit !== 'є');
      const fav = keys.map(([key]) => [key, s.bought[key] ?? 0] as const).sort((a, b) => b[1] - a[1])[0];
      const affinity = keys.reduce((a, [key]) => a + Math.log1p(s.bought[key] ?? 0), 0) / Math.max(keys.length, 1);
      if (affinity > 0) parts.push([affinity * 1.5, fav && fav[1] >= 2 ? `ти часто береш: ${INGREDIENTS[fav[0]].name}` : undefined]);

      // What's already at home, so less to buy.
      const home = keys.filter(([key, n]) => haveOf(s.fridge, key) >= n - 0.01).length;
      if (keys.length && home) parts.push([(home / keys.length) * 2.5, `вдома є ${home} з ${keys.length}`]);

      // A portion near a third of the daily norm fits a main meal.
      if (s.norm) {
        const off = Math.abs(r.kcal - s.norm / 3) / (s.norm / 3);
        parts.push([-Math.min(off, 1) * 1.2, undefined]);
        if (off < 0.25) parts.push([0.3, 'вписується в твою норму']);
      }

      // Taken out of the plan before, or cooked in the last two days: let something else through.
      const skip = s.skipped[r.id] ?? 0;
      if (skip) parts.push([-Math.min(skip, 4) * 0.7, undefined]);
      if (cooked.some((c) => now - c.at < 2 * DAY)) parts.push([-1.5, undefined]);

      const score = parts.reduce((a, [n]) => a + n, 0);
      const why = parts.filter(([n, w]) => w && n > 0).sort((a, b) => b[0] - a[0])[0]?.[1];
      return { r, score, why };
    })
    .sort((a, b) => b.score - a.score);
}
