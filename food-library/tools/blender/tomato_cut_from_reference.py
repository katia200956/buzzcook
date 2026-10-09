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
H2=0.5+1.6*(fine-big)+0.6*(big-huge)+0.45*seed-0.45*cav
Image.fromarray((np.clip(H2,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_height.png')
Image.fromarray((np.clip(cav,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref_cavity.png')
# colour: a touch warmer / less blue, as measured against the reference
a2=np.asarray(Image.open('/tmp/kat2/pal/cut_ref.png')).astype(float)/255
g=(a2@np.array([.299,.587,.114]))[...,None]; a2=g+(a2-g)*1.25
a2=a2*np.array([1.0,0.95,0.72])
Image.fromarray((np.clip(a2,0,1)*255).astype(np.uint8)).save('/tmp/kat2/pal/cut_ref.png')
print('cav mean',cav.mean(),'seed mean',seed.mean())
