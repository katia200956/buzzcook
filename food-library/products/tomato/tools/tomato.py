"""Tomato — procedural Blender build for the Buzzcook food library.

One build of the whole tomato with its real anatomy (skin wall, septa and columella, gel-filled
locules, seeds, calyx, stem); every state is cut from it. Reference analysis: ../reference.md.

Run:  python tomato.py --out <dir> [--states whole,slices] [--preview <dir>]
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))

import bpy  # noqa: E402  (must come before bmesh)
import bmesh  # noqa: E402
from mathutils import Euler, Matrix, Vector, noise  # noqa: E402

import lib  # noqa: E402
from lib import lerp, srgb  # noqa: E402

ID = "tomato"
SEED = 1001
D, H = 0.070, 0.056          # average diameter / height, metres
N_LOC = 7                    # locules (chambers)
WALL = 0.0058                # pericarp thickness at the equator
WALL_V = 0.0085              # wall under the stem and at the blossom end
SEPTUM = 0.0014
DENSITY = 0.98               # g/cm3

R = lib.rng(SEED)
OFF = Vector((R.uniform(0, 100), R.uniform(0, 100), R.uniform(0, 100)))
RIB_PHASE = R.uniform(0, 2 * math.pi)

# material slots (indices are shared by every piece mesh)
MAT_NAMES = ["juice", "skin", "flesh", "flesh_cut", "core", "core_cut", "gel", "gel_cut",
             "seed", "seed_cut", "calyx", "stem"]
M = {n: i for i, n in enumerate(MAT_NAMES)}
CUT = {"wall": M["flesh_cut"], "core": M["core_cut"], "placenta": M["core_cut"], "gel": M["gel_cut"],
       "seeds": M["seed_cut"]}
PART_ORDER = ["wall", "core", "placenta", "gel", "seeds"]


def materials():
    return [
        lib.make_material("juice", rough=0.06, coat=0.5, coat_rough=0.03, spec=0.6, alpha=0.6),
        lib.make_material("skin", rough=0.32, coat=0.12, coat_rough=0.12),
        lib.make_material("flesh", rough=0.45, coat=0.3),
        lib.make_material("flesh_cut", rough=0.42, coat=0.2, coat_rough=0.3, spec=0.35),
        lib.make_material("core", rough=0.5, coat=0.3),
        lib.make_material("core_cut", rough=0.45, coat=0.2, coat_rough=0.3, spec=0.35),
        lib.make_material("gel", rough=0.12, coat=0.6, coat_rough=0.04, spec=0.5, alpha=0.92),
        lib.make_material("gel_cut", rough=0.15, coat=0.5, coat_rough=0.08, spec=0.5, alpha=0.92),
        lib.make_material("seed", rough=0.45),
        lib.make_material("seed_cut", rough=0.4, coat=0.4),
        lib.make_material("calyx", rough=0.62, sheen=0.2),
        lib.make_material("stem", rough=0.6, sheen=0.2),
    ]


# low-poly unit seed (flattened later): 8 x 4 sphere, 26 verts
SEED_MESH = lib.grid_shell(lambda u, v: Vector((math.sin(v) * math.cos(u), math.sin(v) * math.sin(u),
                                                math.cos(v))), 8, 4)
SEED_MESH = ([Vector((p.z, p.x, p.y)) for p in SEED_MESH[0]], SEED_MESH[1])


# ------------------------------------------------------------------ shape

def shape(u, v, d, h, dimple=True, ribs=1.0):
    """Outer profile: slightly flattened, broad shoulders, faint locule ribs, asymmetry."""
    s, c = math.sin(v), math.cos(v)
    p = 0.8 if c > 0 else 1.0
    z = h / 2 * math.copysign(abs(c) ** p, c)
    rh = d / 2 * (max(s, 0.0) ** 0.92) * (1 + 0.05 * c)
    rib = math.cos(N_LOC * u + RIB_PHASE + 0.4 * math.sin(2 * u)) * s * s * (0.6 + 0.4 * max(c, 0))
    rh *= 1 + 0.014 * ribs * rib
    dv = Vector((math.cos(u) * s, math.sin(u) * s, c))
    rh *= 1 + 0.03 * noise.noise(dv * 1.3 + OFF) + 0.008 * noise.noise(dv * 3.1 + OFF * 1.7)
    z *= 1 + 0.025 * noise.noise(dv * 1.1 + OFF * 2.3)
    if dimple:
        if c > 0:
            z -= 0.0042 * math.exp(-(rh / 0.009) ** 2)
        else:
            z += 0.0008 * math.exp(-(rh / 0.003) ** 2)
    return Vector((rh * math.cos(u), rh * math.sin(u), z))


def build():
    """Returns dict with part bmeshes (in place, Z up, bottom at z=0) and helpers."""
    o_v, o_f = lib.grid_shell(lambda u, v: shape(u, v, D, H), 88, 44)
    zmin = min(p.z for p in o_v)
    o_v = [p - Vector((0, 0, zmin)) for p in o_v]
    c_v, c_f = lib.grid_shell(
        lambda u, v: shape(u, v, D - 2 * WALL, H - 2 * WALL_V, dimple=False, ribs=0.5)
        + Vector((0, 0, -zmin - 0.001)), 40, 20)
    outer_tree = lib.bvh(o_v, o_f)
    cav_tree = lib.bvh(c_v, c_f)
    wall_min = min(outer_tree.find_nearest(p)[3] for p in c_v)
    assert all(lib.inside(outer_tree, p) for p in c_v[::7]), "cavity pokes out of the skin"

    # cavity radius per height (conservative), for fitting the locules: cast rays from the
    # axis outward at many angles and keep the shortest hit
    zs = [p.z for p in c_v]
    c_lo, c_hi = min(zs), max(zs)
    zc = (c_lo + c_hi) / 2
    bins = 60
    rmin = []
    for b in range(bins):
        z = c_lo + (c_hi - c_lo) * (b + 0.5) / bins
        best = 1.0
        for k in range(36):
            a = 2 * math.pi * k / 36
            hit = cav_tree.ray_cast(Vector((0, 0, z)), Vector((math.cos(a), math.sin(a), 0)))
            if hit[0] is not None:
                best = min(best, hit[3])
        rmin.append(best if best < 1.0 else 0.0)
    rmin = [min(rmin[max(0, b - 1)], rmin[b], rmin[min(bins - 1, b + 1)]) for b in range(bins)]

    def cav_r(z):
        b = int((z - c_lo) / (c_hi - c_lo) * bins)
        return rmin[max(0, min(bins - 1, b))]

    hc = (c_hi - c_lo) / 2

    # locules: unequal wedges centred on the rib bulges
    weights = [R.uniform(0.82, 1.18) for _ in range(N_LOC)]
    tot = sum(weights)
    spans = [2 * math.pi * w / tot for w in weights]
    start = -RIB_PHASE / N_LOC - spans[0] / 2
    locs = []
    a = start
    for i in range(N_LOC):
        locs.append(dict(center=a + spans[i] / 2 + R.uniform(-0.03, 0.03), span=spans[i],
                         rin=R.uniform(0.0030, 0.0042), hz=hc * R.uniform(0.89, 0.93),
                         zc=zc + R.uniform(-0.0015, 0.0015), p=R.uniform(3.6, 4.4),
                         off=Vector((R.uniform(0, 50), R.uniform(0, 50), R.uniform(0, 50)))))
        a += spans[i]

    def loc_map(L, a3):
        """Superellipsoid coords (radial, tangential, vertical) in [-1,1] -> world point."""
        ar, at, az = a3
        z = L["zc"] + az * L["hz"]
        rout = max(cav_r(z) * 0.96 - 0.0005, L["rin"] + 0.002)
        r = L["rin"] + (ar + 1) / 2 * (rout - L["rin"])
        r += 0.0005 * noise.noise(Vector(a3) * 1.7 + L["off"])
        halfw = max(L["span"] / 2 - (SEPTUM / 2) / max(r, 1e-4), 0.03)
        ang = L["center"] + at * halfw
        return Vector((r * math.cos(ang), r * math.sin(ang), z))

    loc_meshes = []
    for L in locs:
        def fn(u, v, L=L):
            x, y, z = math.sin(v) * math.cos(u), math.sin(v) * math.sin(u), math.cos(v)
            n = (abs(x) ** L["p"] + abs(y) ** L["p"] + abs(z) ** L["p"]) ** (1 / L["p"])
            return loc_map(L, (x / n, y / n, z / n))
        loc_meshes.append(lib.grid_shell(fn, 24, 14))
    bad = sum(1 for lv, _ in loc_meshes for p in lv[::5] if not lib.inside(cav_tree, p))
    assert bad == 0, f"{bad} locule points outside the cavity"

    # placenta: pale fibrous body on the inner side of each locule, fanning out in lobes;
    # the seeds hang in a band along its outer edge, the gel fills the rest
    def placenta_edge(L, at, az):
        lobes = 0.12 * abs(math.cos(1.5 * math.pi * at)) + 0.07 * abs(math.cos(2.5 * math.pi * az))
        return -0.30 + lobes + 0.05 * noise.noise(Vector((at, az, 0)) * 2.5 + L["off"])

    def placenta_map(L, a3):
        ar, at, az = a3
        edge = placenta_edge(L, at, az)
        r = -0.96 + (ar + 1) / 2 * (edge + 0.96)
        return loc_map(L, (r, at * 0.94, az * 0.92))

    pla_meshes = []
    for L in locs:
        def fn(u, v, L=L):
            x, y, z = math.sin(v) * math.cos(u), math.sin(v) * math.sin(u), math.cos(v)
            n = (abs(x) ** L["p"] + abs(y) ** L["p"] + abs(z) ** L["p"]) ** (1 / L["p"])
            return placenta_map(L, (x / n, y / n, z / n))
        pla_meshes.append(lib.grid_shell(fn, 20, 12))

    # seeds: flat teardrops in a band near the locule wall, pointed end inward, each hanging on
    # a pale funiculus (thin rod) that runs from the placenta body to the seed. On a cut face the
    # rods in the cut plane read as the radial streaks between placenta and seeds (reference 2).
    ico_v, ico_f = SEED_MESH
    seeds = []
    seeds_by_loc = []
    rods = []
    for li, L in enumerate(locs):
        lv, lf = loc_meshes[li]
        ltree = lib.bvh(lv, lf)
        placed, tries = [], 0
        target = R.randint(36, 42)
        while len(placed) < target and tries < 8000:
            tries += 1
            at, az = R.uniform(-0.9, 0.9), R.uniform(-0.9, 0.9)
            edge = placenta_edge(L, at, az)
            a3 = (R.uniform(max(edge + 0.25, 0.50), 0.86), at, az)
            if sum(abs(t) ** L["p"] for t in a3) ** (1 / L["p"]) > 0.93:
                continue
            p = loc_map(L, a3)
            if ltree.find_nearest(p)[3] < 0.0013 or not lib.inside(ltree, p):
                continue
            if any((p - q).length < 0.0024 for q, _, _ in placed):
                continue
            hub = R.uniform(0.4, 0.75)  # rods fan out from the placenta body
            root = loc_map(L, (placenta_edge(L, at * hub, az * hub) - 0.15, at * hub, az * hub))
            placed.append((p, root, L["center"] + at * L["span"] / 2))
        for p, root, ang in placed:
            sc = R.uniform(0.85, 1.15)
            axis = (p - root)
            axis.z *= 0.6  # seeds lie flatter than the rod points
            axis = axis.normalized()
            rot = (Euler((R.uniform(-0.3, 0.3), R.uniform(-0.3, 0.3), 0)).to_matrix()
                   @ axis.to_track_quat("X", "Z").to_matrix()
                   @ Matrix.Rotation(R.uniform(0, 6.3), 3, "X"))
            verts = []
            for q in ico_v:
                w = Vector((-q.x * 0.0019, q.y * 0.0013, q.z * 0.00048))
                if q.x > 0:  # teardrop: pointed end inward, towards the rod
                    w.y *= 1 - 0.45 * q.x
                    w.z *= 1 - 0.3 * q.x
                verts.append(p + rot @ (w * sc))
            seeds.append((verts, ico_f))
            # funiculus: slightly curved hexagonal rod from inside the placenta body into the seed
            d = p - root
            tip = root + d * 0.92
            rr = R.uniform(0.00028, 0.00040)
            u = d.normalized()
            side = u.cross(Vector((0, 0, 1)))
            if side.length < 1e-6:
                side = u.cross(Vector((1, 0, 0)))
            side.normalize()
            up = u.cross(side)
            # the rod is a flat ribbon (placental tissue is sheet-like), rolled at a random
            # angle, wide at the body and narrowing to the seed, with a slight bow
            roll = R.uniform(0, math.pi)
            wide = side * math.cos(roll) + up * math.sin(roll)
            thin = up * math.cos(roll) - side * math.sin(roll)
            bow = thin * R.uniform(-1, 1) * d.length * 0.06
            centres = [(root, 3.5, 1.1), (root + d * 0.5 + bow, 3.0, 1.0), (tip, 1.5, 0.7)]
            rv = []
            for c, sw, st in centres:
                for k in range(6):
                    a = 2 * math.pi * k / 6
                    rv.append(c + (wide * math.cos(a) * sw + thin * math.sin(a) * st) * rr)
            rf = []
            for ring in range(2):
                b0 = ring * 6
                rf += [(b0 + k, b0 + (k + 1) % 6, b0 + 6 + (k + 1) % 6, b0 + 6 + k) for k in range(6)]
            rf.append(tuple(reversed(range(6))))
            rf.append(tuple(range(12, 18)))
            rods.append((rv, rf))
        seeds_by_loc.append(seeds[len(seeds) - len(placed):])

    # parts as nested closed shells
    parts = {}
    b = bmesh.new()
    lib.add_shell(b, o_v, o_f, M["skin"])
    lib.add_shell(b, c_v, c_f, M["flesh"], reverse=True)
    parts["wall"] = b
    b = bmesh.new()
    lib.add_shell(b, c_v, c_f, M["core"])
    for lv, lf in loc_meshes:
        lib.add_shell(b, lv, lf, M["core"], reverse=True)
    parts["core"] = b
    b = bmesh.new()
    for pv, pf in pla_meshes:
        lib.add_shell(b, pv, pf, M["core"])
    for rv, rf in rods:
        lib.add_shell(b, rv, rf, M["core"])
    parts["placenta"] = b
    b = bmesh.new()
    for lv, lf in loc_meshes:
        lib.add_shell(b, lv, lf, M["gel"])
    for pv, pf in pla_meshes:
        lib.add_shell(b, pv, pf, M["gel"], reverse=True)
    # seeds sit inside the gel without holes cut for them (saves a third of the interior
    # triangles); the gel's volume therefore already includes the seeds
    parts["gel"] = b
    b = bmesh.new()
    for sv, sf in seeds:
        lib.add_shell(b, sv, sf, M["seed"])
    parts["seeds"] = b
    for bm in parts.values():
        bm.normal_update()

    top = max(o_v, key=lambda p: p.z if math.hypot(p.x, p.y) < 0.001 else -1)
    info = dict(outer=(o_v, o_f), outer_tree=outer_tree, wall_min=wall_min, top=top,
                height=max(p.z for p in o_v), n_seeds=len(seeds), locs=locs,
                loc_meshes=loc_meshes, pla_meshes=pla_meshes, seeds_by_loc=seeds_by_loc, rods=rods,
                cavity=(c_v, c_f))
    info["calyx"] = calyx(outer_tree, top)
    return parts, info


def surface_z(tree, x, y):
    hit = tree.ray_cast(Vector((x, y, 0.2)), Vector((0, 0, -1)))
    return hit[0].z if hit[0] is not None else None


def calyx(tree, top):
    """Calyx (5-6 thin curling sepals + centre) and a short bent stem, closed shells."""
    bm = bmesh.new()
    anchors = []  # (point, normal, material, length scale) for the trichomes
    n = 6 if R.random() < 0.6 else 5
    base_ang = R.uniform(0, 2 * math.pi)
    for k in range(n):
        ang = base_ang + 2 * math.pi * k / n + R.uniform(-0.18, 0.18)
        length = R.uniform(0.019, 0.026)
        bend = R.uniform(-0.35, 0.35)
        curl = R.uniform(0.004, 0.009)
        width = R.uniform(0.0042, 0.0056)
        segs = 16
        top_rows, bot_rows = [], []
        for i in range(segs + 1):
            s = i / segs
            a = ang + bend * math.sin(math.pi * s * 0.8) * s
            rho = 0.0022 + s * length
            x, y = rho * math.cos(a), rho * math.sin(a)
            zs = surface_z(tree, x, y)
            z = (zs if zs is not None else top.z) + 0.0005 + curl * max(0.0, (s - 0.45) / 0.55) ** 2.2
            c = Vector((x, y, z))
            t = Vector((math.cos(a), math.sin(a), 0))
            side = Vector((-t.y, t.x, 0))
            w = width * max(0.05, (1 - s) ** 0.8) * (0.55 + 0.45 * math.sin(min(1.0, s * 5) * math.pi / 2))
            twist = 0.5 * s * bend
            up = Vector((0, 0, 1))
            sd = (side * math.cos(twist) + up * math.sin(twist)) * (w / 2)
            keel = 0.00025 * (1 - s)
            th = 0.00035 + 0.00025 * (1 - s)
            top_rows.append([c + sd, c + up * keel, c - sd])
            bot_rows.append([c + sd - up * th * 0.5, c - up * th, c - sd - up * th * 0.5])
            if 0.08 < s < 0.97:
                for _ in range(2):
                    f_ = R.uniform(-0.85, 0.85)
                    anchors.append((c + sd * f_ + up * keel * (1 - abs(f_)), up, M["calyx"], 0.8))
        vt = [[bm.verts.new(p) for p in row] for row in top_rows]
        vb = [[bm.verts.new(p) for p in row] for row in bot_rows]
        for i in range(segs):
            for j in range(2):
                f = bm.faces.new((vt[i][j], vt[i][j + 1], vt[i + 1][j + 1], vt[i + 1][j]))
                f.material_index = M["calyx"]
                f = bm.faces.new((vb[i][j], vb[i + 1][j], vb[i + 1][j + 1], vb[i][j + 1]))
                f.material_index = M["calyx"]
            for j in (0, 2):  # side walls
                f = bm.faces.new((vt[i][j], vt[i + 1][j], vb[i + 1][j], vb[i][j]) if j == 0
                                 else (vt[i][j], vb[i][j], vb[i + 1][j], vt[i + 1][j]))
                f.material_index = M["calyx"]
        for i, flip in ((0, True), (segs, False)):  # end caps
            q = [vt[i][0], vt[i][1], vt[i][2], vb[i][2], vb[i][1], vb[i][0]]
            f = bm.faces.new(list(reversed(q)) if flip else q)
            f.material_index = M["calyx"]
    # centre boss
    boss = bmesh.new()
    bmesh.ops.create_uvsphere(boss, u_segments=16, v_segments=8, radius=1.0)
    for v in boss.verts:
        v.co = Vector((v.co.x * 0.0042, v.co.y * 0.0042, v.co.z * 0.0016)) + top + Vector((0, 0, 0.0006))
    me = bpy.data.meshes.new("_b")
    boss.to_mesh(me)
    for p in me.polygons:
        p.material_index = M["calyx"]
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    # stem: bent tube with a cut tip
    segs, sides = 12, 10
    length = R.uniform(0.011, 0.015)
    lean = Vector((R.uniform(-1, 1), R.uniform(-1, 1), 0)).normalized() * R.uniform(0.002, 0.004)
    rings = []
    for i in range(segs + 1):
        s = i / segs
        c = top + Vector((0, 0, 0.0012 + s * length)) + lean * s * s
        tang = (Vector((0, 0, length)) + lean * 2 * s).normalized()
        r = 0.0026 * (1 - 0.3 * s) * (1 + 0.25 * max(0, 0.25 - s) / 0.25)
        q = tang.to_track_quat("Z", "Y")
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            rr = r * (1 + 0.08 * math.cos(3 * a + s))
            ring.append(bm.verts.new(c + q @ Vector((rr * math.cos(a), rr * math.sin(a), 0))))
            if 0 < i < segs and R.random() < 0.9:
                nrm = (q @ Vector((math.cos(a), math.sin(a), 0))).normalized()
                anchors.append((c + q @ Vector((rr * math.cos(a), rr * math.sin(a), 0)) + nrm * 0.00003,
                                nrm, M["stem"], 1.0))
        rings.append(ring)
    for i in range(segs):
        for j in range(sides):
            f = bm.faces.new((rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides],
                              rings[i + 1][j]))
            f.material_index = M["stem"]
    f = bm.faces.new(list(reversed(rings[0])))
    f.material_index = M["stem"]
    f = bm.faces.new(rings[-1])
    f.material_index = M["stem"]
    # trichomes: short pale hairs (3-sided closed cones) leaning away from the surface
    for p, nrm, mat, ls in anchors:
        length = R.uniform(0.0004, 0.0011) * ls
        tilt = Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-0.3, 0.6))).normalized()
        d = (nrm + tilt * 0.7).normalized()
        side = d.cross(Vector((0, 0, 1)))
        if side.length < 1e-6:
            side = d.cross(Vector((1, 0, 0)))
        side.normalize()
        up2 = d.cross(side)
        rb = 0.00009
        base = [bm.verts.new(p + (side * math.cos(2 * math.pi * k / 3) + up2 * math.sin(2 * math.pi * k / 3)) * rb)
                for k in range(3)]
        tip = bm.verts.new(p + d * length)
        for k in range(3):
            f = bm.faces.new((base[k], base[(k + 1) % 3], tip))
            f.material_index = mat
            f.select = True
        f = bm.faces.new((base[2], base[1], base[0]))
        f.material_index = mat
        f.select = True
    bm.normal_update()
    return bm


# ------------------------------------------------------------------ colour

C = {
    "skin": srgb("#C9260C"), "skin_orange": srgb("#D9480F"), "skin_yellow": srgb("#D7701E"),
    "scar": srgb("#7D6A2C"),
    "flesh": srgb("#E0502A"), "flesh_out": srgb("#D0260C"), "flesh_in": srgb("#E85A38"),
    "core": srgb("#F2B494"), "core_c": srgb("#F8D9C6"),
    "gel": srgb("#D2330F"), "gel_hi": srgb("#EC6236"),
    "seed": srgb("#F0B848"), "seed_cut": srgb("#F8DC96"),
    "calyx": srgb("#3D6420"), "calyx_tip": srgb("#5E7F2C"), "stem": srgb("#5A8628"),
    "stem_cut": srgb("#A3B567"), "hair": srgb("#D5DEBB"),
    "juice": srgb("#E3502A"), "juice_hi": srgb("#F58350"),
}


def colour_fn(info):
    tree = info["outer_tree"]
    top = info["top"]

    def fn(mat, co, face):
        if face.select:  # trichomes on the calyx and stem
            return C["hair"]
        if mat == M["juice"]:
            return lerp(C["juice"], C["juice_hi"], 0.5 + 0.5 * noise.noise(co * 90))
        rh = math.hypot(co.x, co.y)
        if mat == M["skin"]:
            n = noise.noise(co * 90 + OFF) * 0.5 + noise.noise(co * 260 + OFF * 3) * 0.25
            c = lerp(C["skin"], C["skin_orange"], 0.35 + 0.35 * n)
            near_top = math.exp(-((co - top).length / 0.016) ** 2)
            c = lerp(c, C["skin_yellow"], 0.55 * near_top)
            if (co - top).length < 0.0028:
                c = lerp(c, C["scar"], 0.8)
            return c
        if mat == M["flesh"]:
            return C["flesh"]
        if mat == M["flesh_cut"]:
            d = tree.find_nearest(co)[3]
            return lerp(C["flesh_out"], C["flesh_in"], (d / WALL) ** 2)
        if mat == M["core"]:
            return C["core"]
        if mat == M["core_cut"]:
            fib = noise.noise(Vector((math.atan2(co.y, co.x) * 6, co.z * 120, rh * 60)) + OFF) * 0.5 + 0.5
            return lerp(lerp(C["core_c"], C["core"], (rh - 0.003) / 0.016), C["flesh_in"], 0.5 * fib)
        if mat in (M["gel"], M["gel_cut"]):
            n = noise.noise(co * 400 + OFF) * 0.5 + 0.5
            return lerp(C["gel"], C["gel_hi"], 0.4 * n)
        if mat == M["seed"]:
            return C["seed"]
        if mat == M["seed_cut"]:
            return C["seed_cut"]
        if mat == M["calyx"]:
            return lerp(C["calyx"], C["calyx_tip"], (rh - 0.004) / 0.02)
        if mat == M["stem"]:
            if face.normal.z > 0.8 and co.z > top.z + 0.008:
                return C["stem_cut"]
            return C["stem"]
        return Vector((1, 0, 1))
    return fn


# ------------------------------------------------------------------ states

def slice_planes(info, thick, rng, tilt_deg):
    h = info["height"]
    planes = []
    z = h - thick * rng.uniform(1.15, 1.35)  # top cap a little thicker, like a real first cut
    while z > thick * 1.0:
        t = math.radians(tilt_deg)
        no = Euler((rng.uniform(-t, t), rng.uniform(-t, t), 0)).to_matrix() @ Vector((0, 0, 1))
        planes.append((Vector((rng.uniform(-0.001, 0.001), rng.uniform(-0.001, 0.001), z)), no))
        z -= thick * rng.uniform(0.92, 1.08)
    return planes


def copy_parts(parts):
    return {k: lib.bm_copy(v) for k, v in parts.items()}


def make_pieces(parts, planes):
    return lib.split_all([copy_parts(parts)], planes, CUT)


SOLID_PARTS = ["wall", "core", "placenta", "gel"]  # gel volume includes the seeds


def piece_mass_g(piece):
    # nested shells: wall + core + placenta + gel volumes add up to the solid volume
    v = sum(lib.volume(piece[p]) for p in SOLID_PARTS if p in piece)
    return v * 1e6 * DENSITY


def objects_for(pieces, prefix, info, mats, coll, attach_calyx_to_top=False, sort_key=None):
    fn = colour_fn(info)
    if sort_key:
        pieces = sorted(pieces, key=sort_key)
    obs, masses = [], []
    top_idx = None
    if attach_calyx_to_top:
        cz = [sum((v.co.z for v in p["wall"].verts), 0) / len(p["wall"].verts) if "wall" in p else -1
              for p in pieces]
        top_idx = max(range(len(pieces)), key=lambda i: cz[i])
    for i, p in enumerate(pieces):
        masses.append(piece_mass_g(p))
        bm = lib.merge_parts(p, PART_ORDER)
        if i == top_idx:
            me = bpy.data.meshes.new("_c")
            info["calyx"].to_mesh(me)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        lib.paint(bm, fn)
        obs.append(lib.to_object(f"{prefix}_{i:02d}" if len(pieces) < 100 else f"{prefix}_{i:03d}",
                                 bm, mats, coll))
        bm.free()
    return obs, masses


def centroid(piece):
    vs = [v.co for bm in piece.values() for v in bm.verts]
    return sum(vs, Vector()) / max(1, len(vs))


def grid_planes(axis, lo, hi, step, rng, jitter=0.08, tilt_deg=2.0):
    """Parallel knife cuts across the whole product, each a little uneven."""
    axis = Vector(axis).normalized()
    planes = []
    pos = lo + step * rng.uniform(0.3, 0.7)
    t = math.radians(tilt_deg)
    while pos < hi:
        no = Euler((rng.uniform(-t, t), rng.uniform(-t, t), rng.uniform(-t, t))).to_matrix() @ axis
        planes.append((axis * pos, no))
        pos += step * rng.uniform(1 - jitter, 1 + jitter)
    return planes


def radial_planes(n_cuts, rng, jitter_deg=4.0, start=None):
    """Vertical cuts through the stem axis (halves, quarters, wedges)."""
    start = rng.uniform(0, math.pi) if start is None else start
    planes = []
    for k in range(n_cuts):
        a = start + math.pi * k / n_cuts + math.radians(rng.uniform(-jitter_deg, jitter_deg))
        tilt = math.radians(rng.uniform(-2, 2))
        no = Vector((math.cos(a), math.sin(a), tilt))
        planes.append((Vector((rng.uniform(-0.0008, 0.0008), rng.uniform(-0.0008, 0.0008), 0)), no))
    return planes


def keep_region(pieces, test):
    return [p for p in pieces if test(centroid(p))]


def state_whole(parts, info, mats, coll):
    bm = bmesh.new()
    o_v, o_f = info["outer"]
    lib.add_shell(bm, o_v, o_f, M["skin"])
    me = bpy.data.meshes.new("_c")
    info["calyx"].to_mesh(me)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    bm.normal_update()
    lib.paint(bm, colour_fn(info))
    vol = sum(lib.volume(parts[p]) for p in SOLID_PARTS)
    ob = lib.to_object("whole", bm, mats, coll, origin="bottom")
    return [ob], [vol * 1e6 * DENSITY]


def slice_key(p):
    return -centroid(p).z


def state_slices(parts, info, mats, coll, thick, tilt):
    rng = lib.rng(SEED + int(thick * 1e4))
    pieces = make_pieces(parts, slice_planes(info, thick, rng, tilt))
    return objects_for(pieces, "slice", info, mats, coll, attach_calyx_to_top=True, sort_key=slice_key)


def state_half(parts, info, mats, coll, cross=False):
    rng = lib.rng(SEED + 11 + cross)
    if cross:
        z = info["height"] * rng.uniform(0.47, 0.53)
        planes = [(Vector((0, 0, z)), Vector((rng.uniform(-0.02, 0.02), rng.uniform(-0.02, 0.02), 1)))]
    else:
        planes = radial_planes(1, rng)
    pieces = make_pieces(parts, planes)
    return objects_for(pieces, "half", info, mats, coll, sort_key=slice_key)


def state_radial(parts, info, mats, coll, n_cuts, prefix, salt):
    rng = lib.rng(SEED + salt)
    pieces = make_pieces(parts, radial_planes(n_cuts, rng, jitter_deg=5.0))
    key = lambda p: math.atan2(centroid(p).y, centroid(p).x)
    return objects_for(pieces, prefix, info, mats, coll, sort_key=key)


def state_half_slices(parts, info, mats, coll):
    rng = lib.rng(SEED + 21)
    planes = slice_planes(info, 0.006, rng, 1.2) + radial_planes(1, rng)
    pieces = make_pieces(parts, planes)
    key = lambda p: (-round(centroid(p).z, 3), centroid(p).x)
    return objects_for(pieces, "half_slice", info, mats, coll, sort_key=key)


def grid_key(p):
    c = centroid(p)
    return (-round(c.z / 0.004), round(c.y / 0.004), c.x)


def state_grid(parts, info, mats, coll, step_xy, step_z, prefix, salt, jitter=0.08, tilt=2.0,
               axes="xyz", min_cm3=0.05):
    rng = lib.rng(SEED + salt)
    h = info["height"]
    planes = []
    if "x" in axes:
        planes += grid_planes((1, 0, 0), -0.045, 0.045, step_xy, rng, jitter, tilt)
    if "y" in axes:
        planes += grid_planes((0, 1, 0), -0.045, 0.045, step_xy, rng, jitter, tilt)
    if "z" in axes:
        planes += grid_planes((0, 0, 1), 0.0, h, step_z, rng, jitter, tilt)
    pieces = make_pieces(parts, planes)
    pieces = [p for p in pieces if piece_mass_g(p) / DENSITY >= min_cm3]
    return objects_for(pieces, prefix, info, mats, coll, sort_key=grid_key)


def state_small(parts, info, mats, coll, step, prefix, salt, quadrant):
    """Diced / chopped: a representative set cut from one slab (and one quadrant of it).
    The app instances these pieces to reach the recipe's grams."""
    rng = lib.rng(SEED + salt)
    h = info["height"]
    z0 = h * 0.45
    pieces = make_pieces(parts, [(Vector((0, 0, z0)), Vector((0, 0, 1))),
                                 (Vector((0, 0, z0 + step)), Vector((0, 0, 1)))])
    pieces = keep_region(pieces, lambda c: z0 < c.z < z0 + step)
    if quadrant:
        pieces = lib.split_all(pieces, [(Vector(), Vector((1, 0, 0))), (Vector(), Vector((0, 1, 0)))], CUT)
        pieces = keep_region(pieces, lambda c: c.x > 0 and c.y > 0)
    planes = grid_planes((1, 0, 0), -0.045, 0.045, step, rng, 0.3, 12.0) + \
        grid_planes((0, 1, 0), -0.045, 0.045, step, rng, 0.3, 12.0)
    pieces = lib.split_all(pieces, planes, CUT)
    min_cm3 = (step * 100) ** 3 * 0.12
    pieces = [p for p in pieces if piece_mass_g(p) / DENSITY >= min_cm3]
    return objects_for(pieces, prefix, info, mats, coll, sort_key=grid_key)


