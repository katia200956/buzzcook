# A tomato built in Blender as real anatomy, so every cut shows true 3D insides instead of a
# picture on a flat cap: skin, a thick red wall (pericarp), radial walls (septa) meeting in a pale
# core (columella), locule cavities filled with glossy gel that sits a little below the cut, and
# flat oval seeds standing in the gel (some sliced through, like a real knife does). Matched to
# Katusha's floating-slices reference photo: round, red-orange, 7 chambers, green calyx.
# Runs headless with the bpy wheel (pip install bpy; tested with 4.2 and 5.2):
#   python3 tomato.py outdir
# Writes whole.glb, half.glb (half_bottom, and half_top turned cut side up next to it) and slices.glb (slice_0 = bottom ... slice_4).
# Units: diameter 1, standing on z = 0. Materials are named skin, flesh, gel, seed, calyx;
# ProductView gives each its real-world look.
import math, os, random, sys
import bpy, bmesh
from mathutils import Vector, Matrix

out = sys.argv[-1]
random.seed(7)

R, HZ = 0.5, 0.4          # equator radius, half height
ZC = HZ                   # centre height
N = 7                     # locules (chambers)
PHASE = 0.3
WALL = 0.072              # outer wall thickness at the equator
SEPTUM = 0.034            # radial wall thickness
HL = 0.325                # locule half height
RECESS = 0.005            # how far the gel sits below a cut
HALF_GAP = float(os.environ.get('HALF_GAP', '0.3'))
SLICE_GAP = float(os.environ.get('SLICE_GAP', '0.3'))


