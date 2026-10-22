"""Avocado (Hass) for the Buzzcook food library, built from the AVO-1 photogrammetry scan.

The scan is one half of a Hass avocado with the pit in it. tools/scan_prep.py turns it into a
clean skin half (aligned, metres, bottom hole closed) with its own UV map, and tools/skin_texture.py
bakes and cleans the skin colour and normal maps (stickers and the hole removed). This script:

  1. mirrors the skin half into a closed whole skin (the second half slightly flatter, so the
     fruit is not perfectly symmetric);
  2. builds the inside as nested shells offset from the skin: skin (1.6 mm), green flesh under
     the skin (to 5 mm), green-to-yellow flesh (to 12 mm), pale yellow core flesh around the pit
     cavity, and the pit (seed coat + cotyledon) fitted to the pit dome of the scan;
  3. cuts every state from that one build with planes (lib.split_all) and exports GLBs.

Run:  python avocado.py -- --work /tmp/avo/work --out OUT [--preview DIR] [--states a,b]
"""
import argparse
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "..", "tools"))

import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Euler, Matrix, Vector, noise  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import lib  # noqa: E402

ID = "avocado"
SEED = 4770
OFF = Vector((3.1, 7.7, 1.3))

# pit fitted to the scan's pit dome (tools/scan_prep.py prints the footprint and height)
PIT_C = Vector((0.0116, 0.0, 0.0))
PIT_R = Vector((0.0195, 0.0173, 0.0165))
COAT = 0.0008
SKIN = 0.0012
GREEN = 0.005
YELLOW = 0.012

DENSITY = {"skin": 1.0, "flesh": 0.97, "seed": 1.1}

C = {k: lib.srgb(v) for k, v in {
    "skin_cut0": "#2A2A1E", "skin_cut1": "#4F6424",
    "g1": "#7FA22E", "g2": "#B9CD5E", "y1": "#E2DD8E", "y2": "#EEE2A2",
    "cavity": "#E4DB9A", "peeled": "#62842A", "peeled2": "#7E9C33",
    "coat": "#6E4A33", "coat2": "#C49C7C", "coat_cut": "#4E3122", "coat3": "#B98A6E",
    "cot": "#E9D8AD", "cot2": "#D9C08E",
    "mash": "#C9D16A", "mash2": "#9DB547", "mash_y": "#E3DE96", "puree": "#BFCB5C", "puree2": "#A8BE4C",
}.items()}

MAT_NAMES = ["skin", "skin_cut", "flesh", "flesh_cut", "seed", "seed_cut", "_int", "_fsurf", "puree"]
M = {n: i for i, n in enumerate(MAT_NAMES)}
CUT = {"skin": M["skin_cut"], "flesh_out": M["flesh_cut"], "flesh_mid": M["flesh_cut"],
       "flesh_in": M["flesh_cut"], "coat": M["seed_cut"], "pit": M["seed_cut"]}
PART_ORDER = ["skin", "flesh_out", "flesh_mid", "flesh_in", "coat", "pit"]
FLESH = ["flesh_out", "flesh_mid", "flesh_in"]
BODY = ["skin"] + FLESH
PIT = ["coat", "pit"]


# ------------------------------------------------------------------ materials

