import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { byId, DAYS, defaultPlan, PlanItem, Recipe, recipes, sortPlan, weekKey } from '../data';
import { dailyNorm, emptyProfile, Profile } from '../data/profile';
import { Pick, rank } from '../data/recommend';
import { buildList, FridgeItem, guessKey, haveOf, INGREDIENTS, mealsAhead, needOf, ShopItem, slotId, takeOut } from '../data/pantry';
import type { Food } from '../data/foods';
import { deliveryPrice, portionCost } from '../data/prices';
import { makeWeek, Week } from '../data/weekplan';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Provider = 'apple' | 'google' | 'email';
export type Slot = { week: string; day: string; meal: string };
// One line of the calorie diary. Calories and macros are stored with the entry, so a past day
// keeps its numbers even if a recipe or product is changed later.
// One dinner cooked at home instead of ordered: what it cost and what delivery would have cost.
export type Saving = { at: number; recipe: string; portions: number; home: number; delivery: number };

export type Entry = {
  id: string;
  meal: string; // one of DIARY_MEALS
  kind: 'recipe' | 'food';
  ref: string; // recipe id or food id
  name: string;
  amount: number; // portions for a recipe, grams for a food
  kcal: number;
  p: number;
  c: number;
  f: number;
};

type State = {
  saved: string[];
  done: Record<string, number>; // cooking steps finished per recipe
  current?: string; // recipe being cooked right now
  themeMode: ThemeMode;
  plans: Record<string, PlanItem[]>; // per week (keyed by its Monday); a missing day+meal is a skipped meal
  liked: string[];
  premium: boolean; // calories and audio; a local flag until real payments exist
  user?: { provider: Provider; name: string };
  guest: boolean; // chose "пізніше" on the sign-in screen
  diary: Record<string, Entry[]>; // calorie diary per day, keyed yyyy-mm-dd (premium)
  goal: number; // daily calorie goal the user typed in
  products: Record<string, Food>; // scanned or typed-in products, by id ("bc:<barcode>" or "my:<time>")
  fridge: FridgeItem[]; // what is at home
  shop: ShopItem[]; // the shopping list; a ticked item has gone into the fridge
  cooked: Record<string, string[]>; // per week, the plan slots ("day|meal") already cooked
  profile: Profile;
  onboarded: boolean; // went through (or skipped) the first-launch questions
  // What the person does, for recommendations: dishes cooked, dishes taken out of the plan, ingredients bought.
  cookLog: { id: string; at: number }[];
  skipped: Record<string, number>;
  bought: Record<string, number>;
  savings: Saving[];
  remind: boolean; // the 17:00 reminder and the Sunday summary
};

