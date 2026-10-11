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
from mathutils import Euler, Matrix, Vector, kdtree, noise  # noqa: E402

import lib  # noqa: E402
from lib import lerp, srgb  # noqa: E402

ID = "banana"
SEED = 2002
R_MAX = 0.0180                # peel radius at the widest point (36 mm across)
PEEL = 0.0025                 # peel thickness in the body
S_TIP, S_END = -0.094, 0.112  # blossom tip and cut stem end along the axis
STEM_R = 0.0056
STEM_S = 0.1068               # neck ends, stem begins
S_F0, S_F1 = -0.084, 0.068    # flesh from blossom end to the neck
N_RIDGE = 5
DENSITY_FLESH = 0.96
DENSITY_PEEL = 0.90

R = lib.rng(SEED)
OFF = Vector((R.uniform(0, 100), R.uniform(0, 100), R.uniform(0, 100)))
STAR_PHASE = math.pi / 2 + R.uniform(-0.3, 0.3)
RIDGE_PHASE = math.pi / 2 + 0.31
RIDGE_JITTER = [R.uniform(-0.06, 0.06) for _ in range(5)]

MAT_NAMES = ["peel", "peel_cut", "flesh", "flesh_cut", "core", "core_cut", "seed", "seed_cut",
             "stem", "puree", "_int", "_int_peel", "tip"]
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
        lib.make_material("puree", rough=0.32, coat=0.35, coat_rough=0.25, spec=0.4),
        lib.make_material("_int", rough=0.5),
        lib.make_material("_int_peel", rough=0.5),
        lib.make_material("tip", rough=0.85, spec=0.25),
    ]


C = {k: srgb(v) for k, v in dict(
    peel="#EEC02A", peel_hi="#F5CF45", peel_lo="#DDA21A", peel_green="#D2C232", ridge="#C38E16",
    neck="#A8B437", stem="#82983A", stem_dark="#5E6E2C", stem_end="#5A3E26", stem_end_rim="#7A5A36",
    tip="#2C1F16", tip_rim="#6A4A22", stem_cut="#9C8466", speck="#7A5426",
    peel_cut_out="#E2C35A", peel_cut_in="#F2EBD3",
    flesh="#EFE6CB", flesh_hi="#F7F1E1", flesh_lo="#DCCDA5", fiber="#F5EEDD", flesh_tip="#9A7E58",
    cut_edge="#EFE5CA", cut_mid="#F6F0E0", cut_in="#F2EAD6", ray="#E4D4B0",
    core="#E8DAB8", core_dark="#DCCAA2", halo="#F0E7D0", seed="#3A2A1C", seed_cut="#5C4430",
    mash="#EADCB0", mash_dark="#CDB27A", mash_ox="#C7A36A", puree="#E9DBB0", puree_dark="#DCC898",
    fried="#E2B468", fried_dark="#B47C3A", fried_side="#EBCB8A",
    baked="#3E2A1C", baked_hi="#6A4A28", baked_lo="#22170F",
).items()}


# ------------------------------------------------------------------ shape (straight frame)

def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def r_body(s):
    """Round peel radius along the axis: blunt blossom end with a small button, full body that is a
    touch fuller toward the blossom end, a long tapering neck, a short stem and the flared cut end."""
    t = (s + 0.018) / 0.080
    r = R_MAX * (1 - 0.06 * t * t - 0.02 * t)
    d = s - S_TIP
    if d < 0.002:                          # dried blossom button, a small dome
        q = 1 - d / 0.002
        return 0.0003 + 0.0014 * math.sqrt(max(0.0, 1 - q * q))
    if d < 0.026:                          # blunt, slightly conical blossom end
        x = (d - 0.002) / 0.024
        r = lerp(0.0016, r, 1 - (1 - x) ** 2.4)
    w = smoothstep(0.026, 0.098, s)
    r = lerp(r, STEM_R, w ** 0.8) if w > 0 else r
    if s > 0.098:
        r = STEM_R
    if s > S_END - 0.006:                  # brown cut end of the stem swells into a woody knob
        q = (s - (S_END - 0.006)) / 0.006
        r = STEM_R * (1 + 0.28 * math.sin(math.pi * 0.5 * min(1.0, q * 1.25)) ** 1.5)
        if q > 0.8:                        # rounded rim of the cut
            r *= 0.82 + 0.18 * math.sqrt(max(0.0, 1 - ((q - 0.8) / 0.2) ** 2))
    return r