def materials(work):
    mats = []
    for n in MAT_NAMES:
        if n == "skin":
            m = bpy.data.materials.new("skin")
            m.use_nodes = True
            nt = m.node_tree
            bsdf = nt.nodes["Principled BSDF"]
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(os.path.join(work, "avocado_skin_basecolor.jpg"))
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
            ntex = nt.nodes.new("ShaderNodeTexImage")
            ntex.image = bpy.data.images.load(os.path.join(work, "avocado_skin_normal.jpg"))
            ntex.image.colorspace_settings.name = "Non-Color"
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nm.inputs["Strength"].default_value = 1.0
            nt.links.new(ntex.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
            bsdf.inputs["Roughness"].default_value = 0.5
            bsdf.inputs["Specular IOR Level"].default_value = 0.4
            bsdf.inputs["Coat Weight"].default_value = 0.08
            bsdf.inputs["Coat Roughness"].default_value = 0.3
        elif n == "skin_cut":
            m = lib.make_material(n, rough=0.5)
        elif n == "flesh":
            m = lib.make_material(n, rough=0.38, coat=0.25, coat_rough=0.2, spec=0.45)
        elif n == "flesh_cut":
            m = lib.make_material(n, rough=0.3, coat=0.5, coat_rough=0.14, spec=0.45)
        elif n == "seed":
            m = lib.make_material(n, rough=0.55, coat=0.08, coat_rough=0.3, spec=0.35)
        elif n == "seed_cut":
            m = lib.make_material(n, rough=0.55, coat=0.3, coat_rough=0.2)
        elif n == "puree":
            m = lib.make_material(n, rough=0.36, coat=0.3, coat_rough=0.25)
        else:
            m = lib.make_material(n)
        if n in ("flesh", "flesh_cut", "puree"):
            b = m.node_tree.nodes.get("Principled BSDF")
            if b:   # previews only; glTF keeps base colour, roughness and clearcoat
                b.inputs["Subsurface Weight"].default_value = 0.12
                b.inputs["Subsurface Scale"].default_value = 0.002
        mats.append(m)
    return mats


# ------------------------------------------------------------------ geometry

def load_skin_half(work):
    d = np.load(os.path.join(work, "skin_half.npz"))
    return d["V"], d["F"], d["UV"]


def mirror_k(x):
    """z scale of the mirrored (upper) half: a little flatter, more so toward the stem end."""
    return 0.955 + 0.03 * (x / 0.0525)


def whole_skin(V, F, UV):
    """Closed skin: the scan half (z <= 0) plus its mirror image. The open rim of the half
    (its boundary loop, snapped to z = 0 in scan_prep.py) is shared by both halves."""
    edges = {}
    for f in F:
        for i in range(3):
            e = tuple(sorted((f[i], f[(i + 1) % 3])))
            edges[e] = edges.get(e, 0) + 1
    rim = {i for e, n in edges.items() if n == 1 for i in e}
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    lo, hi = [], []
    for i, v in enumerate(V):
        if i in rim:
            p = bm.verts.new(Vector((v[0], v[1], 0.0)))
            lo.append(p)
            hi.append(p)
        else:
            lo.append(bm.verts.new(Vector(v)))
            hi.append(bm.verts.new(Vector((v[0], v[1], -v[2] * mirror_k(v[0])))))
    for f, uv in zip(F, UV):
        if all(i in rim for i in f):
            continue   # sliver lying in the cut plane: it would sit inside the closed fruit
        a = bm.faces.new([lo[i] for i in f])
        for l, u in zip(a.loops, uv):
            l[uvl].uv = u
        b = bm.faces.new([hi[i] for i in reversed(f)])
        for l, u in zip(b.loops, list(reversed(uv))):
            l[uvl].uv = u
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    holes = [e for e in bm.edges if not e.is_manifold]
    if holes:
        bmesh.ops.holes_fill(bm, edges=holes, sides=0)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    for f in bm.faces:
        f.material_index = M["skin"]
    bm.normal_update()
    return bm


def bm_arrays(bm):
    bm.verts.ensure_lookup_table()
    return [v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in bm.faces]


def smooth_base(skin_bm, target_faces=4500):
    """Decimated, slightly smoothed copy of the skin used as the base of the inner shells."""
    me = bpy.data.meshes.new("_base")
    c = lib.bm_copy(skin_bm)
    c.to_mesh(me)
    c.free()
    ob = bpy.data.objects.new("_base", me)
    bpy.context.scene.collection.objects.link(ob)
    md = ob.modifiers.new("dec", "DECIMATE")
    md.ratio = target_faces / len(me.polygons)
    md.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bm = bmesh.new()
    bm.from_mesh(me2)
    bpy.data.objects.remove(ob)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(me2)
    for lay in list(bm.loops.layers.uv):
        bm.loops.layers.uv.remove(lay)
    for _ in range(6):
        bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bm.normal_update()
    return bm


def offset_shell(base, tree, depth):
    """Inner shell `depth` under the skin. Where the fruit is thin (the neck), the offset is
    limited to 40 % of the local thickness so shells never cross."""
    base.verts.ensure_lookup_table()
    ds = []
    for v in base.verts:
        n = v.normal
        hit = tree.ray_cast(v.co - n * 1e-4, -n)
        h = hit[3] if hit[0] is not None else 0.1
        ds.append(min(depth, 0.4 * h))
    for _ in range(4):   # smooth the offset field
        ds = [0.5 * ds[v.index] + 0.5 * sum(ds[e.other_vert(v).index] for e in v.link_edges)
              / max(1, len(v.link_edges)) for v in base.verts]
    verts = [v.co - v.normal * d for v, d in zip(base.verts, ds)]
    faces = [[v.index for v in f.verts] for f in base.faces]
    return verts, faces


def pit_surface(scale_in=0.0):
    rng = lib.rng(SEED + 5)
    o = Vector((rng.uniform(0, 9), rng.uniform(0, 9), rng.uniform(0, 9)))

    def fn(u, v):
        d = Vector((math.cos(v), math.sin(v) * math.cos(u), math.sin(v) * math.sin(u)))
        egg = 1 + 0.07 * d.x            # rounder toward the broad end (+x)
        n = 1 + 0.012 * noise.noise(d * 2.5 + o)
        r = Vector((PIT_R.x * n, PIT_R.y * egg * n, PIT_R.z * egg * n))
        p = Vector((d.x * r.x, d.y * r.y, d.z * r.z))
        if scale_in:
            p -= d.normalized() * scale_in
        return PIT_C + p
    return lib.grid_shell(fn, 56, 36)


def shell_pair(outer, inner, mat_out, mat_in):
    bm = bmesh.new()
    lib.add_shell(bm, outer[0], outer[1], mat_out)
    if inner:
        lib.add_shell(bm, inner[0], inner[1], mat_in, reverse=True)
    bm.normal_update()
    return bm


def build(work):
    V, F, UV = load_skin_half(work)
    skin = whole_skin(V, F, UV)
    s0 = bm_arrays(skin)
    tree = BVHTree.FromBMesh(skin)
    base = smooth_base(skin)
    s1 = offset_shell(base, tree, SKIN)
    s2 = offset_shell(base, tree, GREEN)
    s3 = offset_shell(base, tree, YELLOW)
    base.free()
    p0 = pit_surface()
    p1 = pit_surface(COAT)

    # skin: textured outer surface with the reversed S1 shell inside
    lib.add_shell(skin, s1[0], s1[1], M["_int"], reverse=True)
    skin.normal_update()
    parts = {
        "skin": skin,
        "flesh_out": shell_pair(s1, s2, M["_fsurf"], M["_int"]),
        "flesh_mid": shell_pair(s2, s3, M["_int"], M["_int"]),
        "flesh_in": shell_pair(s3, p0, M["_int"], M["flesh"]),   # reversed pit = the pit cavity
        "coat": shell_pair(p0, p1, M["seed"], M["_int"]),
        "pit": shell_pair(p1, None, M["_int"], None),
    }
    info = {"tree": tree, "outer": s0, "pit_tree": BVHTree.FromPolygons(p0[0], p0[1])}
    return parts, info


# ------------------------------------------------------------------ colour

def colour_fn(info):
    tree, ptree = info["tree"], info["pit_tree"]

    def fn(mat, co, face):
        if mat == M["skin"]:
            return Vector((1, 1, 1))
        n1 = noise.noise(co * 260 + OFF) * 0.5 + 0.5
        n2 = noise.noise(co * 70 + OFF * 2) * 0.5 + 0.5
        if mat in (M["seed"], M["seed_cut"]):
            pd = (ptree.find_nearest(co)[3] or 0.0)
            if mat == M["seed"]:
                n3 = noise.noise(co * 160 + OFF * 4) * 0.5 + 0.5
                n4 = noise.noise(co * 420 + OFF * 6) * 0.5 + 0.5
                t = min(1.0, max(0.0, (n2 - 0.38) * 3.0))      # dark seed-coat patches vs pale tan
                c = lib.lerp(C["coat2"], C["coat"], t)
                c = lib.lerp(c, C["coat3"], 0.35 * n3)          # pinkish blush
                return c * (0.88 + 0.24 * n4)
            if pd < COAT * 0.6:
                return lib.lerp(C["coat_cut"], C["coat"], n1 * 0.5)
            return lib.lerp(C["cot"], C["cot2"], min(1.0, (pd - COAT) / 0.012) * 0.6 + 0.15 * n1)
        d = tree.find_nearest(co)[3] or 0.0
        if mat == M["skin_cut"]:
            return lib.lerp(C["skin_cut0"], C["skin_cut1"], d / SKIN)
        if mat == M["flesh"]:
            if d < SKIN + 0.001:   # outside of peeled flesh
                return lib.lerp(C["peeled"], C["peeled2"], 0.6 * n2 + 0.2 * n1)
            return lib.lerp(C["cavity"], C["y2"], 0.4 * n2)
        if mat == M["flesh_cut"]:
            if d < GREEN:
                c = lib.lerp(C["g1"], C["g2"], (d - SKIN) / (GREEN - SKIN))
            elif d < YELLOW:
                c = lib.lerp(C["g2"], C["y1"], (d - GREEN) / (YELLOW - GREEN))
            else:
                c = lib.lerp(C["y1"], C["y2"], (d - YELLOW) / 0.008)
            n3 = noise.noise(co * 120 + OFF * 5) * 0.5 + 0.5
            return c * (0.95 + 0.05 * n1 + 0.05 * n3)
        return Vector((0.8, 0.8, 0.6))
    return fn


# ------------------------------------------------------------------ pieces

def copy_parts(parts, keys):
    return {k: lib.bm_copy(parts[k]) for k in keys}


def make_pieces(parts, planes, keys):
    return lib.split_all([copy_parts(parts, keys)], planes, CUT)


def piece_mass_g(piece):
    m = 0.0
    for k, bm in piece.items():
        dens = DENSITY["skin"] if k == "skin" else DENSITY["seed"] if k in PIT else DENSITY["flesh"]
        m += lib.volume(bm) * 1e6 * dens
    return m


def centroid(piece):
    vs = [v.co for bm in piece.values() for v in list(bm.verts)[::3]]
    return sum(vs, Vector()) / max(1, len(vs))


def clean(bm, has_skin):
    """Drop hidden interface shells and weld the coincident cap loops, so a piece is one closed
    surface: its outer surface plus its cut faces."""
    dead = [f for f in bm.faces if f.material_index == M["_int"]
            or (has_skin and f.material_index == M["_fsurf"])]
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    for f in bm.faces:
        if f.material_index == M["_fsurf"]:
            f.material_index = M["flesh"]
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-6)
    bm.normal_update()
    return bm


