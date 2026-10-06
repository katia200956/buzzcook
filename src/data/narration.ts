import { salatArt, type SceneLayer } from './scenes';

// Narrated cooking: each step is read out one short sentence at a time. While a sentence plays,
// the ingredient it names comes forward in the step's scene. Hands-on sentences wait for "готово",
// and what they produce lands in the bowl under the scene, where it stays for the rest of the recipe.

// Something in the bowl: a cutout (or a drawn bit) centred at x/y % of the bowl's inner circle, w % wide.
export type BowlBit = {
  src?: number;
  aspect?: number;
  fx?: 'leaves' | 'sauce';
  x: number;
  y: number;
  w: number;
  rotate?: number;
};

export type Line = {
  // Shown on screen; **bold** marks the amounts.
  text: string;
  // Read out instead of the text (numbers and units spelled out).
  say?: string;
  // Scene layer brought forward while the line plays (index into the step's scene).
  focus?: number;
  // Hands-on: the narration stops after this line until "готово".
  act?: boolean;
  // Lands in the bowl on "готово".
  add?: BowlBit[];
  // Stirs the bowl on "готово".
  stir?: boolean;
  // The finishing touch: the bowl turns into the real dish.
  serve?: boolean;
};

// A narrated step: its lines, and optionally its own scene. Steps whose usual scene is the
// finished dish get a different one here, since the bowl now shows the dish being built.
type Step = { lines: Line[]; scene?: SceneLayer[] };

export const isAction = (l: Line) => !!(l.act || l.add || l.stir || l.serve);

const shrimp = (i: number, x: number, y: number, rotate: number): BowlBit => ({ ...salatArt.shrimps[i % 3], x, y, w: 20, rotate });

const narration: Record<string, Step[]> = {
  salat: [
    {
      lines: [
        {
          text: 'Наріжте **1 помідор** часточками.',
          say: 'Наріжте один помідор часточками.',
          focus: 0,
          add: [{ ...salatArt.tomatoPile, x: 33, y: 60, w: 46, rotate: -8 }],
        },
        {
          text: '**Авокадо** — кубиками.',
          say: 'Авокадо наріжте кубиками.',
          focus: 1,
          add: [{ ...salatArt.avocadoPile, x: 67, y: 57, w: 42, rotate: 6 }],
        },
        {
          text: '**50 г салату** порвіть руками.',
          say: "П'ятдесят грамів салату порвіть руками.",
          add: [{ fx: 'leaves', x: 50, y: 50, w: 100 }],
        },
      ],
    },
    {
      lines: [
        {
          text: 'Змастіть розігріту сковороду **2–3 краплями олії**.',
          say: 'Змастіть розігріту сковороду двома-трьома краплями олії.',
          focus: 0,
          act: true,
        },
        { text: 'Викладіть **200 г креветок**.', say: 'Викладіть двісті грамів креветок.', focus: 1, act: true },
        {
          text: 'Смажте по 2 хвилини з кожного боку, поки не порожевіють.',
          say: 'Смажте по дві хвилини з кожного боку, поки не порожевіють.',
          focus: 1,
        },
      ],
    },
    {
      // The shrimps come straight from the pan.
      scene: [
        { ...salatArt.pan, x: 50, y: 52, w: 74, anim: 'driftIn', toss: 'pan' },
        { ...salatArt.shrimps[0], x: 41, y: 45, w: 13, anim: 'dropIn', delay: 0.4, toss: 'food' },
        { ...salatArt.shrimps[1], x: 60, y: 49, w: 13, rotate: 25, anim: 'dropIn', delay: 0.55, toss: 'food' },
        { ...salatArt.shrimps[2], x: 48, y: 61, w: 13, rotate: -20, anim: 'dropIn', delay: 0.7, toss: 'food' },
        { fx: 'steam', x: 50, y: 30, w: 40, delay: 1.2 },
      ],
      lines: [
        {
          text: 'Висипте гарячі креветки в миску до овочів.',
          focus: 0,
          add: [shrimp(0, 36, 34, 10), shrimp(1, 60, 30, -30), shrimp(2, 50, 52, 25), shrimp(0, 30, 62, -50), shrimp(1, 68, 62, 40)],
        },
        { text: 'Перемішайте знизу догори двома ложками.', stir: true },
      ],
    },
    {
      lines: [
        {
          text: 'Змішайте **1 ст. л. гірчиці**, **1 ст. л. лимонного соку** і **1 ч. л. меду**.',
          say: 'Змішайте столову ложку гірчиці, столову ложку лимонного соку і чайну ложку меду.',
          focus: 0,
          act: true,
        },
        { text: 'Додайте **сіль** і **перець**.', focus: 1, act: true },
        { text: 'Збивайте виделкою до глянцю.', focus: 0, act: true },
      ],
    },
    {
      // The sauce from step 4 waits above the bowl.
      scene: [{ ...salatArt.dressing, x: 50, y: 48, w: 62, anim: 'driftIn', float: true }],
      lines: [
        { text: 'Полийте салат **гірчичним соусом**.', focus: 0, add: [{ fx: 'sauce', x: 50, y: 50, w: 100 }] },
        { text: 'Прикрасьте **гілочками кропу** і подавайте.', serve: true },
      ],
    },
  ],
};

export const stepLines = (id: string, i: number) => narration[id]?.[i]?.lines;
export const narratedScene = (id: string, i: number) => narration[id]?.[i]?.scene;
export const hasNarration = (id: string) => !!narration[id];
export const servedDish = (id: string) => (id === 'salat' ? salatArt.final : undefined);
