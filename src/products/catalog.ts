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

/** How a product is prepared (the states in STANDARD.md). A recipe asks for "tomato" + "half" and gets that model. */
export type Form =
  | 'whole'
  | 'half'
  | 'quarter'
  | 'slice'
  | 'strips'
  | 'cubes'
  | 'diced'
  | 'chopped'
  | 'mashed'
  | 'peeled'
  | 'cooked'
  | 'wedge'
  | 'raw';
// Cut forms (half, slice) are made in Blender from the whole product, so they match it exactly. Each
// piece is its own node in the GLB (half_top/half_bottom, slice_0 = bottom ... slice_N = top), laid
// out apart (halves side by side cut face up, slices floating), so a recipe scene can move them.

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
  /** Fine-tuning of the 'skin' finish for this product: a pebbly lemon peel needs more bump than a tomato. */
  skin?: { roughness?: number; clearcoat?: number; bump?: number; tone?: number };
  /** Where the model came from, for licensing. */
  source: 'higgsfield-tripo' | 'polyhaven-cc0' | 'blender-procedural';
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
    // Built in Blender as a real tomato (tools/tomato.py), matched to Katusha's reference photo.
    // The half and slices below are cut from the same tomato, so their insides are true 3D:
    // thick walls, 7 gel chambers sitting just below the cut, and seeds standing in the gel.
    model: cdn + 'd69b3725-0cc2-4cb9-b3a9-2073ee7c20e7.glb',
    sizeCm: 7,
    finish: 'skin',
    source: 'blender-procedural',
  },
  {
    id: 'tomato-half',
    base: 'tomato',
    form: 'half',
    name: { uk: 'Половинка помідора', en: 'Tomato half' },
    aliases: ['помідор навпіл', 'розрізаний помідор', 'halved tomato'],
    category: 'vegetables',
    model: cdn + '22831bf3-1f49-499f-bd6c-49b25c71c34f.glb',
    sizeCm: 7,
    finish: 'skin',
    source: 'blender-procedural',
  },
  {
    id: 'tomato-slice',
    base: 'tomato',
    form: 'slice',
    name: { uk: 'Помідор слайсами', en: 'Sliced tomato' },
    aliases: ['скибки помідора', 'нарізаний помідор', 'кружальця помідора', 'tomato slices'],
    category: 'vegetables',
    model: cdn + '82878732-7e85-4ac4-b8c5-6dce0dc19e2b.glb',
    sizeCm: 7,
    finish: 'skin',
    source: 'blender-procedural',
  },
  {
    id: 'lemon',
    base: 'lemon',
    form: 'whole',
    name: { uk: 'Лимон', en: 'Lemon' },
    aliases: ['лимони', 'lemons'],
    category: 'fruit',
    // Built as a real lemon (tools/lemon.py): pebbly peel, thick white pith, ten juice segments
    // split by membranes around a white core, a few seeds. Half and slices are cut from it.
    model: cdn + '59106bd9-f276-4b59-876b-6bdcccea7158.glb',
    sizeCm: 8,
    finish: 'skin',
    skin: { bump: 0.0025, tone: 0.15, roughness: 0.35, clearcoat: 0.2 },
    source: 'blender-procedural',
  },
  {
    id: 'lemon-half',
    base: 'lemon',
    form: 'half',
    name: { uk: 'Половинка лимона', en: 'Lemon half' },
    aliases: ['лимон навпіл', 'розрізаний лимон', 'halved lemon'],
    category: 'fruit',
    model: cdn + 'bacb92f1-cc30-43f0-8bb6-7b49561bee90.glb',
    sizeCm: 8,
    finish: 'skin',
    skin: { bump: 0.0025, tone: 0.15, roughness: 0.35, clearcoat: 0.2 },
    source: 'blender-procedural',
  },
  {
    id: 'lemon-slice',
    base: 'lemon',
    form: 'slice',
    name: { uk: 'Лимон слайсами', en: 'Sliced lemon' },
    aliases: ['скибки лимона', 'кружальця лимона', 'нарізаний лимон', 'lemon slices'],
    category: 'fruit',
    model: cdn + 'bc2fc94b-bf2b-466c-b1e1-8f9e66deb95e.glb',
    sizeCm: 8,
    finish: 'skin',
    skin: { bump: 0.0025, tone: 0.15, roughness: 0.35, clearcoat: 0.2 },
    source: 'blender-procedural',
  },
  {
    id: 'onion-red',
    base: 'onion-red',
    form: 'whole',
    name: { uk: 'Червона цибуля', en: 'Red onion' },
    aliases: ['цибуля червона', 'фіолетова цибуля', 'ялтинська цибуля', 'red onions', 'purple onion'],
    category: 'vegetables',
    // Built as a real onion (tools/onion.py): ten nested layers, each with a purple skin on the
    // outside, growing from a root plate into a dry neck. Half (root to neck) and rings are cut from it.
    model: cdn + '284b64d6-7260-461f-97d5-9a64bc1aed3c.glb',
    sizeCm: 7.5,
    finish: 'skin',
    skin: { bump: 0.0008, tone: 0.3, roughness: 0.3, clearcoat: 0.4 },
    source: 'blender-procedural',
  },
  {
    id: 'onion-red-half',
    base: 'onion-red',
    form: 'half',
    name: { uk: 'Половинка червоної цибулі', en: 'Red onion half' },
    aliases: ['червона цибуля навпіл', 'halved red onion'],
    category: 'vegetables',
    model: cdn + '310e111e-fbf9-4910-8f5b-34003ed9c80c.glb',
    sizeCm: 7.5,
    finish: 'skin',
    skin: { bump: 0.0008, tone: 0.3, roughness: 0.3, clearcoat: 0.4 },
    source: 'blender-procedural',
  },
  {
    id: 'onion-red-slice',
    base: 'onion-red',
    form: 'slice',
    name: { uk: 'Червона цибуля кільцями', en: 'Sliced red onion' },
    aliases: ['кільця червоної цибулі', 'нарізана червона цибуля', 'red onion rings', 'red onion slices'],
    category: 'vegetables',
    model: cdn + 'e48b7216-0cbf-4110-9467-93cdbb5cd6ca.glb',
    sizeCm: 7.5,
    finish: 'skin',
    skin: { bump: 0.0008, tone: 0.3, roughness: 0.3, clearcoat: 0.4 },
    source: 'blender-procedural',
  },
  {
    id: 'banana',
    base: 'banana',
    form: 'whole',
    name: { uk: 'Банан', en: 'Banana' },
    aliases: ['банани', 'bananas'],
    category: 'fruit',
    // Built as a real banana (tools/banana.py): curved, five soft ridges, 3 mm peel, creamy flesh
    // and a three-armed core with tiny seeds. The peeled fruit, half and slices come from the same build.
    model: cdn + 'f7160d77-4502-4b3f-aa01-476889ed71c9.glb',
    sizeCm: 18,
    finish: 'skin',
    skin: { bump: 0.0006, tone: 0.3, roughness: 0.4, clearcoat: 0.15 },
    source: 'blender-procedural',
  },
  {
    id: 'banana-peeled',
    base: 'banana',
    form: 'peeled',
    name: { uk: 'Очищений банан', en: 'Peeled banana' },
    aliases: ['банан без шкірки', 'peeled bananas'],
    category: 'fruit',
    model: cdn + '42778813-2f60-43cf-8cce-c24a584c8cff.glb',
    sizeCm: 17,
    finish: 'skin',
    skin: { bump: 0.0006, tone: 0.3, roughness: 0.4, clearcoat: 0.15 },
    source: 'blender-procedural',
  },
  {
    id: 'banana-half',
    base: 'banana',
    form: 'half',
    name: { uk: 'Половинка банана', en: 'Banana half' },
    aliases: ['банан навпіл', 'halved banana'],
    category: 'fruit',
    model: cdn + '55bea276-c165-406f-a863-5df49ff492b9.glb',
    sizeCm: 18,
    finish: 'skin',
    skin: { bump: 0.0006, tone: 0.3, roughness: 0.4, clearcoat: 0.15 },
    source: 'blender-procedural',
  },
  {
    id: 'banana-slice',
    base: 'banana',
    form: 'slice',
    name: { uk: 'Банан слайсами', en: 'Sliced banana' },
    aliases: ['кружальця банана', 'нарізаний банан', 'banana slices'],
    category: 'fruit',
    model: cdn + 'e7c3ec7a-5eee-4ff0-bf1d-37cd128f222a.glb',
    sizeCm: 18,
    finish: 'skin',
    skin: { bump: 0.0006, tone: 0.3, roughness: 0.4, clearcoat: 0.15 },
    source: 'blender-procedural',
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
