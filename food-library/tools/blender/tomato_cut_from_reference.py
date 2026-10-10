# Build cut colour + height maps from Katusha's palette showcase reference
import numpy as np
from PIL import Image, ImageFilter
src=Image.open('/mnt/project-files/products/references/tomato-palette-showcase.png').convert('RGB')
c=src.crop((162,192,882,922)).resize((1024,1024),Image.LANCZOS)
a=np.asarray(c).astype(float)/255
mx=a.max(-1); mn=a.min(-1); s=(mx-mn)/(mx+1e-6)
bg=(s<0.18)&(mx>0.6)&(a[...,0]-a[...,2]<0.15)   # grey backdrop outside the cut
rim=np.array([0.70,0.13,0.10])
a[bg]=rim
Image.fromarray((a*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref.png')
L=Image.fromarray((a@np.array([.299,.587,.114])*255).astype(np.uint8))
fine=np.asarray(L.filter(ImageFilter.GaussianBlur(1.5))).astype(float)/255
big=np.asarray(L.filter(ImageFilter.GaussianBlur(14))).astype(float)/255
huge=np.asarray(L.filter(ImageFilter.GaussianBlur(40))).astype(float)/255
yel=np.clip((a[...,1]-a[...,2]-0.18)/0.2,0,1)*np.clip((a[...,0]-0.6)/0.2,0,1)
yel=np.asarray(Image.fromarray((yel*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(float)/255
H=0.5+1.6*(fine-big)+0.6*(big-huge)+0.25*yel
Image.fromarray((np.clip(H,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_height.png')
print('ok', bg.mean())
# ---- v8: cavities (dark gel pockets around the seeds) sink and turn translucent; seeds stand proud
fineL=fine
d=np.clip((huge-fineL-0.02)/0.14,0,1)
redish=np.clip((a[...,0]-a[...,2]-0.25)/0.2,0,1)
near=np.asarray(Image.fromarray((yel*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))).astype(float)/255
near=np.clip(near/0.12,0,1)
cav=d*redish*near
cav=np.asarray(Image.fromarray((np.clip(cav,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))).astype(float)/255
seed=np.clip((yel-0.25)/0.5,0,1)*near
H2=0.5+1.6*(fine-big)+0.6*(big-huge)+0.45*seed-0.3*cav
Image.fromarray((np.clip(H2,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_height.png')
Image.fromarray((np.clip(cav,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_cavity.png')
# colour: a touch warmer / less blue, as measured against the reference
a2=np.asarray(Image.open('/tmp/kat2/pal/cut_ref.png')).astype(float)/255
g=(a2@np.array([.299,.587,.114]))[...,None]; a2=g+(a2-g)*1.25
a2=a2*np.array([1.0,0.95,0.72])
Image.fromarray((np.clip(a2,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref.png')
print('cav mean',cav.mean(),'seed mean',seed.mean())
# ---- v10: a few more seeds in the dark pockets next to the existing ones
rng=np.random.default_rng(7)
col=np.asarray(Image.open('/tmp/kat2/pal/cut_ref.png')).astype(float)/255
Hh=np.asarray(Image.open('/tmp/kat2/pal/cut_ref_height.png')).astype(float)/255
cand=np.argwhere((cav>0.25)&(yel<0.15)&(near>0.5)); rng.shuffle(cand)
GEL=np.array([0xF4,0xB8,0x60])/255; PODS=np.array([0xB5,0x8A,0x3E])/255
placed=[]; yy,xx=np.mgrid[0:1024,0:1024]
existing=np.argwhere(yel>0.5)
for (y,x) in cand:
    if len(placed)>=14: break
    if any((y-py)**2+(x-px)**2<26**2 for py,px in placed): continue
    if existing.size and ((existing[:,0]-y)**2+(existing[:,1]-x)**2).min()<14**2: continue
    ang=rng.uniform(0,np.pi); ra,rb=rng.uniform(7,9),rng.uniform(4.5,6)
    sl=slice(max(0,y-14),y+15), slice(max(0,x-14),x+15)
    dy=yy[sl]-y; dx=xx[sl]-x
    u=(dx*np.cos(ang)+dy*np.sin(ang))/ra; v=(-dx*np.sin(ang)+dy*np.cos(ang))/rb
    r2=u*u+v*v; m=np.clip((1-r2)/0.25,0,1)
    shade=np.clip(1-r2,0,1)[...,None]
    seedc=PODS*(1-shade)+GEL*shade
    hl=np.exp(-((u+0.35)**2+(v+0.35)**2)/0.04)[...,None]*0.5
    c=col[sl]; col[sl]=c*(1-m[...,None])+np.clip(seedc+hl,0,1)*m[...,None]
    Hh[sl]=np.maximum(Hh[sl], Hh[sl]*(1-m)+(0.5+0.35*np.sqrt(np.clip(1-r2,0,1)))*m)
    placed.append((y,x))
# calmer colours: no extra saturation (v9 had x1.25 baked in above)
g=(col@np.array([.299,.587,.114]))[...,None]; col=g+(col-g)*0.85
Image.fromarray((np.clip(col,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref.png')
Image.fromarray((np.clip(Hh,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_height.png')
print('added seeds',len(placed))
