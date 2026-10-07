import type { Form } from './catalog';

// Every dish in the app broken down into the products you see in its photo, and in what form.
// A 3D recipe scene is built from these: it looks each one up with findProduct(product, form),
// so a tomato is made once and reused in the salad (wedges), the omelette and the pasta (cherry
// halves). Small grains and seeds (sesame, chili flakes, quinoa, rice) are drawn as scattered
// particles in the scene, and sauces as liquid, so they are listed with form 'cooked' and no model.

export type DishPart = {
  /** Product base id in the catalog (may not have a model yet). */
  product: string;
  form: Form;
  /** How it shows up on the plate, in the recipe's words. */
  look: string;
};

export const dishes: Record<string, DishPart[]> = {
  salat: [
    { product: 'shrimp', form: 'cooked', look: 'обсмажені креветки, рожеві, завиті' },
    { product: 'avocado', form: 'cubes', look: 'кубики авокадо' },
    { product: 'tomato', form: 'wedge', look: 'часточки помідора' },
    { product: 'lettuce', form: 'whole', look: 'листя салату, порване' },
    { product: 'lemon', form: 'wedge', look: 'часточка лимона' },
    { product: 'dill', form: 'whole', look: 'гілочки кропу' },
    { product: 'mustard-dressing', form: 'cooked', look: 'гірчичний соус' },
  ],
  tost: [
    { product: 'bread', form: 'slice', look: 'підсмажена скибка хліба на заквасці' },
    { product: 'avocado', form: 'half', look: 'пів авокадо, розім’яте на тості' },
    { product: 'egg', form: 'cooked', look: 'яйце пашот з рідким жовтком' },
    { product: 'microgreens', form: 'whole', look: 'мікрозелень' },
    { product: 'chili-flakes', form: 'cooked', look: 'пластівці чилі' },
  ],
  omlet: [
    { product: 'egg', form: 'whole', look: 'яйця, згорнутий омлет' },
    { product: 'spinach', form: 'whole', look: 'листя шпинату' },
    { product: 'feta', form: 'cubes', look: 'покришена фета' },
    { product: 'cherry-tomato', form: 'half', look: 'половинки помідорів чері' },
    { product: 'butter', form: 'slice', look: 'шматочок вершкового масла' },
    { product: 'chives', form: 'slice', look: 'нарізана цибуля-різанець' },
  ],
  yogurt: [
    { product: 'greek-yogurt', form: 'cooked', look: 'грецький йогурт у мисці' },
    { product: 'raspberry', form: 'whole', look: 'малина' },
    { product: 'blueberry', form: 'whole', look: 'чорниця' },
    { product: 'strawberry', form: 'half', look: 'половинки полуниці' },
    { product: 'granola', form: 'whole', look: 'грудочки граноли' },
    { product: 'mint', form: 'whole', look: 'листок м’яти' },
    { product: 'honey', form: 'cooked', look: 'мед' },
  ],
  soup: [
    { product: 'pumpkin', form: 'cubes', look: 'кубики гарбуза' },
    { product: 'onion', form: 'half', look: 'цибулина' },
    { product: 'garlic', form: 'whole', look: 'зубчики часнику' },
    { product: 'pumpkin-seeds', form: 'whole', look: 'гарбузове насіння' },
    { product: 'thyme', form: 'whole', look: 'гілочки чебрецю' },
    { product: 'cream', form: 'cooked', look: 'спіраль вершків' },
  ],
  teriyaki: [
    { product: 'chicken-thigh', form: 'cooked', look: 'шматочки курки в глазурі теріякі' },
    { product: 'rice', form: 'cooked', look: 'гірка вареного рису' },
    { product: 'broccoli', form: 'whole', look: 'суцвіття броколі' },
    { product: 'garlic', form: 'whole', look: 'часник' },
    { product: 'green-onion', form: 'slice', look: 'кільця зеленої цибулі' },
    { product: 'sesame', form: 'cooked', look: 'кунжут' },
  ],
  bowl: [
    { product: 'salmon', form: 'cooked', look: 'запечене філе лосося' },
    { product: 'quinoa', form: 'cooked', look: 'кіноа' },
    { product: 'avocado', form: 'slice', look: 'віялом нарізане авокадо' },
    { product: 'cucumber', form: 'slice', look: 'стрічки огірка' },
    { product: 'edamame', form: 'whole', look: 'боби едамаме' },
    { product: 'radish', form: 'slice', look: 'кружальця редиски' },
    { product: 'sesame', form: 'cooked', look: 'кунжут' },
  ],
  pasta: [
    { product: 'spaghetti', form: 'cooked', look: 'спагеті' },
    { product: 'cherry-tomato', form: 'half', look: 'половинки помідорів чері' },
    { product: 'garlic', form: 'slice', look: 'пластинки часнику' },
    { product: 'basil', form: 'whole', look: 'листя базиліку' },
    { product: 'parmesan', form: 'slice', look: 'стружка пармезану' },
  ],
  nut: [
    { product: 'sweet-potato', form: 'wedge', look: 'запечені часточки батату' },
    { product: 'carrot', form: 'slice', look: 'запечена морква' },
    { product: 'zucchini', form: 'slice', look: 'кружальця цукіні' },
    { product: 'red-onion', form: 'wedge', look: 'часточки червоної цибулі' },
    { product: 'chickpeas', form: 'cooked', look: 'запечений нут' },
    { product: 'parsley', form: 'whole', look: 'петрушка' },
    { product: 'tahini', form: 'cooked', look: 'соус тахіні' },
  ],
};