# ---------------------------------------------------------------- peeled, mashed

def peeled_colour_fn(info):
    bounds = []
    for L in info["locs"]:
        bounds += [L["center"] - L["span"] / 2, L["center"] + L["span"] / 2]

    def fn(mat, co, face):
        if face.select:  # trichomes on the calyx and stem
            return C["hair"]
        if mat == M["juice"]:
            return lerp(C["juice"], C["juice_hi"], 0.5 + 0.5 * noise.noise(co * 90))
        n = noise.noise(co * 140 + OFF) * 0.5 + 0.5
        a = math.atan2(co.y, co.x)
        d = min(abs((a - b + math.pi) % (2 * math.pi) - math.pi) for b in bounds)
        rh = math.hypot(co.x, co.y)
        septum = math.exp(-((d * max(rh, 0.005)) / 0.0011) ** 2)  # lighter lines over the septa
        c = lerp(srgb("#C42A10"), srgb("#E4532A"), 0.3 + 0.5 * n)
        c = lerp(c, srgb("#EC7444"), 0.45 * septum)
        top = info["top"]
        c = lerp(c, srgb("#F4B07A"), math.exp(-((co - top).length / 0.006) ** 2))
        return c
    return fn


def state_peeled(parts, info, mats, coll):
    o_v, o_f = info["outer"]
    centre = Vector((0, 0, info["height"] * 0.48))
    v2 = []
    for p in o_v:
        d = p - centre
        v2.append(centre + d * (1 - 0.0006 / max(d.length, 1e-4)))
    bm = bmesh.new()
    lib.add_shell(bm, v2, o_f, M["flesh"])
    bm.normal_update()
    lib.paint(bm, peeled_colour_fn(info))
    vol = lib.volume(bm)
    return [lib.to_object("peeled", bm, mats, coll, origin="bottom")], [vol * 1e6 * DENSITY]