def refine_cuts(bm, max_edge=0.0055, rounds=2):
    cut = {M["flesh_cut"], M["seed_cut"]}
    for _ in range(rounds):
        edges = [e for e in bm.edges if e.calc_length() > max_edge
                 and all(f.material_index in cut for f in e.link_faces)]
        if not edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.normal_update()


def objects_for(pieces, prefix, info, mats, coll, sort_key=None, fn=None):
    fn = fn or colour_fn(info)
    if sort_key:
        pieces = sorted(pieces, key=sort_key)
    obs, masses = [], []
    for i, p in enumerate(pieces):
        masses.append(piece_mass_g(p))
        bm = lib.merge_parts(p, PART_ORDER)
        clean(bm, "skin" in p)
        refine_cuts(bm)
        lib.paint(bm, fn)
        name = f"{prefix}_{i:02d}" if len(pieces) < 100 else f"{prefix}_{i:03d}"
        obs.append(lib.to_object(name, bm, mats, coll, smooth_angle=math.radians(50)))
        bm.free()
    return obs, masses


def jitter_planes(axis, lo, hi, step, rng, tilt_deg=3.0, first=None):
    """Parallel cut planes across `axis` with ±8 % spacing and ±tilt (a knife is never exact)."""
    planes = []
    t = math.radians(tilt_deg)
    s = first if first is not None else lo + step * rng.uniform(0.6, 1.0)
    while s < hi:
        no = Vector([1.0 if i == axis else 0.0 for i in range(3)])
        no = Euler((rng.uniform(-t, t), rng.uniform(-t, t), rng.uniform(-t, t))).to_matrix() @ no
        co = Vector((0, 0, 0))
        co[axis] = s
        planes.append((co, no))
        s += step * rng.uniform(0.92, 1.08)
    return planes


