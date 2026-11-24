import type { Food } from './foods';

// Buzzcook's own shared product list in Supabase (table from supabase/products.sql).
// Talks to the Supabase REST API directly, no extra library. The publishable key is meant to sit
// in the app; the table's row-level security only lets the app read and add, never edit or delete.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
export const hasShared = url !== '' && key !== '';

const headers = { apikey: key, 'Content-Type': 'application/json' };
type Row = { barcode: string; name: string; kcal: number; protein: number; fat: number; carbs: number; portion: number };

// A product someone already added, or null. Throws on network trouble.
export async function lookupShared(code: string): Promise<Food | null> {
  if (!hasShared) return null;
  const res = await fetch(`${url}/rest/v1/products?barcode=eq.${encodeURIComponent(code)}&select=*`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const [r] = (await res.json()) as Row[];
  if (!r) return null;
  return { id: `bc:${code}`, name: r.name, cat: 'спільна база buzzcook', kcal: Number(r.kcal), p: Number(r.protein), f: Number(r.fat), c: Number(r.carbs), portion: Number(r.portion) };
}

// Adds a typed-in product. If the barcode is already there, the existing one is kept.
export async function addShared(code: string, x: Food): Promise<void> {
  if (!hasShared) throw new Error('no Supabase keys in .env.local');
  const row: Row = { barcode: code, name: x.name, kcal: x.kcal, protein: x.p, fat: x.f, carbs: x.c, portion: x.portion };
  const res = await fetch(`${url}/rest/v1/products?on_conflict=barcode`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
}