def mound(radius, height, nu=96, nv=40, wobble=0.12, salt=0):
    off = Vector((salt * 3.1, salt * 1.7, salt * 2.3))

    def fn(u, v):
        s, c = math.sin(v), math.cos(v)
        dv = Vector((math.cos(u) * s, math.sin(u) * s, c))
        r = radius * (1 + wobble * noise.noise(dv * 1.6 + off) + 0.04 * noise.noise(dv * 6 + off))
        z = height * c if c > 0 else 0.0015 * c
        z *= 1 + 0.25 * noise.noise(dv * 2.4 + off * 2)
        return Vector((r * s * math.cos(u), r * s * math.sin(u), z + 0.0016))
    return lib.grid_shell(fn, nu, nv)


def puree_colour(mat, co, face):
    n = noise.noise(co * 160 + OFF) * 0.5 + 0.5
    m = noise.noise(co * 45 + OFF * 2) * 0.5 + 0.5
    c = lerp(srgb("#B8240C"), srgb("#E04A1C"), 0.25 + 0.6 * n)
    return lerp(c, srgb("#F07848"), 0.25 * max(0, m - 0.55) / 0.45)


def seed_shells(points, rng):
    iv, fv = SEED_MESH
    out = []
    for p in points:
        rot = Euler((rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3))).to_matrix()
        out.append(([p + rot @ Vector((q.x * 0.00145, q.y * 0.00105, q.z * 0.00042)) for q in iv], fv))
    return out


