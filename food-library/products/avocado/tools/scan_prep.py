"""Step 2: scan aligned to the frame and scaled to 105 mm length; skin half cut 6 mm under the cut
plane, top band rebuilt from a smoothed outline (the scan rim is chipped), bottom hole (where the
fruit rested) filled, decimated to 13k triangles, one-island UV map. Saves WORK/stage2.blend.
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
# Stage 2: aligned + scaled scan, clean skin half (hole filled), UV unwrap, bake colour/normal.
import bpy, bmesh, numpy as np, math
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree
LEN=0.105
ZCUT=0.006
bpy.ops.wm.open_mainfile(filepath=WORK+"/scan.blend")
o=bpy.data.objects['g0']
o.data.transform(o.matrix_world); o.parent=None; o.matrix_world=Matrix()
f=np.load(WORK+'/frame.npz'); c=Vector(f['c']); R=Matrix(f['R'].tolist())
M=R.to_4x4()@Matrix.Translation(-c)
o.data.transform(M)
co=np.array([v.co[:] for v in o.data.vertices])
s=LEN/(co[:,0].max()-co[:,0].min())
xm=(co[:,0].max()+co[:,0].min())/2; ym=(co[:,1].max()+co[:,1].min())/2
o.data.transform(Matrix.Diagonal((s,s,s,1))@Matrix.Translation((-xm,-ym,0)))
o.data.update()
print('scale',s)
for ob in list(bpy.data.objects):
    if ob is not o: bpy.data.objects.remove(ob)
o.name='scan'
# ---- skin half
bm=bmesh.new(); bm.from_mesh(o.data)
geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
bmesh.ops.bisect_plane(bm,geom=geom,dist=1e-7,plane_co=(0,0,-ZCUT),plane_no=(0,0,1),clear_outer=True)
# keep largest component
bm.verts.ensure_lookup_table()
seen=set(); comps=[]
for v in bm.verts:
    if v in seen: continue
    st=[v]; seen.add(v); comp=[]
    while st:
        x=st.pop(); comp.append(x)
        for e in x.link_edges:
            y=e.other_vert(x)
            if y not in seen: seen.add(y); st.append(y)
    comps.append(comp)
comps.sort(key=len)
for comp in comps[:-1]:
    bmesh.ops.delete(bm,geom=comp,context='VERTS')
print('components dropped',len(comps)-1)
# boundary loops
def loops(bm):
    be=set(e for e in bm.edges if e.is_boundary); out=[]
    while be:
        e=be.pop(); loop=[e]; v=e.verts[1]; start=e.verts[0]
        while v!=start:
            nxt=[x for x in v.link_edges if x in be]
            if not nxt: break
            e=nxt[0]; be.discard(e); loop.append(e); v=e.other_vert(v)
        out.append(loop)
    return out
L=loops(bm)
L.sort(key=lambda l: -np.mean([ (e.verts[0].co.z) for e in l]))
for l in L: print('loop',len(l), np.mean([e.verts[0].co.z for e in l]))
rim=L[0]
# rebuild the top band (z = -ZCUT .. 0) from a smoothed outline: the scan's rim is chipped
# in places and its last millimetres carry flesh colour
loopv=[]
e=rim[0]; v=e.verts[0]; start=v; prev=None
while True:
    loopv.append(v)
    nxt=[x for x in v.link_edges if x.is_boundary and x.other_vert(v)!=prev]
    if not nxt: break
    w=nxt[0].other_vert(v); prev=v; v=w
    if v==start: break
P=np.array([v.co[:] for v in loopv])
cx=(P[:,0].max()+P[:,0].min())/2; ax=(P[:,0].max()-P[:,0].min())/2; by=(P[:,1].max()-P[:,1].min())/2
th=np.arctan2(P[:,1]/by,(P[:,0]-cx)/ax); rr=np.hypot(P[:,1]/by,(P[:,0]-cx)/ax)
# slope dr/dz from the surface just below the loop
below=[x for x in bm.verts if -ZCUT-0.004<x.co.z<-ZCUT-0.002]
Q=np.array([x.co[:] for x in below]); qth=np.arctan2(Q[:,1]/by,(Q[:,0]-cx)/ax); qr=np.hypot(Q[:,1]/by,(Q[:,0]-cx)/ax)
order=np.argsort(th)
def circ_smooth(vals,thv,win):
    out=np.empty_like(vals)
    for i,t in enumerate(thv):
        d=np.abs((thv-t+np.pi)%(2*np.pi)-np.pi); w=np.exp(-(d/win)**2); out[i]=(vals*w).sum()/w.sum()
    return out
rs=circ_smooth(rr,th,0.12)
env=np.maximum(rr,rs)            # fill dents, keep bulges
env=circ_smooth(env,th,0.05)
slope=[]
for i,t in enumerate(th):
    d=np.abs((qth-t+np.pi)%(2*np.pi)-np.pi); m=d<0.05
    slope.append((rr[i]-qr[m].mean())/0.003 if m.any() else 0.0)
slope=circ_smooth(np.clip(np.array(slope),0,30),th,0.1)
rings=[loopv]
NR=4
for k in range(1,NR+1):
    z=-ZCUT+ZCUT*k/NR
    t=k/NR
    ring=[]
    for i,v in enumerate(loopv):
        base=rr[i]+(env[i]-rr[i])*min(1.0,t*1.6)
        # quadratic continuation with zero slope at the equator
        dz=z+ZCUT; r=base+slope[i]*(dz-dz*dz/(2*ZCUT))
        ring.append(bm.verts.new((cx+np.cos(th[i])*r*ax, np.sin(th[i])*r*by, z)))
    rings.append(ring)
n=len(loopv)
# orientation: faces must point outward; build then fix normals
newf=[]
for k in range(NR):
    a_,b_=rings[k],rings[k+1]
    for i in range(n):
        j=(i+1)%n
        try: newf.append(bm.faces.new((a_[i],a_[j],b_[j],b_[i])))
        except ValueError: pass
bm.normal_update()
# match winding with the neighbouring old faces
old_f=next(f for f in loopv[0].link_faces if f not in newf)
nf0=next(f for f in rings[1][0].link_faces)
if old_f.normal.dot(nf0.normal)<0: bmesh.ops.reverse_faces(bm,faces=newf)
bmesh.ops.triangulate(bm,faces=newf)
print('band rebuilt, loop',n,'max dent filled mm',round(float((env-rr).max())*ax*1000,2))
# other loops = holes on the bottom: fit quadric and fill
holes=L[1:]
for hl in holes:
    hv=set(v for e in hl for v in e.verts)
    hc=sum((v.co for v in hv),Vector())/len(hv)
    rad=max((v.co-hc).length for v in hv)
    zb=float(np.mean([v.co.z for v in hv]))
    orig=set(bm.verts); origE=set(bm.edges)
    r=bmesh.ops.holes_fill(bm,edges=list(hl),sides=0)
    nf=bmesh.ops.triangulate(bm,faces=r['faces'])['faces']
    for it in range(8):
        edges=set(e for f in nf for e in f.edges if e.calc_length()>0.0024 and e not in origE)
        if not edges: break
        bmesh.ops.subdivide_edges(bm,edges=list(edges),cuts=1,use_grid_fill=False)
        bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>3])
        nf=[f for f in bm.faces if any(e not in origE for e in f.edges)]
    patchv=set(v for f in nf for v in f.verts)-orig
    for v in patchv: v.co.z=zb
    for it in range(40):
        for v in patchv:
            nb=[e.other_vert(v).co for e in v.link_edges]
            v.co.xy=v.co.xy*0.5+(sum(nb,Vector())/len(nb)).xy*0.5
    for it in range(400):
        for v in patchv:
            nb=[e.other_vert(v).co.z for e in v.link_edges]
            v.co.z=sum(nb)/len(nb)
    for v in patchv:
        t=max(0.0,1-((v.co.xy-hc.xy).length/rad)**2)
        v.co.z-=0.0012*t
    for f in nf: f.material_index=1
    print('hole filled',len(nf),'faces, radius',rad,'new verts',len(patchv))
bm.normal_update()
me=bpy.data.meshes.new('skin_half'); bm.to_mesh(me)
sk=bpy.data.objects.new('skin_half',me); bpy.context.scene.collection.objects.link(sk)
me.materials.append(bpy.data.materials.new('skin')); me.materials.append(bpy.data.materials.new('patch'))
# decimate
bpy.context.view_layer.objects.active=sk
md=sk.modifiers.new('dec','DECIMATE'); md.ratio=min(1.0,13000/len(me.polygons)); md.use_collapse_triangulate=True
dg=bpy.context.evaluated_depsgraph_get()
me2=bpy.data.meshes.new_from_object(sk.evaluated_get(dg)); sk.modifiers.clear(); sk.data=me2
# make sure rim still on z=0
for v in me2.vertices:
    if abs(v.co.z)<0.0004: v.co.z=0.0
print('skin faces',len(me2.polygons))
# remove old uv, unwrap
while me2.uv_layers: me2.uv_layers.remove(me2.uv_layers[0])
me2.uv_layers.new(name='UVMap')
for ob in bpy.context.view_layer.objects: ob.select_set(False)
sk.select_set(True); bpy.context.view_layer.objects.active=sk
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.unwrap(method='MINIMUM_STRETCH',margin=0.01)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=WORK+"/stage2.blend")
