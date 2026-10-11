"""Banana — procedural Blender build for the Buzzcook food library.

One build of the whole banana with its real anatomy (ridged peel with a pale inner layer, grooved
fibrous flesh with loose strings, a three-armed seed core with tiny dark seeds, neck, stem and
blossom tip); every state is cut from it. Reference analysis: ../reference.md.

The banana is built straight along its axis and then bent around a circular arc, so every slice
plane passes through the axis of curvature and is exactly perpendicular to the fruit.

Run:  python banana.py --out <dir> [--states whole,slices] [--preview <dir>]
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

ID = "banana"
SEED = 2002
RC = 0.125                    # radius of the banana's curve (axis), metres
R_MAX = 0.0180                # peel radius at the widest point (36 mm across)
PEEL = 0.0025                 # peel thickness in the body
S_TIP, S_END = -0.092, 0.112  # blossom tip and cut stem end along the axis
S_F0, S_F1 = -0.084, 0.068    # flesh from blossom end to the neck
N_RIDGE = 5
DENSITY_FLESH = 0.96
DENSITY_PEEL = 0.90

R = lib.rng(SEED)
OFF = Vector((R.uniform(0, 100), R.uniform(0, 100), R.uniform(0, 100)))
STAR_PHASE = math.pi / 2 + R.uniform(-0.3, 0.3)

MAT_NAMES = ["peel", "peel_cut", "flesh", "flesh_cut", "core", "core_cut", "seed", "seed_cut",
             "stem", "_int", "_int_peel"]
M = {n: i for i, n in enumerate(MAT_NAMES)}
CUT = {"peel": M["peel_cut"], "flesh": M["flesh_cut"], "flesh_in": M["flesh_cut"],
       "core": M["core_cut"], "core_in": M["core_cut"], "seeds": M["seed_cut"], "fibers": M["flesh_cut"]}
PART_ORDER = ["peel", "flesh", "flesh_in", "core", "core_in", "seeds", "fibers"]


def materials():
    return [
        lib.make_material("peel", rough=0.5, coat=0.08, coat_rough=0.35, spec=0.4, sheen=0.25),
        lib.make_material("peel_cut", rough=0.5, coat=0.25, coat_rough=0.3, spec=0.35),
        lib.make_material("flesh", rough=0.55, coat=0.15, coat_rough=0.4, spec=0.35, sheen=0.3),
        lib.make_material("flesh_cut", rough=0.5, coat=0.15, coat_rough=0.35, spec=0.3),
        lib.make_material("core", rough=0.5),
        lib.make_material("core_cut", rough=0.5, coat=0.15, coat_rough=0.35, spec=0.3),
        lib.make_material("seed", rough=0.45),
        lib.make_material("seed_cut", rough=0.4, coat=0.3),
        lib.make_material("stem", rough=0.8, spec=0.3),
        lib.make_material("_int", rough=0.5),
        lib.make_material("_int_peel", rough=0.5),
    ]


C = {k: srgb(v) for k, v in dict(
    peel="#E8BE2E", peel_hi="#F2CD4A", peel_lo="#D9AA22", peel_green="#B3AE3A",
    neck="#A9A43E", stem="#7E7A3A", stem_end="#4A3424", stem_end_rim="#6E5236",
    tip="#3A2A1E", speck="#8C6A30",
    peel_cut_out="#E6C653", peel_cut_in="#F1E5C2",
    flesh="#F0D47A", flesh_hi="#F7E29A", flesh_lo="#E2BF5C", fiber="#F4E3AC", flesh_tip="#8A6A42",
    cut_edge="#E9C86E", cut_mid="#F4E0A2", cut_in="#F1DB98", ray="#D6B172",
    core="#CFA466", core_dark="#B88C50", halo="#E7CB8E", seed="#3B2B1D", seed_cut="#4E3925",
).items()}


# ------------------------------------------------------------------ shape (straight frame)

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def r_body(s):
    """Round peel radius along the axis: blossom nub, full body, neck, stem."""
    t = (s + 0.012) / 0.085
    r = R_MAX * (1 - 0.11 * t * t)
    d = s - S_TIP
    if d < 0.032:
        q = 1 - d / 0.032
        r = r * (0.16 + 0.84 * math.sqrt(max(0.0, 1 - q * q)))
    w = smoothstep(0.034, 0.093, s)
    r = lerp(r, 0.0057, w) if w > 0 else r
    if s > 0.093:
        r = 0.0057 + 0.0007 * smoothstep(0.104, S_END, s)
    return r


def ridge(u, s):
    """Peel ridges: rounded polygon in [-0.5, 0.5], sharper toward the neck."""
    seg = 2 * math.pi / N_RIDGE
    a = (u - math.pi / 2) % seg - seg / 2
    poly = math.cos(seg / 2) / math.cos(a)
    x = (poly - math.cos(seg / 2)) / (1 - math.cos(seg / 2))
    return x ** 0.8 - 0.45


def ridge_amp(s):
    return 0.075 + 0.09 * smoothstep(0.03, 0.09, s)


def lift(s):
    """Neck and stem bend up a little more than the body."""
    return 4.5 * max(0.0, s - 0.072) ** 2


def bend(s, y, z):
    """Straight frame (s along axis, y sideways, z up) -> world; convex side down, bottom near 0."""
    z = z + lift(s)
    phi = s / RC
    rr = RC - z
    return Vector((rr * math.sin(phi), y, RC - rr * math.cos(phi)))


def unbend(p):
    dx, dz = p.x, p.z - RC
    phi = math.atan2(dx, -dz)
    s = phi * RC
    z = RC - math.hypot(dx, dz)
    return s, p.y, z - lift(s)


def tangent(s):
    phi = s / RC
    return Vector((math.cos(phi), 0, math.sin(phi)))


def flesh_round(s):
    return r_body(s) - PEEL * (1 + 0.25 * smoothstep(0.04, 0.07, s))


def cap(s, s0, s1, c0, c1):
    """Rounded end factor of a shell spanning [s0, s1] with cap lengths c0, c1."""
    k = 1.0
    if s - s0 < c0:
        q = 1 - (s - s0) / c0
        k = math.sqrt(max(0.0, 1 - q * q))
    if s1 - s < c1:
        q = 1 - (s1 - s) / c1
        k = min(k, math.sqrt(max(0.0, 1 - q * q)))
    return k


def grooves(u, s):
    """Fine lengthwise grooves and fuzz on the flesh surface (relative)."""
    a = Vector((math.cos(u), math.sin(u), 0))
    g = 0.009 * noise.noise(Vector((a.x * 9, a.y * 9, s * 4)) + OFF)
    g += 0.006 * noise.noise(Vector((a.x * 28, a.y * 28, s * 9)) + OFF * 1.3)
    g += 0.004 * noise.noise(Vector((a.x * 90, a.y * 90, s * 160)) + OFF * 1.7)
    return g


def r_peel(s, u):
    n = 1 + 0.012 * noise.noise(Vector((math.cos(u) * 2, math.sin(u) * 2, s * 25)) + OFF * 2.1)
    return r_body(s) * (1 + ridge_amp(s) * ridge(u, s)) * n


def r_flesh(s, u):
    return flesh_round(s) * (1 + 0.3 * ridge_amp(s) * ridge(u, s)) * (1 + grooves(u, s)) \
        * cap(s, S_F0, S_F1, 0.016, 0.017)


MID = (S_F0 + 0.004, S_F1 - 0.004)
STAR = (S_F0 + 0.010, S_F1 - 0.012)


def r_mid(s, u):
    lobe = 1 + 0.03 * math.cos(3 * (u - STAR_PHASE))
    return 0.62 * flesh_round(s) * lobe * cap(s, MID[0], MID[1], 0.013, 0.014)


def star_scale(s):
    return flesh_round(s) / 0.0153


def r_star(s, u):
    """Soft outer halo of the seed core: three broad arms."""
    a = max(0.0, math.cos(3 * (u - STAR_PHASE)))
    wob = 1 + 0.10 * noise.noise(Vector((math.cos(u) * 3, math.sin(u) * 3, s * 40)) + OFF * 3.1)
    return (0.0021 + 0.0034 * a ** 1.1 * wob) * star_scale(s) * cap(s, STAR[0], STAR[1], 0.010, 0.010)


STAR_IN = (STAR[0] + 0.004, STAR[1] - 0.004)


def r_star_in(s, u):
    """Darker inner star where the tiny seeds sit."""
    a = max(0.0, math.cos(3 * (u - STAR_PHASE)))
    wob = 1 + 0.08 * noise.noise(Vector((math.cos(u) * 3, math.sin(u) * 3, s * 40)) + OFF * 3.7)
    return (0.0010 + 0.0021 * a ** 1.4 * wob) * star_scale(s) \
        * cap(s, STAR_IN[0], STAR_IN[1], 0.008, 0.008)


# ------------------------------------------------------------------ mesh builders

def body_rings(s0, s1, c0, c1, step, ncap):
    """s positions for a rounded shell: dense near the caps, even in the body."""
    ss = []
    for i in range(1, ncap + 1):
        th = (math.pi / 2) * i / ncap
        ss.append(s0 + c0 * (1 - math.cos(th)))
    a, b = s0 + c0, s1 - c1
    n = max(1, int(round((b - a) / step)))
    ss += [a + (b - a) * j / n for j in range(1, n)]
    for i in range(ncap, 0, -1):
        th = (math.pi / 2) * i / ncap
        ss.append(s1 - c1 * (1 - math.cos(th)))
    return ss


def tube(ring_s, nu, rfn, poles, ends_k=None, flat=None):
    """Closed tube around the bent axis. ring_s: s of every ring; rfn(s, u) radius; poles: (s0, s1).
    flat: optional list of (s, k) extra rings at the start/end for flat end discs."""
    verts = [bend(poles[0], 0, 0)]
    rings = []
    for s, k in (flat[0] if flat else []):
        rings.append((s, k))
    rings += [(s, 1.0) for s in ring_s]
    for s, k in (flat[1] if flat else []):
        rings.append((s, k))
    for s, k in rings:
        for i in range(nu):
            u = 2 * math.pi * i / nu
            r = rfn(s, u) * k
            verts.append(bend(s, r * math.cos(u), r * math.sin(u)))
    verts.append(bend(poles[1], 0, 0))
    nr = len(rings)
    first, last = 0, len(verts) - 1
    ring = lambda j, i: 1 + j * nu + (i % nu)
    faces = []
    for i in range(nu):
        faces.append((first, ring(0, i + 1), ring(0, i)))
    for j in range(nr - 1):
        for i in range(nu):
            faces.append((ring(j, i), ring(j, i + 1), ring(j + 1, i + 1), ring(j + 1, i)))
    for i in range(nu):
        faces.append((last, ring(nr - 1, i), ring(nr - 1, i + 1)))
    # make normals point out
    bm = bmesh.new()
    lib.add_shell(bm, verts, faces, 0)
    if bm.calc_volume(signed=True) < 0:
        faces = [tuple(reversed(f)) for f in faces]
    bm.free()
    return verts, faces


SEED_MESH = lib.grid_shell(lambda u, v: Vector((math.sin(v) * math.cos(u), math.sin(v) * math.sin(u),
                                                math.cos(v))), 8, 4)


def build():
    # peel: flat nub at the blossom tip, flat cut at the stem end
    ps = body_rings(S_TIP, S_END, 0.0, 0.0, 0.0012, 0)
    ps = [s for s in ps if S_TIP + 0.0006 < s < S_END - 0.0006]
    o_v, o_f = tube(ps, 96, r_peel, (S_TIP, S_END),
                    flat=([(S_TIP, 0.45), (S_TIP + 0.0003, 0.85)],
                          [(S_END - 0.0003, 0.9), (S_END, 0.55)]))
    f_s = body_rings(S_F0, S_F1, 0.016, 0.017, 0.00115, 9)
    f_v, f_f = tube(f_s, 104, r_flesh, (S_F0, S_F1))
    m_s = body_rings(MID[0], MID[1], 0.013, 0.014, 0.0025, 6)
    m_v, m_f = tube(m_s, 72, r_mid, MID)
    st_s = body_rings(STAR[0], STAR[1], 0.010, 0.010, 0.0025, 5)
    st_v, st_f = tube(st_s, 72, r_star, STAR)
    si_s = body_rings(STAR_IN[0], STAR_IN[1], 0.008, 0.008, 0.0025, 5)
    si_v, si_f = tube(si_s, 72, r_star_in, STAR_IN)

    outer_tree = lib.bvh(o_v, o_f)
    flesh_tree = lib.bvh(f_v, f_f)
    star_tree = lib.bvh(si_v, si_f)
    peel_min = min(outer_tree.find_nearest(p)[3] for p in f_v[::5])
    assert all(lib.inside(outer_tree, p) for p in f_v[::11]), "flesh pokes out of the peel"
    assert all(lib.inside(flesh_tree, p) for p in m_v[::7]), "mid shell pokes out of the flesh"

    # seeds: two rows in each of the three locule arms, tiny and dark
    seeds = []
    rng = lib.rng(SEED + 3)
    for arm in range(3):
        ua = STAR_PHASE + 2 * math.pi * arm / 3
        for row in (-1, 1):
            s = STAR_IN[0] + 0.010 + rng.uniform(0, 0.003)
            while s < STAR_IN[1] - 0.010:
                u = ua + row * rng.uniform(0.10, 0.16)
                r = rng.uniform(0.0011, 0.0016) * star_scale(s)
                # semi-axes: specks about 0.9 x 0.55 x 0.4 mm
                size = Vector((rng.uniform(0.0004, 0.0005), rng.uniform(0.00025, 0.0003),
                               rng.uniform(0.00018, 0.00022))) * min(1.0, star_scale(s))
                seeds.append((s, u, r, size, rng.uniform(0, math.pi)))
                s += rng.uniform(0.0028, 0.0042)
    seed_shells = []
    for s, u, r, size, spin in seeds:
        c = bend(s, r * math.cos(u), r * math.sin(u))
        t = tangent(s)
        radial = (c - bend(s, 0, 0)).normalized()
        side = t.cross(radial).normalized()
        # long axis along the fruit, flat side facing the centre
        rot = Matrix((t, side, radial)).transposed() @ Euler((spin * 0.15, 0, 0)).to_matrix()
        vs = [c + rot @ Vector((p.x * size.x, p.y * size.y, p.z * size.z)) for p in SEED_MESH[0]]
        if all(lib.inside(star_tree, p) for p in vs):
            seed_shells.append(vs)

    # loose strings (phloem bundles) lying on the flesh, half sunk in
    fibers = []
    rng = lib.rng(SEED + 5)
    for k in range(13):
        u0 = rng.uniform(0, 2 * math.pi)
        a0 = rng.uniform(S_F0 + 0.02, S_F0 + 0.06)
        a1 = rng.uniform(S_F1 - 0.06, S_F1 - 0.016)
        w = rng.uniform(0.0003, 0.00045)
        drift = rng.uniform(-0.12, 0.12)
        ns = 60
        pts = []
        for j in range(ns + 1):
            s = a0 + (a1 - a0) * j / ns
            u = u0 + drift * (j / ns) + 0.012 * math.sin(j * 0.25 + k)
            r = r_flesh(s, u) - w * 0.15
            pts.append((s, u, r))
        fibers.append((pts, w))

    parts = {}
    bm = bmesh.new()
    lib.add_shell(bm, o_v, o_f, M["peel"])
    lib.add_shell(bm, f_v, f_f, M["_int_peel"], reverse=True)
    parts["peel"] = bm
    bm = bmesh.new()
    lib.add_shell(bm, f_v, f_f, M["flesh"])
    lib.add_shell(bm, m_v, m_f, M["_int"], reverse=True)
    parts["flesh"] = bm
    bm = bmesh.new()
    lib.add_shell(bm, m_v, m_f, M["_int"])
    lib.add_shell(bm, st_v, st_f, M["_int"], reverse=True)
    parts["flesh_in"] = bm
    bm = bmesh.new()
    lib.add_shell(bm, st_v, st_f, M["_int"])
    lib.add_shell(bm, si_v, si_f, M["_int"], reverse=True)
    parts["core"] = bm
    bm = bmesh.new()
    lib.add_shell(bm, si_v, si_f, M["_int"])
    for vs in seed_shells:
        lib.add_shell(bm, vs, SEED_MESH[1], M["_int"], reverse=True)
    parts["core_in"] = bm
    bm = bmesh.new()
    for vs in seed_shells:
        lib.add_shell(bm, vs, SEED_MESH[1], M["_int"])
    parts["seeds"] = bm
    bm = bmesh.new()
    for pts, w in fibers:
        fv, ff = fiber_tube(pts, w)
        for f in lib.add_shell(bm, fv, ff, M["flesh"]):
            f.select = True
    parts["fibers"] = bm
    for b in parts.values():
        b.normal_update()

    info = dict(outer=(o_v, o_f), flesh=(f_v, f_f), peel_min=peel_min, n_seeds=len(seed_shells),
                length=S_END - S_TIP)
    return parts, info


def fiber_tube(pts, w, nu=5):
    verts, faces = [], []
    frames = []
    for j, (s, u, r) in enumerate(pts):
        c = bend(s, r * math.cos(u), r * math.sin(u))
        t = tangent(s)
        n = (c - bend(s, 0, 0)).normalized()
        b = t.cross(n).normalized()
        taper = math.sin(math.pi * min(1.0, max(0.0, j / (len(pts) - 1)))) ** 0.3
        frames.append((c, n, b, w * max(taper, 0.25)))
    verts.append(frames[0][0])
    for c, n, b, ww in frames:
        for i in range(nu):
            a = 2 * math.pi * i / nu
            verts.append(c + (n * math.cos(a) * 0.5 + b * math.sin(a)) * ww)
    verts.append(frames[-1][0])
    nr = len(frames)
    last = len(verts) - 1
    ring = lambda j, i: 1 + j * nu + (i % nu)
    for i in range(nu):
        faces.append((0, ring(0, i + 1), ring(0, i)))
    for j in range(nr - 1):
        for i in range(nu):
            faces.append((ring(j, i), ring(j, i + 1), ring(j + 1, i + 1), ring(j + 1, i)))
    for i in range(nu):
        faces.append((last, ring(nr - 1, i), ring(nr - 1, i + 1)))
    bm = bmesh.new()
    lib.add_shell(bm, verts, faces, 0)
    if bm.calc_volume(signed=True) < 0:
        faces = [tuple(reversed(f)) for f in faces]
    bm.free()
    return verts, faces


# ------------------------------------------------------------------ colour

def colour_fn(info):
    def fn(mat, co, face):
        s, y, z = unbend(co)
        rho = math.hypot(y, z)
        u = math.atan2(z, y)
        a = Vector((math.cos(u), math.sin(u), 0))
        if mat == M["peel"]:
            if s > S_END - 0.0004 and abs(face.normal.dot(tangent(s))) > 0.6:
                return lerp(C["stem_end"], C["stem_end_rim"], (rho / 0.006) ** 3)
            if s < S_TIP + 0.0012:
                return C["tip"]
            streak = noise.noise(Vector((a.x * 9, a.y * 9, s * 10)) + OFF) * 0.5 + 0.5
            fine = noise.noise(co * 700 + OFF) * 0.5 + 0.5
            c = lerp(C["peel_lo"], C["peel_hi"], 0.25 + 0.5 * streak + 0.15 * (fine - 0.5))
            c = lerp(c, C["peel_hi"], 0.35 * max(0.0, ridge(u, s)) * 2)
            # greenish toward the neck, darker toward the blossom tip
            c = lerp(c, C["peel_green"], 0.55 * smoothstep(0.035, 0.085, s))
            c = lerp(c, C["neck"], smoothstep(0.08, 0.095, s))
            c = lerp(c, C["stem"], smoothstep(0.096, 0.108, s))
            c = lerp(c, C["tip"], 0.85 * (1 - smoothstep(S_TIP + 0.0012, S_TIP + 0.0045, s)))
            # a few sugar specks
            sp = noise.noise(co * 420 + OFF * 4.0)
            if sp > 0.62 and S_TIP + 0.01 < s < 0.07:
                c = lerp(c, C["speck"], min(0.7, (sp - 0.62) * 5))
            return c
        if mat == M["peel_cut"]:
            rf = r_flesh(s, u)
            ro = r_peel(s, u)
            t = (rho - rf) / max(1e-5, ro - rf)
            return lerp(C["peel_cut_in"], C["peel_cut_out"], max(0.0, min(1.0, t)) ** 1.5)
        if mat == M["flesh"]:
            if face.select:
                return C["fiber"]
            g = grooves(u, s) / 0.012
            c = lerp(C["flesh_lo"], C["flesh_hi"], 0.5 + 0.9 * g)
            c = lerp(c, C["flesh_tip"], 0.8 * (1 - smoothstep(S_F0 + 0.001, S_F0 + 0.006, s)))
            return c
        if mat == M["flesh_cut"]:
            fr = max(1e-5, flesh_round(s))
            rr = rho / fr
            rs = r_star(s, u)
            if rho <= rs * 1.06 + 1e-5:
                # star halo boundary: soft, fibrous rays reach out of the core
                ray = noise.noise(Vector((a.x * 14, a.y * 14, s * 30)) + OFF * 5) * 0.5 + 0.5
                return lerp(C["halo"], C["ray"], 0.5 * ray)
            if rr < 0.8:
                ray = max(0.0, noise.noise(Vector((a.x * 18, a.y * 18, s * 25)) + OFF * 5))
                return lerp(C["cut_mid"], C["ray"], 0.45 * ray)
            # darker, yellower towards the cut edge
            return lerp(C["cut_mid"], C["cut_edge"], smoothstep(0.8, 1.0, rr))
        if mat == M["core_cut"]:
            n = noise.noise(co * 2500 + OFF) * 0.5 + 0.5
            if rho > r_star_in(s, u) * 1.08 + 1e-5:
                return lerp(C["halo"], C["ray"], 0.4 * n)   # outer halo edge, blends into flesh
            return lerp(C["core"], C["core_dark"], 0.7 * n)
        if mat == M["core"]:
            return C["core"]
        if mat in (M["seed"], M["seed_cut"]):
            return C["seed"] if mat == M["seed"] else C["seed_cut"]
        if mat == M["stem"]:
            return C["stem_end"]
        return C["cut_mid"]
    return fn


# ------------------------------------------------------------------ pieces

def copy_parts(parts, keys):
    return {k: lib.bm_copy(parts[k]) for k in keys}


def make_pieces(parts, planes, keys):
    return lib.split_all([copy_parts(parts, keys)], planes, CUT)


def centroid(piece):
    vs = [v.co for bm in piece.values() for v in list(bm.verts)[::5]]
    return sum(vs, Vector()) / max(1, len(vs))


def piece_mass_g(piece):
    m = 0.0
    if "peel" in piece:
        m += lib.volume(piece["peel"]) * 1e6 * DENSITY_PEEL
    for p in ("flesh", "flesh_in", "core", "core_in"):
        if p in piece:
            m += lib.volume(piece[p]) * 1e6 * DENSITY_FLESH
    if "seeds" in piece:
        m += lib.volume(piece["seeds"]) * 1e6 * 1.1
    return m


def clean(bm, peeled):
    """Weld coincident cap loops and drop hidden interface shells, so each piece is one closed
    surface: outer skin (peel or flesh) plus its cut faces."""
    kill = {M["_int"], M["_int_peel"]}
    if not peeled:
        kill.add(M["flesh"])
    dead = [f for f in bm.faces if f.material_index in kill and not (peeled and f.select)]
    if not peeled:
        dead += [f for f in bm.faces if f.select]
    bmesh.ops.delete(bm, geom=list(set(dead)), context="FACES")
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=2e-7)
    bm.normal_update()
    return bm


def objects_for(pieces, prefix, info, mats, coll, peeled, sort_key=None):
    fn = colour_fn(info)
    if sort_key:
        pieces = sorted(pieces, key=sort_key)
    obs, masses = [], []
    for i, p in enumerate(pieces):
        masses.append(piece_mass_g(p))
        bm = lib.merge_parts(p, PART_ORDER)
        clean(bm, peeled)
        lib.paint(bm, fn)
        name = f"{prefix}_{i:02d}" if len(pieces) < 100 else f"{prefix}_{i:03d}"
        obs.append(lib.to_object(name, bm, mats, coll))
        bm.free()
    return obs, masses


def slice_planes(s_lo, s_hi, thick, rng, tilt_deg=2.0):
    planes = []
    s = s_lo + thick * rng.uniform(0.5, 0.8)
    t = math.radians(tilt_deg)
    while s < s_hi:
        no = Euler((rng.uniform(-t, t), rng.uniform(-t, t), rng.uniform(-t, t))).to_matrix() @ tangent(s)
        planes.append((bend(s, 0, 0), no))
        s += thick * rng.uniform(0.92, 1.08)
    return planes


def s_key(p):
    return unbend(centroid(p))[0]


SOLID = ["peel", "flesh", "flesh_in", "core", "core_in", "seeds"]
FLESH = ["flesh", "flesh_in", "core", "core_in", "seeds", "fibers"]


def state_whole(parts, info, mats, coll):
    bm = bmesh.new()
    o_v, o_f = info["outer"]
    lib.add_shell(bm, o_v, o_f, M["peel"])
    bm.normal_update()
    lib.paint(bm, colour_fn(info))
    m = piece_mass_g({k: parts[k] for k in SOLID})
    return [lib.to_object("whole", bm, mats, coll, origin="bottom")], [m]


def state_peeled(parts, info, mats, coll):
    bm = lib.merge_parts({k: parts[k] for k in ("flesh", "fibers")}, ["flesh", "fibers"])
    bm.normal_update()
    clean(bm, peeled=True)
    # inner flesh shells are hidden in the whole peeled fruit: drop them
    lib.paint(bm, colour_fn(info))
    m = piece_mass_g({k: parts[k] for k in ("flesh", "flesh_in", "core", "core_in", "seeds")})
    return [lib.to_object("peeled", bm, mats, coll, origin="bottom")], [m]


def state_slices_peel(parts, info, mats, coll, thick=0.010):
    rng = lib.rng(SEED + 31)
    planes = slice_planes(S_F0 + 0.012, S_F1 - 0.012, thick, rng)
    pieces = make_pieces(parts, planes, SOLID)
    return objects_for(pieces, "slice", info, mats, coll, peeled=False, sort_key=s_key)


def state_slices_peeled(parts, info, mats, coll, thick=0.010):
    rng = lib.rng(SEED + 37)
    planes = slice_planes(S_F0 + 0.004, S_F1 - 0.004, thick, rng)
    pieces = make_pieces(parts, planes, FLESH)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in"))]
    return objects_for(pieces, "slice", info, mats, coll, peeled=True, sort_key=s_key)


def state_cubes(parts, info, mats, coll, step=0.015):
    """Peeled banana in chunks, each chunk quartered lengthwise: the usual way to cube a banana."""
    rng = lib.rng(SEED + 41)
    planes = slice_planes(S_F0 + 0.002, S_F1 - 0.002, step, rng, tilt_deg=3.0)
    chunks = make_pieces(parts, planes, FLESH)
    pieces = []
    for ch in chunks:
        if not any(k in ch for k in ("flesh", "flesh_in")):
            continue
        s = s_key(ch)
        c = bend(s, 0, 0)
        a = math.radians(rng.uniform(-6, 6))
        cuts = [(c + Vector((0, rng.uniform(-0.001, 0.001), 0)), Vector((0, 1, a))),
                (c, (c - Vector((0, 0, RC))).normalized() * -1 + tangent(s) * a)]
        pieces += lib.split_all([ch], cuts, CUT)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in")) and piece_mass_g(p) > 0.4]
    key = lambda p: (round(s_key(p), 3), centroid(p).y, centroid(p).z)
    return objects_for(pieces, "cube", info, mats, coll, peeled=True, sort_key=key)


S = lambda f, *a, **k: (lambda p, i, m, c: f(p, i, m, c, *a, **k))

STATES = {
    "whole": [("whole", S(state_whole))],
    "peeled": [("peeled", S(state_peeled))],
    "slices": [("slices_peel", S(state_slices_peel)), ("slices_peeled", S(state_slices_peeled))],
    "cubes": [("cubes", S(state_cubes))],
}


# ------------------------------------------------------------------ preview poses

def drop_to_floor(obs):
    bpy.context.view_layer.update()
    zmin = min((o.matrix_world @ v.co).z for o in obs for v in o.data.vertices)
    for o in obs:
        o.location.z -= zmin


def pose_spread(obs, gap):
    """Slices pulled apart along the curve, as if the knife just went through."""
    n = len(obs)
    for k, ob in enumerate(obs):
        s, _, _ = unbend(ob.location)
        ob.location += tangent(s) * (k - (n - 1) / 2) * gap
    drop_to_floor(obs)


CUT_MATS = None


def pose_cut_up(obs, per_row=5, gap=0.006):
    """Each piece lies with its biggest cut face toward the camera, in rows (like on a board)."""
    cut = {M["flesh_cut"], M["core_cut"], M["peel_cut"], M["seed_cut"]}
    for ob in obs:
        best = {}
        for p in ob.data.polygons:
            if p.material_index in cut:
                k = tuple(round(x, 1) for x in p.normal)
                best[k] = best.get(k, 0) + p.area
        if not best:
            continue
        k = max(best, key=best.get)
        n = Vector(k).normalized()
        ob.rotation_euler = n.rotation_difference(Vector((0, -0.3, 0.95)).normalized()).to_euler()
    bpy.context.view_layer.update()
    sizes = [max(ob.dimensions) for ob in obs]
    cell = max(sizes) + gap
    rows = (len(obs) + per_row - 1) // per_row
    for i, ob in enumerate(obs):
        r, c = divmod(i, per_row)
        ob.location = Vector(((c - (per_row - 1) / 2) * cell + (r % 2) * cell * 0.25,
                              ((rows - 1) / 2 - r) * cell * 0.95, 0.03))
    bpy.context.view_layer.update()
    for ob in obs:
        zmin = min((ob.matrix_world @ v.co).z for v in ob.data.vertices)
        ob.location.z -= zmin


def pose_explode(obs, k):
    c = sum((o.location for o in obs), Vector()) / len(obs)
    for o in obs:
        d = o.location - c
        o.location = o.location + Vector((d.x * 0.5, d.y, d.z)) * k
    drop_to_floor(obs)


def frame(scene, obs, elev=24.0, azim=-12.0, res=(1200, 900), samples=64, dist_k=2.6):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::7]]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max((hi - lo).length, 0.03)
    dist = size * dist_k
    e, a = math.radians(elev), math.radians(azim)
    cam = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    return lib.studio(scene, cam_loc=tuple(cam), cam_target=tuple(c), res=res, samples=samples)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--states", default=",".join(STATES))
    ap.add_argument("--only", default="")
    ap.add_argument("--preview", default="")
    ap.add_argument("--samples", type=int, default=64)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    report_path = os.path.join(a.out, "build_report.json")
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    lib.new_scene()
    parts, info = build()
    report["peel_min_mm"] = round(info["peel_min"] * 1000, 2)
    report["seeds"] = info["n_seeds"]
    report["length_axis_m"] = round(info["length"], 4)
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
                                triangles=lib.tri_count(obs),
                                max_piece_triangles=max(lib.tri_count([o]) for o in obs),
                                bytes=os.path.getsize(path),
                                mass_total_g=round(sum(masses), 1),
                                piece_mass_g=round(sum(masses) / len(masses), 2),
                                piece_size_mm=[round(sum(d[i] for d in dims) / len(dims), 1)
                                               for i in range(3)])
            print(name, report[name], flush=True)
            if a.preview:
                os.makedirs(a.preview, exist_ok=True)
                if name.startswith("slices") or name == "cubes":
                    pose_cut_up(obs, per_row=5 if name.startswith("slices") else 8)
                    frame(scene, obs, elev=48, azim=-8, samples=a.samples, dist_k=2.0)
                else:
                    frame(scene, obs, elev=18, azim=-10, samples=a.samples)
                lib.render(scene, os.path.join(a.preview, f"{ID}_{name}.jpg"))
            with open(report_path, "w") as f:
                json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