def state_puree(parts, info, mats, coll):
    rng = lib.rng(SEED + 41)
    vol_whole = sum(lib.volume(parts[p]) for p in SOLID_PARTS) * 0.97  # minus calyx scar
    r = (vol_whole / (2 / 3 * math.pi * 0.38)) ** (1 / 3)
    mv, mf = mound(r, r * 0.38, salt=1)
    bm = bmesh.new()
    lib.add_shell(bm, mv, mf, M["gel"])
    tree = lib.bvh(mv, mf)
    pts = []
    for _ in range(70):
        a, rr = rng.uniform(0, 6.3), r * math.sqrt(rng.random()) * 0.85
        x, y = rr * math.cos(a), rr * math.sin(a)
        hit = tree.ray_cast(Vector((x, y, 0.2)), Vector((0, 0, -1)))
        if hit[0] is not None:
            pts.append(hit[0] - Vector((0, 0, 0.0003)))
    for sv, sf in seed_shells(pts, rng):
        lib.add_shell(bm, sv, sf, M["seed"])
    bm.normal_update()
    lib.paint(bm, lambda m, co, f: C["seed"] if m == M["seed"] else puree_colour(m, co, f))
    return [lib.to_object("puree", bm, mats, coll, origin="bottom")], [vol_whole * 1e6 * DENSITY]


