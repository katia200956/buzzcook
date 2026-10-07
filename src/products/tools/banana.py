# Banana built as real anatomy (see ../STANDARD.md and Katusha's reference photo): a curved fruit
# with five soft ridges, a 3 mm peel (yellow outside, cream inside), creamy flesh, and a tan
# three-armed core with tiny dark seed dots running its length. Metres, Z up, tip on z = 0, stem up.
#   python3 banana.py outdir  ->  whole.glb, peeled.glb, half.glb, slices.glb
# The middle slices are peeled like in the reference; the two end pieces keep their peel.
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import material, loft, cut, export, join, shell, obj_from_bm, MAT

out = sys.argv[-1]
random.seed(3)
bpy.ops.wm.read_factory_settings(use_empty=True)

L = 0.18                       # length along the curve
R = 0.0195                     # radius of the body
BEND = 0.07                    # how much the banana curves
GAP = 0.009

material('peel', '#f6d34a', 0.45)
material('pith', '#efe6c4', 0.6)        # inside of the peel, seen on its cut
material('flesh', '#f4dea0', 0.5)
material('core', '#c9a46a', 0.5)
material('seed', '#3b2a1c', 0.4)
material('calyx', '#4f3f26', 0.8)

def centre(s):
    """Point on the banana's curved axis at s (0 = tip, 1 = stem end)."""
    return Vector((BEND * (s - 0.5) ** 2 - BEND * 0.25 * s, 0.0, L * s * 0.97))

def frame(s):
    t = (centre(min(1, s + 1e-3)) - centre(max(0, s - 1e-3))).normalized()
    n = Vector((0, 1, 0)); b = t.cross(n).normalized(); n = b.cross(t)
    return t, n, b

def radius(s):
    tip = min(1.0, s / 0.12) ** 0.55                 # blunt flower end
    neck = 1 - 0.68 * max(0.0, (s - 0.78) / 0.22) ** 1.3    # narrows to the stem
    return R * tip * neck

def tube(name, mat, r_of, s0, s1, ridge, n=60, m=48):
    rings = []
    for i in range(n + 1):
        s = s0 + (s1 - s0) * i / n
        c = centre(s); t, nn, b = frame(s); r = max(r_of(s), 0.0008)
        ring = []
        for j in range(m):
            a = 2 * math.pi * j / m
            rr = r * (1 + ridge * math.cos(5 * a) + 0.015 * math.sin(3 * a + 11 * s))
            ring.append(c + (nn * math.cos(a) + b * math.sin(a)) * rr)
        rings.append(ring)
    return loft(name, mat, rings)

outer = tube('outer', 'peel', radius, 0.0, 0.93, 0.032, n=90, m=64)
flesh_r = lambda s: max(0.0, radius(s) - 0.003 - 0.004 * max(0.0, s - 0.75) / 0.25)
fleshsurf = tube('fleshsurf', 'flesh', flesh_r, 0.035, 0.86, 0.02, n=70, m=48)

# Core: a thin three-armed star running down the middle, with tiny dark seeds along its arms.
def star(s, a):
    return 0.0016 + 0.0042 * max(0.0, math.cos(3 * (a - 0.4))) ** 8
rings = []
for i in range(41):
    s = 0.07 + 0.74 * i / 40
    c = centre(s); t, nn, b = frame(s)
    k = min(1.0, (s - 0.07) / 0.05, (0.81 - s) / 0.05) ** 0.5
    rings.append([c + (nn * math.cos(a) + b * math.sin(a)) * star(s, a) * max(k, 0.25)
                  for a in (2 * math.pi * j / 60 for j in range(60))])
core = loft('core', 'core', rings)

bm = bmesh.new()
for i in range(170):
    s = random.uniform(0.1, 0.78); arm = random.randrange(3)
    a = 0.4 + arm * 2 * math.pi / 3 + random.uniform(-0.12, 0.12)
    c = centre(s); t, nn, b = frame(s)
    p = c + (nn * math.cos(a) + b * math.sin(a)) * random.uniform(0.0015, 0.0045)
    g = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=random.uniform(0.0004, 0.0006))
    bmesh.ops.translate(bm, vec=p, verts=g['verts'])
seeds = obj_from_bm(bm, 'seeds', 'seed')

core_copy = core.copy(); core_copy.data = core.data.copy(); bpy.context.scene.collection.objects.link(core_copy)
flesh_copy = fleshsurf.copy(); flesh_copy.data = fleshsurf.data.copy(); bpy.context.scene.collection.objects.link(flesh_copy)
outer_copy = outer.copy(); outer_copy.data = outer.data.copy(); bpy.context.scene.collection.objects.link(outer_copy)
peel = shell(outer_copy, flesh_copy, 'peel')
flesh = shell(fleshsurf, core_copy, 'flesh')

# Stem and dark flower-end tip.
bm = bmesh.new()
for s0, s1, r0, r1 in ((0.92, 1.0, 0.0058, 0.0062), (-0.012, 0.012, 0.0035, 0.0045)):
    c0, c1 = centre(max(0, s0)), centre(s1)
    if s0 < 0: c0 = centre(0) - Vector((0, 0, 0.002))
    g = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=r0, radius2=r1, depth=(c1 - c0).length)
    d = (c1 - c0).normalized()
    rot = Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((c0 + c1) / 2) @ rot, verts=g['verts'])
for f in bm.faces: f.smooth = True
ends = obj_from_bm(bm, 'ends', 'calyx')

with_peel = [dict(obj=peel, cap='pith'), dict(obj=flesh, cap='flesh'), dict(obj=core, cap='core'),
             dict(obj=seeds, cap='seed', loose=True), dict(obj=ends, cap='calyx')]
peeled_parts = with_peel[1:4]

whole = join([outer, ends], 'whole')
export([whole], out + '/whole.glb')
peeled = join([fleshsurf, core], 'peeled')
export([peeled], out + '/peeled.glb')

mid = L * 0.5
bot = cut(with_peel, None, mid, 'half_bottom'); top = cut(with_peel, mid, None, 'half_top')
top.rotation_euler = (math.pi, 0, 0)
top.location = (top.location.x + 0.05, 0, bot.location.z)
export([top, bot], out + '/half.glb')

bounds = [None, 0.052, 0.067, 0.082, 0.097, 0.112, None]
pieces = []
for i in range(len(bounds) - 1):
    end = i == 0 or i == len(bounds) - 2
    p = cut(with_peel if end else peeled_parts, bounds[i], bounds[i + 1], f'slice_{i}')
    p.location.z += i * GAP
    pieces.append(p)
export(pieces, out + '/slices.glb')
print('done')