def ridge_a(u, s):
    """Angle from u to the nearest peel ridge."""
    seg = 2 * math.pi / N_RIDGE
    uu = u - RIDGE_PHASE - 0.10 * math.sin(s * 23 + 1.3)
    k = int(math.floor(uu / seg + 0.5))
    a = uu - k * seg + RIDGE_JITTER[k % N_RIDGE] * seg
    return (a + seg / 2) % seg - seg / 2


def ridge(u, s):
    """Peel cross-section in [-0.5, 0.5]: five gently convex faces meeting at soft ridges, the ridges
    wander a little along the fruit and are not evenly spaced (no fruit is a perfect pentagon)."""
    seg = 2 * math.pi / N_RIDGE
    a = ridge_a(u, s)
    poly = math.cos(seg / 2) / math.cos(a)
    x = (poly - math.cos(seg / 2)) / (1 - math.cos(seg / 2))
    crest = math.exp(-(a / 0.075) ** 2)
    return 0.55 * x ** 1.3 + 0.45 * crest - 0.33


def ridge_amp(s):
    return 0.040 + 0.05 * smoothstep(0.02, 0.085, s) + 0.01 * smoothstep(0.09, 0.10, s)


def ellipse(u):
    """Slightly flattened, slightly lop-sided section."""
    return 1 + 0.035 * math.cos(2 * u) + 0.012 * math.cos(u + 0.7)


def kappa(s):
    """Curvature of the axis: gentle in the body, tighter through the neck, the stem nearly straight."""
    k = 1 / 0.16 + (1 / 0.22 - 1 / 0.16) * smoothstep(-0.03, -0.09, s)
    k += (1 / 0.08 - 1 / 0.16) * smoothstep(0.02, 0.07, s) * (1 - smoothstep(0.088, 0.104, s))
    return k


def _axis_table():
    n = int(round((S_END - S_TIP) / AXIS_STEP))
    ss = [S_TIP + i * AXIS_STEP for i in range(n + 1)]
    th, pos = [0.0], [Vector((0, 0, 0))]
    for i in range(1, len(ss)):
        sm = (ss[i - 1] + ss[i]) / 2
        th_m = th[-1] + kappa(sm) * AXIS_STEP / 2
        pos.append(pos[-1] + Vector((math.cos(th_m), 0, math.sin(th_m))) * AXIS_STEP)
        th.append(th[-1] + kappa(sm) * AXIS_STEP)
    # rotate so the two ends of the body sit at the same height (fruit lying on its convex side)
    i0, i1 = int((-0.07 - S_TIP) / AXIS_STEP), int((0.05 - S_TIP) / AXIS_STEP)
    d = pos[i1] - pos[i0]
    rot = math.atan2(d.z, d.x)
    R2 = Matrix.Rotation(rot, 3, "Y")
    pos = [R2 @ p for p in pos]
    th = [t - rot for t in th]
    # sideways wander: a real banana is never perfectly planar
    for i, s in enumerate(ss):
        pos[i].y += 0.0016 * math.sin((s - S_TIP) / (S_END - S_TIP) * math.pi * 1.3 + 0.4)
    kd = kdtree.KDTree(len(ss))
    for i, p in enumerate(pos):
        kd.insert(p, i)
    kd.balance()
    return ss, th, pos, kd


AXIS_STEP = 0.0005


def _axis_at(s):
    f = (s - S_TIP) / AXIS_STEP
    i = max(0, min(len(AX_S) - 2, int(math.floor(f))))
    t = f - i
    return AX_P[i].lerp(AX_P[i + 1], t), AX_T[i] * (1 - t) + AX_T[i + 1] * t


def tangent(s):
    th = _axis_at(s)[1]
    return Vector((math.cos(th), 0, math.sin(th)))


def normal(s):
    """Unit vector toward the concave (upper) side of the curve."""
    th = _axis_at(s)[1]
    return Vector((-math.sin(th), 0, math.cos(th)))