def heap_place(obs, radius, rng, height=0.03):
    """Drop pieces into a rough mound around the origin (preview / cooked / crushed pose)."""
    placed = []
    for ob in sorted(obs, key=lambda o: -o.dimensions.length):
        for _ in range(60):
            a, rr = rng.uniform(0, 6.3), radius * math.sqrt(rng.random())
            z = height * (1 - (rr / radius) ** 2) * rng.uniform(0.2, 1.0)
            p = Vector((rr * math.cos(a), rr * math.sin(a), z))
            if all((p - q).length > ob.dimensions.length * 0.35 for q in placed):
                break
        placed.append(p)
        ob.location = p + Vector((0, 0, ob.dimensions.z * 0.4))
        ob.rotation_euler = Euler((rng.uniform(-1.2, 1.2), rng.uniform(-1.2, 1.2), rng.uniform(0, 6.3)))


def state_crushed(parts, info, mats, coll):
    obs, masses = state_small(parts, info, mats, coll, 0.008, "chunk", 51, quadrant=False)
    rng = lib.rng(SEED + 52)
    for ob in obs:  # crushed by hand: squash and smear each chunk
        me = ob.data
        sq = Vector((rng.uniform(0.8, 1.25), rng.uniform(0.8, 1.25), rng.uniform(0.5, 0.8)))
        for v in me.vertices:
            v.co = Vector((v.co.x * sq.x, v.co.y * sq.y, v.co.z * sq.z)) + \
                Vector((noise.noise(v.co * 300 + OFF), noise.noise(v.co * 300 + OFF * 2), 0)) * 0.0007
    heap_place(obs, 0.04, rng, 0.025)
    # juice pool under the chunks
    mv, mf = mound(0.048, 0.004, wobble=0.18, salt=3)
    bm = bmesh.new()
    lib.add_shell(bm, mv, mf, M["gel"])
    bm.normal_update()
    lib.paint(bm, puree_colour)
    pool = lib.to_object("juice", bm, mats, coll, origin="bottom")
    vol = lib.volume(bm)
    obs.append(pool)
    masses.append(vol * 1e6 * 1.02)
    return obs, masses


