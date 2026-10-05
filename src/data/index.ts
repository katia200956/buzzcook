import raw from './recipes.json';

export type Step = {
  title: string;
  still: string;
  min: number;
  txt: string;
  uses: string[];
  tip: string;
};

export type Recipe = {
  id: string;
  cat: string;
  name: string;
  img: string;
  desc: string;
  total: number;
  prep: number;
  cook: number;
  kcal: number;
  serv: number;
  diff: string;
  p: number;
  c: number;
  f: number;
  tags: string[];
  ing: [string, string][];
  steps?: Step[];
  tools?: string[];
};

export type PlanItem = { day: string; meal: string; recipe: string };

const images: Record<string, number> = {
  'assets/plan-salat.jpg': require('../../assets/food/plan-salat.jpg'),
  'assets/plan-omlet.jpg': require('../../assets/food/plan-omlet.jpg'),
  'assets/plan-soup.jpg': require('../../assets/food/plan-soup.jpg'),
  'assets/plan-pasta.jpg': require('../../assets/food/plan-pasta.jpg'),
  'assets/dish-tost.jpg': require('../../assets/food/dish-tost.jpg'),
  'assets/dish-yogurt.jpg': require('../../assets/food/dish-yogurt.jpg'),
  'assets/dish-teriyaki.jpg': require('../../assets/food/dish-teriyaki.jpg'),
  'assets/dish-bowl.jpg': require('../../assets/food/dish-bowl.jpg'),
  'assets/dish-nut.jpg': require('../../assets/food/dish-nut.jpg'),
  'assets/step-1.jpg': require('../../assets/food/step-1.jpg'),
  'assets/step-2.jpg': require('../../assets/food/step-2.jpg'),
  'assets/step-3.jpg': require('../../assets/food/step-3.jpg'),
  'assets/step-4.jpg': require('../../assets/food/step-4.jpg'),
  'assets/step-5.jpg': require('../../assets/food/step-5.jpg'),
};

export const img = (path: string) => images[path];

// Background-free cutouts for the cooking steps, so each step looks like it sits right on the screen.
const cutouts: Record<string, number[]> = {
  salat: [
    require('../../assets/steps/c2.png'),
    require('../../assets/steps/c4.png'),
    require('../../assets/steps/c6.png'),
    require('../../assets/steps/c8.png'),
    require('../../assets/steps/c9.png'),
  ],
};

export const stepCutout = (id: string, i: number) => cutouts[id]?.[i];

// Dishes that have a background-free photo of the finished plate; the belt shows it as is.
const plateCutouts: Record<string, number> = {
  salat: require('../../assets/steps/c9.png'),
};

export const plateCutout = (id: string) => plateCutouts[id];

// Generated clips for each cooking step; each one starts where the previous one ended.
const clips: Record<string, number[]> = {
  salat: [
    require('../../assets/video/v1.mp4'),
    require('../../assets/video/v2.mp4'),
    require('../../assets/video/v3.mp4'),
    require('../../assets/video/v4.mp4'),
    require('../../assets/video/v5.mp4'),
  ],
};

export const stepClip = (id: string, i: number) => clips[id]?.[i];

// Kitchen tools per dish, shown on the recipe card ("інструменти" in the Figma card).
const tools: Record<string, string[]> = {
  salat: ['дошка', 'ніж', 'сковорода', 'миска'],
  tost: ['тостер', 'каструля', 'виделка'],
  omlet: ['сковорода', 'віничок', 'миска'],
  yogurt: ['миска', 'ложка'],
  soup: ['каструля', 'блендер', 'деко'],
  teriyaki: ['сковорода', 'каструля', 'ніж'],
  bowl: ['деко', 'каструля', 'ніж'],
  pasta: ['каструля', 'сковорода'],
  nut: ['деко', 'ніж', 'миска'],
};

export const recipes = (raw.recipes as unknown as Recipe[]).map((r) => ({ ...r, tools: tools[r.id] ?? [] }));

// The week grid: rows are days, columns are meals. A day may skip a meal, which leaves its cell empty.
export const DAYS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота', 'Неділя'];
export const MEALS = ['Сніданок', 'Обід', 'Вечеря'];
export const defaultPlan = raw.plan as PlanItem[];
export const byId = (id: string) => recipes.find((r) => r.id === id);

// Plan entries in day order, then meal order.
export const sortPlan = (plan: PlanItem[]) =>
  [...plan].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));

// Next meal in the plan after the given recipe, used on the "Смачного" screen.
export const nextInPlan = (plan: PlanItem[], id: string) => {
  const list = sortPlan(plan);
  const i = list.findIndex((p) => p.recipe === id);
  if (i < 0) return undefined;
  return list[(i + 1) % list.length];
};