def material(name, rgb, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    return m

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

MAT = {
    'skin': material('skin', srgb('#d8321a'), 0.25),
    'flesh': material('flesh', srgb('#e4441f'), 0.3),
    'gel': material('gel', srgb('#d94a1c'), 0.05),
    'seed': material('seed', srgb('#e9c46a'), 0.35),
    'calyx': material('calyx', srgb('#4a7a2c'), 0.5),
}

def obj_from_bm(bm, name, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(MAT[mat])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def body_radius(z):
    t = (z - ZC) / HZ
    return R * math.sqrt(max(0.0, 1 - t * t))

def dimple(rho, top):
    return 0.032 * math.exp(-(rho / 0.1) ** 2) if top else 0.008 * math.exp(-(rho / 0.05) ** 2)

# ---------------------------------------------------------------- body (the skin)
def make_body():
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=112, v_segments=72, radius=1)
    for v in bm.verts:
        x, y, zz = v.co
        th = math.atan2(y, x)
        rho = math.hypot(x, y) * R
        # Very soft shoulders over each chamber, strongest at the equator.
        rho *= 1 + 0.012 * math.cos(N * (th - PHASE)) * (1 - zz * zz) + 0.004 * math.cos(3 * th + 1)
        z = ZC + HZ * zz
        z += -dimple(rho, True) if zz > 0 else dimple(rho, False)
        v.co = (rho * math.cos(th), rho * math.sin(th), z)
    for f in bm.faces: f.smooth = True
    return obj_from_bm(bm, 'body', 'skin')

# ---------------------------------------------------------------- locules (gel chambers)
def chaikin(pts, n):
    for _ in range(n):
        q = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            q += [a * 0.75 + b * 0.25, a * 0.25 + b * 0.75]
        pts = q
    return pts

def resample(pts, m):
    seg = [(pts[(i + 1) % len(pts)] - pts[i]).length for i in range(len(pts))]
    total = sum(seg); out_, acc, i = [], 0.0, 0
    for k in range(m):
        s = total * k / m
        while acc + seg[i] < s: acc += seg[i]; i += 1
        f = (s - acc) / seg[i] if seg[i] else 0
        out_.append(pts[i].lerp(pts[(i + 1) % len(pts)], f))
    return out_

JIT = [(random.uniform(-0.06, 0.06), random.uniform(0.92, 1.06)) for _ in range(N)]

def outline(k, z, inset, m=56):
    """Closed outline of chamber k at height z, shrunk by inset (the gel sits inside the cavity)."""
    t = max(-1.0, min(1.0, (z - ZC) / HL))
    twist = 0.12 * t
    rb = body_radius(z)
    ro = rb - (WALL + 0.035 * t * t) - inset
    rc = 0.08 + 0.035 * max(0.0, t) ** 2 + 0.01 * max(0.0, -t) ** 2 + inset
    d = SEPTUM / 2 + inset
    half = math.pi / N
    th = 2 * math.pi * k / N + PHASE + JIT[k][0] + twist
    ta, tb = th - half, th + half
    ua, ub = Vector((math.cos(ta), math.sin(ta))), Vector((math.cos(tb), math.sin(tb)))
    na, nb = Vector((-ua.y, ua.x)), Vector((ub.y, -ub.x))
    ro = max(ro, rc + 0.01)
    pts = []
    for i in range(8):                       # side A, inward to outward
        r = rc + (ro - rc) * i / 7
        pts.append(math.sqrt(max(r * r - d * d, 0)) * ua + d * na)
    a0, a1 = ta + math.asin(min(1, d / ro)), tb - math.asin(min(1, d / ro))
    for i in range(1, 12):                   # outer arc
        a = a0 + (a1 - a0) * i / 12
        pts.append(Vector((math.cos(a), math.sin(a))) * ro)
    for i in range(8):                       # side B, outward to inward
        r = ro - (ro - rc) * i / 7
        pts.append(math.sqrt(max(r * r - d * d, 0)) * ub + d * nb)
    b0, b1 = tb - math.asin(min(1, d / rc)), ta + math.asin(min(1, d / rc))
    for i in range(1, 5):                    # inner arc, near the core
        a = b0 + (b1 - b0) * i / 5
        pts.append(Vector((math.cos(a), math.sin(a))) * rc)
    pts = resample(chaikin(pts, 3), m)
    # Round the chamber off towards its ends, like the real cavities.
    c = sum(pts, Vector((0, 0))) / len(pts)
    e = (1 - min(1.0, abs(t)) ** 2.2) ** 0.45 * JIT[k][1]
    res = []
    for p in pts:
        # Real chambers are never neat wedges: a soft, slowly changing wobble along the outline.
        v = p - c; a = math.atan2(v.y, v.x)
        w = 1 + 0.05 * math.sin(3 * a + 1.7 * k + 5 * t) + 0.025 * math.sin(5 * a + k + 3 * t)
        res.append(c + v * e * w)
    return res, c

def make_locules(inset, name, mat):
    bm = bmesh.new(); L, M = 34, 56
    for k in range(N):
        rings = []
        for i in range(L):
            t = -math.cos(math.pi * (i + 0.5) / L) * 0.985
            z = ZC + HL * t
            pts, _ = outline(k, z, inset, M)
            rings.append([bm.verts.new((p.x, p.y, z)) for p in pts])
        for i in range(L - 1):
            for j in range(M):
                a, b = rings[i][j], rings[i][(j + 1) % M]
                c, d = rings[i + 1][(j + 1) % M], rings[i + 1][j]
                bm.faces.new((a, b, c, d))
        for ring, sign in ((rings[0], -1), (rings[-1], 1)):
            cen = sum((v.co for v in ring), Vector()) / M
            tip = bm.verts.new((cen.x, cen.y, cen.z + sign * 0.006))
            for j in range(M):
                f = (ring[j], ring[(j + 1) % M], tip) if sign > 0 else (ring[(j + 1) % M], ring[j], tip)
                bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = True
    return obj_from_bm(bm, name, mat)

def inside(pts, p):
    n, ins = len(pts), False
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        if (a.y > p.y) != (b.y > p.y) and p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x:
            ins = not ins
    return ins

# ---------------------------------------------------------------- seeds
def make_seeds():
    bm = bmesh.new(); placed = []
    for k in range(N):
        n = 0; tries = 0
        while n < 46 and tries < 6000:
            tries += 1
            t = random.uniform(-0.88, 0.88); z = ZC + HL * t
            pts, c = outline(k, z, 0.016)
            # Seeds hang on the placenta, so they crowd the inner half of the chamber near the core.
            th = math.atan2(c.y, c.x) + random.uniform(-0.75, 0.75) * math.pi / N
            r = random.uniform(0.09, 0.09 + 0.62 * (body_radius(z) - WALL - 0.09))
            p = Vector((math.cos(th), math.sin(th))) * r
            if not inside(pts, p): continue
            q = Vector((p.x, p.y, z))
            if any((q - o).length < 0.03 for o in placed): continue
            placed.append(q); n += 1
            s = random.uniform(0.85, 1.15)
            g = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1)
            vs = g['verts']
            # Flat teardrop: long axis pointing out from the core, flat face mostly up.
            yaw = th + random.uniform(-0.45, 0.45)
            rot = (Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(random.uniform(-0.6, 0.6), 4, 'X')
                   @ Matrix.Rotation(random.uniform(-0.35, 0.35), 4, 'Y'))
            for v in vs:
                x, y, zz = v.co
                x *= 0.023 * s * (1 + 0.18 * x)          # slightly pointed towards the attachment end
                v.co = (x, y * 0.016 * s, zz * 0.0062 * s)
            bmesh.ops.transform(bm, matrix=Matrix.Translation(q) @ rot, verts=vs)
    for f in bm.faces: f.smooth = True
    return obj_from_bm(bm, 'seeds', 'seed'), placed