# ---------------------------------------------------------------- cooked

def cook_mesh(ob, kind, rng):
    """Shrink and soften a piece and darken its colours for a cooking method."""
    me = ob.data
    lay = me.color_attributes[lib.COL]
    shrink = {"stewed": 0.86, "roasted": 0.9, "grilled": 0.94}[kind]
    flat = set()
    for p in me.polygons:
        if p.material_index not in (M["skin"], M["calyx"], M["stem"]):
            flat.update(p.vertices)
    amp = {"stewed": 0.0004, "roasted": 0.0005, "grilled": 0.0002}[kind]
    for v in me.vertices:
        w = Vector((noise.noise(v.co * 220 + OFF), noise.noise(v.co * 220 + OFF * 2),
                    noise.noise(v.co * 220 + OFF * 3)))
        v.co = v.co * shrink + (Vector() if v.index in flat else w * amp)
    for poly in me.polygons:
        mat = poly.material_index
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            c = Vector(lay.data[li].color[:3])
            if kind == "stewed":
                c = lerp(c, srgb("#A8200C"), 0.45)
            elif kind == "roasted":
                c = lerp(c, srgb("#7E1A0A"), 0.55)
                blister = max(0.0, noise.noise(co * 160 + OFF) - 0.15) / 0.85
                c = lerp(c, srgb("#2E0C04"), 0.95 * blister if mat == M["skin"] else 0.35 * blister)
                if mat in (M["flesh_cut"], M["core_cut"], M["gel_cut"], M["seed_cut"]):
                    edge = max(0.0, noise.noise(co * 90 + OFF * 4))
                    c = lerp(c, srgb("#5A1E08"), 0.3 + 0.6 * edge)
            elif kind == "grilled":
                c = lerp(c, srgb("#B02810"), 0.2)
                if mat in (M["flesh_cut"], M["core_cut"], M["gel_cut"], M["seed_cut"]):
                    wx = ob.matrix_world @ co
                    stripe = abs(((wx.x * 0.7 + wx.y * 0.7) / 0.011) % 1.0 - 0.5)
                    if stripe < 0.16:
                        c = lerp(c, srgb("#2A0E06"), 0.9 * (1 - (stripe / 0.16) ** 2))
            lay.data[li].color = (c.x, c.y, c.z, 1.0)


def lay_out(obs, gap=0.006, per_row=4):
    """Lay pieces flat on the floor in rows (cooked pieces, parts)."""
    x = y = 0.0
    row_h = 0.0
    for i, ob in enumerate(obs):
        if i and i % per_row == 0:
            x = 0.0
            y += row_h + gap
            row_h = 0.0
        d = ob.dimensions
        ob.location = Vector((x + d.x / 2, y + d.y / 2, ob.location.z))
        x += d.x + gap
        row_h = max(row_h, d.y)
    xs = [o.location.x for o in obs]
    ys = [o.location.y for o in obs]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    for o in obs:
        o.location.x -= cx
        o.location.y -= cy


def drop_to_floor(ob):
    bpy.context.view_layer.update()
    zmin = min((ob.matrix_world @ v.co).z for v in ob.data.vertices)
    ob.location.z -= zmin


def state_cooked(parts, info, mats, coll, kind):
    rng = lib.rng(SEED + 61)
    if kind == "roasted":
        obs, masses = state_half(parts, info, mats, coll, cross=True)
        for ob in obs:
            if ob.location.z > info["height"] * 0.4:  # top half: turn cut face up
                ob.rotation_euler = Euler((math.pi, 0, 0))
        for ob in obs:
            cook_mesh(ob, kind, rng)
        bpy.context.view_layer.update()
        for k, ob in enumerate(obs):
            ob.location.x = (k - 0.5) * 0.075
            ob.location.y = 0
            drop_to_floor(ob)
        masses = [m * 0.8 for m in masses]  # water loss
    elif kind == "stewed":
        obs, masses = state_grid(parts, info, mats, coll, 0.015, 0.015, "cube", 31)
        for ob in obs:
            cook_mesh(ob, kind, rng)
        heap_place(obs, 0.045, rng, 0.02)
        bpy.context.view_layer.update()
        zmin = min((o.matrix_world @ v.co).z for o in obs for v in o.data.vertices)
        for o in obs:
            o.location.z -= zmin
        masses = [m * 0.85 for m in masses]
    else:  # grilled slices
        obs, masses = state_slices(parts, info, mats, coll, 0.009, 1.0)
        obs = [o for o in obs[1:-1]]  # caps are not grilled
        masses = masses[1:-1]
        for ob in obs:
            cook_mesh(ob, kind, rng)
        lay_out(obs)
        for ob in obs:
            drop_to_floor(ob)
        masses = [m * 0.92 for m in masses]
        for ob in list(coll.objects):
            if ob.type == "MESH" and ob not in obs:
                bpy.data.objects.remove(ob)
    return obs, masses


# ---------------------------------------------------------------- parts

def state_parts_pulp(parts, info, mats, coll):
    """Seeds with their gel, scooped out locule by locule."""
    obs, masses = [], []
    fn = colour_fn(info)
    for i, ((lv, lf), (pv, pf), seeds) in enumerate(zip(info["loc_meshes"], info["pla_meshes"],
                                                       info["seeds_by_loc"])):
        bm = bmesh.new()
        lib.add_shell(bm, lv, lf, M["gel"])
        lib.add_shell(bm, pv, pf, M["gel"], reverse=True)
        lib.add_shell(bm, pv, pf, M["core"])
        for sv, sf in seeds:
            lib.add_shell(bm, sv, sf, M["gel"], reverse=True)
            lib.add_shell(bm, sv, sf, M["seed"])
        bm.normal_update()
        masses.append(lib.volume(bm) * 1e6 * 1.0)
        lib.paint(bm, fn)
        obs.append(lib.to_object(f"pulp_{i:02d}", bm, mats, coll))
    return obs, masses


