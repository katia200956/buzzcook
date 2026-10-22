"""Step 0: import baked_mesh.usda into WORK/scan.blend and print basic mesh facts.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, bmesh, mathutils, math, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=USDZ+"/baked_mesh.usda")
for o in bpy.data.objects:
    print(o.name, o.type, tuple(round(v,4) for v in o.dimensions), o.matrix_world.to_euler())
    if o.type=='MESH':
        me=o.data; print(' verts',len(me.vertices),'faces',len(me.polygons), 'uv', [u.name for u in me.uv_layers])
        bm=bmesh.new(); bm.from_mesh(me)
        parts=0; seen=set()
        for v in bm.verts:
            if v.index in seen: continue
            parts+=1; stack=[v]; seen.add(v.index)
            while stack:
                x=stack.pop()
                for e in x.link_edges:
                    y=e.other_vert(x)
                    if y.index not in seen: seen.add(y.index); stack.append(y)
        nm=sum(1 for e in bm.edges if not e.is_manifold)
        print(' islands',parts,'nonmanifold edges',nm)
bpy.ops.wm.save_as_mainfile(filepath=WORK+"/scan.blend")