def bend(s, y, z):
    """Straight frame (s along axis, y sideways, z toward the concave side) -> world."""
    p, th = _axis_at(s)
    return p + Vector((0, y, 0)) + Vector((-math.sin(th), 0, math.cos(th))) * z


def unbend(p):
    _, i, _ = AX_KD.find(p)
    s = AX_S[i] + (p - AX_P[i]).dot(tangent(AX_S[i]))
    s = AX_S[i] + (p - _axis_at(s)[0]).dot(tangent(s)) if S_TIP < s < S_END else s
    q = p - _axis_at(s)[0]
    return s, q.y, q.dot(normal(s))


AX_S, AX_T, AX_P, AX_KD = _axis_table()


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
    # many narrow lengthwise ribs left by the vascular strands under the peel
    rib = 1 - abs(noise.noise(Vector((a.x * 7, a.y * 7, s * 2.5)) + OFF * 2.3))
    g += 0.009 * (rib ** 3 - 0.35)
    return g


def r_peel(s, u):
    n = 1 + 0.012 * noise.noise(Vector((math.cos(u) * 2, math.sin(u) * 2, s * 25)) + OFF * 2.1)
    return r_body(s) * (1 + ridge_amp(s) * ridge(u, s)) * n * ellipse(u)


def r_flesh(s, u):
    return flesh_round(s) * (1 + 0.3 * ridge_amp(s) * ridge(u, s)) * (1 + grooves(u, s)) * ellipse(u) \
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
    ps = [s for s in ps if S_TIP + 0.006 < s < S_END - 0.005]
    ps += [S_TIP + 0.0002 + 0.006 * (i / 20) ** 1.6 for i in range(20)]
    ps += [S_END - 0.005 + 0.0049 * i / 20 for i in range(21)]
    ps = sorted(ps)
    o_v, o_f = tube(ps, 96, r_peel, (S_TIP, S_END),
                    flat=([], [(S_END, 0.75), (S_END, 0.45)]))
    f_s = body_rings(S_F0, S_F1, 0.016, 0.017, 0.00115, 9)
    f_v, f_f = tube(f_s, 144, r_flesh, (S_F0, S_F1))
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
        for row in (-1, 0, 1):
            s = STAR_IN[0] + 0.010 + rng.uniform(0, 0.003)
            while s < STAR_IN[1] - 0.010:
                u = ua + row * rng.uniform(0.42, 0.55)
                r = rng.uniform(0.0011, 0.0016) * star_scale(s)
                # semi-axes: specks about 0.9 x 0.55 x 0.4 mm
                size = Vector((rng.uniform(0.0005, 0.00065), rng.uniform(0.0002, 0.00025),
                               rng.uniform(0.00018, 0.00022))) * min(1.0, star_scale(s))
                seeds.append((s, u, r, size, rng.uniform(0, math.pi)))
                s += rng.uniform(0.0012, 0.0019)
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

def peel_colour(co, s, u, a, rho, face):
    """Large-scale peel colour (fine freckles, scuffs and texture are added by the photo shader)."""
    if s > S_END - 0.0012 and abs(face.normal.dot(tangent(s))) > 0.5:
        # dry fibrous cut end of the stem: dark centre, lighter woody rim, radial fibres
        f = noise.noise(Vector((a.x * 14, a.y * 14, 0)) + OFF * 6) * 0.5 + 0.5
        return lerp(lerp(C["stem_end"], C["stem_cut"], (rho / 0.006) ** 0.8), C["stem_end_rim"], 0.6 * f)
    if s < S_TIP + 0.0026:
        f = noise.noise(co * 2500 + OFF) * 0.5 + 0.5
        return lerp(C["tip"], C["tip_rim"], 0.35 * f + 0.6 * smoothstep(S_TIP + 0.0012, S_TIP + 0.0026, s))
    streak = noise.noise(Vector((a.x * 6, a.y * 6, s * 7)) + OFF) * 0.5 + 0.5
    blot = noise.noise(co * 60 + OFF * 2) * 0.5 + 0.5
    c = lerp(C["peel_lo"], C["peel_hi"], 0.35 + 0.3 * streak + 0.2 * (blot - 0.5))
    # thin darker, slightly greenish lines along the ridges
    crest = math.exp(-(ridge_a(u, s) / 0.038) ** 2)
    c = lerp(c, C["ridge"], 0.65 * crest * (1 - smoothstep(0.075, 0.095, s)))
    # buttery yellow body, greenish yellow toward the neck, green neck, olive stem
    c = lerp(c, C["peel_green"], 0.55 * smoothstep(0.025, 0.075, s))
    c = lerp(c, C["neck"], smoothstep(0.060, 0.096, s))
    c = lerp(c, C["stem"], smoothstep(0.090, 0.106, s))
    c = lerp(c, C["stem_dark"], 0.5 * crest * smoothstep(0.094, 0.104, s))
    c = lerp(c, C["stem_end"], smoothstep(S_END - 0.0062, S_END - 0.0035, s))
    # amber-brown ring around the blossom button
    c = lerp(c, C["tip_rim"], 0.9 * (1 - smoothstep(S_TIP + 0.0026, S_TIP + 0.0075, s)))
    return c


