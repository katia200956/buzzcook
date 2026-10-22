"""Step 4b: clean the baked skin: supermarket stickers, flesh-coloured rim, exposed flesh patch and
the filled hole are masked and refilled (smooth tone + skin detail from random skin patches).
"""
import os
WORK = os.environ.get("AVO_WORK", "/tmp/avo/work")      # scratch folder
USDZ = os.environ.get("AVO_USDZ", "/tmp/avo/usdz")      # AVO-1.usdz unzipped here
import numpy as np, cv2
S=2048
d=np.load(WORK+'/uvtris.npz'); T=d['t']; M=d['m']
col=cv2.imread(WORK+'/skin_diffuse_raw.png')[:,:,::-1].astype(np.float32)/255
nrm=cv2.imread(WORK+'/skin_normal_raw.png')[:,:,::-1].astype(np.float32)/255
def rast(sel):
    m=np.zeros((S,S),np.uint8)
    for t in T[sel]:
        p=np.round(np.stack([t[:,0]*S,(1-t[:,1])*S],1)*4).astype(np.int32)
        cv2.fillPoly(m,[p],1,shift=2)
    return m
island=cv2.dilate(rast(np.ones(len(T),bool)),np.ones((3,3),np.uint8))
hole=rast(M==1)
r,g,b=col[...,0],col[...,1],col[...,2]; mx=col.max(2); mn=col.min(2)
bright=(mn>0.36)|((r>0.45)&(r>g*1.6))
green=(g>r*1.05)&(g>0.22)&((mx-mn)>0.08)
black=mx<0.015
green|=((r+g)/2>b*1.7)&(mx>0.28)
bad=((bright|green|black)&(island>0)).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(bad,8)
keep=np.zeros((S,S),np.uint8)
for i in range(1,n):
    if st[i,4]>300:
        ys,xs=np.nonzero(lab==i); hull=cv2.convexHull(np.stack([xs,ys],1).astype(np.int32))
        if st[i,4]<60000: cv2.fillPoly(keep,[hull],1)
        else: keep[lab==i]=1
keep=keep>0
dist_in=cv2.distanceTransform(island,cv2.DIST_L2,5)
fr=(dist_in<14)&(green|bright)
mask=(keep|(hole>0)|fr).astype(np.uint8)
mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
mask=cv2.dilate(mask,np.ones((15,15),np.uint8))
mask[island==0]=1
valid=((mask==0)&(dist_in>12)).astype(np.float32)
def nblur(img,v,s):
    a=cv2.GaussianBlur(img*v[...,None],(0,0),s); w=cv2.GaussianBlur(v,(0,0),s)
    return a/np.maximum(w,1e-4)[...,None], w
def lowpass(img):
    q=8; sm=cv2.resize(img,(S//q,S//q),interpolation=cv2.INTER_AREA); vs=cv2.resize(valid,(S//q,S//q),interpolation=cv2.INTER_AREA)
    vs=(vs>0.99).astype(np.float32)
    out,w=nblur(sm,vs,1.5); w=np.clip(w*4,0,1)
    for sg in (4,10,25,50):
        big,wb=nblur(sm,vs,sg)
        out=out*w[...,None]+big*(1-w[...,None]); w=np.maximum(w,np.clip(wb*4,0,1))
    up=cv2.resize(out,(S,S),interpolation=cv2.INTER_CUBIC)
    fine,wf=nblur(img,valid,6); t=np.clip(wf*3,0,1)[...,None]
    return fine*t+up*(1-t)
lowc=lowpass(col); lown=lowpass(nrm)
hpc=col-nblur(col,valid,8)[0]; hpn=nrm-nblur(nrm,valid,8)[0]
# candidate source centres: 128 window fully valid
TS=128; h=TS//2
er=cv2.erode(valid.astype(np.uint8),np.ones((TS+1,TS+1),np.uint8))
cy,cx=np.nonzero(er); print('source centres',len(cy))
rng=np.random.default_rng(11)
yy,xx=np.mgrid[-h:h,-h:h]; win=np.exp(-(xx**2+yy**2)/(2*(TS/4.5)**2)).astype(np.float32)
accc=np.zeros_like(col); accn=np.zeros_like(nrm); accw=np.zeros((S,S),np.float32)
need=cv2.dilate(mask,np.ones((65,65),np.uint8))
need[island==0]=0
need=cv2.dilate(need,np.ones((9,9),np.uint8))
gy,gx=np.mgrid[h:S-h+1:TS//3, h:S-h+1:TS//3]
for ty,tx in zip(gy.ravel(),gx.ravel()):
    if not need[ty,tx]: continue
    k=rng.integers(len(cy)); sy,sx=cy[k],cx[k]
    accc[ty-h:ty+h,tx-h:tx+h]+=hpc[sy-h:sy+h,sx-h:sx+h]*win[...,None]
    accn[ty-h:ty+h,tx-h:tx+h]+=hpn[sy-h:sy+h,sx-h:sx+h]*win[...,None]
    accw[ty-h:ty+h,tx-h:tx+h]+=win
detc=accc/np.maximum(accw,1e-4)[...,None]; detn=accn/np.maximum(accw,1e-4)[...,None]
# overlapping averaging lowers contrast: restore std
def match(det,ref,m):
    s1=det[m>0].std(0)+1e-5; s0=ref[valid>0].std(0); return det*(s0/s1)
detc=match(detc,hpc,mask); detn=match(detn,hpn,mask)
a=cv2.GaussianBlur(mask.astype(np.float32),(0,0),6); a=np.maximum(a,cv2.erode(mask,np.ones((7,7),np.uint8)).astype(np.float32))[...,None]
outc=col*(1-a)+(lowc+detc)*a
outn=nrm*(1-a)+(lown+detn)*a
o8=(np.clip(outc,0,1)*255).astype(np.uint8); n8=(np.clip(outn,0,1)*255).astype(np.uint8)
cv2.imwrite(WORK+'/avocado_skin_basecolor.png',o8[:,:,::-1])
cv2.imwrite(WORK+'/avocado_skin_normal.png',n8[:,:,::-1])
cv2.imwrite(WORK+'/fix_small.jpg',cv2.resize(o8[:,:,::-1],(1024,1024),interpolation=cv2.INTER_AREA))
cv2.imwrite(WORK+'/fixn_small.jpg',cv2.resize(n8[:,:,::-1],(512,512),interpolation=cv2.INTER_AREA))
