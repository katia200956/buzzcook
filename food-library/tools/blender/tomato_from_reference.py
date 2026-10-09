import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix, noise
sys.path.insert(0, "/home/claude/buzzcook/food-library/tools")
import lib
args = sys.argv[sys.argv.index("--") + 1:]
OUT_BLEND, OUT_JPG, SAMPLES = args[0], args[1], int(args[2])
R = "/mnt/project-files/products/references/oshinchan-tomato/"
rng = random.Random(5)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

import os
PAL = "/tmp/kat2/pal/"
def img(name, non_color=False):
    src = PAL + name if os.path.exists(PAL + name) else R + name
    im = bpy.data.images.load(src, check_existing=True)
    if non_color: im.colorspace_settings.name = "Non-Color"
    return im

def mat_tex(name, base, normal=None, rough=None, rough_scale=1.0, coat=0.0, sss=0.0, alpha=False,
            normal_strength=1.0, rough_bias=0.0, height=None, height_scale=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); b = N.new("ShaderNodeBsdfPrincipled")
    L.new(b.outputs[0], out.inputs["Surface"])
    t = N.new("ShaderNodeTexImage"); t.image = img(base)
    hsv = N.new("ShaderNodeHueSaturation")
    grade = {}  # colours baked into palette textures (recolor.py)
    hh, ss, vv = grade.get(name, (0.5, 1.0, 1.0))
    hsv.inputs["Hue"].default_value = hh
    hsv.inputs["Saturation"].default_value = ss
    hsv.inputs["Value"].default_value = vv
    L.new(t.outputs["Color"], hsv.inputs["Color"]); L.new(hsv.outputs[0], b.inputs["Base Color"])
    if alpha:
        L.new(t.outputs["Alpha"], b.inputs["Alpha"])
    if normal:
        tn = N.new("ShaderNodeTexImage"); tn.image = img(normal, True)
        nm = N.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = normal_strength
        L.new(tn.outputs["Color"], nm.inputs["Color"]); L.new(nm.outputs[0], b.inputs["Normal"])
    if rough:
        tr = N.new("ShaderNodeTexImage"); tr.image = img(rough, True)
        mp = N.new("ShaderNodeMapRange")
        mp.inputs["To Min"].default_value = rough_bias
        mp.inputs["To Max"].default_value = rough_scale
        L.new(tr.outputs["Color"], mp.inputs["Value"]); L.new(mp.outputs[0], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough_scale
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.05
    if name.startswith("skin"):
        b.inputs["Specular IOR Level"].default_value = 0.2
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Radius"].default_value = (1.0, 0.25, 0.12)
        b.inputs["Subsurface Scale"].default_value = 0.003
    return m

def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    obs = [o for o in bpy.data.objects if o not in before]
    return [o for o in obs if o.type == "MESH"], obs

# ---------- half
halves, allh = import_fbx(R + "tomato_cut.fbx")
half = halves[0]
for o in allh:
    if o.type != "MESH": bpy.data.objects.remove(o)
half.name = "tomato_half"
m_skin_h = mat_tex("skin", "tomato_bunkatu_hontai.png", "tomato_normal2_for_bake.png", None, rough_scale=0.24,
                   coat=0.04, sss=0.0, normal_strength=0.4)
m_cut = mat_tex("cut", "tomato_cut_danmen.png", "tomato_cut_normal3.jpg", "tomato_cut_roughness3.jpg",
                rough_scale=0.45, rough_bias=0.04, coat=0.3, sss=0.15, normal_strength=1.2)
half.data.materials[0] = m_skin_h; half.data.materials[1] = m_cut

# ---------- whole
wholes, allw = import_fbx(R + "tomato.fbx")
whole = wholes[0]
for o in allw:
    if o.type != "MESH": bpy.data.objects.remove(o)
whole.name = "tomato_whole"
m_skin_w = mat_tex("skin_whole", "tomato_for_bake.png", "tomato_normal2_for_bake.png", "tomato_roughness.png",
                   rough_scale=0.45, rough_bias=0.2, coat=0.04, sss=0.0, normal_strength=0.5)
m_heta_big = mat_tex("calyx_stem", "heta_big.png", None, None, rough_scale=0.65, alpha=True)
m_heta = mat_tex("calyx", "tomatoheta.png", None, None, rough_scale=0.65, alpha=True)
for m in (m_heta_big, m_heta):
    m.blend_method = "HASHED" if hasattr(m, "blend_method") else None
for i, m in enumerate((m_skin_w, m_heta_big, m_heta)): whole.data.materials[i] = m

# ---------- report orientation
def avg_normal(ob, mi):
    n = Vector()
    for p in ob.data.polygons:
        if p.material_index == mi: n += p.normal * p.area
    return n.normalized()
print("half rot", half.rotation_euler[:], "cut normal (local)", avg_normal(half, 1)[:], "dims", half.dimensions[:])
print("whole scale", whole.scale[:], whole.matrix_world.to_scale()[:])
print("whole rot", whole.rotation_euler[:], "dims", whole.dimensions[:])
bpy.context.view_layer.update()
for o in (half, whole):
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    print(o.name, "world bbox", [round(min(p[i] for p in ws), 4) for i in range(3)], [round(max(p[i] for p in ws), 4) for i in range(3)])
nw = (half.matrix_world.to_3x3() @ avg_normal(half, 1)).normalized()
print("cut normal world", nw[:])
# ---- smooth silhouette, keep the cut flat; give the cut face real relief (height from the cut photo)
def prep(ob, cut_mi=None, levels=2):
    me = ob.data
    for p in me.polygons: p.use_smooth = True
    bm = bmesh.new(); bm.from_mesh(me)
    if cut_mi is not None:
        cr = bm.edges.layers.float.get("crease_edge") or bm.edges.layers.float.new("crease_edge")
        bw = bm.edges.layers.float.get("bevel_weight_edge") or bm.edges.layers.float.new("bevel_weight_edge")
        for e in bm.edges:
            mats = {f.material_index for f in e.link_faces}
            if len(mats) > 1: e[cr] = 0.0; e[bw] = 1.0
    bm.to_mesh(me); bm.free()
    if cut_mi is not None:  # even, slightly flattened rounded rim
        bv = ob.modifiers.new("Rim", "BEVEL"); bv.limit_method = "WEIGHT"
        bv.width = 0.0022 / max(ob.matrix_world.to_scale()); bv.segments = 4; bv.profile = 0.62
        bv.harden_normals = False
    sub = ob.modifiers.new("Smooth", "SUBSURF"); sub.levels = levels; sub.render_levels = levels
    return sub
prep(half, cut_mi=1, levels=4)
vg = half.vertex_groups.new(name="cut_face")
vg.add([v for p in half.data.polygons if p.material_index == 1 for v in p.vertices], 1.0, "REPLACE")
edge_v = set(v for p in half.data.polygons if p.material_index == 0 for v in p.vertices)
vg.add(list(edge_v), 0.0, "REPLACE")  # rim stays on the skin
tex = bpy.data.textures.new("cut_height", "IMAGE"); tex.image = img("tomato_cut_height_derived.png", True)
dsp = half.modifiers.new("CutRelief", "DISPLACE")
dsp.texture = tex; dsp.texture_coords = "UV"; dsp.vertex_group = "cut_face"
dsp.direction = "NORMAL"; dsp.strength = 0.0016; dsp.mid_level = 0.55
prep(whole, levels=2)
# slightly uneven proportions, like a real fruit
half.scale = (1.03, 1.0, 0.98); whole.scale = (0.98, 1.02, 0.96)

# ---- hairs on the stem and sepals (particle hair, short and pale)
vg2 = whole.vertex_groups.new(name="stem")
vg2.add([v for p in whole.data.polygons if p.material_index in (1, 2) for v in p.vertices], 1.0, "REPLACE")
ps = whole.modifiers.new("Hairs", "PARTICLE_SYSTEM").particle_system
st = ps.settings
st.type = "HAIR"; st.count = 5000
st.hair_length = 0.0013 / max(whole.matrix_world.to_scale())
st.emit_from = "FACE"; st.use_advanced_hair = False
ps.vertex_group_density = "stem"
st.root_radius = 0.00002; st.tip_radius = 0.0; st.radius_scale = 1.0
st.length_random = 0.6
hm = bpy.data.materials.new("hair"); hm.use_nodes = True
hb = hm.node_tree.nodes.get("Principled BSDF")
hb.inputs["Base Color"].default_value = (0.78, 0.82, 0.62, 1); hb.inputs["Roughness"].default_value = 0.4
hb.inputs["Transmission Weight"].default_value = 0.4
whole.data.materials.append(hm); st.material = len(whole.data.materials)

# ---- a little juice: a few drops on the rim of the cut, one running down the skin
jm = bpy.data.materials.new("juice"); jm.use_nodes = True
jb = jm.node_tree.nodes.get("Principled BSDF")
jb.inputs["Base Color"].default_value = (0.85, 0.18, 0.06, 1); jb.inputs["Roughness"].default_value = 0.02
jb.inputs["Transmission Weight"].default_value = 0.9; jb.inputs["IOR"].default_value = 1.34
def drop(p, n, r, length=0.0, down=Vector((0, 0, -1))):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=1.0)
    t = (down - n * n.dot(down)).normalized() if length else Vector((0, 0, 1))
    side = n.cross(t).normalized() if length else n.orthogonal().normalized()
    for v in bm.verts:
        x, y, z = v.co
        # flattened against the surface (z = along normal), elongated along t when running
        stretch = 1 + length / r * max(0.0, x) if length else 1.0
        v.co = p + side * (y * r) + t * (x * r * stretch) + n * (max(z, -0.2) * r * 0.45)
    me = bpy.data.meshes.new("drop"); bm.to_mesh(me); bm.free()
    for f in me.polygons: f.use_smooth = True
    ob = bpy.data.objects.new("juice_drop", me); scene.collection.objects.link(ob)
    me.materials.append(jm)
    return ob
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
he = half.evaluated_get(dg); hme = he.to_mesh()
rim = []
for p in hme.polygons:
    if p.material_index == 0:
        c = half.matrix_world @ p.center
        if c.y < 0.004:  # skin right next to the cut
            rim.append((c, (half.matrix_world.to_3x3() @ p.normal).normalized()))
