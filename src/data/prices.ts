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

// Where the person eats when they don't cook, and the prices they typed in themselves. The store
// pushes these in on every change (applyPrices), so every sum below already uses them.
export type Place = 'delivery' | 'cafe' | 'restaurant';
export const PLACES: { id: Place; label: string; at: string; instead: string }[] = [
  { id: 'delivery', label: 'доставка', at: 'у доставці', instead: 'замість доставки' },
  { id: 'cafe', label: 'кафе', at: 'у кафе', instead: 'замість кафе' },
  { id: 'restaurant', label: 'ресторан', at: 'у ресторані', instead: 'замість ресторану' },
];
export const placeOf = (p: Place) => PLACES.find((x) => x.id === p) ?? PLACES[0];

let place: Place = 'delivery';
let myIng: Record<string, number> = {};
let myOut: Record<string, number> = {};
export function applyPrices(p: Place, ing: Record<string, number>, out: Record<string, number>) {
  place = p;
  myIng = ing;
  myOut = out;
}
export const currentPlace = () => placeOf(place);

// Our suggested price for an ingredient (per kg, litre or piece), and the one actually used.
export const ourPrice = (key: string) => PRICE[key] ?? 0;
export const priceOf = (key: string) => myIng[key] ?? ourPrice(key);
export const isMyPrice = (key: string) => myIng[key] !== undefined;
export const priceUnit = (key: string) => {
  const u = INGREDIENTS[key]?.unit;
  return u === 'шт' ? 'грн/шт' : u === 'мл' ? 'грн/л' : 'грн/кг';
};

export const lineCost = (key: string, n: number) => {
  const ing = INGREDIENTS[key];
  if (!ing) return 0;
  if (ing.unit === 'є') return STAPLE;
  const p = priceOf(key);
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

// One portion where the person usually eats. Delivery: menu price plus the fee share. Café: the
// menu price plus a 10% tip. Restaurant: about 1.8× a mid-range menu, plus a 10% tip.
export function ourOutPrice(recipe: string, p: Place = place) {
  const menu = MENU[recipe] ?? 180;
  if (p === 'cafe') return Math.round(menu * 1.1);
  if (p === 'restaurant') return Math.round(menu * 1.8 * 1.1);
  return menu + DELIVERY_FEE;
}
// The same, or the price the person typed in for this dish.
export const outPrice = (recipe: string) => myOut[recipe] ?? ourOutPrice(recipe);
export const isMyOut = (recipe: string) => myOut[recipe] !== undefined;

// What one portion saves against eating out; never negative.
export const savedPerPortion = (recipe: string) => Math.max(0, outPrice(recipe) - portionCost(recipe));

export const uah = (n: number) => `${Math.round(n).toLocaleString('uk-UA')} грн`;