def juice_blob(bm, centre, radius, height, rng, mat):
    """Flat glossy puddle or droplet: a squashed, noisy closed blob resting on the floor."""
    off = Vector((rng.uniform(0, 30), rng.uniform(0, 30), 0))
    def fn(u, v):
        x, y, z = math.sin(v) * math.cos(u), math.sin(v) * math.sin(u), math.cos(v)
        r = radius * (1 + 0.22 * noise.noise(Vector((x, y, 0)) * 1.6 + off)
                      + 0.08 * noise.noise(Vector((x, y, 0)) * 4.1 + off))
        zz = height * (0.5 + 0.5 * z) if z > -0.6 else height * 0.2 * (1 + z) / 0.4
        return centre + Vector((x * r, y * r, max(zz, 0.00005)))
    nu, nv = (36, 10) if radius > 0.008 else (12, 6)
    vs, fs = lib.grid_shell(fn, nu, nv)
    lib.add_shell(bm, vs, fs, mat)


def state_juice(parts, info, mats, coll):
    """Juice released on the board when the tomato is cut: a puddle, droplets and a few loose seeds."""
    rng = lib.rng(SEED + 91)
    fn = colour_fn(info)
    obs, masses = [], []
    bm = bmesh.new()
    juice_blob(bm, Vector((0, 0, 0)), 0.021, 0.0009, rng, M["juice"])
    for k in range(3):
        a = rng.uniform(0, 6.3)
        juice_blob(bm, Vector((math.cos(a) * 0.016, math.sin(a) * 0.016, 0)), 0.009, 0.0007, rng, M["juice"])
    bm.normal_update()
    masses.append(lib.volume(bm) * 1e6 * 1.0)
    lib.paint(bm, fn)
    obs.append(lib.to_object("puddle", bm, mats, coll))
    bm = bmesh.new()
    for k in range(14):
        a, d = rng.uniform(0, 6.3), rng.uniform(0.024, 0.042)
        juice_blob(bm, Vector((math.cos(a) * d, math.sin(a) * d, 0)), rng.uniform(0.0012, 0.003),
                   rng.uniform(0.0005, 0.0011), rng, M["juice"])
    bm.normal_update()
    masses.append(lib.volume(bm) * 1e6 * 1.0)
    lib.paint(bm, fn)
    obs.append(lib.to_object("drops", bm, mats, coll))
    bm = bmesh.new()
    ico_v, ico_f = SEED_MESH
    for k in range(4):
        a = rng.uniform(0, 6.3)
        tgt = Vector((math.cos(a) * rng.uniform(0.006, 0.02), math.sin(a) * rng.uniform(0.006, 0.02), 0.0008))
        rot = Matrix.Rotation(rng.uniform(0, 6.3), 3, "Z")
        verts = []
        for q in ico_v:
            w = Vector((q.x * 0.0019, q.y * 0.0013, q.z * 0.00048))
            if q.x > 0:
                w.y *= 1 - 0.45 * q.x
                w.z *= 1 - 0.3 * q.x
            verts.append(tgt + rot @ w)
        lib.add_shell(bm, verts, ico_f, M["seed"])
    bm.normal_update()
    masses.append(lib.volume(bm) * 1e6 * DENSITY)
    lib.paint(bm, fn)
    obs.append(lib.to_object("seeds", bm, mats, coll))
    return obs, masses


def preview_juice(scene, coll, mats, obs, rng, info):
    """Render-only puddles under posed cut pieces (not exported)."""
    fn = colour_fn(info)
    bpy.context.view_layer.update()
    bm = bmesh.new()
    for ob in obs[: min(len(obs), 6)]:
        pts = [ob.matrix_world @ v.co for v in list(ob.data.vertices)[::9]]
        c = sum(pts, Vector()) / len(pts)
        ext = max(max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts))
        c = Vector((c.x + rng.uniform(-0.3, 0.3) * ext, c.y - 0.25 * ext, 0))
        juice_blob(bm, c, ext * rng.uniform(0.2, 0.32), 0.0006, rng, M["juice"])
        for k in range(3):
            a = rng.uniform(0, 6.3)
            juice_blob(bm, c + Vector((math.cos(a), math.sin(a), 0)) * ext * rng.uniform(0.35, 0.6),
                       rng.uniform(0.001, 0.0025), 0.0007, rng, M["juice"])
    bm.normal_update()
    lib.paint(bm, fn)
    lib.to_object("_juice_preview", bm, mats, coll)


def state_parts_flesh(parts, info, mats, coll):
    """Seeded tomato flesh: the wall cut into four petals, without gel and seeds."""
    rng = lib.rng(SEED + 71)
    pieces = lib.split_all([{"wall": lib.bm_copy(parts["wall"])}], radial_planes(2, rng), CUT)
    key = lambda p: math.atan2(centroid(p).y, centroid(p).x)
    return objects_for(pieces, "petal", info, mats, coll, sort_key=key)


def state_parts_skin(parts, info, mats, coll):
    """Blanched skin pulled off in curled pieces."""
    rng = lib.rng(SEED + 81)
    o_v, o_f = info["outer"]
    fn = colour_fn(info)
    obs, masses = [], []
    for k in range(4):
        a0 = k * math.pi / 2 + rng.uniform(-0.2, 0.2)
        a1 = a0 + rng.uniform(1.1, 1.5)
        sel = []
        for f in o_f:
            c = sum((o_v[i] for i in f), Vector()) / len(f)
            a = math.atan2(c.y, c.x) % (2 * math.pi)
            lo, hi = a0 % (2 * math.pi), a1 % (2 * math.pi)
            ina = (lo <= a <= hi) if lo < hi else (a >= lo or a <= hi)
            if ina and 0.008 < c.z < info["height"] - 0.006:
                sel.append(f)
        used = sorted({i for f in sel for i in f})
        idx = {i: n for n, i in enumerate(used)}
        centre = Vector((0, 0, info["height"] * 0.5))
        top = [o_v[i] for i in used]
        th = 0.0004
        bot = [p - (p - centre).normalized() * th for p in top]
        # blanched skin relaxes and rolls outward at its edges
        c0 = sum(top, Vector()) / len(top)
        n = Vector((c0.x, c0.y, 0)).normalized()
        tdir = Vector((-n.y, n.x, 0))
        zed = Vector((0, 0, 1))

        def curl(p):
            d = p - c0
            s_, h_, r_ = d.dot(tdir), d.z, d.dot(n)
            return c0 + tdir * s_ * 0.95 + zed * h_ * 0.9 + n * (r_ + 16 * s_ * s_ + 6 * h_ * h_)
        top = [curl(p) for p in top]
        bot = [curl(p) for p in bot]
        bm = bmesh.new()
        vt = [bm.verts.new(p) for p in top]
        vb = [bm.verts.new(p) for p in bot]
        edge_count = {}
        for f in sel:
            ff = bm.faces.new([vt[idx[i]] for i in f])
            ff.material_index = M["skin"]
            fb = bm.faces.new([vb[idx[i]] for i in reversed(f)])
            fb.material_index = M["flesh"]
            for a, b in zip(f, f[1:] + f[:1]):
                key = (min(a, b), max(a, b))
                edge_count[key] = edge_count.get(key, 0) + 1
        for f in sel:  # rim around the open border
            for a, b in zip(f, f[1:] + f[:1]):
                if edge_count[(min(a, b), max(a, b))] == 1:
                    rf = bm.faces.new((vt[idx[b]], vt[idx[a]], vb[idx[a]], vb[idx[b]]))
                    rf.material_index = M["flesh_cut"]
        bm.normal_update()
        masses.append(lib.volume(bm) * 1e6 * 1.05)
        lib.paint(bm, fn)
        obs.append(lib.to_object(f"skin_{k:02d}", bm, mats, coll))
    return obs, masses


