// The product library: real 3D food models a recipe scene can ask for by name ("хліб", "egg", ...)
// instead of generating the ingredient from scratch. Each product is one GLB (textured, PBR) that
// can be turned to any angle. Models live in Higgsfield file storage (public CDN, CORS open) and
// are loaded at runtime, so the app bundle stays small. See README.md for how to add a product.

export type ProductCategory = 'bakery' | 'dairy' | 'eggs' | 'meat' | 'vegetables' | 'fruit';

/** Surface look, see ProductView: juicy = glossy skin, wet = cut flesh, satin = dry foods. */
export type Finish = 'juicy' | 'wet' | 'satin';

/** How a product is prepared. A recipe asks for "tomato" + "half" and gets that model. */
export type Form = 'whole' | 'half' | 'slice' | 'wedge' | 'cubes' | 'raw' | 'cooked';

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
    model: cdn + '23cd1ed2-2e96-4944-ba00-dfc0631ee497.glb',
    sizeCm: 7,
    finish: 'juicy',
    source: 'higgsfield-tripo',
  },
  {
    id: 'tomato-half',
    base: 'tomato',
    form: 'half',
    name: { uk: 'Половинка помідора', en: 'Tomato half' },
    aliases: ['помідор навпіл', 'розрізаний помідор', 'halved tomato'],
    category: 'vegetables',
    model: cdn + '3c48685d-3011-472e-b071-a827d4120cd9.glb',
    sizeCm: 7,
    finish: 'wet',
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
