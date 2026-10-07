# Shared Blender helpers for building library products as real anatomy and cutting them into
# states (see ../STANDARD.md). A product script builds its parts as closed meshes in metres, Z up,
# base on z = 0, then calls cut() for each piece: solid parts are intersected with the slab between
# two knife planes (each part can sit a little below the cut, like gel or juice), loose bits such as
# seeds stay whole in the piece their middle is in and are sliced where they cross the knife.
import math, random
import bpy, bmesh
from mathutils import Vector, Matrix

MAT = {}

def srgb(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

def material(name, hex_, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*srgb(hex_), 1)
    b.inputs['Roughness'].default_value = rough
    MAT[name] = m
    return m

def obj_from_bm(bm, name, mat):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(MAT[mat])
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def bake(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    new = bpy.data.objects.new(ob.name, me); bpy.context.scene.collection.objects.link(new)
    bpy.data.objects.remove(ob)
    return new

def boolean(a, b, op, tolerant=False):
    c = a.copy(); c.data = a.data.copy(); bpy.context.scene.collection.objects.link(c)
    mod = c.modifiers.new('b', 'BOOLEAN'); mod.operation = op; mod.solver = 'EXACT'
    mod.object = b; mod.material_mode = 'TRANSFER'
    # Lofted chambers can touch themselves at their pinched ends; this keeps their cuts reliable
    # (slower, so only for parts that need it).
    mod.use_self = tolerant; mod.use_hole_tolerant = tolerant
    return bake(c)

def revolve(name, mat, radius, z0, z1, rings=72, segs=96, smooth=True):
    """Closed surface of revolution around Z: radius(z, angle) -> r, from z0 to z1 (both poles closed)."""
    bm = bmesh.new(); rows = []
    for i in range(1, rings):
        u = i / rings
        z = z0 + (z1 - z0) * (1 - math.cos(math.pi * u)) / 2
        rows.append([bm.verts.new((radius(z, a) * math.cos(a), radius(z, a) * math.sin(a), z))
                     for a in (2 * math.pi * j / segs for j in range(segs))])
    for i in range(len(rows) - 1):
        for j in range(segs):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % segs], rows[i + 1][(j + 1) % segs], rows[i + 1][j]))
    bot, top = bm.verts.new((0, 0, z0)), bm.verts.new((0, 0, z1))
    for j in range(segs):
        bm.faces.new((rows[0][(j + 1) % segs], rows[0][j], bot))
        bm.faces.new((rows[-1][j], rows[-1][(j + 1) % segs], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = smooth
    return obj_from_bm(bm, name, mat)

def shell(outer_ob, inner_ob, name):
    """A hollow solid between two closed surfaces, without a boolean: the inner one turned inside out."""
    me = inner_ob.data
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    return join([outer_ob, inner_ob], name)

def loft(name, mat, rings_pts, cap=True):
    """Closed mesh through a list of rings (each a list of 3D points, same count), ends fanned shut."""
    bm = bmesh.new(); M = len(rings_pts[0])
    rows = [[bm.verts.new(p) for p in ring] for ring in rings_pts]
    for i in range(len(rows) - 1):
        for j in range(M):
            bm.faces.new((rows[i][j], rows[i][(j + 1) % M], rows[i + 1][(j + 1) % M], rows[i + 1][j]))
    if cap:
        for ring in (rows[0], rows[-1]):
            c = bm.verts.new(sum((v.co for v in ring), Vector()) / M)
            for j in range(M): bm.faces.new((ring[j], ring[(j + 1) % M], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = True
    return obj_from_bm(bm, name, mat)

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
    total = sum(seg); out, acc, i = [], 0.0, 0
    for k in range(m):
        s = total * k / m
        while acc + seg[i] < s: acc += seg[i]; i += 1
        f = (s - acc) / seg[i] if seg[i] else 0
        out.append(pts[i].lerp(pts[(i + 1) % len(pts)], f))
    return out

def wedge_outline(theta, half, rc, ro, d, m=48, smooth=3):
    """2D outline of a wedge-shaped chamber between two radial walls of half-thickness d,
    from the core radius rc to the outer radius ro, centred on angle theta."""
    ta, tb = theta - half, theta + half
    ua, ub = Vector((math.cos(ta), math.sin(ta))), Vector((math.cos(tb), math.sin(tb)))
    na, nb = Vector((-ua.y, ua.x)), Vector((ub.y, -ub.x))
    ro = max(ro, rc + 1e-4); pts = []
    for i in range(8):
        r = rc + (ro - rc) * i / 7; pts.append(math.sqrt(max(r * r - d * d, 0)) * ua + d * na)
    a0, a1 = ta + math.asin(min(1, d / ro)), tb - math.asin(min(1, d / ro))
    for i in range(1, 12):
        a = a0 + (a1 - a0) * i / 12; pts.append(Vector((math.cos(a), math.sin(a))) * ro)
    for i in range(8):
        r = ro - (ro - rc) * i / 7; pts.append(math.sqrt(max(r * r - d * d, 0)) * ub + d * nb)
    b0, b1 = tb - math.asin(min(1, d / rc)), ta + math.asin(min(1, d / rc))
    for i in range(1, 4):
        a = b0 + (b1 - b0) * i / 4; pts.append(Vector((math.cos(a), math.sin(a))) * rc)
    return resample(chaikin(pts, smooth), m)

def inside(pts, p):
    n, ins = len(pts), False
    for i in range(n):
        a, b = pts[i], pts[(i + 1) % n]
        if (a.y > p.y) != (b.y > p.y) and p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x:
            ins = not ins
    return ins

def box(za, zb, mat, lo=-1.0, hi=1.0):
    a = lo if za is None else za; b = hi if zb is None else zb
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, (a + b) / 2)) @ Matrix.Diagonal((0.6, 0.6, b - a, 1)), verts=bm.verts)
    return obj_from_bm(bm, 'box', mat)

def islands(bm):
    seen, res = set(), []
    for v in bm.verts:
        if v in seen: continue
        stack, comp = [v], []; seen.add(v)
        while stack:
            x = stack.pop(); comp.append(x)
            for e in x.link_edges:
                o = e.other_vert(x)
                if o not in seen: seen.add(o); stack.append(o)
        res.append(comp)
    return res

def join(objs, name):
    bm = bmesh.new(); mats = []
    for o in objs:
        me = o.data.copy(); remap = []
        for m in me.materials:
            if m.name not in [x.name for x in mats]: mats.append(m)
            remap.append([x.name for x in mats].index(m.name))
        for p in me.polygons: p.material_index = remap[p.material_index] if remap else 0
        bm.from_mesh(me); bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    return ob

def flat_caps(ob):
    for p in ob.data.polygons:
        if abs(p.normal.z) > 0.9995: p.use_smooth = False

def cut(parts, za, zb, name, extras=()):
    """One piece between knife heights za and zb (None = uncut end). parts: dicts with obj, cap
    (material of the cut face), recess (how far that part sits below the cut), loose (bits kept
    whole in the piece their middle is in) and tolerant (for lofted chambers, see boolean)."""
    out = []
    for p in parts:
        r = p.get('recess', 0.0)
        a = None if za is None else za + r; b = None if zb is None else zb - r
        if p.get('loose'):
            bm = bmesh.new(); bm.from_mesh(p['obj'].data)
            lo = -9 if za is None else za + r; hi = 9 if zb is None else zb - r
            for comp in islands(bm):
                cz = sum(v.co.z for v in comp) / len(comp)
                if not (lo < cz < hi): bmesh.ops.delete(bm, geom=comp, context='VERTS')
            tmp = obj_from_bm(bm, name + '_bits', p['cap'])
            if not tmp.data.vertices: continue
            out.append(boolean(tmp, box(za, zb, p['cap']), 'INTERSECT'))
        else:
            res = boolean(p['obj'], box(a, b, p['cap']), 'INTERSECT', p.get('tolerant', False))
            if res.data.vertices: out.append(res)
    out += list(extras)
    for o in out: flat_caps(o)
    piece = join(out, name)
    # Pivot at the piece's own centre, so it spins and falls naturally in an animation.
    c = sum((v.co for v in piece.data.vertices), Vector()) / max(1, len(piece.data.vertices))
    piece.data.transform(Matrix.Translation(-c)); piece.location = c
    return piece

def export(objs, path):
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='EXPORT')
