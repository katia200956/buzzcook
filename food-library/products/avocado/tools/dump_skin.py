"""Step 5: skin half as arrays (WORK/skin_half.npz) for avocado.py.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, numpy as np, sys
bpy.ops.wm.open_mainfile(filepath=WORK+"/stage2.blend")
me=bpy.data.objects['skin_half'].data
V=np.array([v.co[:] for v in me.vertices])
F=[];UV=[];MI=[]
uv=me.uv_layers['UVMap'].data
for p in me.polygons:
    vs=list(p.vertices); us=[uv[i].uv[:] for i in p.loop_indices]
    for k in range(1,len(vs)-1):
        F.append([vs[0],vs[k],vs[k+1]]); UV.append([us[0],us[k],us[k+1]])
np.savez(WORK+'/skin_half.npz',V=V,F=np.array(F),UV=np.array(UV))
print(len(V),len(F))