def box(info):
    vs = info["outer"][0]
    return (Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))),
            Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs))))


HALF = [(Vector((0, 0, 3e-5)), Vector((0, 0, 1)))]   # just off the mirror seam (exact seam vertices upset bisect)


def state_whole(parts, info, mats, coll):
    bm = bmesh.new()
    me = bpy.data.meshes.new("_w")
    lib.bm_copy(parts["skin"]).to_mesh(me)
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    clean(bm, True)
    lib.paint(bm, colour_fn(info))
    m = piece_mass_g({k: parts[k] for k in BODY + PIT})
    return [lib.to_object("whole", bm, mats, coll, origin="bottom", smooth_angle=math.radians(80))], [m]


def state_half(parts, info, mats, coll):
    """Cut lengthwise around the pit; the pit stays in the lower half, as in the scan."""
    pieces = make_pieces(parts, HALF, BODY)
    pieces.sort(key=lambda p: centroid(p).z)
    obs, masses = objects_for(pieces, "half", info, mats, coll)
    p_obs, p_m = objects_for([copy_parts(parts, PIT)], "pit", info, mats, coll)
    return obs + p_obs, masses + p_m


def state_quarter(parts, info, mats, coll):
    pieces = make_pieces(parts, HALF + [(Vector((0, 0, 0)), Vector((0, 1, 0)))], BODY)
    key = lambda p: (round(centroid(p).z, 3), centroid(p).y)
    return objects_for(pieces, "quarter", info, mats, coll, sort_key=key)


