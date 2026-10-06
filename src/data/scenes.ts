// Animated cooking-step scenes, ported from the recipe-page scrollytelling demo.
// Each step is a stack of background-free cutouts; every layer sits at a point in the
// square stage (x/y in % of its size), is w% of the stage wide and plays one entrance.

export type SceneAnim =
  | 'driftIn' // eases up from below while growing
  | 'dropIn' // falls from above with a spin and a little bounce
  | 'dropFade' // falls in and dissolves, as if poured into the dish
  | 'zoomIn' // a slow cinematic push in
  | 'cut'; // cut in half: a knife flash, then the halves part (and juice splashes)

export type SceneLayer = {
  src?: number;
  // Height / width of the cutout, so it can be laid out before it loads.
  aspect?: number;
  // A procedural effect instead of a picture.
  fx?: 'steam';
  x: number;
  y: number;
  w: number;
  rotate?: number;
  delay?: number;
  anim?: SceneAnim;
  // Lazy bobbing once the layer has landed.
  float?: boolean;
  // For 'cut': juice colour; no splash without it.
  splash?: string;
};

const cut = (src: number, w: number, h: number) => ({ src, aspect: h / w });

export const salatArt = {
  tomato: cut(require('../../assets/scenes/salat/tomato.png'), 367, 420),
  avocado: cut(require('../../assets/scenes/salat/avocado.png'), 397, 420),
  tomatoPile: cut(require('../../assets/scenes/salat/tomato-pile.png'), 460, 240),
  avocadoPile: cut(require('../../assets/scenes/salat/avocado-pile.png'), 440, 368),
  pan: cut(require('../../assets/scenes/salat/pan.png'), 744, 800),
  plate: cut(require('../../assets/scenes/salat/plate.png'), 791, 800),
  dressing: cut(require('../../assets/scenes/salat/dressing.png'), 320, 258),
  seeds: cut(require('../../assets/scenes/salat/seeds.png'), 260, 246),
  final: cut(require('../../assets/scenes/salat/final.png'), 795, 800),
  shrimps: [
    cut(require('../../assets/scenes/salat/shrimp-1.png'), 84, 84),
    cut(require('../../assets/scenes/salat/shrimp-2.png'), 94, 82),
    cut(require('../../assets/scenes/salat/shrimp-3.png'), 88, 90),
  ],
};

// Shrimps falling into the scene one after another.
const droppingShrimps = (positions: [x: number, y: number, delay: number, rotate?: number][]): SceneLayer[] =>
  positions.map(([x, y, delay, rotate], i) => ({ ...salatArt.shrimps[i % 3], x, y, w: 13, delay, rotate, anim: 'dropIn' }));

const scenes: Record<string, SceneLayer[][]> = {
  salat: [
    // 1. Наріжте овочі: tomato and avocado are cut in half, the chopped piles grow below.
    [
      { ...salatArt.tomato, x: 32, y: 32, w: 26, anim: 'cut', delay: 0.25, splash: '#ff5a3c' },
      { ...salatArt.avocado, x: 68, y: 36, w: 30, rotate: 8, anim: 'cut', delay: 0.7, splash: '#b6d95e' },
      { ...salatArt.tomatoPile, x: 33, y: 74, w: 40, anim: 'driftIn', delay: 1.5 },
      { ...salatArt.avocadoPile, x: 68, y: 76, w: 36, anim: 'driftIn', delay: 1.75 },
    ],
    // 2. Обсмажте креветки: shrimps drop into the hot pan, steam rises.
    [
      { ...salatArt.pan, x: 50, y: 54, w: 74, anim: 'driftIn' },
      ...droppingShrimps([
        [40, 42, 0.55],
        [59, 47, 0.75, 25],
        [47, 60, 0.95, -20],
        [63, 63, 1.15, 60],
        [36, 60, 1.35, -45],
      ]),
      { fx: 'steam', x: 50, y: 30, w: 44, delay: 1.9 },
    ],
    // 3. З'єднайте в мисці: the hot shrimps land on the salad.
    [
      { ...salatArt.plate, x: 50, y: 54, w: 80, anim: 'zoomIn' },
      ...droppingShrimps([
        [39, 40, 0.5],
        [61, 45, 0.7, 30],
        [50, 62, 0.9, -25],
      ]),
      { fx: 'steam', x: 50, y: 26, w: 36, delay: 1.5 },
    ],
    // 4. Зробіть гірчичний соус: mustard seeds pour into the sauce and dissolve.
    [
      { ...salatArt.dressing, x: 50, y: 58, w: 70, anim: 'driftIn', float: true },
      { ...salatArt.seeds, x: 50, y: 40, w: 30, anim: 'dropFade', delay: 0.6 },
    ],
    // 5. Полийте і подавайте: the finished dish, a slow push in.
    [{ ...salatArt.final, x: 50, y: 52, w: 84, anim: 'zoomIn', float: true }],
  ],
};

export const stepScene = (id: string, i: number) => scenes[id]?.[i];
