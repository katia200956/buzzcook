import { byId, DAYS, PlanItem } from '.';

// Ingredients as the fridge and the shopping list count them. Recipe texts say "1 ст. л." or "жменя",
// so each recipe also lists what it takes in grams, millilitres or pieces. Things nobody weighs
// (salt, oil, spices, herbs, sauces) are "staples": the fridge only knows whether they are at home.
export type Unit = 'г' | 'мл' | 'шт' | 'є';

export const SECTIONS = ['овочі й фрукти', 'м’ясо й риба', 'молочне й яйця', 'крупи, хліб, бобові', 'зелень, соуси, спеції', 'інше'] as const;
export type Section = (typeof SECTIONS)[number];

// `g` is the weight of one piece, so a scanned pack in grams can stand in for pieces and back.
// `alias` words find the ingredient in a scanned or typed product name.
type Ing = { name: string; unit: Unit; sec: Section; g?: number; alias?: string[] };

const VEG: Section = 'овочі й фрукти';
const MEAT: Section = 'м’ясо й риба';
const MILK: Section = 'молочне й яйця';
const DRY: Section = 'крупи, хліб, бобові';
const HERB: Section = 'зелень, соуси, спеції';

export const INGREDIENTS: Record<string, Ing> = {
  shrimp: { name: 'креветки', unit: 'г', sec: MEAT, alias: ['кревет'] },
  chicken: { name: 'куряче стегно', unit: 'г', sec: MEAT, alias: ['курк', 'куряч', 'стегн'] },
  salmon: { name: 'філе лосося', unit: 'г', sec: MEAT, alias: ['лосос', 'сьомг'] },
  avocado: { name: 'авокадо', unit: 'шт', sec: VEG, g: 200, alias: ['авокадо'] },
  tomato: { name: 'помідор', unit: 'шт', sec: VEG, g: 120, alias: ['помідор', 'томат'] },
  cherry: { name: 'помідори чері', unit: 'г', sec: VEG, alias: ['чері'] },
  lettuce: { name: 'листя салату', unit: 'г', sec: VEG, alias: ['салат', 'айсберг', 'ромен'] },
  spinach: { name: 'шпинат', unit: 'г', sec: VEG, alias: ['шпинат'] },
  pumpkin: { name: 'гарбуз', unit: 'г', sec: VEG, alias: ['гарбуз'] },
  onion: { name: 'цибуля', unit: 'шт', sec: VEG, g: 80, alias: ['цибул'] },
  redonion: { name: 'червона цибуля', unit: 'шт', sec: VEG, g: 80, alias: ['червона цибул'] },
  garlic: { name: 'часник, зубчики', unit: 'шт', sec: VEG, g: 5, alias: ['часник'] },
  broccoli: { name: 'броколі', unit: 'г', sec: VEG, alias: ['броколі'] },
  cucumber: { name: 'огірок', unit: 'шт', sec: VEG, g: 120, alias: ['огір'] },
  radish: { name: 'редиска', unit: 'шт', sec: VEG, g: 15, alias: ['редис'] },
  sweetpotato: { name: 'батат', unit: 'шт', sec: VEG, g: 250, alias: ['батат'] },
  carrot: { name: 'морква', unit: 'шт', sec: VEG, g: 80, alias: ['морк'] },
  zucchini: { name: 'цукіні', unit: 'шт', sec: VEG, g: 250, alias: ['цукіні', 'кабач'] },
  raspberry: { name: 'малина', unit: 'г', sec: VEG, alias: ['малин'] },
  blueberry: { name: 'чорниця', unit: 'г', sec: VEG, alias: ['чорниц', 'лохин'] },
  strawberry: { name: 'полуниця', unit: 'шт', sec: VEG, g: 15, alias: ['полуниц'] },
  edamame: { name: 'едамаме', unit: 'г', sec: VEG, alias: ['едамаме'] },
  egg: { name: 'яйця', unit: 'шт', sec: MILK, g: 55, alias: ['яйц', 'яєць'] },
  feta: { name: 'фета', unit: 'г', sec: MILK, alias: ['фета', 'бринз'] },
  yogurt: { name: 'грецький йогурт', unit: 'г', sec: MILK, alias: ['йогурт'] },
  cream: { name: 'вершки 10%', unit: 'мл', sec: MILK, alias: ['вершк'] },
  parmesan: { name: 'пармезан', unit: 'г', sec: MILK, alias: ['пармезан'] },
  butter: { name: 'вершкове масло', unit: 'є', sec: MILK, alias: ['вершкове масло'] },
  bread: { name: 'хліб на заквасці', unit: 'г', sec: DRY, alias: ['хліб'] },
  granola: { name: 'гранола', unit: 'г', sec: DRY, alias: ['гранол', 'мюслі'] },
  rice: { name: 'рис', unit: 'г', sec: DRY, alias: ['рис'] },
  quinoa: { name: 'кіноа', unit: 'г', sec: DRY, alias: ['кіноа'] },
  spaghetti: { name: 'спагеті', unit: 'г', sec: DRY, alias: ['спагеті', 'макарон', 'паста'] },
  chickpeas: { name: 'нут', unit: 'г', sec: DRY, alias: ['нут'] },
  broth: { name: 'овочевий бульйон', unit: 'мл', sec: DRY, alias: ['бульйон'] },
  pumpkinseeds: { name: 'гарбузове насіння', unit: 'є', sec: DRY, alias: ['насіння'] },
  oil: { name: 'оливкова олія', unit: 'є', sec: HERB, alias: ['олія'] },
  mustard: { name: 'діжонська гірчиця', unit: 'є', sec: HERB, alias: ['гірчиц'] },
  lemon: { name: 'лимон', unit: 'є', sec: HERB, alias: ['лимон'] },
  honey: { name: 'мед', unit: 'є', sec: HERB, alias: ['мед'] },
  salt: { name: 'сіль', unit: 'є', sec: HERB, alias: ['сіль'] },
  pepper: { name: 'чорний перець', unit: 'є', sec: HERB, alias: ['перець'] },
  chili: { name: 'пластівці чилі', unit: 'є', sec: HERB, alias: ['чилі'] },
  teriyaki: { name: 'соус теріякі', unit: 'є', sec: HERB, alias: ['теріякі'] },
  soy: { name: 'соєвий соус', unit: 'є', sec: HERB, alias: ['соєв'] },
  tahini: { name: 'тахіні', unit: 'є', sec: HERB, alias: ['тахіні'] },
  sesame: { name: 'кунжут', unit: 'є', sec: HERB, alias: ['кунжут'] },
  dill: { name: 'кріп', unit: 'є', sec: HERB, alias: ['кріп'] },
  microgreens: { name: 'мікрозелень', unit: 'є', sec: HERB, alias: ['мікрозелен'] },
  chives: { name: 'цибуля-різанець', unit: 'є', sec: HERB, alias: ['різанец'] },
  greenonion: { name: 'зелена цибуля', unit: 'є', sec: HERB, alias: ['зелена цибул'] },
  mint: { name: 'м’ята', unit: 'є', sec: HERB, alias: ['м’ят', "м'ят"] },
  thyme: { name: 'чебрець', unit: 'є', sec: HERB, alias: ['чебрец'] },
  basil: { name: 'базилік', unit: 'є', sec: HERB, alias: ['базилік'] },
  parsley: { name: 'петрушка', unit: 'є', sec: HERB, alias: ['петрушк'] },
  // Added with the trial recipes.
  cottage: { name: 'кисломолочний сир', unit: 'г', sec: MILK, alias: ['кисломолоч'] },
  sourcream: { name: 'сметана', unit: 'г', sec: MILK, alias: ['сметан'] },
  milk: { name: 'молоко', unit: 'мл', sec: MILK, alias: ['молоко'] },
  tofu: { name: 'тофу', unit: 'г', sec: MILK, alias: ['тофу'] },
  chickenbreast: { name: 'куряче філе', unit: 'г', sec: MEAT, alias: ['куряче філе', 'філе кур', 'грудк'] },
  chickenmince: { name: 'курячий фарш', unit: 'г', sec: MEAT, alias: ['курячий фарш'] },
  turkey: { name: 'філе індички', unit: 'г', sec: MEAT, alias: ['індич'] },
  hake: { name: 'філе хека', unit: 'г', sec: MEAT, alias: ['хек'] },
  tuna: { name: 'тунець консервований', unit: 'г', sec: MEAT, alias: ['тунець', 'тунц'] },
  banana: { name: 'банан', unit: 'шт', sec: VEG, g: 120, alias: ['банан'] },
  bellpepper: { name: 'болгарський перець', unit: 'шт', sec: VEG, g: 150, alias: ['болгарськ', 'перець солодк'] },
  beet: { name: 'буряк', unit: 'шт', sec: VEG, g: 200, alias: ['буряк'] },
  cabbage: { name: 'капуста', unit: 'г', sec: VEG, alias: ['капуст'] },
  potato: { name: 'картопля', unit: 'шт', sec: VEG, g: 150, alias: ['картопл'] },
  eggplant: { name: 'баклажан', unit: 'шт', sec: VEG, g: 300, alias: ['баклажан'] },
  olives: { name: 'маслини', unit: 'г', sec: VEG, alias: ['маслин', 'оливки'] },
  greenbeans: { name: 'стручкова квасоля', unit: 'г', sec: VEG, alias: ['стручков'] },
  tomatocan: { name: 'томати у власному соку', unit: 'г', sec: VEG, alias: ['томати у власн', 'томати в соку'] },
  oats: { name: 'вівсяні пластівці', unit: 'г', sec: DRY, alias: ['вівсян'] },
  flour: { name: 'борошно', unit: 'г', sec: DRY, alias: ['борошн'] },
  walnut: { name: 'волоські горіхи', unit: 'г', sec: DRY, alias: ['горіх'] },
  buckwheat: { name: 'гречка', unit: 'г', sec: DRY, alias: ['гречк'] },
  bulgur: { name: 'булгур', unit: 'г', sec: DRY, alias: ['булгур'] },
  lentils: { name: 'червона сочевиця', unit: 'г', sec: DRY, alias: ['сочевиц'] },
  beans: { name: 'квасоля консервована', unit: 'г', sec: DRY, alias: ['квасол'] },
  lavash: { name: 'тонкий лаваш', unit: 'шт', sec: DRY, alias: ['лаваш'] },
  ricenoodles: { name: 'рисова локшина', unit: 'г', sec: DRY, alias: ['локшин'] },
  tomatopaste: { name: 'томатна паста', unit: 'є', sec: HERB, alias: ['томатна паста'] },
  paprika: { name: 'паприка', unit: 'є', sec: HERB, alias: ['паприк'] },
  turmeric: { name: 'куркума', unit: 'є', sec: HERB, alias: ['куркум'] },
  oregano: { name: 'орегано', unit: 'є', sec: HERB, alias: ['орегано'] },
  ginger: { name: 'імбир', unit: 'є', sec: HERB, alias: ['імбир'] },
  cinnamon: { name: 'кориця', unit: 'є', sec: HERB, alias: ['кориц'] },
  peanutbutter: { name: 'арахісова паста', unit: 'є', sec: HERB, alias: ['арахіс'] },
};

