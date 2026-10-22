"""Prints the pit dome footprint and height from the aligned scan (used for PIT_C / PIT_R).
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, numpy as np
bpy.ops.wm.open_mainfile(filepath=WORK+"/stage2.blend")
me=bpy.data.objects['scan'].data
co=np.array([v.co[:] for v in me.vertices])
sk=np.array([v.co[:] for v in bpy.data.objects['skin_half'].data.vertices])
print('skin x',sk[:,0].min(),sk[:,0].max(),'y',sk[:,1].min(),sk[:,1].max(),'z',sk[:,2].min())
for zt in (0.0005,0.001,0.002,0.004,0.008,0.012):
    d=co[co[:,2]>zt]; print(zt,len(d),'x',d[:,0].min().round(4),d[:,0].max().round(4),'y',d[:,1].min().round(4),d[:,1].max().round(4))
d=co[co[:,2]>0.002]
print('top',co[:,2].max(), 'top at', co[co[:,2].argmax()])
# widths along x of skin
for x in np.linspace(sk[:,0].min(),sk[:,0].max(),11):
    s=sk[np.abs(sk[:,0]-x)<0.002]
    if len(s): print('x',round(x,4),'w',round(s[:,1].max()-s[:,1].min(),4),'depth',round(s[:,2].min(),4), 'yc',round((s[:,1].max()+s[:,1].min())/2,4))