def colour_fn(info):
    def fn(mat, co, face):
        s, y, z = unbend(co)
        rho = math.hypot(y, z)
        u = math.atan2(z, y)
        a = Vector((math.cos(u), math.sin(u), 0))
        if mat in (M["peel"], M["stem"], M["tip"]):
            return peel_colour(co, s, u, a, rho, face)
        if mat == M["peel_cut"]:
            rf = r_flesh(s, u)
            ro = r_peel(s, u)
            t = (rho - rf) / max(1e-5, ro - rf)
            return lerp(C["peel_cut_in"], C["peel_cut_out"], max(0.0, min(1.0, t)) ** 1.5)
        if mat == M["flesh"]:
            if face.select:
                return C["fiber"]
            g = grooves(u, s) / 0.012
            c = lerp(C["flesh_lo"], C["flesh_hi"], 0.62 + 0.3 * g)
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


def finish_peel(bm):
    """Give the stem and the blossom button their own materials and add a cylindrical UV map
    (u around the fruit, v along it; 1 unit = one circumference of the body)."""
    for f in bm.faces:
        if f.material_index == M["peel"]:
            s = unbend(f.calc_center_median())[0]
            if s > STEM_S:
                f.material_index = M["stem"]
            elif s < S_TIP + 0.0026:
                f.material_index = M["tip"]
    uv = bm.loops.layers.uv.get("UVMap") or bm.loops.layers.uv.new("UVMap")
    circ = 2 * math.pi * R_MAX
    for f in bm.faces:
        cs = []
        for l in f.loops:
            s, y, z = unbend(l.vert.co)
            cs.append((math.atan2(z, y) / (2 * math.pi) % 1.0, (s - S_TIP) / circ))
        if max(c[0] for c in cs) - min(c[0] for c in cs) > 0.5:
            cs = [(c[0] + 1 if c[0] < 0.5 else c[0], c[1]) for c in cs]
        for l, c in zip(f.loops, cs):
            l[uv].uv = c
    return bm


def objects_for(pieces, prefix, info, mats, coll, peeled, sort_key=None, fn=None):
    fn = fn or colour_fn(info)
    if sort_key:
        pieces = sorted(pieces, key=sort_key)
    obs, masses = [], []
    for i, p in enumerate(pieces):
        masses.append(piece_mass_g(p))
        bm = lib.merge_parts(p, PART_ORDER)
        clean(bm, peeled)
        finish_peel(bm)
        lib.paint(bm, fn)
        name = f"{prefix}_{i:02d}" if len(pieces) < 100 else f"{prefix}_{i:03d}"
        ob = lib.to_object(name, bm, mats, coll)
        # axis frame of the piece for the photo shaders (polar coordinates on the cut faces)
        s = s_key(p)
        ob["ax"] = tangent(s)[:]
        ob["nr"] = normal(s)[:]
        ob["c0"] = (bend(s, 0, 0) - ob.location)[:]
        ob["rr"] = flesh_round(s)
        obs.append(ob)
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
FLESH = ["flesh", "flesh_in", "core", "core_in", "seeds"]


