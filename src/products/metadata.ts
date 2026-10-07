import type { Form } from './catalog';

// Facts about each library product that a recipe needs beyond its 3D model: real size and weight
// (to turn "100 g" into a number of pieces), what can be eaten, how it is usually prepared, which
// 3D states exist, and which cooking actions suit it. See STANDARD.md.

export type CookingAction =
  | 'wash'
  | 'peel'
  | 'cut'
  | 'slice'
  | 'chop'
  | 'dice'
  | 'mash'
  | 'grate'
  | 'mix'
  | 'pour'
  | 'place'
  | 'fry'
  | 'bake'
  | 'boil'
  | 'stew'
  | 'grill'
  | 'blanch';

export type ProductMeta = {
  /** Same id as the whole product in catalog.ts. */
  id: string;
  /** Real size of a typical whole product, in centimetres. */
  sizeCm: { width: number; height: number; depth: number };
  /** Typical whole product weight, in grams. */
  weightG: number;
  /** Grams per millilitre, for volumes such as mashed or cooked states. */
  density: number;
  /** Approximate weight of one piece in each state, for working out how many pieces a recipe needs. */
  pieceWeightG: Partial<Record<Form, number>>;
  edibleParts: string[];
  preparation: string[];
  /** States with a model in the library now. */
  states: Form[];
  /** States the standard calls for that are not built yet. */
  planned: Form[];
  actions: CookingAction[];
  /** What the reference photos show; drives the model. */
  look: string;
};

export const metadata: ProductMeta[] = [
  {
    id: 'tomato',
    sizeCm: { width: 7, height: 5.5, depth: 7 },
    weightG: 135,
    density: 0.96,
    pieceWeightG: { whole: 135, half: 67, quarter: 34, slice: 20, wedge: 17, cubes: 4, diced: 1.2 },
    edibleParts: ['skin', 'flesh', 'gel', 'seeds'],
    preparation: ['raw in salads', 'sliced for sandwiches', 'diced for salsa', 'crushed for sauce', 'peeled after blanching', 'roasted', 'stewed'],
    states: ['whole', 'half', 'slice'],
    planned: ['quarter', 'strips', 'cubes', 'diced', 'chopped', 'mashed', 'peeled', 'cooked'],
    actions: ['wash', 'cut', 'slice', 'dice', 'chop', 'mash', 'peel', 'blanch', 'mix', 'place', 'bake', 'stew', 'grill'],
    look:
      'Round, slightly flattened, smooth glossy red-orange skin with a soft broad highlight and a few water drops; ' +
      'green calyx of thin curling sepals around a short stem. Inside: thick bright red wall, radial walls meeting in a ' +
      'paler core, 6–8 chambers of translucent orange-red gel with pale yellow flat seeds, gel slightly below the cut.',
  },
];

export function findMeta(id: string): ProductMeta | undefined {
  return metadata.find((m) => m.id === id);
}

/** How many pieces of a product in a state make up the given weight (at least one). */
export function piecesFor(id: string, form: Form, grams: number): number | undefined {
  const w = findMeta(id)?.pieceWeightG[form];
  return w ? Math.max(1, Math.round(grams / w)) : undefined;
}
