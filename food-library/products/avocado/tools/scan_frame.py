"""Step 1 of the avocado prep: open the AVO-1 scan (USD from the unzipped AVO-1.usdz), fit the cut plane
and the long axis, save the frame to WORK/frame.npz. First: unzip AVO-1.usdz into USDZ and run
scan_info.py to turn baked_mesh.usda into WORK/scan.blend.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import bpy, bmesh, numpy as np, math
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath=WORK+"/scan.blend")
o=bpy.data.objects['g0']
me=o.data; me.transform(o.matrix_world)
V=np.array([o.matrix_world@Vector((0,0,0)) for _ in range(0)])
co=np.zeros(len(me.vertices)*3); me.vertices.foreach_get('co',co); co=co.reshape(-1,3)
# note: mesh transformed in place above
P=me.polygons; n=len(P)
cen=np.zeros(n*3); P.foreach_get('center',cen); cen=cen.reshape(-1,3)
nor=np.zeros(n*3); P.foreach_get('normal',nor); nor=nor.reshape(-1,3)
area=np.zeros(n); P.foreach_get('area',area)
# candidate cut faces: normal near +Z
cand=nor[:,2]>0.97
print('cand',cand.sum())
# RANSAC-ish: fit plane to cand centroids, iterate keep inliers
pts=cen[cand]; w=area[cand]
for it in range(5):
    c=np.average(pts,axis=0,weights=w); u,s,vt=np.linalg.svd((pts-c)*np.sqrt(w)[:,None]); nn=vt[2]
    if nn[2]<0: nn=-nn
    d=(pts-c)@nn
    keep=np.abs(d)<np.percentile(np.abs(d),70)
    pts=pts[keep]; w=w[keep]
print('plane c',c,'n',nn)
dist=(cen-c)@nn
cut=(np.abs(dist)<0.006)&((nor@nn)>0.9)
above=dist>0.006
print('cut faces',cut.sum(),'above',above.sum())
np.savez(WORK+'/plane.npz',c=c,n=nn)
# basis: z=nn, x = principal axis of skin verts projected
dv=(co-c)@nn
skinv=co[dv<-0.01]
proj=skinv-np.outer((skinv-c)@nn,nn)
pc=proj-proj.mean(0); u,s,vt=np.linalg.svd(pc,full_matrices=False)
ex=vt[0]; ex=ex-nn*(ex@nn); ex/=np.linalg.norm(ex); ey=np.cross(nn,ex)
R=np.stack([ex,ey,nn])
loc=(co-c)@R.T
print('extent x',loc[:,0].min(),loc[:,0].max(),'y',loc[:,1].min(),loc[:,1].max(),'z',loc[:,2].min(),loc[:,2].max())
np.savez(WORK+'/frame.npz',c=c,R=R)
# boundary loops
bm=bmesh.new(); bm.from_mesh(me)
be=[e for e in bm.edges if e.is_boundary]
print('boundary edges',len(be))
pts=np.array([((e.verts[0].co+e.verts[1].co)/2)[:] for e in be])
if len(pts): 
    l=(pts-c)@R.T; print('boundary centre',l.mean(0),'span',l.min(0),l.max(0))
# pit dome
ab=loc[(dv>0.004)]
print('dome verts',len(ab),'x',ab[:,0].min(),ab[:,0].max(),'y',ab[:,1].min(),ab[:,1].max(),'zmax',ab[:,2].max())