def state_peeled(parts, info, mats, coll):
    """Both halves scooped out of the skin, pit removed."""
    pieces = make_pieces(parts, HALF, FLESH)
    return objects_for(pieces, "peeled", info, mats, coll, sort_key=lambda p: centroid(p).z)


def state_slices(parts, info, mats, coll, thick=0.006):
    """Each peeled half sliced lengthwise (the avocado-toast fan)."""
    lo, hi = box(info)
    rng = lib.rng(SEED + 31)
    planes = HALF + jitter_planes(1, lo.y, hi.y - thick * 0.4, thick, rng)
    pieces = [p for p in make_pieces(parts, planes, FLESH) if piece_mass_g(p) > 0.8]
    key = lambda p: (round(centroid(p).z, 3) > 0, centroid(p).y)
    return objects_for(pieces, "slice", info, mats, coll, sort_key=key)


def state_cubes(parts, info, mats, coll, step=0.015):
    lo, hi = box(info)
    rng = lib.rng(SEED + 41)
    planes = (HALF + jitter_planes(0, lo.x, hi.x, step, rng, tilt_deg=2)
              + jitter_planes(1, lo.y, hi.y, step, rng, tilt_deg=2)
              + [(Vector((0, 0, z)), Vector((0, 0, 1))) for z in (-0.016, 0.016)])
    pieces = [p for p in make_pieces(parts, planes, FLESH) if piece_mass_g(p) > 0.6]
    key = lambda p: (round(centroid(p).z, 2), round(centroid(p).y, 2), centroid(p).x)
    return objects_for(pieces, "cube", info, mats, coll, sort_key=key)


def state_diced(parts, info, mats, coll, step=0.008):
    """8 mm dice of one peeled half (a representative portion; the app multiplies it)."""
    lo, hi = box(info)
    rng = lib.rng(SEED + 51)
    lower = make_pieces(parts, HALF, FLESH)
    lower.sort(key=lambda p: centroid(p).z)
    planes = (jitter_planes(0, lo.x, hi.x, step, rng, tilt_deg=4)
              + jitter_planes(1, lo.y, hi.y, step, rng, tilt_deg=4)
              + jitter_planes(2, lo.z, -0.004, step, rng, tilt_deg=4))
    pieces = [p for p in lib.split_all([lower[0]], planes, CUT) if piece_mass_g(p) > 0.08]
    key = lambda p: (round(centroid(p).z, 3), round(centroid(p).y, 3), centroid(p).x)
    return objects_for(pieces, "dice", info, mats, coll, sort_key=key)


def mound(radius, height, nu, nv, lump, salt):
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
        n = noise.noise(co * 220 + OFF) * 0.5 + 0.5
        m = noise.noise(co * 55 + OFF * 2) * 0.5 + 0.5
        if kind == "mashed":
            c = lib.lerp(C["mash"], C["mash_y"], 0.7 * m)
            if noise.noise(co * 900 + OFF * 3) > 0.45:   # bits of the dark green outer flesh
                c = lib.lerp(c, C["mash2"], 0.7)
            return c * (0.96 + 0.08 * n)
        return lib.lerp(C["puree"], C["puree2"], 0.35 * n)
    return fn


