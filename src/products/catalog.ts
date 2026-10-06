// The product library: real 3D food models a recipe scene can ask for by name ("хліб", "egg", ...)
// instead of generating the ingredient from scratch. Each product is one GLB (textured, PBR) that
// can be turned to any angle. Models live in Higgsfield file storage (public CDN, CORS open) and
// are loaded at runtime, so the app bundle stays small. See README.md for how to add a product.

export type ProductCategory = 'bakery' | 'dairy' | 'eggs' | 'meat' | 'vegetables' | 'fruit';

export type Product = {
  id: string;
  name: { uk: string; en: string };
  /** Other words a recipe may use for the same product (lowercase). */
  aliases: string[];
  category: ProductCategory;
  /** Public GLB url. */
  model: string;
  /** Longest real-world side in centimetres, so products keep their relative size in a scene. */
  sizeCm: number;
  /** Where the model came from, for licensing. */
  source: 'higgsfield-tripo' | 'polyhaven-cc0';
};

const cdn = 'https://d2ol7oe51mr4n9.cloudfront.net/user_3JEO9h5kAQyW1nFbAaW0QOpZhET/';

export const products: Product[] = [
  {
    id: 'bread-slice',
    name: { uk: 'Хліб', en: 'Bread' },
    aliases: ['скибка хліба', 'шматок хліба', 'білий хліб', 'bread slice', 'toast bread'],
    category: 'bakery',
    model: cdn + '55aa8642-ae71-4650-9ada-0d446a6d31fd.glb',
    sizeCm: 12,
    source: 'higgsfield-tripo',
  },
  {
    id: 'egg',
    name: { uk: 'Яйце', en: 'Egg' },
    aliases: ['яйця', 'куряче яйце', 'eggs', 'chicken egg'],
    category: 'eggs',
    model: cdn + 'f963077b-4129-462e-a455-49808bbfec06.glb',
    sizeCm: 6,
    source: 'higgsfield-tripo',
  },
  {
    id: 'tomato',
    name: { uk: 'Помідор', en: 'Tomato' },
    aliases: ['помідори', 'томат', 'томати', 'tomatoes'],
    category: 'vegetables',
    model: cdn + '23cd1ed2-2e96-4944-ba00-dfc0631ee497.glb',
    sizeCm: 7,
    source: 'higgsfield-tripo',
  },
  {
    id: 'cheese-wedge',
    name: { uk: 'Сир', en: 'Cheese' },
    aliases: ['твердий сир', 'шматок сиру', 'cheese wedge', 'hard cheese'],
    category: 'dairy',
    model: cdn + '4e54b116-b9a6-4a44-bf8e-3a6cb8e496de.glb',
    sizeCm: 10,
    source: 'higgsfield-tripo',
  },
  {
    id: 'beef-steak',
    name: { uk: 'Яловичина', en: 'Beef' },
    aliases: ["м'ясо", 'мясо', 'стейк', 'яловичий стейк', 'beef steak', 'steak', 'meat'],
    category: 'meat',
    model: cdn + '454cf509-0b54-4733-8a7f-da26ac4afb18.glb',
    sizeCm: 16,
    source: 'higgsfield-tripo',
  },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/[’ʼ`]/g, "'").replace(/\s+/g, ' ');

const index = new Map<string, Product>();
for (const p of products) {
  for (const key of [p.id, p.name.uk, p.name.en, ...p.aliases]) index.set(norm(key), p);
}

/** Finds a product by id, Ukrainian or English name, or alias. Returns undefined if it is not in the library yet. */
export function findProduct(name: string): Product | undefined {
  return index.get(norm(name));
}
