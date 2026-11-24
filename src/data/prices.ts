import { byId } from '.';
import { FridgeItem, haveOf, INGREDIENTS, needsOf } from './pantry';

// Rough store prices (АТБ/Сільпо level, November 2026). Per kilogram for 'г', per litre for 'мл',
// per piece for 'шт'. A staple ('є': salt, oil, spices, sauces) costs a few hryvnias per dish.
// These are estimates to be replaced by a weekly price table before launch.
export const PRICE_DATE = '2026-11';
const STAPLE = 3;

const PRICE: Record<string, number> = {
  shrimp: 520, chicken: 170, salmon: 900, avocado: 45, tomato: 12, cherry: 160, lettuce: 220, spinach: 280,
  pumpkin: 25, onion: 3, redonion: 4, garlic: 2, broccoli: 120, cucumber: 10, radish: 2, sweetpotato: 30,
  carrot: 2, zucchini: 15, raspberry: 450, blueberry: 400, strawberry: 6, edamame: 300, egg: 6.5, feta: 360,
  yogurt: 180, cream: 120, parmesan: 900, bread: 90, granola: 220, rice: 70, quinoa: 300, spaghetti: 80,
  chickpeas: 90, broth: 40, cottage: 190, sourcream: 140, milk: 45, tofu: 260, chickenbreast: 230,
  chickenmince: 190, turkey: 330, hake: 260, tuna: 450, banana: 9, bellpepper: 18, beet: 4, cabbage: 18,
  potato: 3, eggplant: 25, olives: 300, greenbeans: 160, tomatocan: 120, oats: 50, flour: 30, walnut: 380,
  buckwheat: 60, bulgur: 90, lentils: 110, beans: 80, lavash: 18, ricenoodles: 240,
};

const lineCost = (key: string, n: number) => {
  const ing = INGREDIENTS[key];
  if (!ing) return 0;
  if (ing.unit === 'є') return STAPLE;
  const p = PRICE[key] ?? 0;
  return ing.unit === 'шт' ? n * p : (n / 1000) * p;
};

// What the whole dish (all its portions) costs from the store.
export const dishCost = (recipe: string) => needsOf(recipe).reduce((a, [key, n]) => a + lineCost(key, n), 0);

// The same, minus what is already at home: the part you still have to buy.
export function dishCostLeft(recipe: string, fridge: FridgeItem[]) {
  return needsOf(recipe).reduce((a, [key, n]) => {
    const ing = INGREDIENTS[key];
    if (!ing) return a;
    const have = haveOf(fridge, key);
    if (ing.unit === 'є') return a + (have > 0 ? 0 : STAPLE);
    return a + lineCost(key, Math.max(0, n - have));
  }, 0);
}

export const portionCost = (recipe: string) => {
  const r = byId(recipe);
  return r ? Math.round(dishCost(recipe) / r.serv) : 0;
};

// One portion of a similar dish ordered from a mid-range place in Kyiv (menu price), plus the
// share of delivery and service fee that falls on one dish (≈70–90 грн an order, about two dishes).
// Estimates anchored on Пузата хата in Glovo (борщ 125 грн, солянка 140 грн); check before launch.
export const DELIVERY_FEE = 45;
const MENU: Record<string, number> = {
  salat: 260, tost: 190, omlet: 170, yogurt: 160, soup: 150, teriyaki: 260, bowl: 360, pasta: 220, nut: 210,
  syrnyky: 150, oatmeal: 110, shakshuka: 190, smoothie: 120, pancakes: 150, borshch: 125, lentilsoup: 130,
  greek: 190, tunasalad: 200, chickenbuck: 180, wrap: 170, bulgur: 150, hake: 220, turkey: 240, tofu: 220,
  peppers: 180, ragout: 160, meatballs: 190, salmonpotato: 380, noodles: 210, chickpeasalad: 180,
};

export const deliveryPrice = (recipe: string) => (MENU[recipe] ?? 180) + DELIVERY_FEE;

// What one portion saves against ordering it; never negative.
export const savedPerPortion = (recipe: string) => Math.max(0, deliveryPrice(recipe) - portionCost(recipe));

export const uah = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} грн`;