def flesh_volume(parts):
    return sum(lib.volume(parts[k]) for k in FLESH)


def state_mashed(parts, info, mats, coll):
    """Fork-mashed avocado: a lumpy heap with soft chunks pressed into it."""
    vol = flesh_volume(parts)
    h_r = 0.42
    r = (vol / (2 / 3 * math.pi * h_r)) ** (1 / 3)
    v, f = mound(r, r * h_r, 160, 80, 0.3, 1)
    bm = bmesh.new()
    lib.add_shell(bm, v, f, M["puree"])
    bm.normal_update()
    lib.paint(bm, mash_colour("mashed"))
    obs = [lib.to_object("mash_00", bm, mats, coll, origin="bottom")]
    masses = [vol * 1e6 * DENSITY["flesh"] * 0.85]
    d_obs, d_m = state_diced(parts, info, mats, coll)
    rng = lib.rng(SEED + 71)
    keep = set(rng.sample(range(len(d_obs)), min(16, len(d_obs))))
    for i, ob in enumerate(d_obs):
        if i not in keep:
            bpy.data.objects.remove(ob)
            continue
        a = rng.uniform(0, 2 * math.pi)
        rr = rng.uniform(0, r * 0.75)
        ob.data.transform(Matrix.Diagonal((1.15, 1.15, 0.6, 1)))
        ob.rotation_euler = Euler((rng.uniform(-0.5, 0.5), rng.uniform(-0.5, 0.5), rng.uniform(0, 6.3)))
        zt = r * h_r * math.sqrt(max(0.0, 1 - (rr / r) ** 2))
        ob.location = Vector((rr * math.cos(a), rr * math.sin(a), zt - 0.0015))
        ob.name = f"chunk_{len(obs):02d}"
        obs.append(ob)
        masses.append(d_m[i])
    return obs, masses


def state_puree(parts, info, mats, coll):
    vol = flesh_volume(parts)
    h_r = 0.36
    r = (vol / (2 / 3 * math.pi * h_r)) ** (1 / 3)
    v, f = mound(r, r * h_r, 128, 56, 0.05, 2)
    bm = bmesh.new()
    lib.add_shell(bm, v, f, M["puree"])
    bm.normal_update()
    lib.paint(bm, mash_colour("puree"))
    return [lib.to_object("puree", bm, mats, coll, origin="bottom")], [vol * 1e6 * DENSITY["flesh"]]


def state_parts_pit(parts, info, mats, coll):
    return objects_for([copy_parts(parts, PIT)], "pit", info, mats, coll)


def state_parts_skin(parts, info, mats, coll):
    """The two empty skin halves left after scooping."""
    pieces = make_pieces(parts, HALF, ["skin"])
    return objects_for(pieces, "skin", info, mats, coll, sort_key=lambda p: centroid(p).z)


def state_pit_cut(parts, info, mats, coll):
    """The pit cut in half: brown seed coat around the pale cotyledon."""
    pieces = make_pieces(parts, [(PIT_C, Vector((0, 0, 1)))], PIT)
    return objects_for(pieces, "pit_half", info, mats, coll, sort_key=lambda p: centroid(p).z)


STATES = {
    "whole": [("whole", state_whole)],
    "half": [("half", state_half)],
    "quarter": [("quarter", state_quarter)],
    "peeled": [("peeled", state_peeled)],
    "slices": [("slices_6mm", state_slices)],
    "cubes": [("cubes", state_cubes)],
    "diced": [("diced", state_diced)],
    "mashed": [("mashed", state_mashed), ("puree", state_puree)],
    "parts": [("parts_pit", state_parts_pit), ("parts_pit_cut", state_pit_cut), ("parts_skin", state_parts_skin)],
}


# ------------------------------------------------------------------ placement and previews

def rest_on_floor(obs):
    """Root pivot = centre of the group's bottom (STANDARD §4)."""
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in o.data.vertices]
    c = Vector(((min(p.x for p in pts) + max(p.x for p in pts)) / 2,
                (min(p.y for p in pts) + max(p.y for p in pts)) / 2, min(p.z for p in pts)))
    for o in obs:
        o.location -= c