// What each dish takes, as cooked by the recipe (all its portions), line by line in the order of the recipe's `ing`. Staples carry 0.
const NEEDS: Record<string, [string, number][]> = {
  salat: [['shrimp', 200], ['avocado', 1], ['tomato', 1], ['lettuce', 50], ['oil', 0], ['mustard', 0], ['lemon', 0], ['honey', 0], ['salt', 0], ['pepper', 0], ['dill', 0]],
  tost: [['bread', 40], ['avocado', 0.5], ['egg', 1], ['lemon', 0], ['chili', 0], ['microgreens', 0]],
  omlet: [['egg', 3], ['spinach', 40], ['feta', 30], ['cherry', 75], ['butter', 0], ['chives', 0]],
  yogurt: [['yogurt', 200], ['raspberry', 50], ['blueberry', 50], ['strawberry', 4], ['granola', 30], ['honey', 0], ['mint', 0]],
  soup: [['pumpkin', 600], ['onion', 1], ['garlic', 2], ['broth', 700], ['cream', 100], ['pumpkinseeds', 0], ['thyme', 0]],
  teriyaki: [['chicken', 400], ['rice', 150], ['broccoli', 250], ['teriyaki', 0], ['garlic', 2], ['greenonion', 0], ['sesame', 0]],
  bowl: [['salmon', 300], ['quinoa', 120], ['avocado', 1], ['cucumber', 1], ['edamame', 80], ['radish', 4], ['soy', 0], ['sesame', 0]],
  pasta: [['spaghetti', 180], ['cherry', 300], ['garlic', 2], ['oil', 0], ['basil', 0], ['parmesan', 20], ['salt', 0]],
  nut: [['sweetpotato', 1], ['carrot', 2], ['zucchini', 1], ['redonion', 1], ['chickpeas', 240], ['tahini', 0], ['oil', 0], ['parsley', 0]],
  // Trial recipes (to be reworked with a nutritionist).
  syrnyky: [['cottage', 400], ['egg', 1], ['flour', 45], ['honey', 0], ['blueberry', 100], ['sourcream', 40], ['oil', 0]],
  oatmeal: [['oats', 60], ['milk', 200], ['banana', 1], ['walnut', 15], ['cinnamon', 0]],
  shakshuka: [['egg', 4], ['tomato', 3], ['bellpepper', 1], ['onion', 1], ['garlic', 2], ['paprika', 0], ['oil', 0], ['parsley', 0]],
  smoothie: [['banana', 1], ['raspberry', 100], ['yogurt', 150], ['granola', 20], ['honey', 0]],
  pancakes: [['banana', 2], ['egg', 2], ['oats', 80], ['milk', 100], ['oil', 0], ['strawberry', 7]],
  borshch: [['beet', 2], ['cabbage', 300], ['potato', 3], ['carrot', 1], ['onion', 1], ['beans', 200], ['tomatopaste', 0], ['garlic', 2], ['sourcream', 80], ['dill', 0]],
  lentilsoup: [['lentils', 200], ['carrot', 1], ['onion', 1], ['garlic', 2], ['broth', 1000], ['turmeric', 0], ['lemon', 0]],
  greek: [['tomato', 2], ['cucumber', 1], ['bellpepper', 1], ['redonion', 0.5], ['feta', 150], ['olives', 50], ['oil', 0], ['oregano', 0]],
  tunasalad: [['tuna', 160], ['egg', 2], ['lettuce', 100], ['cherry', 150], ['cucumber', 1], ['oil', 0], ['mustard', 0]],
  chickenbuck: [['chickenbreast', 300], ['buckwheat', 160], ['carrot', 1], ['onion', 1], ['oil', 0], ['salt', 0], ['pepper', 0]],
  wrap: [['lavash', 2], ['chickenbreast', 250], ['tomato', 1], ['cucumber', 1], ['lettuce', 50], ['yogurt', 60], ['garlic', 1]],
  bulgur: [['bulgur', 150], ['zucchini', 1], ['bellpepper', 1], ['carrot', 1], ['onion', 1], ['oil', 0], ['parsley', 0]],
  hake: [['hake', 400], ['potato', 3], ['broccoli', 200], ['lemon', 0], ['oil', 0], ['thyme', 0]],
  turkey: [['turkey', 400], ['broccoli', 300], ['garlic', 2], ['soy', 0], ['sesame', 0], ['oil', 0]],
  tofu: [['tofu', 300], ['rice', 150], ['bellpepper', 1], ['broccoli', 200], ['soy', 0], ['ginger', 0], ['sesame', 0]],
  peppers: [['bellpepper', 6], ['chickenmince', 300], ['rice', 100], ['carrot', 1], ['onion', 1], ['tomatopaste', 0], ['sourcream', 60]],
  ragout: [['potato', 3], ['zucchini', 1], ['eggplant', 1], ['bellpepper', 1], ['carrot', 1], ['onion', 1], ['tomato', 2], ['oil', 0]],
  meatballs: [['chickenmince', 500], ['egg', 1], ['onion', 1], ['tomatocan', 400], ['garlic', 2], ['basil', 0]],
  salmonpotato: [['salmon', 300], ['potato', 4], ['greenbeans', 200], ['lemon', 0], ['dill', 0], ['oil', 0]],
  noodles: [['ricenoodles', 160], ['peanutbutter', 0], ['carrot', 1], ['cucumber', 1], ['soy', 0], ['honey', 0], ['greenonion', 0]],
  chickpeasalad: [['chickpeas', 240], ['spinach', 80], ['bellpepper', 1], ['feta', 80], ['lemon', 0], ['oil', 0]],
};

