# Recolour Oshinchan tomato textures to Katusha's palette (2026-10-09 colour anatomy guide)
import numpy as np
from PIL import Image
R="/mnt/project-files/products/references/oshinchan-tomato/"; O="/tmp/kat2/pal/"
hx=lambda h: np.array([int(h[i:i+2],16) for i in (0,2,4)],float)/255
P={k:hx(v) for k,v in dict(TOMATO="C62828",REDORANGE="E7473C",FLESH="E7473C",ORANGERED="F06A3A",
   ORANGE="F7931E",GEL="F4B860",CORE="F7E7A8",PITH="EDE2C6",PINK="D96B6B",PODS="B58A3E",
   STEM="556B2F",LEAF="3E5A2A").items()}
def load(n): return np.asarray(Image.open(R+n).convert("RGBA")).astype(float)/255
def lum(c): return c@np.array([.299,.587,.114])
def hsv(rgb):
    mx=rgb.max(-1); mn=rgb.min(-1); d=mx-mn+1e-6; r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,d/(mx+1e-6),mx
def ramp(L,stops):
    out=np.zeros(L.shape+(3,))
    for c in range(3): out[...,c]=np.interp(L,[s[0] for s in stops],[s[1][c] for s in stops])
    return out
def norm(L,m=None):
    lo,hi=np.percentile(L if m is None else L[m],[2,98]); return np.clip((L-lo)/(hi-lo+1e-6),0,1)
def blur_noise(shape,scale,seed):
    rng=np.random.default_rng(seed); s=(max(2,shape[0]//scale),max(2,shape[1]//scale))
    n=Image.fromarray((rng.random(s)*255).astype(np.uint8)).resize(shape[::-1],Image.BICUBIC)
    return np.asarray(n).astype(float)/255
def sat(c,f):
    g=lum(c)[...,None]; return g+(c-g)*f
def save(a,n): Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(O+n)
mix=lambda a,b,t: a*(1-t[...,None])+b*t[...,None]
sm=lambda x,a,b: np.clip((x-a)/(b-a),0,1)

# ---- cut face
a=load("tomato_cut_danmen.png"); rgb=a[...,:3]; h,s,v=hsv(rgb); L=norm(lum(rgb))
yel=np.clip(sm(h,18,45)*sm(s,0.15,0.4)+sm(L,0.8,1)*sm(-s,-0.45,-0.15),0,1)   # pale/yellow tissue
nz=blur_noise(L.shape,24,1); nz2=blur_noise(L.shape,48,2)
# flesh: dark rim -> tomato red, body red flesh/orange red, warm transitions orange, pink patches
flesh=ramp(L,[(0,P["TOMATO"]*0.75),(0.3,P["TOMATO"]),(0.5,P["FLESH"]),(0.75,P["ORANGERED"]),(1,P["ORANGE"])])
flesh=mix(flesh,P["PINK"]*np.ones_like(flesh),sm(nz,0.6,0.85)*0.35*sm(L,0.3,0.6))
flesh=mix(flesh,P["ORANGE"]*np.ones_like(flesh),sm(nz2,0.65,0.9)*0.35*sm(L,0.45,0.8))
# pale tissue: low saturation & bright -> core/pith; saturated yellow -> seed gel; darker -> seed pods
inner=ramp(L,[(0,P["PODS"]*0.8),(0.35,P["PODS"]),(0.6,P["GEL"]),(0.85,P["CORE"]),(1,P["CORE"])])
inner=mix(inner,P["PITH"]*np.ones_like(inner),sm(-s,-0.35,-0.12)*sm(L,0.6,0.9))
out=mix(sat(flesh,1.3),sat(inner,1.15),yel)
save(np.dstack([out,a[...,3]]),"tomato_cut_danmen.png")

# ---- skins: tomato red, lighter areas towards red orange, green shoulder spots -> stem/leaf green
for n in ["tomato_bunkatu_hontai.png","tomato_for_bake.png"]:
    a=load(n); rgb=a[...,:3]; h,s,v=hsv(rgb); Lr=lum(rgb)
    gm=sm(h,50,80)*sm(-h,-180,-150)*sm(s,0.2,0.4)
    k=Lr/np.median(Lr[Lr>0.05])
    red=mix(P["TOMATO"]*np.ones_like(rgb),P["REDORANGE"]*np.ones_like(rgb),sm(k,1.0,1.35)*0.8)
    red=red*np.clip(1+(k-1)*0.35,0.75,1.1)[...,None]
    gr=mix(P["LEAF"]*np.ones_like(rgb),P["STEM"]*np.ones_like(rgb),sm(k,0.6,1.1))
    save(np.dstack([mix(sat(red*np.array([1.02,1.05,0.8]),1.35),gr,gm),a[...,3]]),n)
# ---- calyx/stem: leaf green in shadows, stem green in light
for n in ["heta_big.png","tomatoheta.png"]:
    a=load(n); Lr=lum(a[...,:3]); L2=norm(Lr,a[...,3]>0.5)
    g=ramp(L2,[(0,P["LEAF"]*0.8),(0.45,P["LEAF"]),(0.8,P["STEM"]),(1,P["STEM"]*1.15)])
    save(np.dstack([g,a[...,3]]),n)
print("ok")
