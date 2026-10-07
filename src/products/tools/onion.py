# Red onion built as real anatomy (see ../STANDARD.md and Katusha's reference photo): ten nested
# fleshy layers, each a separate shell with a thin purple skin on the outside, slightly off-centre
# around a small core, all growing from a flat root plate and narrowing into a dry neck.
# Metres, Z up, root plate on z = 0.
#   python3 onion.py outdir   ->  whole.glb, half.glb (cut root to neck), slices.glb (rings)
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import material, revolve, cut, export, join, shell, obj_from_bm, MAT

out = sys.argv[-1]
random.seed(5)
bpy.ops.wm.read_factory_settings(use_empty=True)

A, C = 0.039, 0.029            # equator radius, half height of the bulb
ZC = C + 0.002
TOP = ZC + C + 0.009           # end of the neck
LAYERS, STEP = 10, 0.086       # layers, and how much each is scaled down from the one outside it
BAND = 0.013                   # purple skin of each layer, as a fraction of the scale
GAP = 0.004                    # thin air gap between layers, same units
SLICE_GAP = 0.011

material('skin', '#9a3a72', 0.35)
material('flesh', '#f4e6ee', 0.2)
material('calyx', '#7a5232', 0.8)

def smax(a, b, k=4.0):
    return (a ** k + b ** k) ** (1 / k)

def outer(z, a):
    t = (z - ZC) / C
    body = A * math.sqrt(max(0.0, 1 - t * t))
    # Above the shoulder the bulb blends smoothly into the narrow neck.
    zs = ZC + 0.014
    neck = 0.006 + 0.026 * max(0.0, (TOP - z) / (TOP - zs)) ** 1.4
    b = min(1.0, max(0.0, (z - zs) / 0.012)); b = b * b * (3 - 2 * b)
    lump = 1 + 0.025 * math.cos(2 * a + 1.1) + 0.01 * math.sin(3 * a + 40 * z)
    return (body * (1 - b) + neck * b) * lump

def layer_surface(s, name, mat, dx, detail=(28, 50)):
    """The outer surface scaled by s around the root, so every layer grows from the root plate."""
    pivot = 0.004
    def r(z, a):
        zz = pivot + (z - pivot) / s
        return outer(zz, a) * s
    ob = revolve(name, mat, r, pivot + (0.0 - pivot) * s + 0.0006, pivot + (TOP - pivot) * s, rings=detail[0], segs=detail[1])
    ob.data.transform(Matrix.Translation((dx, 0.0004 * math.sin(dx * 9000), 0)))
    return ob

purples, fleshes = [], []
for i in range(LAYERS):
    s = 1 - i * STEP; dx = 0.00065 * i
    a = layer_surface(s, f'L{i}a', 'skin', dx, (64, 100) if i == 0 else (28, 50))
    if i == 0:
        outside = a.copy(); outside.data = a.data.copy(); bpy.context.scene.collection.objects.link(outside)
    b = layer_surface(s - BAND, f'L{i}b', 'flesh', dx)
    c = layer_surface(s - STEP + GAP, f'L{i}c', 'flesh', dx + 0.00065)
    b2 = b.copy(); b2.data = b.data.copy(); bpy.context.scene.collection.objects.link(b2)
    b2.data.materials[0] = MAT['flesh']
    purples.append(shell(a, b, f'P{i}'))
    fleshes.append(shell(b2, c, f'F{i}'))
core = layer_surface(1 - LAYERS * STEP, 'core', 'flesh', 0.00065 * LAYERS)
fleshes.append(core)
skin = join(purples, 'skin'); flesh = join(fleshes, 'flesh')

# Dry neck tuft and root plate.
bm = bmesh.new()
for j in range(14):
    a = 2 * math.pi * j / 14 + random.uniform(-0.2, 0.2)
    g = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=0.0011, radius2=0.0002, depth=0.008)
    tilt = Matrix.Rotation(random.uniform(0.15, 0.5), 4, Vector((-math.sin(a), math.cos(a), 0)))
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0.004 * math.cos(a), 0.004 * math.sin(a), TOP + 0.002)) @ tilt, verts=g['verts'])
g = bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=0.009, radius2=0.011, depth=0.0016)
bmesh.ops.translate(bm, vec=(0, 0, 0.0009), verts=g['verts'])
tuft = obj_from_bm(bm, 'calyx', 'calyx')

parts = [dict(obj=skin, cap='skin'), dict(obj=flesh, cap='flesh')]

whole = join([outside, tuft], 'whole')
export([whole], out + '/whole.glb')

bounds = [None, 0.011, 0.021, 0.031, 0.041, None]
pieces = []
for i in range(len(bounds) - 1):
    extras = []
    if i == 0 or i == len(bounds) - 2:
        t = tuft.copy(); t.data = tuft.data.copy(); bpy.context.scene.collection.objects.link(t)
        keep = [dict(obj=t, cap='calyx')]
        tb = cut(keep, bounds[i], bounds[i + 1], f'tuft_{i}')
        tb.data.transform(Matrix.Translation(tb.location)); tb.location = (0, 0, 0)
        if tb.data.vertices: extras.append(tb)
    p = cut(parts, bounds[i], bounds[i + 1], f'slice_{i}', extras)
    p.location.z += i * SLICE_GAP
    pieces.append(p)
export(pieces, out + '/slices.glb')

# Half: an onion is halved from root to neck, so lay it on its side and cut through the middle.
lay = Matrix.Translation((0, 0, A)) @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ Matrix.Translation((0, 0, -ZC))
side = []
for p in parts + [dict(obj=tuft, cap='calyx')]:
    o = p['obj'].copy(); o.data = p['obj'].data.copy(); bpy.context.scene.collection.objects.link(o)
    o.data.transform(lay); side.append(dict(obj=o, cap=p['cap'], tolerant=p['cap'] == 'skin'))
# Knife a hair off the axis, so it does not run exactly through the layers' seam vertices.
bot = cut(side, None, A + 0.0003, 'half_bottom'); top = cut(side, A + 0.0003, None, 'half_top')
top.rotation_euler = (math.pi, 0, 0)
top.location = (top.location.x, 2 * A + 0.012, bot.location.z)
export([top, bot], out + '/half.glb')
print('done')
