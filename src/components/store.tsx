import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

type State = {
  saved: string[];
  checked: Record<string, number[]>; // shopping list ticks per recipe
  done: Record<string, number>; // cooking steps finished per recipe
  current?: string; // recipe being cooked right now
  themeMode: ThemeMode;
};

type Store = State & {
  toggleSaved: (id: string) => void;
  toggleChecked: (id: string, i: number) => void;
  setDone: (id: string, n: number) => void;
  setThemeMode: (m: ThemeMode) => void;
};

const Ctx = createContext<Store | null>(null);
const KEY = 'buzzcook:v2';
const initial: State = { saved: [], checked: {}, done: {}, themeMode: 'system' };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [ready, setReady] = useState(false);

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
    toggleSaved: (id) =>
      setState((s) => ({ ...s, saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [...s.saved, id] })),
    toggleChecked: (id, i) =>
      setState((s) => {
        const cur = s.checked[id] ?? [];
        return { ...s, checked: { ...s.checked, [id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] } };
      }),
    setDone: (id, n) => setState((s) => ({ ...s, current: id, done: { ...s.done, [id]: Math.max(n, 0) } })),
    setThemeMode: (themeMode) => setState((s) => ({ ...s, themeMode })),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx)!;