export const needsOf = (recipe: string) => NEEDS[recipe] ?? [];

// One thing at home. A product the catalog doesn't know has no `key` and is only listed.
export type FridgeItem = {
  id: string;
  key?: string;
  name: string;
  qty: number; // ignored for 'є'
  unit: Unit;
  expires?: string; // yyyy-mm-dd
  price?: number; // later: what it cost, for the week's budget
};

export type ShopItem = { id: string; key?: string; name: string; qty: number; unit: Unit; sec: Section; done: boolean };

// The longest alias that appears in the name wins, so "червона цибуля" beats "цибуля".
export function guessKey(name: string) {
  const n = name.toLowerCase();
  let best: string | undefined;
  let len = 0;
  for (const [key, x] of Object.entries(INGREDIENTS)) {
    for (const a of [x.name, ...(x.alias ?? [])]) {
      if (a.length > len && n.includes(a)) {
        best = key;
        len = a.length;
      }
    }
  }
  return best;
}

// Converts between grams and pieces through the weight of one piece; null when it can't.
export function convert(qty: number, from: Unit, to: Unit, key?: string): number | null {
  if (from === to) return qty;
  const g = key ? INGREDIENTS[key]?.g : undefined;
  if (from === 'г' && to === 'шт' && g) return qty / g;
  if (from === 'шт' && to === 'г' && g) return qty * g;
  if ((from === 'г' && to === 'мл') || (from === 'мл' && to === 'г')) return qty;
  return null;
}

