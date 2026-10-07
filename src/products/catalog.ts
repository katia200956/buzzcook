// The product library: real 3D food models a recipe scene can ask for by name ("хліб", "egg", ...)
// instead of generating the ingredient from scratch. Each product is one GLB (textured, PBR) that
// can be turned to any angle. Models live in Higgsfield file storage (public CDN, CORS open) and
// are loaded at runtime, so the app bundle stays small. See README.md for how to add a product.

export type ProductCategory = 'bakery' | 'dairy' | 'eggs' | 'meat' | 'vegetables' | 'fruit';

/**
 * Surface look, see ProductView. natural = the model's own scanned material (the default, closest
 * to the real thing); juicy = a light gloss on skins; wet = cut flesh; satin = dry foods;
 * skin = whole fruit and vegetables, with procedural pores, colour drift and micro-bumps (skin.ts).
 */
export type Finish = 'natural' | 'juicy' | 'wet' | 'satin' | 'skin';

/** How a product is prepared. A recipe asks for "tomato" + "half" and gets that model. */
export type Form = 'whole' | 'half' | 'slice' | 'wedge' | 'cubes' | 'raw' | 'cooked';
// Cut forms (half, slice) are made in Blender from the whole model, so they match it exactly. Each
// piece is its own node in the GLB (half_top/half_bottom, slice_0 = bottom ... slice_N = top), laid
// out apart like a floating cut, so a recipe scene can move the pieces separately.

export type Product = {
  id: string;
  /** The product this is a form of; same as id for the whole product. */
  base: string;
  form: Form;
  name: { uk: string; en: string };
  /** Other words a recipe may use for the same product (lowercase). */
  aliases: string[];
  category: ProductCategory;
  /** Public GLB url. */
  model: string;
  /** Longest real-world side in centimetres, so products keep their relative size in a scene. */
  sizeCm: number;
  finish: Finish;
  /** Where the model came from, for licensing. */
  source: 'higgsfield-tripo' | 'polyhaven-cc0';
};

const cdn = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JEO9h5kAQyW1nFbAaW0QOpZhET/';

export const products: Product[] = [
  {
    id: 'bread-slice',
    base: 'bread',
    form: 'slice',
    name: { uk: 'Хліб', en: 'Bread' },
    aliases: ['скибка хліба', 'шматок хліба', 'білий хліб', 'bread slice', 'toast bread'],
    category: 'bakery',
    model: cdn + '55aa8642-ae71-4650-9ada-0d446a6d31fd.glb',
    sizeCm: 12,
    finish: 'satin',
    source: 'higgsfield-tripo',
  },
  {
    id: 'egg',
    base: 'egg',
    form: 'whole',
    name: { uk: 'Яйце', en: 'Egg' },
    aliases: ['яйця', 'куряче яйце', 'eggs', 'chicken egg'],
    category: 'eggs',
    model: cdn + 'f963077b-4129-462e-a455-49808bbfec06.glb',
    sizeCm: 6,
    finish: 'juicy',
    source: 'higgsfield-tripo',
  },
  {
    id: 'tomato',
    base: 'tomato',
    form: 'whole',
    name: { uk: 'Помідор', en: 'Tomato' },
    aliases: ['помідори', 'томат', 'томати', 'tomatoes'],
    category: 'vegetables',
    // Ribbed beefsteak tomato (Meshy 7), matched to a studio photo of real ones. The half and slices
    // below are cut from this same model in Blender.
    model: cdn + 'bb04a161-74c3-4507-b7b4-d72ec6d9f30c.glb',
    sizeCm: 9,
    finish: 'skin',
    source: 'higgsfield-tripo',
  },
  {
    id: 'tomato-half',
    base: 'tomato',
    form: 'half',
    name: { uk: 'Половинка помідора', en: 'Tomato half' },
    aliases: ['помідор навпіл', 'розрізаний помідор', 'halved tomato'],
    category: 'vegetables',
    model: cdn + '46409c00-0a26-42fb-978a-4692618a4f03.glb',
    sizeCm: 9,
    finish: 'skin',
    source: 'higgsfield-tripo',
  },
  {
    id: 'tomato-slice',
    base: 'tomato',
    form: 'slice',
    name: { uk: 'Помідор слайсами', en: 'Sliced tomato' },
    aliases: ['скибки помідора', 'нарізаний помідор', 'кружальця помідора', 'tomato slices'],
    category: 'vegetables',
    model: cdn + '0e5b8912-22e0-4827-95a6-24a867084402.glb',
    sizeCm: 9,
    finish: 'skin',
    source: 'higgsfield-tripo',
  },
  {
    id: 'cheese-wedge',
    base: 'cheese',
    form: 'wedge',
    name: { uk: 'Сир', en: 'Cheese' },
    aliases: ['твердий сир', 'шматок сиру', 'cheese wedge', 'hard cheese'],
    category: 'dairy',
    model: cdn + '4e54b116-b9a6-4a44-bf8e-3a6cb8e496de.glb',
    sizeCm: 10,
    finish: 'satin',
    source: 'higgsfield-tripo',
  },
  {
    id: 'beef-steak',
    base: 'beef',
    form: 'raw',
    name: { uk: 'Яловичина', en: 'Beef' },
    aliases: ["м'ясо", 'мясо', 'стейк', 'яловичий стейк', 'beef steak', 'steak', 'meat'],
    category: 'meat',
    model: cdn + '454cf509-0b54-4733-8a7f-da26ac4afb18.glb',
    sizeCm: 16,
    finish: 'wet',
    source: 'higgsfield-tripo',
  },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ');

const index = new Map<string, Product>();
for (const p of products) {
  for (const key of [p.id, p.name.uk, p.name.en, ...p.aliases]) index.set(norm(key), p);
}

/**
 * Finds a product by id, Ukrainian or English name, or alias, optionally in a given form
 * ("tomato", "half"). Returns undefined if it is not in the library yet.
 */
export function findProduct(name: string, form?: Form): Product | undefined {
  const p = index.get(norm(name));
  if (!p || !form || p.form === form) return p;
  return products.find((q) => q.base === p.base && q.form === form);
}
