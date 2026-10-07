# Cut a whole-product GLB into forms (whole, half, slices) with Blender, capping each cut with a
# "flesh" material that maps a top-down photo of the cut face onto it (ProductView renders that
# material wet). Runs headless with the bpy wheel: pip install bpy==4.2.0 (Python 3.11).
#   python3 cut.py in.glb section.jpg outdir
# Writes whole.glb, half.glb (half_top, half_bottom) and slices.glb (slice_0 = bottom ... slice_4).
import os, sys, bpy, bmesh
from mathutils import Vector, Matrix

src, section, out = sys.argv[-3:]
# How far apart the pieces float (the model is scaled to longest side 1). The tomato used HALF_GAP=0.3 SLICE_GAP=0.2.
HALF_GAP = float(os.environ.get('HALF_GAP', '0.3'))
SLICE_GAP = float(os.environ.get('SLICE_GAP', '0.2'))

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    mw = ob.matrix_world.copy(); ob.parent = None; ob.matrix_world = mw
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o is not ob: bpy.data.objects.remove(o)
    # Longest side 1, centred, standing on z = 0.
    bb = [Vector(c) for c in ob.bound_box]
    lo = Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    hi = Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    s = 1 / max(hi - lo)
    ob.data.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    # Generated meshes are split at every UV seam; weld them so a cut gives closed loops to fill.
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.to_mesh(ob.data); bm.free()
    ob.data.materials[0].name = 'skin'
    return ob, (hi.z - lo.z) * s

def flesh_material():
    m = bpy.data.materials.new('flesh'); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(section)
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.22
    return m

def piece(ob, z0, z1, flesh, name):
    """Copy of ob between heights z0 and z1 (None = uncut end), each cut capped with flesh."""
    c = ob.copy(); c.data = ob.data.copy(); c.name = name
    bpy.context.scene.collection.objects.link(c)
    c.data.materials.append(flesh); fi = len(c.data.materials) - 1
    bm = bmesh.new(); bm.from_mesh(c.data)
    uv = bm.loops.layers.uv.active
    for z, keep_above in ((z0, True), (z1, False)):
        if z is None: continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        r = bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                                   clear_inner=keep_above, clear_outer=not keep_above, dist=1e-5)
        edges = [e for e in r['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_valid and e.is_boundary]
        f = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges)
        caps = [g for g in f['geom'] if isinstance(g, bmesh.types.BMFace)]
        if not caps:
            before = set(bm.faces); bmesh.ops.holes_fill(bm, edges=edges, sides=0)
            new = [fc for fc in bm.faces if fc not in before]
            if new: bmesh.ops.triangulate(bm, faces=new); caps = [fc for fc in bm.faces if fc not in before]
        if not caps: print('WARN no cap', name, z, len(edges)); continue
        # Project the section photo straight down onto the cap, its circle fitted to the cut.
        xs = [v.co.x for fc in caps for v in fc.verts]; ys = [v.co.y for fc in caps for v in fc.verts]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        d = max(max(xs) - min(xs), max(ys) - min(ys)) * 1.02
        want = -1 if keep_above else 1
        for fc in caps:
            fc.material_index = fi; fc.smooth = False
            fc.normal_update()
            if fc.normal.z * want < 0: fc.normal_flip()
            for l in fc.loops:
                l[uv].uv = ((l.vert.co.x - cx) / d + 0.5, (l.vert.co.y - cy) / d + 0.5)
    bm.to_mesh(c.data); bm.free()
    return c

def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True,
                              export_image_format='JPEG', export_yup=True, export_apply=True)

ob, H = load(); flesh = flesh_material()
export([ob], out + '/whole.glb')

# Half: cut across the middle, top half lifted so both cut faces show.
top = piece(ob, H * 0.5, None, flesh, 'half_top'); bot = piece(ob, None, H * 0.5, flesh, 'half_bottom')
top.location.z = HALF_GAP
export([top, bot], out + '/half.glb')
for o in (top, bot): bpy.data.objects.remove(o)

# Slices: four cuts, the five pieces stacked apart like a floating sliced tomato.
bounds = [None] + [H * f for f in (0.2, 0.37, 0.54, 0.7)] + [None]
parts = []
for i in range(len(bounds) - 1):
    p = piece(ob, bounds[i], bounds[i + 1], flesh, f'slice_{i}')
    p.location.z = i * SLICE_GAP
    parts.append(p)
export(parts, out + '/slices.glb')