// How much of an ingredient is at home, in the catalog's unit (1 for a staple that is there).
export function haveOf(fridge: FridgeItem[], key: string) {
  const ing = INGREDIENTS[key];
  let sum = 0;
  for (const f of fridge) {
    if (f.key !== key) continue;
    if (ing.unit === 'є') return 1;
    sum += convert(f.qty, f.unit, ing.unit, key) ?? 0;
  }
  return sum;
}

const dayIndex = (d = new Date()) => (d.getDay() + 6) % 7;
export const slotId = (p: PlanItem) => `${p.day}|${p.meal}`;

// Meals still to cook: not marked cooked and, for this week, not on a day that has passed.
export function mealsAhead(plan: PlanItem[], cooked: string[], thisWeek: boolean) {
  const today = dayIndex();
  return plan.filter((p) => !cooked.includes(slotId(p)) && (!thisWeek || DAYS.indexOf(p.day) >= today) && byId(p.recipe));
}

export function needOf(meals: PlanItem[]) {
  const need: Record<string, number> = {};
  for (const m of meals) for (const [key, n] of needsOf(m.recipe)) need[key] = (need[key] ?? 0) + n;
  return need;
}

const roundUp = (n: number, unit: Unit) => (unit === 'шт' ? Math.ceil(n - 0.01) : unit === 'є' ? 0 : Math.ceil(n / 10) * 10);