rng.shuffle(rim)
picked = []
for c, n in rim:
    if n.x < 0.25 or not (-0.012 < c.z < 0.022) or any((c - q).length < 0.012 for q, _ in picked): continue
    picked.append((c, n))
    if len(picked) == 2: break
for i, (c, n) in enumerate(picked):
    drop(c + n * 0.0002, n, 0.0014 + 0.0004 * i, length=0.006 if i == 0 else 0.0)
he.to_mesh_clear()
half.location.z += 0.0405
half.rotation_euler.z += 0.45
for o in scene.objects:
    if o.name.startswith('juice_drop'):
        o.matrix_world = Matrix.Translation((0, 0, 0.0405)) @ Matrix.Rotation(0.45, 4, 'Z') @ o.matrix_world
whole.location = (0.055, 0.075, 0.0411)
whole.rotation_euler.z += 0.6
lib.studio(scene, cam_loc=(-0.03, -0.30, 0.09), cam_target=(0.01, 0.02, 0.03), res=(1600, 1200), samples=SAMPLES, lens=85)
scene.cycles.use_denoising = True

# ---- cut face coloured from Katusha's reference: project it from the camera, relief from its detail
from bpy_extras.object_utils import world_to_camera_view
bpy.context.view_layer.update()
me = half.data
orig_uv = me.uv_layers.active.name
uvl = me.uv_layers.new(name="proj")
me.uv_layers[orig_uv].active = True; me.uv_layers[orig_uv].active_render = True
cam = scene.camera; mw = half.matrix_world
pts = {}
for poly in me.polygons:
    if poly.material_index != 1: continue
    for li in poly.loop_indices:
        vi = me.loops[li].vertex_index
        if vi not in pts: pts[vi] = world_to_camera_view(scene, cam, mw @ me.vertices[vi].co)