def state_whole(parts, info, mats, coll):
    bm = bmesh.new()
    o_v, o_f = info["outer"]
    lib.add_shell(bm, o_v, o_f, M["peel"])
    bm.normal_update()
    finish_peel(bm)
    lib.paint(bm, colour_fn(info))
    m = piece_mass_g({k: parts[k] for k in SOLID})
    return [lib.to_object("whole", bm, mats, coll, origin="bottom", smooth_angle=math.radians(80))], [m]


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
                (c, normal(s) + tangent(s) * a)]
        pieces += lib.split_all([ch], cuts, CUT)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in")) and piece_mass_g(p) > 0.4]
    key = lambda p: (round(s_key(p), 3), centroid(p).y, centroid(p).z)
    return objects_for(pieces, "cube", info, mats, coll, peeled=True, sort_key=key)


def state_half(parts, info, mats, coll):
    """Cut across in the middle, peel on."""
    rng = lib.rng(SEED + 51)
    s = (S_F0 + S_F1) / 2 + rng.uniform(-0.003, 0.003)
    no = Euler((0, math.radians(rng.uniform(-2, 2)), math.radians(rng.uniform(-2, 2)))).to_matrix() @ tangent(s)
    pieces = make_pieces(parts, [(bend(s, 0, 0), no)], SOLID)
    return objects_for(pieces, "half", info, mats, coll, peeled=False, sort_key=s_key)


def state_cross_section(parts, info, mats, coll):
    """A 25 mm section from the middle, peel on, both faces cut: shows the full cross-section."""
    rng = lib.rng(SEED + 53)
    s0 = -0.014
    planes = [(bend(s, 0, 0), tangent(s)) for s in (s0, s0 + 0.025)]
    pieces = make_pieces(parts, planes, SOLID)
    mid = [p for p in pieces if s0 < s_key(p) < s0 + 0.025]
    return objects_for(mid, "section", info, mats, coll, peeled=False)


def state_half_slices(parts, info, mats, coll, thick=0.010):
    rng = lib.rng(SEED + 57)
    planes = slice_planes(S_F0 + 0.004, S_F1 - 0.004, thick, rng)
    planes.append((bend(0, rng.uniform(-0.0005, 0.0005), 0), Vector((0, 1, 0.02))))
    pieces = make_pieces(parts, planes, FLESH)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in")) and piece_mass_g(p) > 0.3]
    key = lambda p: (round(s_key(p), 3), centroid(p).y)
    return objects_for(pieces, "half_slice", info, mats, coll, peeled=True, sort_key=key)


def state_strips(parts, info, mats, coll):
    """Peeled banana cut lengthwise into four long strips (planes along the curve)."""
    rng = lib.rng(SEED + 61)
    planes = [(Vector((0, y + rng.uniform(-0.0006, 0.0006), 0)),
               Vector((rng.uniform(-0.01, 0.01), 1, rng.uniform(-0.02, 0.02))))
              for y in (-0.0075, 0.0, 0.0075)]
    pieces = make_pieces(parts, planes, FLESH)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in")) and piece_mass_g(p) > 1.0]
    return objects_for(pieces, "strip", info, mats, coll, peeled=True, sort_key=lambda p: centroid(p).y)


def state_diced(parts, info, mats, coll, step=0.005):
    """Small 5 mm dice: a representative 30 mm portion of the peeled banana (multiply in the app)."""
    rng = lib.rng(SEED + 67)
    s0, s1 = -0.012, 0.018
    chunk = make_pieces(parts, [(bend(s, 0, 0), tangent(s)) for s in (s0, s1)], FLESH)
    chunk = [p for p in chunk if s0 < s_key(p) < s1][0]
    sm = (s0 + s1) / 2
    planes = slice_planes(s0, s1 - step * 0.5, step, rng, tilt_deg=4.0)
    rad = (bend(sm, 0, -1) - bend(sm, 0, 0)).normalized()     # "up" across the fruit at the middle
    for k in range(-3, 4):
        off = k * step + rng.uniform(-0.0006, 0.0006)
        planes.append((Vector((0, off, 0)), Vector((rng.uniform(-0.04, 0.04), 1, rng.uniform(-0.04, 0.04)))))
        planes.append((bend(sm, 0, 0) + rad * off, rad + Vector((rng.uniform(-0.04, 0.04), rng.uniform(-0.04, 0.04), 0))))
    pieces = lib.split_all([chunk], planes, CUT)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in", "core", "core_in"))
              and piece_mass_g(p) > 0.03]
    key = lambda p: (round(s_key(p), 3), round(centroid(p).y, 3), centroid(p).z)
    return objects_for(pieces, "dice", info, mats, coll, peeled=True, sort_key=key)


