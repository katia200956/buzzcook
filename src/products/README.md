# Product library (3D)

Real 3D models of food products that recipe scenes can reuse by name instead of generating an
ingredient from scratch.

```tsx
import { findProduct } from '../products/catalog';
import { ProductView } from '../products/ProductView';

<ProductView product="хліб" size={200} />   // name, alias or id
findProduct("м'ясо")?.model                  // the GLB url, for your own three.js scene
```

All products can be browsed at the `/products` route.

## How a product is made

1. **Photo.** Higgsfield `generate_image` (`gpt_image_2_5`, 1:1): one item, three-quarter view,
   whole object in frame, plain white background, soft light, no props.
2. **3D.** Higgsfield `generate_3d` with `tripo_h3_1_image_to_3d`, passing the photo's job id:
   `texture_quality: detailed`, `geometry_quality: detailed`, `pbr: true`, `face_limit: 20000`
   (about 12 credits).
3. **Shrink for phones** (Higgsfield sandbox, Node 20):
   ```sh
   npm i @gltf-transform/cli@4.1.1 sharp@0.33.5   # newer sharp needs a newer Node
   npx gltf-transform optimize raw.glb t.glb --compress quantize --texture-compress auto \
     --texture-size 1024 --simplify false --palette false
   npx gltf-transform jpeg t.glb product.glb --quality 85
   ```
   No Draco or Meshopt: their decoders need WebAssembly, which Hermes does not run.
   Result is 1–2 MB per product.
4. **Upload** with Higgsfield `media_upload` (a `.glb` filename stores it as a permanent file),
   PUT from the sandbox, `media_confirm` with type `file`, and add the returned url to
   `catalog.ts`.
5. **Check** by rendering a turntable (three.js in headless Chromium inside the sandbox) before
   adding it.

Poly Haven (CC0) also has scanned produce that fits the library: apple, avocado, lemon, lime,
kiwi, onion, ginger, sweet potato, pomegranate, bananas, croissant, burger buns.

## Making it look real, not plastic

Generated textures are flat and evenly coloured, which reads as a toy. What works (checked on the
tomato against a studio photo of real beefsteak tomatoes):

- Generate the source photo as the real variety (ribbed beefsteak, not a perfect ball), on white,
  in soft daylight, satin skin with only a broad soft highlight. Meshy 7 keeps that shape best.
- Use `finish: 'skin'` for whole fruit and vegetables. `skin.ts` adds colour drift, pores, uneven
  shine and micro-bumps in shader, so every product gets it without new textures.
- Preview on a light background with a soft overhead key and gentle contact shadow, the way food
  is photographed; dark dramatic backdrops exaggerate gloss.
