# Lemon built as real anatomy (see ../STANDARD.md and Katusha's reference photo): pebbly yellow
# peel with a pointed tip, a thick white pith, ten juice segments split by thin white membranes
# around a white core, and a few cream seeds. Metres, Z up, standing on z = 0.
#   python3 lemon.py outdir   ->  whole.glb, half.glb, slices.glb
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
from lib import material, revolve, loft, wedge_outline, inside, cut, export, obj_from_bm, boolean, MAT

out = sys.argv[-1]
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)

A, C = 0.029, 0.035            # equator radius, half height of the body
ZC = C + 0.003                 # body centre (a small stem point below)
TIP = ZC + C + 0.008           # top of the blossom-end nipple
N = 10                         # segments
GAP = 0.01

material('peel', '#f6cf14', 0.4)
material('pith', '#f8f4e2', 0.6)
material('flesh', '#f9d633', 0.15)
material('seed', '#efe2bd', 0.4)

def smax(a, b, k=4.0):
    return (a ** k + b ** k) ** (1 / k)

def bumps(z, a):
    # Slow unevenness of a real lemon: slightly flattened, a little lopsided, gently lumpy.
    return (1 + 0.035 * math.cos(2 * a + 0.4) + 0.012 * math.sin(3 * a + 20 * z)
            + 0.006 * math.sin(7 * a + 90 * z) * math.cos(5 * a - 60 * z))

def outer(z, a):
    t = (z - ZC) / C
    body = A * math.sqrt(max(0.0, 1 - t * t))
    nip = 0.0072 * math.sqrt(max(0.0, (TIP - z) / 0.016)) if z > TIP - 0.016 else 0.0
    stem = 0.0045 * math.sqrt(max(0.0, z / 0.007)) if z < 0.007 else 0.0
    return smax(smax(body, nip), stem) * bumps(z, a)

def ellipsoid(a_, c_):
    return lambda z, a: a_ * math.sqrt(max(0.0, 1 - ((z - ZC) / c_) ** 2)) * bumps(z, a)

body = revolve('body', 'peel', outer, 0.0, TIP, rings=90, segs=112)
PA, PC = A - 0.0013, C - 0.002          # inside the thin yellow rind: the white pith
pithvol = revolve('pithvol', 'pith', ellipsoid(PA, PC), ZC - PC, ZC + PC, rings=60, segs=96)
FA, FC = A - 0.0043, C - 0.0075         # inside the pith: the juicy part
RC, D = 0.0032, 0.00035                 # white core radius, half a membrane
# Membrane angles, unevenly spaced like a real lemon's (segments differ a little in size).
WALLS = [2 * math.pi * k / N + 0.12 * math.sin(k * 2.3) for k in range(N)]
WALLS.append(WALLS[0] + 2 * math.pi)

def seg_ring(k, z, inset=0.0):
    t = (z - ZC) / FC
    ro = FA * math.sqrt(max(0.0, 1 - t * t)) * bumps(z, 0) - inset
    a0, a1 = WALLS[k], WALLS[k + 1]
    pts = wedge_outline((a0 + a1) / 2, (a1 - a0) / 2, RC + inset, max(ro, RC + inset + 0.0015), D + inset, m=40)
    c = sum(pts, Vector((0, 0))) / len(pts)
    e = (1 - min(1.0, abs(t)) ** 3) ** 0.4
    return [Vector((c.x + (p.x - c.x) * e, c.y + (p.y - c.y) * e, z)) for p in pts], pts

def segments(inset, name, mat):
    rings = []
    for k in range(N):
        rows = []
        for i in range(30):
            t = -math.cos(math.pi * (i + 0.5) / 30) * 0.97
            rows.append(seg_ring(k, ZC + FC * t, inset)[0])
        rings.append(loft(f'{name}{k}', mat, rows))
    bpy.ops.object.select_all(action='DESELECT')
    for o in rings: o.select_set(True)
    bpy.context.view_layer.objects.active = rings[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active; ob.name = name
    return ob

cavity = segments(0.0, 'cavity', 'pith')
juice = segments(0.00015, 'juice', 'flesh')

# Seeds: a few cream teardrops near the core, lying flat, pointing outwards.
bm = bmesh.new(); placed = []
while len(placed) < 13:
    k = random.randrange(N); z = ZC + random.uniform(-0.013, 0.011)
    th = (WALLS[k] + WALLS[k + 1]) / 2 + random.uniform(-0.1, 0.1)
    r = random.uniform(0.0055, 0.009)
    q = Vector((r * math.cos(th), r * math.sin(th), z))
    if any((q - p).length < 0.007 for p in placed): continue
    placed.append(q)
    g = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=1)
    for v in g['verts']:
        x, y, zz = v.co
        v.co = (x * 0.0042 * (1 + 0.25 * x), y * 0.0021, zz * 0.0014)
    rot = Matrix.Rotation(th + random.uniform(-0.3, 0.3), 4, 'Z') @ Matrix.Rotation(random.uniform(-0.4, 0.4), 4, 'X')
    bmesh.ops.transform(bm, matrix=Matrix.Translation(q) @ rot, verts=g['verts'])
for f in bm.faces: f.smooth = True
seeds = obj_from_bm(bm, 'seeds', 'seed')

rind = boolean(body, pithvol, 'DIFFERENCE')
pith = boolean(pithvol, cavity, 'DIFFERENCE', tolerant=True)
parts = [dict(obj=rind, cap='peel'), dict(obj=pith, cap='pith', tolerant=True),
         dict(obj=juice, cap='flesh', recess=0.0002, tolerant=True), dict(obj=seeds, cap='seed', loose=True)]

whole = body.copy(); whole.data = body.data.copy(); whole.name = 'whole'
bpy.context.scene.collection.objects.link(whole)
export([whole], out + '/whole.glb')

bot = cut(parts, None, ZC, 'half_bottom'); top = cut(parts, ZC, None, 'half_top')
top.rotation_euler = (math.pi, 0.2, 0)
top.location = (2 * A + 0.012, 0, bot.location.z)
export([top, bot], out + '/half.glb')

bounds = [None, ZC - 0.012, ZC - 0.003, ZC + 0.0065, None]
pieces = []
for i in range(len(bounds) - 1):
    p = cut(parts, bounds[i], bounds[i + 1], f'slice_{i}')
    p.location.z += i * GAP
    pieces.append(p)
export(pieces, out + '/slices.glb')
print('done', len(placed), 'seeds')