def mound(radius, height, nu=96, nv=48, lump=0.0, salt=0):
    off = OFF * (1.0 + salt * 0.37)

    def fn(u, v):
        d = Vector((math.sin(v) * math.cos(u), math.sin(v) * math.sin(u), math.cos(v)))
        n = 0.0
        if lump:
            n = lump * (noise.noise(d * 2.2 + off) * 0.45 + noise.noise(d * 5.5 + off * 1.3) * 0.3
                        + noise.noise(d * 13 + off * 1.7) * 0.17 + noise.noise(d * 30 + off * 2.3) * 0.08)
        r = radius * math.sin(v) * (1 + 0.6 * n)
        c = math.cos(v)
        z = max(0.0, height * c * (1 + n)) if c > 0 else 0.0
        return Vector((r * math.cos(u), r * math.sin(u), z))
    return lib.grid_shell(fn, nu, nv)


def mash_colour(kind):
    def fn(mat, co, face):
        n = noise.noise(co * 180 + OFF) * 0.5 + 0.5
        m = noise.noise(co * 60 + OFF * 2) * 0.5 + 0.5
        if kind == "mashed":
            c = lerp(C["mash"], C["mash_dark"], 0.55 * n)
            c = lerp(c, C["mash_ox"], 0.35 * max(0.0, m - 0.55) * 2)
            if noise.noise(co * 1400 + OFF * 3) > 0.62:   # broken seed specks
                c = lerp(c, C["seed"], 0.55)
            return c
        return lerp(C["puree"], C["puree_dark"], 0.35 * n)
    return fn


def flesh_volume(parts):
    return sum(lib.volume(parts[k]) for k in ("flesh", "flesh_in", "core", "core_in"))


def state_mashed(parts, info, mats, coll):
    """Fork-mashed banana: an uneven lumpy heap with soft chunks pressed into it."""
    vol = flesh_volume(parts)
    h_r = 0.42
    r = (vol / (2 / 3 * math.pi * h_r)) ** (1 / 3)
    v, f = mound(r, r * h_r, nu=160, nv=80, lump=0.3, salt=1)
    bm = bmesh.new()
    lib.add_shell(bm, v, f, M["puree"])
    bm.normal_update()
    lib.paint(bm, mash_colour("mashed"))
    obs = [lib.to_object("mash_00", bm, mats, coll, origin="bottom")]
    masses = [vol * 1e6 * DENSITY_FLESH * 0.85]
    # a few half-crushed chunks on top (from the 5 mm dice), flattened
    d_obs, d_m = state_diced(parts, info, mats, coll)
    rng = lib.rng(SEED + 71)
    keep = rng.sample(range(len(d_obs)), min(14, len(d_obs)))
    for i, ob in enumerate(d_obs):
        if i not in keep:
            bpy.data.objects.remove(ob)
            continue
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0, r * 0.75)
        ob.data.transform(Matrix.Diagonal((1.15, 1.15, 0.55, 1)))
        ob.rotation_euler = Euler((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(0, 6.3)))
        zt = r * h_r * math.sqrt(max(0.0, 1 - (rr / r) ** 2))
        ob.location = Vector((rr * math.cos(a), rr * math.sin(a), zt - 0.0012))
        ob.name = f"chunk_{len(obs):02d}"
        obs.append(ob)
        masses.append(d_m[i])
    return obs, masses


def state_puree(parts, info, mats, coll):
    vol = flesh_volume(parts)
    h_r = 0.36
    r = (vol / (2 / 3 * math.pi * h_r)) ** (1 / 3)
    v, f = mound(r, r * h_r, nu=128, nv=56, lump=0.05, salt=2)
    bm = bmesh.new()
    lib.add_shell(bm, v, f, M["puree"])
    bm.normal_update()
    lib.paint(bm, mash_colour("puree"))
    return [lib.to_object("puree", bm, mats, coll, origin="bottom")], [vol * 1e6 * DENSITY_FLESH]


