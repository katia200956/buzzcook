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
  {
    id: 'lemon',
    sizeCm: { width: 6, height: 8, depth: 6 },
    weightG: 110,
    density: 1.03,
    pieceWeightG: { whole: 110, half: 55, wedge: 14, slice: 9 },
    edibleParts: ['flesh', 'juice', 'zest'],
    preparation: ['squeezed for juice', 'sliced for drinks and fish', 'wedges for serving', 'zested'],
    states: ['whole', 'half', 'slice'],
    planned: ['wedge'],
    actions: ['wash', 'cut', 'slice', 'place', 'pour'],
    look:
      'Oval with a pointed nipple at the blossom end and a smaller point at the stem end. Bright saturated yellow peel, ' +
      'pebbly with dense oil-gland pores, satin shine. Cut: thin yellow rind over a thick white pith (about 4 mm), then ' +
      '9–10 wedge segments split by thin white membranes, packed with translucent pale-yellow juice vesicles that catch ' +
      'light, a small white core, and a few cream teardrop seeds lying in the segments. Very wet and glossy on the cut.',
  },
  {
    id: 'onion-red',
    sizeCm: { width: 7.5, height: 6.5, depth: 7.5 },
    weightG: 150,
    density: 0.95,
    pieceWeightG: { whole: 150, half: 70, quarter: 35, slice: 18, strips: 2, diced: 0.5, chopped: 0.2 },
    edibleParts: ['flesh layers'],
    preparation: ['sliced into rings for salads', 'half-moon strips', 'diced for sauces', 'caramelised', 'pickled'],
    states: ['whole', 'half', 'slice'],
    planned: ['peeled', 'quarter', 'strips', 'diced', 'chopped', 'cooked'],
    actions: ['peel', 'cut', 'slice', 'dice', 'chop', 'fry', 'stew', 'place', 'mix'],
    look:
      'Squat sphere tapering to a neck with dry brown fibres on top and a flat root plate below. Skin magenta-purple ' +
      'with fine vertical darker veins and a light sheen. Cut: about 10 concentric layers, each 3–4 mm, white to pale ' +
      'pink with a thin purple outer edge, nested in slightly off-centre ovals around a small core; edges of each slice ' +
      'show purple vertical stripes. Layers are separate shells, slightly translucent and wet.',
  },
  {
    id: 'banana',
    sizeCm: { width: 4, height: 19, depth: 3.6 },
    weightG: 120,
    density: 0.95,
    pieceWeightG: { whole: 120, peeled: 100, half: 50, slice: 6, cubes: 4, mashed: 100 },
    edibleParts: ['flesh'],
    preparation: ['peeled and sliced', 'mashed for baking', 'in smoothies', 'fried or baked'],
    states: ['whole', 'peeled', 'half', 'slice'],
    planned: ['cubes', 'mashed', 'cooked'],
    actions: ['peel', 'cut', 'slice', 'mash', 'mix', 'place', 'fry', 'bake'],
    look:
      'Long curved fruit with five soft ridges, ripe yellow peel with a few tiny brown flecks, a green-tinged neck and a ' +
      'dark brown stem and tip. Peel about 3 mm, cream-white on the inside. Flesh pale buttery yellow, matte to satin, ' +
      'with faint lengthwise fibre lines on the sides of slices. Cut face: creamy centre with a tan three-armed star of ' +
      'seed traces and tiny dark dots, a slightly lighter outer ring. Slices about 1.5 cm thick.',
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