type Store = State & {
  ready: boolean;
  paywall: boolean;
  plan: PlanItem[]; // this week's plan, for the shopping list and "далі в плані"
  planOf: (week: string) => PlanItem[];
  toggleLiked: (id: string) => void;
  toggleSaved: (id: string) => void;
  setDone: (id: string, n: number) => void;
  setThemeMode: (m: ThemeMode) => void;
  setMeal: (slot: Slot, recipe: string | null) => void;
  swapMeals: (a: Slot, b: Slot) => void;
  resetPlan: (week: string) => void;
  setPremium: (on: boolean) => void;
  showPaywall: (open: boolean) => void;
  signIn: (provider: Provider) => void;
  signOut: () => void;
  continueAsGuest: () => void;
  addEntry: (day: string, e: Omit<Entry, 'id'>) => void;
  removeEntry: (day: string, id: string) => void;
  setGoal: (kcal: number) => void;
  saveProduct: (x: Food) => void;
  addFridge: (x: Omit<FridgeItem, 'id'>) => string;
  updateFridge: (id: string, patch: Partial<FridgeItem>) => void;
  removeFridge: (id: string) => void;
  makeList: (weekOffset: 0 | 1) => void;
  toggleShop: (id: string) => void;
  addShop: (name: string) => void;
  removeShop: (id: string) => void;
  cookedDish: (recipe: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  finishOnboarding: () => void;
  rank: (list: Recipe[]) => Pick[];
  addBought: (items: Omit<FridgeItem, 'id'>[]) => void;
  previewWeek: () => Week; // dinners for this week from the profile's budget, time and the fridge
  planWeek: () => Week; // the same, written into this week's plan with a fresh shopping list
  setRemind: (on: boolean) => void;
  savedSince: (from: number) => { saved: number; dinners: number };
};

const Ctx = createContext<Store | null>(null);
const KEY = 'buzzcook:v2';
const initial: State = { saved: [], done: {}, themeMode: 'system', plans: {}, liked: [], premium: false, guest: false, diary: {}, goal: 2000, products: {}, fridge: [], shop: [], cooked: {}, profile: emptyProfile, onboarded: false, cookLog: [], skipped: {}, bought: {}, savings: [], remind: false };

const names: Record<Provider, string> = { apple: 'Apple ID', google: 'Google', email: 'e-mail' };
const countBought = (bought: Record<string, number>, items: { key?: string }[]) => {
  const next = { ...bought };
  for (const x of items) if (x.key) next[x.key] = (next[x.key] ?? 0) + 1;
  return next;
};
const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const same = (p: PlanItem, s: Slot) => p.day === s.day && p.meal === s.meal;
// A week nobody has edited yet starts from the default plan.
const weekPlan = (s: State, week: string) => s.plans[week] ?? defaultPlan;

// Older saves kept one plan for "this week"; move it under this week's key and drop weeks
// that can no longer be shown (anything before last week).
function load(raw: any): State {
  const s = { ...initial, ...raw };
  if (raw.plan && !raw.plans) s.plans = { [weekKey(0)]: raw.plan };
  delete (s as any).plan;
  const oldest = weekKey(-1);
  s.plans = Object.fromEntries(Object.entries(s.plans).filter(([k]) => k >= oldest));
  s.cooked = Object.fromEntries(Object.entries(s.cooked).filter(([k]) => k >= oldest));
  delete (s as any).checked;
  s.profile = { ...emptyProfile, ...raw.profile };
  return s;
}

// Recounts the list from the plan and the fridge. Items typed in by hand stay; ticked ones are already at home.
function withList(s: State, offset: 0 | 1): State {
  const w0 = weekKey(0);
  const thisNeed = needOf(mealsAhead(weekPlan(s, w0), s.cooked[w0] ?? [], true));
  const have = (key: string) => haveOf(s.fridge, key);
  let list;
  if (offset === 0) list = buildList(thisNeed, have);
  else {
    // Next week gets what is left at home after this week's meals.
    const w1 = weekKey(1);
    const left = (key: string) => (INGREDIENTS[key].unit === 'є' ? have(key) : Math.max(0, have(key) - (thisNeed[key] ?? 0)));
    list = buildList(needOf(mealsAhead(weekPlan(s, w1), s.cooked[w1] ?? [], false)), left);
  }
  const mine = s.shop.filter((x) => !x.key && !x.done);
  return { ...s, shop: [...list.map((x) => ({ ...x, id: newId(), done: false })), ...mine] };
}

const rankFor = (s: State, list: Recipe[]) =>
  rank(
    list,
    {
      liked: s.liked,
      saved: s.saved,
      cookLog: s.cookLog,
      eaten: Object.values(s.diary).flatMap((d) => d.filter((e) => e.kind === 'recipe').map((e) => e.ref)),
      skipped: s.skipped,
      bought: s.bought,
      fridge: s.fridge,
      norm: dailyNorm(s.profile),
    },
    s.profile,
  );

// This week's dinners from today on.
const weekFor = (s: State) =>
  makeWeek(rankFor(s, recipes), { budget: s.profile.budget, maxTime: s.profile.maxTime, fridge: s.fridge, fromDay: (new Date().getDay() + 6) % 7 });

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => s && setState(load(JSON.parse(s))))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, ready]);

  const store: Store = {
    ...state,
    ready,
    paywall,
    plan: weekPlan(state, weekKey(0)),
    planOf: (week) => weekPlan(state, week),
    toggleLiked: (id) =>
      setState((s) => ({ ...s, liked: s.liked.includes(id) ? s.liked.filter((x) => x !== id) : [...s.liked, id] })),
    toggleSaved: (id) =>
      setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    setDone: (id, n) => setState((s) => ({ ...s, current: id, done: { ...s.done, [id]: Math.max(n, 0) } })),
    setThemeMode: (themeMode) => setState((s) => ({ ...s, themeMode })),
    setMeal: (slot, recipe) =>
      setState((s) => {
        const cur = weekPlan(s, slot.week);
        const old = cur.find((p) => same(p, slot))?.recipe;
        const rest = cur.filter((p) => !same(p, slot));
        const next = recipe ? [...rest, { day: slot.day, meal: slot.meal, recipe }] : rest;
        // Taking a dish out of the plan is a quiet "not this one".
        const skipped = old && old !== recipe ? { ...s.skipped, [old]: (s.skipped[old] ?? 0) + 1 } : s.skipped;
        return { ...s, plans: { ...s.plans, [slot.week]: next }, skipped };
      }),
    // Swapping with an empty cell simply moves the dish there. Both slots are in the same week.
    swapMeals: (a, b) =>
      setState((s) => {
        const cur = weekPlan(s, a.week);
        const ra = cur.find((p) => same(p, a))?.recipe;
        const rb = cur.find((p) => same(p, b))?.recipe;
        const rest = cur.filter((p) => !same(p, a) && !same(p, b));
        if (ra) rest.push({ day: b.day, meal: b.meal, recipe: ra });
        if (rb) rest.push({ day: a.day, meal: a.meal, recipe: rb });
        return { ...s, plans: { ...s.plans, [a.week]: rest } };
      }),
    resetPlan: (week) =>
      setState((s) => {
        const { [week]: _, ...plans } = s.plans;
        return { ...s, plans };
      }),
    setPremium: (premium) => setState((s) => ({ ...s, premium })),
    showPaywall: setPaywall,
    // Stub sign-in: no keys yet. Real auth plugs in here (expo-apple-authentication, Google via expo-auth-session).
    signIn: (provider) => setState((s) => ({ ...s, user: { provider, name: names[provider] }, guest: false })),
    signOut: () => setState((s) => ({ ...s, user: undefined, guest: false, premium: false })),
    continueAsGuest: () => setState((s) => ({ ...s, guest: true })),
    addEntry: (day, e) =>
      setState((s) => {
        const id = newId();
        return { ...s, diary: { ...s.diary, [day]: [...(s.diary[day] ?? []), { ...e, id }] } };
      }),
    removeEntry: (day, id) =>
      setState((s) => {
        const rest = (s.diary[day] ?? []).filter((x) => x.id !== id);
        const { [day]: _, ...diary } = s.diary;
        return { ...s, diary: rest.length ? { ...diary, [day]: rest } : diary };
      }),
    setGoal: (goal) => setState((s) => ({ ...s, goal })),
    saveProduct: (x) => setState((s) => ({ ...s, products: { ...s.products, [x.id]: x } })),
    addFridge: (x) => {
      const id = newId();
      setState((s) => ({ ...s, fridge: [...s.fridge, { ...x, id }], bought: countBought(s.bought, [x]) }));
      return id;
    },
    updateFridge: (id, patch) => setState((s) => ({ ...s, fridge: s.fridge.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    removeFridge: (id) => setState((s) => ({ ...s, fridge: s.fridge.filter((f) => f.id !== id) })),
    // Recounts the list from the plan and the fridge. Items typed in by hand stay; ticked ones are already at home.
    makeList: (offset) => setState((s) => withList(s, offset)),
    // A ticked item goes into the fridge; unticking takes it back out.
    toggleShop: (id) =>
      setState((s) => {
        const x = s.shop.find((i) => i.id === id);
        if (!x) return s;
        const shop = s.shop.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
        const fid = `shop:${id}`;
        const fridge = x.done
          ? s.fridge.filter((f) => f.id !== fid)
          : [...s.fridge, { id: fid, key: x.key ?? guessKey(x.name), name: x.name, qty: x.unit === 'є' ? 1 : x.qty || 1, unit: x.unit }];
        return { ...s, shop, fridge, bought: x.done ? s.bought : countBought(s.bought, [{ key: x.key ?? guessKey(x.name) }]) };
      }),
    addShop: (name) =>
      setState((s) => ({ ...s, shop: [...s.shop, { id: newId(), name, qty: 0, unit: 'є', sec: (INGREDIENTS[guessKey(name) ?? '']?.sec ?? 'інше'), done: false }] })),
    removeShop: (id) => setState((s) => ({ ...s, shop: s.shop.filter((x) => x.id !== id) })),
    // A finished dish uses its ingredients up and marks its next uncooked slot in this week's plan.
    // A dish that makes two portions also covers its next slot in the plan (tonight and tomorrow),
    // so both count as dinners not ordered.
    cookedDish: (recipe) =>
      setState((s) => {
        const w = weekKey(0);
        const done = s.cooked[w] ?? [];
        const open = sortPlan(weekPlan(s, w)).filter((p) => p.recipe === recipe && !done.includes(slotId(p)));
        const serv = byId(recipe)?.serv ?? 1;
        const slots = open.slice(0, serv >= 2 ? 2 : 1);
        const portions = Math.max(1, slots.length);
        const saving: Saving = { at: Date.now(), recipe, portions, home: portionCost(recipe) * portions, delivery: deliveryPrice(recipe) * portions };
        return {
          ...s,
          fridge: takeOut(s.fridge, recipe),
          cooked: slots.length ? { ...s.cooked, [w]: [...done, ...slots.map(slotId)] } : s.cooked,
          cookLog: [...s.cookLog, { id: recipe, at: Date.now() }].slice(-100),
          savings: [...s.savings, saving].slice(-500),
        };
      }),
    // Body numbers set the diary's daily goal; the norm follows every change.
    setProfile: (patch) =>
      setState((s) => {
        const profile = { ...s.profile, ...patch };
        return { ...s, profile, goal: dailyNorm(profile) ?? s.goal };
      }),
    finishOnboarding: () => setState((s) => ({ ...s, onboarded: true })),
    rank: (list) => rankFor(state, list),
    // Products from a receipt: into the fridge, and anything on the shopping list is ticked off as bought.
    addBought: (items) =>
      setState((s) => {
        const keys = new Set(items.map((x) => x.key).filter(Boolean));
        return {
          ...s,
          fridge: [...s.fridge, ...items.map((x) => ({ ...x, id: newId() }))],
          shop: s.shop.map((i) => (!i.done && i.key && keys.has(i.key) ? { ...i, done: true } : i)),
          bought: countBought(s.bought, items),
        };
      }),
    previewWeek: () => weekFor(state),
    planWeek: () => {
      const week = weekFor(state);
      setState((s) => {
        // Days that have passed keep what was on them; from today on, the new dinners.
        const w = weekKey(0);
        const today = (new Date().getDay() + 6) % 7;
        const past = weekPlan(s, w).filter((p) => DAYS.indexOf(p.day) < today);
        return withList({ ...s, plans: { ...s.plans, [w]: [...past, ...week.plan] } }, 0);
      });
      return week;
    },
    setRemind: (remind) => setState((s) => ({ ...s, remind })),
    savedSince: (from) => {
      const list = state.savings.filter((x) => x.at >= from);
      return { saved: list.reduce((a, x) => a + Math.max(0, x.delivery - x.home), 0), dinners: list.reduce((a, x) => a + x.portions, 0) };
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx)!;