def fried_fn(info):
    base = colour_fn(info)

    def fn(mat, co, face):
        n = noise.noise(co * 300 + OFF) * 0.5 + 0.5
        if mat in (M["flesh_cut"], M["core_cut"], M["seed_cut"]):
            s, y, z = unbend(co)
            rr = math.hypot(y, z) / max(1e-5, flesh_round(s))
            return lerp(lerp(C["fried"], C["fried_dark"], 0.15 + 0.35 * n), C["fried_dark"], 0.6 * smoothstep(0.75, 1.0, rr))
        if mat == M["flesh"]:
            return lerp(C["fried_side"], C["fried"], 0.5 * n)
        return base(mat, co, face)
    return fn


def baked_fn(info):
    base = colour_fn(info)

    def fn(mat, co, face):
        if mat == M["peel"]:
            n = noise.noise(co * 120 + OFF) * 0.5 + 0.5
            m = noise.noise(co * 25 + OFF * 2) * 0.5 + 0.5
            c = lerp(C["baked_lo"], C["baked"], n)
            return lerp(c, C["baked_hi"], 0.6 * max(0.0, m - 0.5) * 2)
        return base(mat, co, face)
    return fn


def state_cooked_fried(parts, info, mats, coll):
    """Pan-fried 10 mm peeled slices: caramelised faces, golden sides, shrunk about 8 %."""
    rng = lib.rng(SEED + 37)
    planes = slice_planes(S_F0 + 0.004, S_F1 - 0.004, 0.010, rng)
    pieces = make_pieces(parts, planes, FLESH)
    pieces = [p for p in pieces if any(k in p for k in ("flesh", "flesh_in"))]
    obs, masses = objects_for(pieces, "slice", info, mats, coll, peeled=True, sort_key=s_key,
                              fn=fried_fn(info))
    for ob in obs:
        ob.data.transform(Matrix.Scale(0.93, 4))
    for ob in obs:
        mesh_wrinkle(ob, 0.25)
    return obs, [m * 0.85 for m in masses]


def mesh_wrinkle(ob, amount):
    """Soft sag of a cooked piece: tiny noise displacement along normals (mm scale)."""
    me = ob.data
    for v in me.vertices:
        w = ob.matrix_world @ v.co
        v.co += v.normal * 0.001 * amount * noise.noise(w * 220 + OFF)


def state_cooked_baked(parts, info, mats, coll):
    """Baked whole in the peel: peel brown-black and slightly shrunk and wrinkled."""
    bm = bmesh.new()
    o_v, o_f = info["outer"]
    lib.add_shell(bm, o_v, o_f, M["peel"])
    bm.normal_update()
    lib.paint(bm, baked_fn(info))
    ob = lib.to_object("baked", bm, mats, coll, origin="bottom")
    ob.data.transform(Matrix.Diagonal((0.97, 0.94, 0.92, 1)))
    me = ob.data
    for v in me.vertices:
        w = v.co
        v.co += v.normal * 0.0006 * (noise.noise(Vector((w.x * 90, w.y * 600, w.z * 600)) + OFF) - 0.2)
    m = piece_mass_g({k: parts[k] for k in SOLID})
    return [ob], [m * 0.88]


def state_parts_peel(parts, info, mats, coll):
    """The peel as its own geometry: pale fibrous inside, peeled off in one piece (lies around the
    flesh in the whole fruit, so peeled + parts_peel = whole)."""
    bm = lib.bm_copy(parts["peel"])
    for f in bm.faces:
        if f.material_index == M["_int_peel"]:
            f.material_index = M["peel_cut"]
    bm.normal_update()
    lib.paint(bm, colour_fn(info))
    m = lib.volume(parts["peel"]) * 1e6 * DENSITY_PEEL
    return [lib.to_object("peel", bm, mats, coll, origin="bottom")], [m]


S = lambda f, *a, **k: (lambda p, i, m, c: f(p, i, m, c, *a, **k))