# ---------------------------------------------------------------- calyx and stem
def surface_z(rho):
    return ZC + HZ * math.sqrt(max(0, 1 - (rho / R) ** 2)) - dimple(rho, True)

def make_calyx():
    bm = bmesh.new()
    top = surface_z(0)
    # Stem: a short bent tube.
    rings, S = [], 12
    for i in range(9):
        s = i / 8
        cen = Vector((0.035 * s * s, 0.012 * s, top - 0.01 + 0.13 * s))
        rr = 0.03 - 0.008 * s + (0.012 if i == 0 else 0)
        rings.append([bm.verts.new(cen + Vector((math.cos(2 * math.pi * j / S), math.sin(2 * math.pi * j / S), 0)) * rr)
                      for j in range(S)])
    for i in range(8):
        for j in range(S):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % S], rings[i + 1][(j + 1) % S], rings[i + 1][j]))
    bm.faces.new(rings[-1]); bm.faces.new(list(reversed(rings[0])))
    # Sepals: tapered, ridged leaves lying on the shoulder, tips curling up and out.
    for j in range(6):
        phi = 2 * math.pi * j / 6 + random.uniform(-0.2, 0.2)
        length = random.uniform(0.22, 0.3); curl = random.uniform(0.05, 0.13)
        u = Vector((math.cos(phi), math.sin(phi), 0)); n = Vector((-u.y, u.x, 0))
        prev = None; K = 14
        for i in range(K + 1):
            s = i / K
            rho = 0.015 + length * s
            bend = 0.04 * math.sin(s * 2.4) * (1 if j % 2 else -1)
            cen = u * rho + n * bend
            cen.z = surface_z(rho) + 0.006 + curl * s ** 3
            w = 0.046 * min(1, s * 5 + 0.35) * (1 - s) ** 0.7 + 0.002
            row = [bm.verts.new(cen + n * w * a + Vector((0, 0, 0.004 * (1 - abs(a))))) for a in (-1, 0, 1)]
            if prev:
                bm.faces.new((prev[0], prev[1], row[1], row[0])); bm.faces.new((prev[1], prev[2], row[2], row[1]))
            prev = row
    for f in bm.faces: f.smooth = True
    ob = obj_from_bm(bm, 'calyx', 'calyx')
    mod = ob.modifiers.new('thick', 'SOLIDIFY'); mod.thickness = 0.005
    return bake(ob)

