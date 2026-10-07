# 3D food library standard

Approved by Katusha on 2026-10-07. Every product in the library follows it, so a recipe scene can
put any ingredients side by side, cut them and mix them without per-product fixes.

## Principle

Each product is built once, from real reference photos, and reused by every recipe. A recipe line
such as "Помідор — 100 г, кубики" becomes: find the product → pick the state → work out how many
pieces make 100 g → place the pieces → play the cooking action. Nothing is generated per recipe.

## Reference first

No product is modelled before its reference photos are analysed. For each product, note from the
photos: shape and proportions, asymmetry, skin texture and shine, colour (outside and inside),
internal structure (walls, chambers, seeds, core, layers), moisture, and how it looks when cut.
These notes go into the product's metadata (`look`) and drive the model.

## Geometry

- **Scale:** metres, real size. A medium tomato is about 0.07 m across.
- **Axes:** glTF, Y up, −Z forward. In Blender (Z up) the exporter converts this.
- **Pivot:** whole product: centre of its base, at Y = 0, on its natural growth axis (stem end up
  where it has one). Each piece (slice, cube, half): its own centre of mass, so it can spin and fall
  naturally in an animation.
- **Inside is real geometry.** Wherever a cut shows the inside, the walls, chambers, gel, seeds,
  core and layers are modelled in 3D and cut part by part. Never a photo on a flat cut.
- **Imperfections:** no perfect symmetry. Shapes, pieces, seeds and cut thickness vary a little
  from piece to piece, with a fixed random seed so a rebuild gives the same product.
- **One source per product:** every state is cut from the same Blender build of the whole
  product, so a slice is visibly the same tomato as the whole one.
- **Pieces are separate nodes** in the GLB (`slice_0` … `slice_N`, `cube_0` …, `half_top`,
  `half_bottom`), so animations can move each one.

## States

State ids (the `Form` type in `catalog.ts`) and the file names in a product's folder:

| State     | File            | What it is                                  |
|-----------|-----------------|---------------------------------------------|
| whole     | `whole.glb`     | the complete product                        |
| half      | `half.glb`      | cut exactly in half                         |
| quarter   | `quarter.glb`   | four wedges                                 |
| slice     | `slices.glb`    | rounds; thin, medium and thick sets         |
| strips    | `strips.glb`    | long strips                                 |
| cubes     | `cubes.glb`     | regular cooking cubes, about 1.5 cm         |
| diced     | `diced.glb`     | small irregular pieces, about 0.5–0.8 cm    |
| chopped   | `chopped.glb`   | finely chopped                              |
| mashed    | `mashed.glb`    | mashed, crushed or puréed                   |
| peeled    | `peeled.glb`    | whole product without its skin              |
| cooked    | `cooked.glb`    | cooked look of the most common cut          |
| wedge     | `wedge.glb`     | wedges (lemon, potato)                      |

Plus product-specific parts where they make sense (`skin.glb`, `seeds.glb`, `flesh.glb`). States
that make no sense for a product (mashed bread, peeled egg yolk) are skipped.

## Materials

Shared names, so `ProductView` and `inside.ts` give each part the same look in every product:
`skin`, `peel`, `flesh`, `gel`, `seed`, `pith`, `core`, `calyx`, `crust`, `crumb`, `yolk`,
`white`, `fat`, `meat`. A material carries a base colour; textures only where a photo-real surface
needs them (bread crust, meat grain). Wet parts use a clear coat; cut flesh is always wet.

## Folder and files

```
products/<id>/
  whole.glb  half.glb  quarter.glb  slices.glb  …   one GLB per state
  materials  shared material names (above), no per-product names
  textures/  only when needed, 1024 px JPEG
  meta       entry in src/products/metadata.ts
```

GLBs are hosted on the Higgsfield CDN and listed in `catalog.ts`; the Blender build script lives
in `src/products/tools/<id>.py`.

## Metadata

Every product has an entry in `metadata.ts` (type `ProductMeta`): real size, weight and density,
weight of one piece for each state (to turn grams into a piece count), edible parts, common
preparation, available and planned states, recommended cooking actions, and the `look` notes taken
from the reference photos.

## Phones

GLBs stay under about 2.5 MB each. No Draco or Meshopt compression (Hermes cannot run their
WebAssembly decoders). Textures 1024 px JPEG at most.

## Checking

Every state is checked with still renders (no videos) against the reference photo before it is
added to the catalog.

## Current status

The tomato's `whole`, `half` and `slice` were built before this standard, in units where the
tomato is 1 across. They are re-exported in metres when the remaining tomato states are built, so
all tomato states come from one build.