xs = [q.x for q in pts.values()]; ys = [q.y for q in pts.values()]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
INSET = 0.012
for poly in me.polygons:
    for li in poly.loop_indices:
        q = pts.get(me.loops[li].vertex_index)
        if q is None: continue
        uvl.data[li].uv = (INSET + (1 - 2 * INSET) * (q.x - x0) / (x1 - x0), INSET + (1 - 2 * INSET) * (q.y - y0) / (y1 - y0))
nt = m_cut.node_tree; N = nt.nodes; Lk = nt.links
bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
for n in list(N):
    if n.type in ("TEX_IMAGE", "NORMAL_MAP", "HUE_SAT", "MAP_RANGE"): N.remove(n)
uvn = N.new("ShaderNodeUVMap"); uvn.uv_map = "proj"
tc = N.new("ShaderNodeTexImage"); tc.image = bpy.data.images.load("/tmp/kat2/pal/cut_ref.png"); tc.extension = "EXTEND"
th = N.new("ShaderNodeTexImage"); th.image = bpy.data.images.load("/tmp/kat2/pal/cut_ref_height.png"); th.extension = "EXTEND"
th.image.colorspace_settings.name = "Non-Color"
Lk.new(uvn.outputs[0], tc.inputs[0]); Lk.new(uvn.outputs[0], th.inputs[0])
Lk.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.6; bump.inputs["Distance"].default_value = 0.0004
Lk.new(th.outputs["Color"], bump.inputs["Height"]); Lk.new(bump.outputs[0], bsdf.inputs["Normal"])
# wet: glossy where the detail is raised (gel, seeds), a bit less on the flesh
mr = N.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value = 0.32; mr.inputs["To Max"].default_value = 0.06
Lk.new(th.outputs["Color"], mr.inputs["Value"]); Lk.new(mr.outputs[0], bsdf.inputs["Roughness"])
Lk.new(tc.outputs["Color"], bsdf.inputs["Emission Color"]); bsdf.inputs["Emission Strength"].default_value = 0.17
bsdf.inputs["Coat Weight"].default_value = 0.2; bsdf.inputs["Subsurface Weight"].default_value = 0.08
tex.image = th.image; dsp.uv_layer = "proj"; dsp.strength = 0.0019; dsp.mid_level = 0.5
# deep gel pockets around the seeds: darker, glassy and see-through
tcv = N.new("ShaderNodeTexImage"); tcv.image = bpy.data.images.load("/tmp/kat2/pal/cut_ref_cavity.png"); tcv.extension = "EXTEND"
tcv.image.colorspace_settings.name = "Non-Color"; Lk.new(uvn.outputs[0], tcv.inputs[0])
cvr = N.new("ShaderNodeMapRange"); cvr.inputs["From Max"].default_value = 0.45
Lk.new(tcv.outputs["Color"], cvr.inputs["Value"])
tw = N.new("ShaderNodeMath"); tw.operation = "MULTIPLY"; tw.inputs[1].default_value = 0.65
Lk.new(cvr.outputs[0], tw.inputs[0]); Lk.new(tw.outputs[0], bsdf.inputs["Transmission Weight"])
inv = N.new("ShaderNodeMath"); inv.operation = "MULTIPLY_ADD"; inv.inputs[1].default_value = -0.85; inv.inputs[2].default_value = 1.0
Lk.new(cvr.outputs[0], inv.inputs[0])
rr = N.new("ShaderNodeMath"); rr.operation = "MULTIPLY"
Lk.new(mr.outputs[0], rr.inputs[0]); Lk.new(inv.outputs[0], rr.inputs[1]); Lk.new(rr.outputs[0], bsdf.inputs["Roughness"])
bsdf.inputs["IOR"].default_value = 1.34

