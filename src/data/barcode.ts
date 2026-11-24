import type { Food } from './foods';

// Open Food Facts: free, no key, crowd-sourced (values can be off, so the user sees them before adding).
// Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
const FIELDS = 'product_name,product_name_uk,product_name_en,brands,nutriments,serving_quantity';
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : undefined);

// A product, null when Open Food Facts doesn't know the code or has no calories for it.
// Throws when the network fails, so the screen can tell "not found" from "no internet".
export async function lookupBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, {
    headers: { 'User-Agent': 'Buzzcook/0.1 (calorie diary)' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts ${res.status}`);
  const body = await res.json();
  const p = body?.product;
  if (body?.status !== 1 || !p) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n.energy_100g) !== undefined ? Math.round(n.energy_100g / 4.184) : undefined);
  if (kcal === undefined) return null;
  const title = (p.product_name_uk || p.product_name || p.product_name_en || '').trim();
  const brand = String(p.brands ?? '').split(',')[0].trim();
  return {
    id: `bc:${code}`,
    // Add the brand unless the name already starts with it ("Coca-Cola Original" + "COCA-COLA SERVICES").
    name: [title || `продукт ${code}`, brand && !title.toLowerCase().includes(brand.toLowerCase().split(/\s+/)[0]) ? brand : ''].filter(Boolean).join(', '),
    cat: 'зі штрихкоду',
    kcal: Math.round(kcal),
    p: num(n.proteins_100g) ?? 0,
    c: num(n.carbohydrates_100g) ?? 0,
    f: num(n.fat_100g) ?? 0,
    portion: num(p.serving_quantity) ?? 100,
  };
}

// Sending a typed-in product to Open Food Facts, so it shows up for everyone who scans it.
// The account comes from .env.local (EXPO_PUBLIC_OFF_USER / EXPO_PUBLIC_OFF_PASSWORD), never from the code.
// EXPO_PUBLIC_ values are built into the app, so anyone with the app file could read them:
// fine for testing on your own phone; before a store release this should move behind our own server.
const offUser = process.env.EXPO_PUBLIC_OFF_USER ?? '';
const offPassword = process.env.EXPO_PUBLIC_OFF_PASSWORD ?? '';
export const canSendToOFF = offUser !== '' && offPassword !== '';

export async function sendToOFF(code: string, x: Food): Promise<void> {
  if (!canSendToOFF) throw new Error('no Open Food Facts account in .env.local');
  const form: Record<string, string> = {
    code,
    user_id: offUser,
    password: offPassword,
    app_name: 'Buzzcook',
    app_version: '0.1',
    lang: 'uk',
    product_name_uk: x.name,
    nutrition_data_per: '100g',
    'nutriment_energy-kcal': String(x.kcal),
    'nutriment_energy-kcal_unit': 'kcal',
    nutriment_proteins: String(x.p),
    nutriment_proteins_unit: 'g',
    nutriment_fat: String(x.f),
    nutriment_fat_unit: 'g',
    nutriment_carbohydrates: String(x.c),
    nutriment_carbohydrates_unit: 'g',
  };
  const res = await fetch('https://world.openfoodfacts.org/cgi/product_jqm2.pl', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Buzzcook/0.1 (calorie diary)' },
    body: Object.entries(form)
      .map(([key, v]) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`)
      .join('&'),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.status !== 1) throw new Error(body?.status_verbose ?? `Open Food Facts ${res.status}`);
}
