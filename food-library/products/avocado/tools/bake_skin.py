"""Step 3: bake the scan colour and normal maps onto the skin half UV map (2048 px).
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy
bpy.ops.wm.open_mainfile(filepath=WORK+"/stage2.blend")
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=4
scan=bpy.data.objects['scan']; sk=bpy.data.objects['skin_half']
# scan material from usd import: check
print([m.name for m in scan.data.materials])
m=scan.data.materials[0]; 
for n in m.node_tree.nodes: print(n.type, getattr(n,'image',None) and n.image.filepath)
res=2048
for kind in ['DIFFUSE','NORMAL']:
    img=bpy.data.images.new('bake_'+kind,res,res,float_buffer=False)
    if kind=='NORMAL': img.colorspace_settings.name='Non-Color'
    for mat in sk.data.materials:
        mat.use_nodes=True; nt=mat.node_tree
        for n in list(nt.nodes):
            if n.type=='TEX_IMAGE': nt.nodes.remove(n)
        t=nt.nodes.new('ShaderNodeTexImage'); t.image=img; nt.nodes.active=t
    for ob in bpy.context.view_layer.objects: ob.select_set(False)
    scan.select_set(True); sk.select_set(True); bpy.context.view_layer.objects.active=sk
    kw=dict(type=kind,use_selected_to_active=True,cage_extrusion=0.003,max_ray_distance=0.006,margin=8)
    if kind=='DIFFUSE': kw['pass_filter']={'COLOR'}
    bpy.ops.object.bake(**kw)
    img.filepath_raw=fWORK+'/skin_{kind.lower()}_raw.png'; img.file_format='PNG'; img.save()
    print('baked',kind)
bpy.ops.wm.save_as_mainfile(filepath=WORK+"/stage2.blend")
