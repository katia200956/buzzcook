"""Step 4a: UV triangles of the skin half, for the texture clean-up mask.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=WORK+"/stage2.blend")
me=bpy.data.objects['skin_half'].data
uv=me.uv_layers['UVMap'].data
tris=[];mat=[]
for p in me.polygons:
    pts=[uv[i].uv[:] for i in p.loop_indices]
    for k in range(1,len(pts)-1): tris.append([pts[0],pts[k],pts[k+1]]); mat.append(p.material_index)
np.savez(WORK+'/uvtris.npz',t=np.array(tris),m=np.array(mat))
