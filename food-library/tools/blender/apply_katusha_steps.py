"""Apply Katusha's 5 Blender steps to tomato_half.blend (headless)."""
import sys, math, random
import bpy, bmesh
from mathutils import Vector, Matrix, noise

src, dst, render_path = sys.argv[-3:]
bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
rng = random.Random(7)

halves = [o for o in scene.objects if o.type == "MESH" and o.name.startswith("tomato_half_")]
halves.sort(key=lambda o: o.name)

# ---- split each half into objects by part, so each layer can be selected like in the steps
GROUPS = {"flesh": {"skin", "flesh", "flesh_cut", "core", "core_cut"},
          "gel": {"gel", "gel_cut"}, "seeds": {"seed", "seed_cut"}, "calyx": {"calyx", "stem"}}
parts = {}
for h in halves:
    mats = [m.name if m else "" for m in h.data.materials]
    for gname, names in GROUPS.items():
        ob = h.copy(); ob.data = h.data.copy()
        ob.name = f"{h.name}_{gname}"
        scene.collection.objects.link(ob)
        bm = bmesh.new(); bm.from_mesh(ob.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if mats[f.material_index] not in names], context="FACES")
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
        bm.to_mesh(ob.data); bm.free()
        if len(ob.data.polygons) == 0:
            bpy.data.objects.remove(ob); continue
        parts.setdefault(h.name, {})[gname] = ob
    bpy.data.objects.remove(h)
for h, d in parts.items():
    d["flesh"].name = h  # keeps "tomato_half_00" as the red tomato object, like in the steps

# ---- step 2: irregular, slightly oval shape and uneven septa (one smooth field in world space,
# so flesh, gel and seeds move together and stay nested)
def field(p, salt):
    o = Vector((salt * 13.1, salt * 7.7, salt * 3.3))
    big = noise.noise_vector(p * 22 + o) * 0.0016
    small = noise.noise_vector(p * 70 + o * 2) * 0.0005
    return big + small

for hi, (h, d) in enumerate(parts.items()):
    flesh = d["flesh"]
    centre = flesh.matrix_world @ (sum((v.co for v in flesh.data.vertices), Vector()) / len(flesh.data.vertices))
    ovalx, ovaly = rng.uniform(1.04, 1.08), rng.uniform(0.95, 0.98)
    for gname, ob in d.items():
        mw, mi = ob.matrix_world, ob.matrix_world.inverted()
        for v in ob.data.vertices:
            p = mw @ v.co
            q = p - centre
            q.x *= ovalx; q.y *= ovaly
            r = math.hypot(q.x, q.y)
            amp = 1.0 + 1.6 * max(0.0, 1 - r / 0.022)  # interior (septa, columella) moves more
            p2 = centre + q + field(p, hi + 1) * amp
            v.co = mi @ p2
        ob.data.update()

# ---- step 5: whole seeds become instances on points (Random Rotation + Random Scale 0.7-1.1);
# seeds the knife went through stay as real cut geometry
def islands(bm):
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen: continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop(); isl.append(g)
            for e in g.edges:
                for n in e.link_faces:
                    if n.index not in seen:
                        seen.add(n.index); stack.append(n)
        out.append(isl)
    return out

def basis(pts):
    c = sum(pts, Vector()) / len(pts)
    cov = Matrix(((0,)*3,)*3)
    for p in pts:
        d = p - c
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    # power iteration for the long axis, then the thin axis
    def principal(m, guess):
        v = guess.normalized()
        for _ in range(40):
            v = (m @ v).normalized()
        return v
    a = principal(cov, Vector((1, 0.3, 0.1)))
    def proj(v): return v - a * a.dot(v)
    cov2 = cov.copy()
    lam = (cov @ a).dot(a)
    for i in range(3):
        for j in range(3):
            cov2[i][j] -= lam * a[i] * a[j]
    b = principal(cov2, proj(Vector((0.1, 1, 0.3))))
    b = proj(b).normalized()
    t = a.cross(b)
    if sum((p - c).dot(a) ** 3 for p in pts) < 0:  # pointed end along +a
        a, t = -a, -t
    return c, Matrix((a, b, t)).transposed()

seed_template = None
for h, d in parts.items():
    sob = d.get("seeds")
    if not sob: continue
    mats = [m.name for m in sob.data.materials]
    bm = bmesh.new(); bm.from_mesh(sob.data); bm.faces.ensure_lookup_table()
    whole, cut_faces = [], []
    for isl in islands(bm):
        if any(mats[f.material_index] == "seed_cut" for f in isl):
            cut_faces += isl
        else:
            whole.append(isl)
    if seed_template is None and whole:
        isl = whole[0]
        vs = {v for f in isl for v in f.verts}
        c, R = basis([v.co.copy() for v in vs])
        tb = bmesh.new()
        vmap = {v: tb.verts.new(R.transposed() @ (v.co - c)) for v in vs}
        col_src = bm.loops.layers.float_color.get("Col") or (bm.loops.layers.float_color[0] if bm.loops.layers.float_color else None)
        col_dst = tb.loops.layers.float_color.new(col_src.name if col_src else "Col")
        for f in isl:
            nf = tb.faces.new([vmap[v] for v in f.verts])
            nf.material_index = 0
            for l_src, l_dst in zip(f.loops, nf.loops):
                l_dst[col_dst] = l_src[col_src] if col_src else (0.94, 0.72, 0.28, 1)
        me = bpy.data.meshes.new("seed_template")
        tb.to_mesh(me); tb.free()
        me.materials.append(bpy.data.materials["seed"])
        seed_template = bpy.data.objects.new("seed_template", me)
        scene.collection.objects.link(seed_template)
        seed_template.hide_render = True; seed_template.hide_viewport = True
        seed_template.location = (0, 0, -1)
    # points with the original orientation of each whole seed
    pts, rots = [], []
    for isl in whole:
        vs = {v for f in isl for v in f.verts}
        c, R = basis([v.co.copy() for v in vs])
        pts.append(c); rots.append(R.to_euler())
    # leave only the cut seeds in the seeds object
    bmesh.ops.delete(bm, geom=[f for isl in whole for f in isl], context="FACES")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(sob.data); bm.free()
    sob.name = f"{h}_seed_cut"
    pm = bpy.data.meshes.new(f"{h}_seed_points")
    pm.vertices.add(len(pts)); pm.vertices.foreach_set("co", [x for p in pts for x in p])
    attr = pm.attributes.new("rot", "FLOAT_VECTOR", "POINT")
    attr.data.foreach_set("vector", [x for e in rots for x in e])
    pob = bpy.data.objects.new(f"{h}_seeds", pm)
    scene.collection.objects.link(pob)
    pob.matrix_world = sob.matrix_world.copy()
    d["seed_points"] = pob