# ---------------------------------------------------------------- booleans
def bake(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    new = bpy.data.objects.new(ob.name, me); bpy.context.scene.collection.objects.link(new)
    bpy.data.objects.remove(ob)
    return new

def boolean(a, b, op):
    c = a.copy(); c.data = a.data.copy(); bpy.context.scene.collection.objects.link(c)
    mod = c.modifiers.new('b', 'BOOLEAN'); mod.operation = op; mod.solver = 'EXACT'
    mod.object = b; mod.material_mode = 'TRANSFER'
    return bake(c)

def box(za, zb, mat):
    lo = -0.2 if za is None else za; hi = 1.2 if zb is None else zb
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, (lo + hi) / 2)) @ Matrix.Diagonal((1.4, 1.4, hi - lo, 1)), verts=bm.verts)
    ob = obj_from_bm(bm, 'box', mat); ob.hide_render = True
    return ob

def flat_caps(ob):
    for p in ob.data.polygons:
        if abs(p.normal.z) > 0.9995: p.use_smooth = False

def join(objs, name):
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data.copy()
        remap = []
        for m in me.materials:
            if m.name not in [x.name for x in mats]: mats.append(m)
            remap.append([x.name for x in mats].index(m.name))
        for p in me.polygons: p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

body = make_body()
cavities = make_locules(0.0, 'cavities', 'flesh')
gel = make_locules(0.0025, 'gel', 'gel')
seeds, placed = make_seeds()
calyx = make_calyx()
pericarp = boolean(body, cavities, 'DIFFERENCE')
H = max(v.co.z for v in body.data.vertices)
print('seeds', len(placed), 'height', round(H, 3))

def piece(za, zb, name, with_calyx):
    parts = [boolean(pericarp, box(za, zb, 'flesh'), 'INTERSECT')]
    ga = None if za is None else za + RECESS; gb = None if zb is None else zb - RECESS
    parts.append(boolean(gel, box(ga, gb, 'gel'), 'INTERSECT'))
    # Seeds stay with the slice their middle is in; ones crossing the knife are cut through.
    keep = bmesh.new(); keep.from_mesh(seeds.data)
    lo = -9 if za is None else za + 0.002; hi = 9 if zb is None else zb - 0.002
    for comp in [list(g) for g in islands(keep)]:
        cz = sum(v.co.z for v in comp) / len(comp)
        if not (lo < cz < hi): bmesh.ops.delete(keep, geom=comp, context='VERTS')
    tmp = obj_from_bm(keep, 'seeds_' + name, 'seed')
    if tmp.data.vertices: parts.append(boolean(tmp, box(za, zb, 'seed'), 'INTERSECT'))
    if with_calyx: parts.append(calyx)
    for p in parts: flat_caps(p)
    return join(parts, name)

def islands(bm):
    seen, res = set(), []
    for v in bm.verts:
        if v in seen: continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen: seen.add(o); stack.append(o)
        res.append(comp)
    return res

def export(objs, path):
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='EXPORT')

whole = join([body, calyx], 'whole')
export([whole], out + '/whole.glb')

mid = ZC
top = piece(mid, None, 'half_top', True); bot = piece(None, mid, 'half_bottom', False)
# The two halves lie side by side, both cut faces up, the way a halved tomato sits on a board.
top.rotation_euler = (math.pi, 0.25, 0)
top.location = (1 + HALF_GAP, 0, 2 * mid)
export([top, bot], out + '/half.glb')

bounds = [None] + [H * f for f in (0.2, 0.37, 0.54, 0.71)] + [None]
parts = []
for i in range(len(bounds) - 1):
    p = piece(bounds[i], bounds[i + 1], f'slice_{i}', i == len(bounds) - 2)
    p.location.z = i * SLICE_GAP
    parts.append(p)
export(parts, out + '/slices.glb')
print('done')