S = lambda f, *a, **k: (lambda p, i, m, c: f(p, i, m, c, *a, **k))

STATES = {
    "whole": [("whole", S(state_whole))],
    "half": [("half", S(state_half)), ("half_cross", S(state_half, cross=True))],
    "quarter": [("quarter", S(state_radial, 2, "quarter", 13))],
    "wedges": [("wedges", S(state_radial, 3, "wedge", 17))],
    "slices": [
        ("slices_thin", S(state_slices, 0.003, 0.8)),
        ("slices_medium", S(state_slices, 0.006, 1.2)),
        ("slices_thick", S(state_slices, 0.011, 1.5)),
    ],
    "half_slices": [("half_slices", S(state_half_slices))],
    "strips": [("strips", S(state_grid, 0.008, 0.008, "strip", 23, axes="xz", min_cm3=0.35))],
    "cubes": [("cubes", S(state_grid, 0.015, 0.015, "cube", 31))],
    "diced": [("diced", S(state_small, 0.007, "dice", 33, quadrant=False))],
    "chopped": [("chopped", S(state_small, 0.003, "chop", 37, quadrant=True))],
    "mashed": [("mashed_crushed", S(state_crushed)), ("mashed_puree", S(state_puree))],
    "peeled": [("peeled", S(state_peeled))],
    "cooked": [("cooked_roasted", S(state_cooked, "roasted")),
               ("cooked_stewed", S(state_cooked, "stewed")),
               ("cooked_grilled", S(state_cooked, "grilled"))],
    "parts": [("parts_skin", S(state_parts_skin)), ("parts_seeds", S(state_parts_pulp)),
              ("parts_flesh", S(state_parts_flesh)), ("parts_juice", S(state_juice))],
}

CUT_UP = {"half", "half_cross", "quarter", "wedges", "parts_flesh"}
HEAP = {"strips": 0.05, "cubes": 0.05, "diced": 0.035, "chopped": 0.022}
FLAT = {"half_slices", "parts_skin", "parts_seeds"}
ASSEMBLED = {"half", "half_cross", "quarter", "wedges", "half_slices", "strips", "cubes", "diced",
             "chopped", "parts_flesh", "parts_seeds"}
EXPLODE = {"half": 0.5, "half_cross": 0.5, "quarter": 0.45, "wedges": 0.4, "half_slices": 0.6,
           "strips": 0.7, "cubes": 0.6, "diced": 0.9, "chopped": 1.0, "parts_flesh": 0.5,
           "parts_seeds": 0.6}


# ------------------------------------------------------------------ preview poses

def pose_floating(obs, gap):
    """Reference-style pose: slices separated vertically, floating with small tilts."""
    rng = lib.rng(SEED + 7)
    n = len(obs)
    for k, ob in enumerate(obs):
        ob.location.z += (n - 1 - k) * gap + 0.03
        ob.rotation_euler = Euler((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05),
                                   rng.uniform(-0.2, 0.2)))


def pose_cut_up(obs):
    """Lay each piece with its cut faces toward the camera, side by side."""
    cut = {M["flesh_cut"], M["core_cut"], M["gel_cut"], M["seed_cut"]}
    for ob in obs:
        n = Vector()
        for p in ob.data.polygons:
            if p.material_index in cut:
                n += p.normal * p.area
        if n.length > 0:
            ob.rotation_euler = n.normalized().rotation_difference(
                Vector((0, -0.55, 0.85)).normalized()).to_euler()
    bpy.context.view_layer.update()
    lay_out(obs, gap=0.008, per_row=4)
    for ob in obs:
        drop_to_floor(ob)


def pose_explode(obs, k):
    c = sum((o.location for o in obs), Vector()) / len(obs)
    for o in obs:
        d = o.location - c
        o.location = o.location + Vector((d.x, d.y, d.z * 0.6)) * k
    bpy.context.view_layer.update()
    zmin = min((o.matrix_world @ v.co).z for o in obs for v in o.data.vertices)
    for o in obs:
        o.location.z -= zmin


def frame(scene, obs, elev=24.0, azim=-12.0, res=(900, 900)):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::7]]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max((hi - lo).length, 0.03)
    dist = size * 3.1
    e, a = math.radians(elev), math.radians(azim)
    cam = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    lib.studio(scene, cam_loc=tuple(cam), cam_target=tuple(c), res=res, samples=40)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--states", default=",".join(STATES))
    ap.add_argument("--only", default="")
    ap.add_argument("--preview", default="")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    report_path = os.path.join(a.out, "build_report.json")
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    lib.new_scene()
    parts, info = build()
    report["wall_min_mm"] = round(info["wall_min"] * 1000, 2)
    report["height_m"] = round(info["height"], 4)
    report["seeds"] = info["n_seeds"]
    only = set(a.only.split(",")) if a.only else None
    for state in a.states.split(","):
        for name, fn in STATES[state]:
            if only and name not in only:
                continue
            scene = lib.new_scene()
            coll = scene.collection
            mats = materials()
            obs, masses = fn(parts, info, mats, coll)
            folder = os.path.join(a.out, state)
            os.makedirs(folder, exist_ok=True)
            path = os.path.join(folder, f"{ID}_{name}.glb")
            lib.export_glb(path, f"{ID}_{name}", obs, coll)
            bpy.context.view_layer.update()
            dims = [sorted((o.dimensions * 1000)[:], reverse=True) for o in obs]
            report[name] = dict(file=os.path.relpath(path, a.out), pieces=len(obs),
                                triangles=lib.tri_count(obs), bytes=os.path.getsize(path),
                                mass_total_g=round(sum(masses), 1),
                                piece_mass_g=round(sum(masses) / len(masses), 2),
                                piece_size_mm=[round(sum(d[i] for d in dims) / len(dims), 1)
                                               for i in range(3)])
            print(name, report[name], flush=True)
            if a.preview:
                os.makedirs(a.preview, exist_ok=True)
                if name.startswith("slices"):
                    pose_floating(obs, {"slices_thin": 0.004, "slices_medium": 0.007,
                                        "slices_thick": 0.012}[name])
                    lib.studio(scene, cam_loc=(0.02, -0.5, 0.17), cam_target=(0, 0, 0.068),
                               samples=40)
                else:
                    if name in CUT_UP:
                        pose_cut_up(obs)
                        preview_juice(scene, coll, mats, obs, lib.rng(SEED + 97), info)
                    elif name in HEAP:
                        heap_place(obs, HEAP[name], lib.rng(SEED + 99), HEAP[name] * 0.5)
                        preview_juice(scene, coll, mats, obs[:1], lib.rng(SEED + 97), info)
                    elif name in FLAT:
                        lay_out(obs, gap=0.004, per_row=6)
                        for ob in obs:
                            drop_to_floor(ob)
                    elif name in EXPLODE:
                        pose_explode(obs, EXPLODE[name])
                    frame(scene, obs, elev=30 if name not in ("whole", "peeled") else 14)
                    if name == "parts_juice":
                        frame(scene, obs, elev=38)
                lib.render(scene, os.path.join(a.preview, f"{ID}_{name}.jpg"))
            with open(report_path, "w") as f:
                json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