# geometry nodes: Instance on Points with Random Rotation and Random Scale
ng = bpy.data.node_groups.new("Seeds", "GeometryNodeTree")
ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
N = ng.nodes; L = ng.links
gin = N.new("NodeGroupInput"); gout = N.new("NodeGroupOutput")
info = N.new("GeometryNodeObjectInfo"); info.inputs["Object"].default_value = seed_template
info.transform_space = "ORIGINAL"
rot_attr = N.new("GeometryNodeInputNamedAttribute"); rot_attr.data_type = "FLOAT_VECTOR"
rot_attr.inputs["Name"].default_value = "rot"
rnd_rot = N.new("FunctionNodeRandomValue"); rnd_rot.data_type = "FLOAT_VECTOR"
rnd_rot.label = "Random Rotation"
rnd_rot.inputs["Min"].default_value = (-0.35, -0.35, -0.6)
rnd_rot.inputs["Max"].default_value = (0.35, 0.35, 0.6)
rnd_rot.inputs["Seed"].default_value = 3
add = N.new("ShaderNodeVectorMath"); add.operation = "ADD"
e2r = N.new("FunctionNodeEulerToRotation") if "FunctionNodeEulerToRotation" in dir(bpy.types) else None
rnd_sc = N.new("FunctionNodeRandomValue"); rnd_sc.data_type = "FLOAT"; rnd_sc.label = "Random Scale"
rnd_sc.inputs["Min"].default_value = 0.7; rnd_sc.inputs["Max"].default_value = 1.1
rnd_sc.inputs["Seed"].default_value = 11
inst = N.new("GeometryNodeInstanceOnPoints")
L.new(gin.outputs[0], inst.inputs["Points"])
L.new(info.outputs["Geometry"], inst.inputs["Instance"])
L.new(rot_attr.outputs["Attribute"], add.inputs[0])
L.new(rnd_rot.outputs[0], add.inputs[1])
if e2r:
    L.new(add.outputs[0], e2r.inputs[0]); L.new(e2r.outputs[0], inst.inputs["Rotation"])
else:
    L.new(add.outputs[0], inst.inputs["Rotation"])
L.new(rnd_sc.outputs[0], inst.inputs["Scale"])
L.new(inst.outputs["Instances"], gout.inputs[0])
for i, n in enumerate([gin, rot_attr, rnd_rot, add, info, rnd_sc, inst, gout]):
    n.location = (i * 200 - 700, 0)
for d in parts.values():
    if "seed_points" in d:
        mod = d["seed_points"].modifiers.new("Seeds", "NODES"); mod.node_group = ng

# ---- step 3: flesh material (subsurface, matte)
for name in ("flesh", "flesh_cut", "core", "core_cut", "skin"):
    m = bpy.data.materials.get(name)
    if not m: continue
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Subsurface Weight"].default_value = 0.25
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.2, 0.1)
    b.inputs["Subsurface Scale"].default_value = 0.004  # metres: a few mm of light bleed
    if name != "skin":
        b.inputs["Roughness"].default_value = 0.55
        b.inputs["Coat Weight"].default_value = 0.05

# ---- step 4: juicy gel (transparent, IOR of water)
for name in ("gel", "gel_cut"):
    m = bpy.data.materials.get(name)
    if not m: continue
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.03
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.333
    b.inputs["Alpha"].default_value = 1.0
    b.inputs["Coat Weight"].default_value = 0.0
    m.surface_render_method = "DITHERED"

# ---- step 1: Cycles
scene.render.engine = "CYCLES"
scene.cycles.samples = 160
scene.cycles.use_denoising = True
scene.cycles.transmission_bounces = 12
scene.cycles.max_bounces = 16
for area_screen in bpy.data.screens:
    for area in area_screen.areas:
        if area.type == "VIEW_3D":
            for sp in area.spaces:
                if sp.type == "VIEW_3D":
                    sp.shading.type = "RENDERED"

bpy.ops.wm.save_as_mainfile(filepath=dst, compress=True)
scene.render.resolution_x, scene.render.resolution_y = 1400, 1050
scene.render.filepath = render_path
scene.render.image_settings.file_format = "JPEG"
bpy.ops.render.render(write_still=True)
print("DONE", [o.name for o in scene.objects])
