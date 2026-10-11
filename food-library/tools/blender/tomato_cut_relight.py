# v12: make the projected cut read as 3D next to the skin
import numpy as np
from PIL import Image, ImageFilter
p='/tmp/kat2/pal/cut_ref.png'
a=np.asarray(Image.open(p).convert('RGB')).astype(float)/255
mx=a.max(-1); mn=a.min(-1); s=(mx-mn)/(mx+1e-6); L=a@np.array([.299,.587,.114])
# 1) remove baked photo highlights (white wet speckles) so the renderer's real gloss shows instead
hl=((L>0.62)&(s<0.42)).astype(np.uint8)*255
hlm=np.asarray(Image.fromarray(hl).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))).astype(float)/255
med=np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(11))).astype(float)/255
core=np.clip((a[...,1]-a[...,2]-0.15)/0.2,0,1)*np.clip((a[...,1]-0.45)/0.2,0,1)   # keep the pale core
w=(hlm*(1-core))[...,None]
a=a*(1-w)+med*w
# second pass for the larger glare patch
L2=a@np.array([.299,.587,.114]); mx2=a.max(-1); s2=(mx2-a.min(-1))/(mx2+1e-6)
hl2=((L2>0.55)&(s2<0.45)).astype(np.uint8)*255
hl2=np.asarray(Image.fromarray(hl2).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3))).astype(float)/255
med2=np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.MedianFilter(41))).astype(float)/255
w2=(hl2*(1-core))[...,None]; a=a*(1-w2)+med2*w2
# 2) flesh closer to the skin red: less orange, a little deeper
red=np.clip((a[...,0]-a[...,1]-0.35)/0.2,0,1)[...,None]
a=a*(1-red)+a*np.array([0.96,0.80,0.85])*red
a=a*0.93
g=(a@np.array([.299,.587,.114]))[...,None]; a=g+(a-g)*1.12
# 3) soft falloff toward the rim, like light on a real cut surface
h,wd=L.shape; yy,xx=np.mgrid[0:h,0:wd]; r=np.sqrt(((xx-wd/2)/(wd/2))**2+((yy-h/2)/(h/2))**2)
vig=1-0.16*np.clip((r-0.7)/0.3,0,1)
a=a*vig[...,None]
Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(p)
print('highlight px',(hlm>0.5).mean())
