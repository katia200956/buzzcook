// Дрібні утиліти карти: відстані, кухні, 3D-дерева в парках.
import type { Palette } from './style';

export type LngLat = [number, number];

export type Place = {
  id: string; name: string; lat: number; lon: number;
  status: 'confirmed' | 'review' | 'none';
  type?: string; cuisine?: string; address?: string; menu_url?: string; price_range?: string;
  dishes?: Dish[];
};
export type Dish = { name: string; category?: string; price_uah?: number; weight?: string; description?: string };

export function distance(a: LngLat, b: LngLat) {
  const R = 6371e3, t = Math.PI / 180, dl = (b[1] - a[1]) * t, dn = (b[0] - a[0]) * t;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const distText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} км`);
export const walkText = (m: number) => { const n = Math.max(1, Math.round(m / 80)); return n < 60 ? `${n} хв пішки` : `${Math.floor(n / 60)} год ${n % 60} хв`; };

const CU: Record<string, string> = {
  italian: 'італійська', japanese: 'японська', sushi: 'суші', georgian: 'грузинська', ukrainian: 'українська', pizza: 'піца', burger: 'бургери',
  coffee_shop: 'кава', asian: 'азійська', french: 'французька', american: 'американська', chinese: 'китайська', mexican: 'мексиканська',
  regional: 'місцева', local: 'місцева', german: 'німецька', steak_house: 'стейки', seafood: 'морепродукти', international: 'різна',
  european: 'європейська', thai: 'тайська', indian: 'індійська', vietnamese: 'вʼєтнамська', korean: 'корейська', turkish: 'турецька',
  middle_eastern: 'близькосхідна', uzbek: 'узбецька', caucasian: 'кавказька', greek: 'грецька', spanish: 'іспанська', vegan: 'веганська',
  vegetarian: 'вегетаріанська', breakfast: 'сніданки', barbecue: 'гриль', bbq: 'гриль', grill: 'гриль', ramen: 'рамен', shawarma: 'шаурма',
  kebab: 'кебаб', pasta: 'паста', fish: 'риба', crimean_tatar: 'кримськотатарська', azerbaijani: 'азербайджанська', armenian: 'вірменська',
  polish: 'польська', fusion: 'фʼюжн', dessert: 'десерти', pancake: 'млинці', dumplings: 'вареники', bistro: 'бістро', sandwich: 'сендвічі',
  hot_dog: 'хот-доги', poke: 'поке', bakery: 'випічка', wine: 'вино', beer: 'пиво',
};
export const cuisineText = (s?: string) =>
  [...new Set(String(s || '').split(/[;,]\s*/).map((x) => CU[x.trim()]).filter(Boolean))].slice(0, 3).join(', ');

export function placesToGeoJSON(places: Place[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: places.map((p, i) => ({
      type: 'Feature', id: i,
      properties: { i, k: p.status === 'confirmed' ? 'c' : p.status === 'review' ? 'r' : 'n' },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}

// ---- 3D-дерева: рівна сітка з легким зсувом, тільки всередині полігонів парків ----
function inRing(x: number, y: number, ring: number[][]) {
  let ins = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
const inPoly = (x: number, y: number, poly: number[][][]) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));
function hash(a: number, b: number) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function circle(lon: number, lat: number, rm: number, n = 10): number[][][] {
  const dLat = rm / 111320, dLon = rm / (111320 * Math.cos((lat * Math.PI) / 180)), ring: number[][] = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; ring.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]); }
  return [ring];
}

const SPARSE = new Set(['grass', 'meadow', 'recreation_ground', 'cemetery']);
const MAX_TREES = 3500;

/** Із полігонів парків, що видно на екрані, робить об'ємні дерева (стовбур + крона + верхівка). */
export function buildTrees(parks: GeoJSON.Feature[], bounds: [number, number, number, number], C: Palette): GeoJSON.FeatureCollection {
  const [W, S, E, N] = bounds;
  const lat0 = (S + N) / 2, STEP = 11, sy = STEP / 111320, sx = STEP / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const seen = new Set<string>(), out: GeoJSON.Feature[] = [];
  for (const f of parks) {
    const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const polys = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
    const sparse = SPARSE.has(String((f.properties as any)?.class ?? (f.properties as any)?.kind ?? ''));
    for (const poly of polys) {
      let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
      for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      x0 = Math.max(x0, W); x1 = Math.min(x1, E); y0 = Math.max(y0, S); y1 = Math.min(y1, N);
      if (x0 > x1 || y0 > y1) continue;
      for (let i = Math.floor(x0 / sx); i <= Math.ceil(x1 / sx); i++) {
        for (let j = Math.floor(y0 / sy); j <= Math.ceil(y1 / sy); j++) {
          if (out.length >= MAX_TREES * 3) break;
          const key = i + ':' + j; if (seen.has(key)) continue;
          const hv = hash(i, j); if (sparse && hv > 0.35) continue;
          const x = (i + 0.2 + hash(j, i) * 0.6) * sx, y = (j + 0.2 + hash(i + 7, j - 3) * 0.6) * sy;
          if (!inPoly(x, y, poly)) continue;
          seen.add(key);
          const s = 0.8 + hv * 0.5, rm = 3.3 * s, top = 7 + hv * 5;
          const col = C.crowns[Math.floor(hv * 97) % C.crowns.length], tcol = C.tops[Math.floor(hv * 53) % C.tops.length];
          out.push({ type: 'Feature', properties: { p: 't', base: 0, top: 2.6, col: C.trunk }, geometry: { type: 'Polygon', coordinates: circle(x, y, 0.35, 6) } });
          out.push({ type: 'Feature', properties: { p: 'c', base: 2.4, top, col }, geometry: { type: 'Polygon', coordinates: circle(x, y, rm) } });
          out.push({ type: 'Feature', properties: { p: 'k', base: top, top: top + 1.8, col: tcol }, geometry: { type: 'Polygon', coordinates: circle(x, y, rm * 0.62) } });
        }
      }
    }
  }
  return { type: 'FeatureCollection', features: out };
}
