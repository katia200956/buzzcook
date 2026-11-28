import { INGREDIENTS, SECTIONS, ShopItem, fmtQty } from './pantry';
import { lineCost, uah } from './prices';

// Calories per 100 g (per 100 ml for liquids), rounded, USDA FoodData Central level. Approximate.
// Pieces are counted through the ingredient's weight of one piece (`g`). Staples have no calories here.
const KCAL: Record<string, number> = {
  shrimp: 99, chicken: 177, salmon: 208, avocado: 160, tomato: 18, cherry: 18, lettuce: 15, spinach: 23,
  pumpkin: 26, onion: 40, redonion: 40, garlic: 149, broccoli: 34, cucumber: 15, radish: 16, sweetpotato: 86,
  carrot: 41, zucchini: 17, raspberry: 52, blueberry: 57, strawberry: 32, edamame: 121, egg: 143, feta: 264,
  yogurt: 97, cream: 118, parmesan: 431, bread: 270, granola: 470, rice: 360, quinoa: 368, spaghetti: 371,
  chickpeas: 139, broth: 6, cottage: 160, sourcream: 193, milk: 52, tofu: 76, chickenbreast: 120,
  chickenmince: 143, turkey: 114, hake: 90, tuna: 116, banana: 89, bellpepper: 26, beet: 43, cabbage: 25,
  potato: 77, eggplant: 25, olives: 115, greenbeans: 31, tomatocan: 32, oats: 379, flour: 364, walnut: 654,
  buckwheat: 343, bulgur: 342, lentils: 358, beans: 91, lavash: 275, ricenoodles: 364,
};
const PIECE_DEFAULT = 60; // a piece with no known weight (тонкий лаваш ≈ 60 г)

// The store price of one line, null when we don't know it (a typed item, or a staple bought by the pack).
export function itemPrice(x: Pick<ShopItem, 'key' | 'qty' | 'unit'>): number | null {
  if (!x.key || x.unit === 'є' || !INGREDIENTS[x.key]) return null;
  const c = lineCost(x.key, x.qty);
  return c > 0 ? c : null;
}

export function itemKcal(x: Pick<ShopItem, 'key' | 'qty' | 'unit'>): number | null {
  if (!x.key || x.unit === 'є') return null;
  const per100 = KCAL[x.key];
  if (per100 === undefined) return null;
  const grams = x.unit === 'шт' ? x.qty * (INGREDIENTS[x.key]?.g ?? PIECE_DEFAULT) : x.qty;
  return Math.round((grams / 100) * per100);
}

const sum = (list: ShopItem[], f: (x: ShopItem) => number | null) => list.reduce((a, x) => a + (f(x) ?? 0), 0);

export function totals(list: ShopItem[]) {
  const left = list.filter((x) => !x.done);
  return {
    all: sum(list, itemPrice),
    left: sum(left, itemPrice),
    kcal: sum(list, itemKcal),
    // Lines with no price (staples, typed items) aren't in the sum: the UI says so.
    unpriced: list.filter((x) => itemPrice(x) === null).length,
  };
}

// Plain text for Telegram, Viber, WhatsApp, SMS: only what is still to buy, grouped by store section.
export function shareText(list: ShopItem[]) {
  const left = list.filter((x) => !x.done);
  const lines = ['🛒 Список покупок · Buzzcook', ''];
  for (const sec of SECTIONS) {
    const items = left.filter((x) => x.sec === sec);
    if (!items.length) continue;
    lines.push(sec.toUpperCase());
    for (const x of items) {
      const qty = fmtQty(x.qty, x.unit);
      const price = itemPrice(x);
      lines.push(`☐ ${x.name.toLowerCase()}${qty ? ` · ${qty}` : ''}${price ? ` · ~${uah(price)}` : ''}`);
    }
    lines.push('');
  }
  const t = totals(left);
  if (t.left > 0) lines.push(`Разом приблизно ${uah(t.left)}`);
  return lines.join('\n').trim();
}
