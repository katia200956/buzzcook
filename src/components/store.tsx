import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { defaultPlan, PlanItem } from '../data';

export type ThemeMode = 'system' | 'light' | 'dark' | 'poster' | 'posterBlack';
export type Provider = 'apple' | 'google' | 'email';
export type Slot = { day: string; meal: string };

type State = {
  saved: string[];
  checked: Record<string, number[]>; // shopping list ticks per recipe
  done: Record<string, number>; // cooking steps finished per recipe
  current?: string; // recipe being cooked right now
  themeMode: ThemeMode;
  plan: PlanItem[]; // the week's table; a missing day+meal is a skipped meal
  premium: boolean; // calories and audio; a local flag until real payments exist
  user?: { provider: Provider; name: string };
  guest: boolean; // chose "пізніше" on the sign-in screen
};

type Store = State & {
  ready: boolean;
  paywall: boolean;
  toggleSaved: (id: string) => void;
  toggleChecked: (id: string, i: number) => void;
  setDone: (id: string, n: number) => void;
  setThemeMode: (m: ThemeMode) => void;
  setMeal: (slot: Slot, recipe: string | null) => void;
  swapMeals: (a: Slot, b: Slot) => void;
  resetPlan: () => void;
  setPremium: (on: boolean) => void;
  showPaywall: (open: boolean) => void;
  signIn: (provider: Provider) => void;
  signOut: () => void;
  continueAsGuest: () => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = 'buzzcook:v2';
const initial: State = { saved: [], checked: {}, done: {}, themeMode: 'system', plan: defaultPlan, premium: false, guest: false };

const names: Record<Provider, string> = { apple: 'Apple ID', google: 'Google', email: 'e-mail' };
const same = (p: PlanItem, s: Slot) => p.day === s.day && p.meal === s.meal;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);
  const [paywall, setPaywall] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((s) => s && setState({ ...initial, ...JSON.parse(s) }))
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
    toggleSaved: (id) =>
      setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    toggleChecked: (id, i) =>
      setState((s) => {
        const cur = s.checked[id] ?? [];
        return { ...s, checked: { ...s.checked, [id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } };
      }),
    setDone: (id, n) => setState((s) => ({ ...s, current: id, done: { ...s.done, [id]: Math.max(n, 0) } })),
    setThemeMode: (themeMode) => setState((s) => ({ ...s, themeMode })),
    setMeal: (slot, recipe) =>
      setState((s) => {
        const rest = s.plan.filter((p) => !same(p, slot));
        return { ...s, plan: recipe ? [...rest, { ...slot, recipe }] : rest };
      }),
    // Swapping with an empty cell simply moves the dish there.
    swapMeals: (a, b) =>
      setState((s) => {
        const ra = s.plan.find((p) => same(p, a))?.recipe;
        const rb = s.plan.find((p) => same(p, b))?.recipe;
        const rest = s.plan.filter((p) => !same(p, a) && !same(p, b));
        if (ra) rest.push({ ...b, recipe: ra });
        if (rb) rest.push({ ...a, recipe: rb });
        return { ...s, plan: rest };
      }),
    resetPlan: () => setState((s) => ({ ...s, plan: defaultPlan })),
    setPremium: (premium) => setState((s) => ({ ...s, premium })),
    showPaywall: setPaywall,
    // Stub sign-in: no keys yet. Real auth plugs in here (expo-apple-authentication, Google via expo-auth-session).
    signIn: (provider) => setState((s) => ({ ...s, user: { provider, name: names[provider] }, guest: false })),
    signOut: () => setState((s) => ({ ...s, user: undefined, guest: false, premium: false })),
    continueAsGuest: () => setState((s) => ({ ...s, guest: true })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx)!;