# ---- not perfectly smooth: soft dents on both fruits and an uneven cut surface
def dents(ob, size, depth, seed):
    s = max(ob.matrix_world.to_scale())
    tx = bpy.data.textures.new("dents_" + ob.name, "CLOUDS"); tx.noise_scale = size / s; tx.noise_depth = 1
    tx.noise_basis = "ORIGINAL_PERLIN"
    md = ob.modifiers.new("Dents", "DISPLACE"); md.texture = tx; md.texture_coords = "LOCAL"
    md.strength = depth / s; md.mid_level = 0.5
    sub_i = next(i for i, m in enumerate(ob.modifiers) if m.type == "SUBSURF")
    ob.modifiers.move(len(ob.modifiers) - 1, sub_i + 1)
    return md
dents(half, 0.014, 0.0022, 1); dents(whole, 0.016, 0.0022, 2)
md2 = dents(half, 0.006, 0.0009, 3); md2.vertex_group = "cut_face"   # ripples on the cut itself
# brighter, neutral backdrop like the reference
for nd in scene.world.node_tree.nodes:
    if nd.type == "BACKGROUND" and nd.inputs["Strength"].default_value == 1.0:
        nd.inputs["Color"].default_value = (0.95, 0.95, 0.95, 1)
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = -0.35
scene.cycles.transmission_bounces = 8
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
lib.render(scene, OUT_JPG)
if len(args) > 3:  # turntable video frames
    piv = bpy.data.objects.new("turntable", None); scene.collection.objects.link(piv)
    piv.location = (0.025, 0.035, 0.0)
    bpy.context.view_layer.update()
    for o in list(scene.objects):
        if o.type == "MESH" and (o.name.startswith(("tomato", "juice"))):
            mw = o.matrix_world.copy(); o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted(); o.matrix_world = mw
    scene.frame_start, scene.frame_end = 1, 96
    piv.rotation_euler = (0, 0, 0); piv.keyframe_insert("rotation_euler", frame=1)
    piv.rotation_euler = (0, 0, 2 * math.pi); piv.keyframe_insert("rotation_euler", frame=97)
    for fc in piv.animation_data.action.fcurves if hasattr(piv.animation_data.action, "fcurves") else []:
        for k in fc.keyframe_points: k.interpolation = "LINEAR"
    scene.render.resolution_x, scene.render.resolution_y = 960, 720
    scene.cycles.samples = 20
    scene.render.image_settings.file_format = "JPEG"
    scene.render.filepath = args[3]
    bpy.ops.render.render(animation=True)