// The shopping list: what the meals need minus what is at home (and minus what the meals before them use up).
export function buildList(need: Record<string, number>, have: (key: string) => number): Omit<ShopItem, 'id' | 'done'>[] {
  const out: Omit<ShopItem, 'id' | 'done'>[] = [];
  for (const [key, n] of Object.entries(need)) {
    const ing = INGREDIENTS[key];
    const h = have(key);
    if (ing.unit === 'є') {
      if (h <= 0) out.push({ key, name: ing.name, qty: 0, unit: 'є', sec: ing.sec });
      continue;
    }
    const left = n - h;
    if (left > 0.01) out.push({ key, name: ing.name, qty: roundUp(left, ing.unit), unit: ing.unit, sec: ing.sec });
  }
  return out.sort((a, b) => SECTIONS.indexOf(a.sec) - SECTIONS.indexOf(b.sec) || a.name.localeCompare(b.name, 'uk'));
}

// Takes what a dish uses out of the fridge, soonest-to-expire first. Staples stay; anything used up disappears.
export function takeOut(fridge: FridgeItem[], recipe: string): FridgeItem[] {
  const next = fridge.map((f) => ({ ...f }));
  const order = [...next].sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999'));
  for (const [key, n] of needsOf(recipe)) {
    const ing = INGREDIENTS[key];
    if (ing.unit === 'є') continue;
    let left = n;
    for (const f of order) {
      if (left <= 0) break;
      if (f.key !== key) continue;
      const inMine = convert(left, ing.unit, f.unit, key);
      if (inMine === null) continue;
      const take = Math.min(f.qty, inMine);
      f.qty -= take;
      left -= convert(take, f.unit, ing.unit, key) ?? take;
    }
  }
  return next.filter((f) => f.unit === 'є' || f.qty > 0.01);
}

export const fmtQty = (qty: number, unit: Unit) => {
  if (unit === 'є') return '';
  const n = unit === 'шт' ? Math.round(qty * 2) / 2 : Math.round(qty);
  return `${String(n).replace('.5', '½').replace(/^0½/, '½')} ${unit}`;
};

// "прострочено", "сьогодні", "завтра", "ще 5 дн."; `soon` when two days or less are left.
export function expiryLabel(expires?: string, now = new Date()) {
  if (!expires) return null;
  const [y, m, d] = expires.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
  const text = days < 0 ? 'прострочено' : days === 0 ? 'до сьогодні' : days === 1 ? 'до завтра' : `ще ${days} дн.`;
  return { days, text, soon: days <= 2 };
}