STATES = {
    "whole": [("whole", S(state_whole))],
    "peeled": [("peeled", S(state_peeled))],
    "half": [("half", S(state_half))],
    "cross_section": [("cross_section", S(state_cross_section))],
    "slices": [("slices_5mm", S(state_slices_peeled, thick=0.005)),
               ("slices_10mm", S(state_slices_peeled, thick=0.010)),
               ("slices_15mm", S(state_slices_peeled, thick=0.015)),
               ("slices_peel", S(state_slices_peel))],
    "half_slices": [("half_slices", S(state_half_slices))],
    "strips": [("strips", S(state_strips))],
    "cubes": [("cubes", S(state_cubes))],
    "diced": [("diced", S(state_diced))],
    "mashed": [("mashed", S(state_mashed)), ("puree", S(state_puree))],
    "cooked": [("cooked_fried", S(state_cooked_fried)), ("cooked_baked", S(state_cooked_baked))],
    "parts": [("parts_peel", S(state_parts_peel))],
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


def pose_heap(obs, radius):
    """Loose pile on the board: random spots in a disc, random turns, a few on top."""
    rng = lib.rng(SEED + 99)
    for ob in obs:
        a = rng.uniform(0, 2 * math.pi)
        r = radius * math.sqrt(rng.uniform(0, 1))
        ob.rotation_euler = Euler((rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3)))
        ob.location = Vector((r * math.cos(a), r * math.sin(a),
                              0.004 + 0.012 * max(0.0, 1 - r / radius) * rng.uniform(0, 1)))
    bpy.context.view_layer.update()
    for ob in obs:
        zmin = min((ob.matrix_world @ v.co).z for v in ob.data.vertices)
        if zmin < 0:   # nothing sinks into the board
            ob.location.z -= zmin


def pose_explode(obs, k):
    c = sum((o.location for o in obs), Vector()) / len(obs)
    for o in obs:
        d = o.location - c
        o.location = o.location + Vector((d.x * 0.5, d.y, d.z)) * k
    drop_to_floor(obs)


def frame(scene, obs, elev=24.0, azim=-12.0, res=(1200, 900), samples=64, dist_k=2.6):
    bpy.context.view_layer.update()
    # rest the group on the floor (the axis frame puts the belly a little below z = 0)
    zmin = min((o.matrix_world @ v.co).z for o in obs for v in o.data.vertices)
    for o in {o.parent or o for o in obs}:
        o.location.z -= zmin
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::7]]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max((hi - lo).length, 0.03)
    dist = size * dist_k
    e, a = math.radians(elev), math.radians(azim)
    cam = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    return lib.studio(scene, bg="#F3F1EE", cam_loc=tuple(cam), cam_target=tuple(c), res=res, samples=samples)


CUT_UP = {"half": 2, "cross_section": 1, "slices_5mm": 7, "slices_10mm": 5, "slices_15mm": 4,
          "slices_peel": 5, "half_slices": 7, "cubes": 8, "cooked_fried": 5}


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
                import photo        # photo-real shaders for previews only (GLBs keep vertex colours)
                photo.photo_materials(mats)
                os.makedirs(a.preview, exist_ok=True)
                if name in CUT_UP:
                    pose_cut_up(obs, per_row=CUT_UP[name])
                    frame(scene, obs, elev=48, azim=-8, samples=a.samples, dist_k=2.0)
                elif name == "diced":
                    pose_heap(obs, 0.032)
                    frame(scene, obs, elev=40, azim=-15, samples=a.samples, dist_k=2.0)
                elif name in ("mashed", "puree"):
                    frame(scene, obs, elev=35, azim=-10, samples=a.samples, dist_k=2.2)
                elif name == "strips":
                    for i, ob in enumerate(obs):
                        ob.location.y += (i - (len(obs) - 1) / 2) * 0.012
                    frame(scene, obs, elev=50, azim=-8, samples=a.samples)
                else:
                    frame(scene, obs, elev=18, azim=-10, samples=a.samples)
                lib.render(scene, os.path.join(a.preview, f"{ID}_{name}.jpg"))
            with open(report_path, "w") as f:
                json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
