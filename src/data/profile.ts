// The person behind the plan: body numbers for the calorie norm, and what they can't or won't eat.
export type Sex = 'f' | 'm';
export type Activity = 'rest' | 'light' | 'mid' | 'high' | 'max';
export type Aim = 'lose' | 'keep' | 'gain';
export type Diet = 'veg' | 'vegan' | 'pesc' | 'nogluten' | 'nolactose';
export type Allergy = 'nuts' | 'seafood' | 'fish' | 'egg' | 'milk' | 'sesame';

export type Profile = {
  sex?: Sex;
  age?: number;
  height?: number; // cm
  weight?: number; // kg
  activity: Activity;
  aim: Aim;
  diets: Diet[];
  allergies: Allergy[];
  budget: number; // hryvnias a week for dinners
  maxTime: number; // minutes a dish may take, 0 = no limit
};

export const emptyProfile: Profile = { activity: 'light', aim: 'keep', diets: [], allergies: [], budget: 600, maxTime: 40 };

export const ACTIVITY: [Activity, string, string, number][] = [
  ['rest', 'мало руху', 'сидяча робота, без спорту', 1.2],
  ['light', 'легка', 'спорт 1–3 рази на тиждень', 1.375],
  ['mid', 'середня', 'спорт 3–5 разів на тиждень', 1.55],
  ['high', 'висока', 'спорт 6–7 разів на тиждень', 1.725],
  ['max', 'дуже висока', 'фізична робота або 2 тренування на день', 1.9],
];

export const AIMS: [Aim, string, number][] = [
  ['lose', 'схуднути', 0.85],
  ['keep', 'тримати вагу', 1],
  ['gain', 'набрати', 1.1],
];

export const DIETS: [Diet, string][] = [
  ['veg', 'вегетаріанська'],
  ['vegan', 'веганська'],
  ['pesc', 'пескетаріанська'],
  ['nogluten', 'без глютену'],
  ['nolactose', 'без лактози'],
];

export const ALLERGIES: [Allergy, string][] = [
  ['nuts', 'горіхи'],
  ['seafood', 'морепродукти'],
  ['fish', 'риба'],
  ['egg', 'яйця'],
  ['milk', 'молоко'],
  ['sesame', 'кунжут'],
];

export const hasBody = (p: Profile) => !!(p.sex && p.age && p.height && p.weight);

// Mifflin–St Jeor resting energy, times activity, times the aim; rounded to 10 kcal.
// Undefined until the four body numbers are in.
export function dailyNorm(p: Profile) {
  if (!hasBody(p)) return undefined;
  const bmr = 10 * p.weight! + 6.25 * p.height! - 5 * p.age! + (p.sex === 'm' ? 5 : -161);
  const act = ACTIVITY.find(([a]) => a === p.activity)?.[3] ?? 1.375;
  const aim = AIMS.find(([a]) => a === p.aim)?.[2] ?? 1;
  return Math.round((bmr * act * aim) / 10) * 10;
}

// Rough split of the norm: protein 1.6 g per kg when losing, 1.4 otherwise; fat 30% of energy; the rest carbs.
export function macroNorm(p: Profile, kcal: number) {
  const protein = Math.round((p.aim === 'lose' ? 1.6 : 1.4) * (p.weight ?? 60));
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { p: protein, f: fat, c: carbs };
}