def face_up(ob, mat_ids):
    """Turn a piece so its largest cut face looks up."""
    best = {}
    for p in ob.data.polygons:
        if p.material_index in mat_ids:
            k = tuple(round(x, 1) for x in p.normal)
            best[k] = best.get(k, 0) + p.area
    if best:
        n = Vector(max(best, key=best.get)).normalized()
        ob.rotation_euler = n.rotation_difference(Vector((0, -0.25, 0.97)).normalized()).to_euler()


CUTS = {M["flesh_cut"], M["skin_cut"], M["seed_cut"]}


def pose(name, obs):
    rng = lib.rng(SEED + 99)
    if name == "half":
        lower, upper, pit = obs
        upper.rotation_euler = (math.pi, 0, 0)
        upper.location += Vector((0, -0.085, 0))
        bpy.context.view_layer.update()
        zmin = min((upper.matrix_world @ v.co).z for v in upper.data.vertices)
        upper.location.z -= zmin
        return   # the pit stays where it is, in the lower half
    elif name in ("quarter", "peeled", "parts_skin", "parts_pit_cut"):
        bpy.context.view_layer.update()
        dx = max(max(o.dimensions) for o in obs) + 0.01
        for i, ob in enumerate(obs):
            face_up(ob, CUTS)
            ob.location = Vector(((i % 2) * dx - dx / 2, -(i // 2) * dx * 0.7, 0))
    elif name == "slices_6mm":
        # slices lying on their cut faces in rows, like on a board
        bpy.context.view_layer.update()
        per_row = 6
        for i, ob in enumerate(obs):
            face_up(ob, CUTS)
            r, c = divmod(i, per_row)
            ob.location = Vector(((c - (per_row - 1) / 2) * 0.034, -r * 0.09, 0))
    elif name in ("cubes", "diced"):
        rad = 0.05 if name == "cubes" else 0.035
        for ob in obs:
            a = rng.uniform(0, 2 * math.pi)
            r = rad * math.sqrt(rng.uniform(0, 1))
            ob.rotation_euler = Euler((rng.uniform(0, 6.3), rng.uniform(0, 6.3), rng.uniform(0, 6.3)))
            ob.location = Vector((r * math.cos(a), r * math.sin(a), 0.004))
    bpy.context.view_layer.update()
    if name not in ("mashed", "puree"):
        for ob in obs:
            zmin = min((ob.matrix_world @ v.co).z for v in ob.data.vertices)
            ob.location.z -= zmin


def frame(scene, obs, elev=30.0, azim=-14.0, samples=64, dist_k=2.3, res=(1200, 900)):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in obs for v in list(o.data.vertices)[::5]]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    dist = max((hi - lo).length, 0.04) * dist_k
    e, a = math.radians(elev), math.radians(azim)
    cam = c + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * dist
    lib.studio(scene, bg="#F3F1EE", cam_loc=tuple(cam), cam_target=tuple(c), res=res, samples=samples)


VIEW = {"whole": (22, -20), "half": (55, -10), "quarter": (55, -10), "peeled": (50, -10),
        "slices_6mm": (60, -10), "cubes": (45, -12), "diced": (45, -12), "mashed": (32, -10),
        "puree": (32, -10), "parts_pit": (25, -20), "parts_pit_cut": (55, -10), "parts_skin": (55, -10)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", required=True)
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
    parts, info = build(a.work)
    only = set(a.only.split(",")) if a.only else None
    for state in a.states.split(","):
        for name, fn in STATES[state]:
            if only and name not in only:
                continue
            scene = lib.new_scene()
            coll = scene.collection
            mats = materials(a.work)
            obs, masses = fn(parts, info, mats, coll)
            rest_on_floor(obs)
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
                for ob in obs:
                    ob.parent = None
                pose(name, obs)
                el, az = VIEW.get(name, (30, -14))
                frame(scene, obs, elev=el, azim=az, samples=a.samples)
                lib.render(scene, os.path.join(a.preview, f"{ID}_{name}.jpg"))
            with open(report_path, "w") as f:
                json.dump(report, f, indent=1)


if __name__ == "__main__":
    main()
