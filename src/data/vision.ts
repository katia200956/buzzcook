import { INGREDIENTS, Unit } from './pantry';

// Photos read by Claude through our Supabase function (supabase/functions/vision). The Anthropic key
// lives only in Supabase; the app sends the photo with the publishable key, like the products table.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';
export const hasVision = url !== '' && key !== '';

export type ReceiptLine = { line: string; name: string; match: string; qty: number; unit: Exclude<Unit, 'є'>; food: boolean };
export type DishGuess = { food: boolean; name: string; grams: number; kcal: number; p: number; f: number; c: number; sure: 'low' | 'medium' | 'high'; note: string };

async function call<T>(body: object): Promise<T> {
  if (!hasVision) throw new Error('no Supabase keys in .env.local');
  const res = await fetch(`${url}/functions/v1/vision`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`vision ${res.status}`);
  return res.json();
}

export const readReceipt = (image: string) =>
  call<{ items: ReceiptLine[] }>({ kind: 'receipt', image, known: Object.values(INGREDIENTS).map((x) => x.name) }).then((r) => r.items ?? []);

export const readDish = (image: string) => call<DishGuess>({ kind: 'dish', image });
