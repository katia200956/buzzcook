"""Shared Blender helpers for the Buzzcook food library (see food-library/STANDARD.md).

Every product is a set of closed "part" meshes (skin wall, flesh core, gel, seeds, ...).
Hollow parts are stored as nested shells: an outer shell plus reversed inner shells, so no
boolean operations are needed. States are made by splitting the parts with planes
(bisect + fill), which keeps all pieces of a state watertight and gap-free.

Blender works in Z-up metres; the glTF exporter converts to Y-up.
"""
import math
import random

import bpy  # must come before bmesh
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import pack_colors

COL = "Col"  # corner-domain colour attribute exported as COLOR_0


# ---------------------------------------------------------------- colour

def srgb(hexstr):
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return Vector(out)


def lerp(a, b, t):
    t = max(0.0, min(1.0, t))
    return a * (1.0 - t) + b * t


# ---------------------------------------------------------------- materials

def make_material(name, rough=0.5, coat=0.0, coat_rough=0.1, spec=0.5, sheen=0.0, alpha=1.0):
    """PBR material whose base colour comes from the vertex colour attribute."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = COL
    nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Specular IOR Level"].default_value = spec
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = coat_rough
    bsdf.inputs["Sheen Weight"].default_value = sheen
    bsdf.inputs["Alpha"].default_value = alpha
    if alpha < 1.0:
        m.surface_render_method = "BLENDED"
    return m


# ---------------------------------------------------------------- mesh building

def grid_shell(fn, nu, nv):
    """Closed surface from fn(u, v) with u in [0, 2pi) around and v in [0, pi] pole to pole.
    Returns (verts, faces) with outward normals for a fn that runs top pole -> bottom pole."""
    verts = [fn(0.0, 0.0)]
    for j in range(1, nv):
        v = math.pi * j / nv
        for i in range(nu):
            verts.append(fn(2 * math.pi * i / nu, v))
    verts.append(fn(0.0, math.pi))
    faces = []
    top, bot = 0, len(verts) - 1
    ring = lambda j, i: 1 + (j - 1) * nu + (i % nu)
    for i in range(nu):
        faces.append((top, ring(1, i), ring(1, i + 1)))
    for j in range(1, nv - 1):
        for i in range(nu):
            faces.append((ring(j, i), ring(j + 1, i), ring(j + 1, i + 1), ring(j, i + 1)))
    for i in range(nu):
        faces.append((bot, ring(nv - 1, i + 1), ring(nv - 1, i)))
    return verts, faces


def add_shell(bm, verts, faces, mat, reverse=False):
    vs = [bm.verts.new(v) for v in verts]
    out = []
    for f in faces:
        ff = bm.faces.new([vs[i] for i in (reversed(f) if reverse else f)])
        ff.material_index = mat
        out.append(ff)
    return out


def bm_copy(bm):
    me = bpy.data.meshes.new("_tmp")
    bm.to_mesh(me)
    c = bmesh.new()
    c.from_mesh(me)
    bpy.data.meshes.remove(me)
    return c


def bvh(verts, faces):
    return BVHTree.FromPolygons([Vector(v) for v in verts], faces)


def inside(tree, p, direction=Vector((0.31, 0.27, 0.91))):
    """Parity test: point inside a closed mesh."""
    n = 0
    o = Vector(p)
    d = direction.normalized()
    while True:
        hit = tree.ray_cast(o, d)
        if hit[0] is None:
            return n % 2 == 1
        n += 1
        o = hit[0] + d * 1e-6


# ---------------------------------------------------------------- cutting

def split(bm, co, no, cut_mat):
    """Split a closed bmesh by the plane (co, no). Returns (below, above); either may be None.
    New cap faces get material index cut_mat."""
    co, no = Vector(co), Vector(no).normalized()
    ds = [(v.co - co).dot(no) for v in bm.verts]
    if not ds:
        return None, None
    if max(ds) <= 1e-7:
        return bm, None
    if min(ds) >= -1e-7:
        return None, bm
    halves = []
    for keep_below in (True, False):
        b = bm_copy(bm)
        geom = b.verts[:] + b.edges[:] + b.faces[:]
        r = bmesh.ops.bisect_plane(b, geom=geom, dist=1e-7, plane_co=co, plane_no=no,
                                   clear_outer=keep_below, clear_inner=not keep_below)
        cut_edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if cut_edges:
            want = no if keep_below else -no
            filled = bmesh.ops.triangle_fill(b, edges=cut_edges, use_beauty=True,
                                             use_dissolve=False, normal=want)
            new_faces = [f for f in filled["geom"] if isinstance(f, bmesh.types.BMFace)]
            b.normal_update()
            flip = [f for f in new_faces if f.normal.dot(want) < 0]
            if flip:
                bmesh.ops.reverse_faces(b, faces=flip)
            for f in new_faces:
                f.material_index = cut_mat
        b.normal_update()
        halves.append(b if b.faces else None)
    return halves[0], halves[1]


def split_all(pieces, planes, cut_mats):
    """pieces: list of dict(part -> bmesh); cut_mats: part -> cap material index.
    Every plane splits every piece it crosses."""
    for co, no in planes:
        out = []
        for p in pieces:
            lo, hi = {}, {}
            for part, bm in p.items():
                a, b = split(bm, co, no, cut_mats[part])
                if a is not None:
                    lo[part] = a
                if b is not None:
                    hi[part] = b
            for q in (lo, hi):
                if q:
                    out.append(q)
        pieces = out
    return pieces


def volume(bm):
    return abs(bm.calc_volume(signed=True))


def piece_volume(piece, solid_parts):
    """Volume of a piece = volume of its outermost solid parts (nested shells already
    subtract their holes)."""
    return sum(volume(piece[p]) for p in solid_parts if p in piece)


# ---------------------------------------------------------------- objects and export

def merge_parts(piece, order):
    out = bmesh.new()
    me = bpy.data.meshes.new("_m")
    for part in order:
        if part in piece:
            piece[part].to_mesh(me)
            out.from_mesh(me)
    bpy.data.meshes.remove(me)
    return out


def paint(bm, colour_fn):
    """colour_fn(material_index, co, face) -> Vector rgb (linear)."""
    lay = bm.loops.layers.float_color.get(COL) or bm.loops.layers.float_color.new(COL)
    for f in bm.faces:
        for l in f.loops:
            c = colour_fn(f.material_index, l.vert.co, f)
            l[lay] = (c[0], c[1], c[2], 1.0)


def to_object(name, bm, mats, collection, origin="centroid", smooth_angle=math.radians(40)):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    collection.objects.link(ob)
    if origin == "centroid":
        c = sum((v.co for v in me.vertices), Vector()) / max(1, len(me.vertices))
    elif origin == "bottom":
        xs = [v.co for v in me.vertices]
        c = Vector(((min(p.x for p in xs) + max(p.x for p in xs)) / 2,
                    (min(p.y for p in xs) + max(p.y for p in xs)) / 2,
                    min(p.z for p in xs)))
    else:
        c = Vector(origin)
    me.transform(Matrix.Translation(-c))
    ob.location = c
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=smooth_angle)
    except AttributeError:
        pass
    if me.color_attributes.get(COL):
        me.color_attributes.active_color = me.color_attributes[COL]
    return ob


def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.unit_settings.system = "METRIC"
    s.unit_settings.scale_length = 1.0
    return s


def export_glb(path, root_name, objects, collection):
    root = bpy.data.objects.new(root_name, None)
    collection.objects.link(root)
    for ob in objects:
        ob.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for ob in objects:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_yup=True, export_apply=True,
                              export_vertex_color="MATERIAL",
                              export_normals=True, export_tangents=False,
                              export_materials="EXPORT", export_extras=False,
                              export_draco_mesh_compression_enable=False)
    pack_colors.pack(path)
    return root


def tri_count(objects):
    n = 0
    for ob in objects:
        if ob.type == "MESH":
            for p in ob.data.polygons:
                n += len(p.vertices) - 2
    return n


# ---------------------------------------------------------------- preview rendering

def studio(scene, bg="#F0EBE7", res=(900, 1200), samples=48, cam_loc=(0, -0.42, 0.06),
           cam_target=(0, 0, 0.04), lens=85):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("w")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bgn = nt.nodes["Background"]
    bgn.inputs["Color"].default_value = (*srgb(bg), 1)
    bgn.inputs["Strength"].default_value = 0.08
    # camera sees the full backdrop colour, reflections and lighting see a dim world
    cam_bg = nt.nodes.new("ShaderNodeBackground")
    cam_bg.inputs["Color"].default_value = (*srgb(bg), 1)
    cam_bg.inputs["Strength"].default_value = 1.0
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    out = nt.nodes["World Output"]
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
    nt.links.new(bgn.outputs[0], mix.inputs[1])
    nt.links.new(cam_bg.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    # backdrop with a soft floor curve
    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, 0))
    floor = bpy.context.active_object
    fm = bpy.data.materials.new("floor")
    fm.use_nodes = True
    fb = fm.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (*srgb(bg), 1)
    fb.inputs["Roughness"].default_value = 0.9
    floor.data.materials.append(fm)
    floor.is_shadow_catcher = True
    # key: large soft area light upper left; fill right; rim behind
    def area(name, loc, size, power, color=(1, 1, 1)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.size = size
        ld.energy = power
        ld.color = color
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        d = Vector(cam_target) - Vector(loc)
        lo.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        return lo
    area("key", (-0.45, -0.35, 0.55), 0.6, 6, (1.0, 0.97, 0.93))
    area("fill", (0.5, -0.4, 0.15), 0.8, 2.5)
    area("rim", (0.15, 0.45, 0.45), 0.4, 3)
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cam = bpy.data.objects.new("cam", cd)
    scene.collection.objects.link(cam)
    cam.location = cam_loc
    d = Vector(cam_target) - Vector(cam_loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    return cam


def render(scene, path):
    scene.render.filepath = path
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    bpy.ops.render.render(write_still=True)


def rng(seed):
    return random.Random(seed)
