"""Preview: the scan next to our half with pit, same light and camera.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, sys, math
sys.path.insert(0,'/home/claude/buzzcook/food-library/tools')
from mathutils import Vector
import lib
GLB=sys.argv[sys.argv.index('--')+1]; OUT=sys.argv[sys.argv.index('--')+2]
bpy.ops.wm.open_mainfile(filepath=WORK+"/stage2.blend")
for o in list(bpy.data.objects):
    if o.name!='scan': bpy.data.objects.remove(o)
scan=bpy.data.objects['scan']
sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)
ours=[o for o in bpy.data.objects if o.type=='MESH' and o.name!='scan' and not o.name.startswith('half_01')]
for o in bpy.data.objects:
    if o.name.startswith('half_01'): bpy.data.objects.remove(o)
def rest(obs,dx):
    bpy.context.view_layer.update()
    pts=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
    c=Vector(((min(p.x for p in pts)+max(p.x for p in pts))/2,(min(p.y for p in pts)+max(p.y for p in pts))/2,min(p.z for p in pts)))
    for o in obs:
        if o.parent and o.parent.type!='EMPTY': continue
        tgt=o.parent if o.parent else o
    roots={o.parent or o for o in obs}
    for r in roots: r.location+= Vector((dx,0,0))-c
rest([scan],0.0); rest(ours,0.0)
bpy.context.view_layer.update()
for r in {o.parent or o for o in ours}: r.location.y-=0.085
lib.studio(sc,bg="#F3F1EE",cam_loc=(0.0,-0.24,0.30),cam_target=(0,-0.045,0.0),res=(1000,1200),samples=32,lens=60)
lib.render(sc,OUT)
