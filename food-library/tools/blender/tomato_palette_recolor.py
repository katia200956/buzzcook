import numpy as np, colorsys
from PIL import Image
R="/mnt/project-files/products/references/oshinchan-tomato/"; O="/tmp/kat2/pal/"
hx=lambda h: np.array([int(h[i:i+2],16) for i in (0,2,4)],float)/255
RED,FLESH,ORANGE,GEL,CORE,STEM=map(hx,["C62828","E37373","F06A3A","F4B860","F7E7A8","556B2F"])
def load(n):
    im=Image.open(R+n); a=np.asarray(im.convert("RGBA")).astype(float)/255; return a
def hsv(rgb):
    mx=rgb.max(-1); mn=rgb.min(-1); d=mx-mn+1e-6
    r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
    h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60
    return h,d/(mx+1e-6),mx
def ramp(L,stops):
    xs=[s[0] for s in stops]; out=np.zeros(L.shape+(3,))
    for c in range(3): out[...,c]=np.interp(L,xs,[s[1][c] for s in stops])
    return out
def sat(c,f):
    g=lum(c)[...,None]; return g+(c-g)*f
def save(a,n): Image.fromarray((np.clip(a,0,1)*255).astype(np.uint8)).save(O+n)
def lum(rgb): return rgb@np.array([.299,.587,.114])
# cut face
a=load("tomato_cut_danmen.png"); rgb=a[...,:3]; h,s,v=hsv(rgb); L=lum(rgb)
Ln=(L-np.percentile(L,2))/(np.percentile(L,98)-np.percentile(L,2)+1e-6); Ln=np.clip(Ln,0,1)
t=np.clip((h-18)/30,0,1)*np.clip((s-0.15)/0.3,0,1)+np.clip((Ln-0.8)/0.2,0,1)*np.clip((0.45-s)/0.3,0,1)
t=np.clip(t,0,1)[...,None]
redside=ramp(Ln,[(0,RED*0.5),(0.3,RED*0.92),(0.62,ORANGE*0.93),(1,(ORANGE+FLESH)/2*1.05)])
yel=ramp(Ln,[(0,GEL*0.55*np.array([1,.8,.6])),(0.6,GEL),(1,(GEL+CORE)/2*1.03)])
save(np.dstack([sat(redside,1.3)*(1-t)+sat(yel,1.15)*t,a[...,3]]),"tomato_cut_danmen.png")
# skins
for n in ["tomato_bunkatu_hontai.png","tomato_for_bake.png"]:
    a=load(n); rgb=a[...,:3]; h,s,v=hsv(rgb); L=lum(rgb)
    g=np.clip((h-50)/30,0,1)*np.clip((h-170)/-30+1,0,1)*np.clip((s-0.2)/0.2,0,1)  # greenish areas
    k=(L/np.median(L[L>0.05]))[...,None]
    col=sat(np.broadcast_to(RED*np.array([1.02,1.05,0.8]),k.shape[:2]+(3,)),1.35)*np.clip(1+(k-1)*0.45,0.7,1.15)
    gr=STEM*np.clip(k*1.4,0.4,1.8)
    save(np.dstack([col*(1-g[...,None])+gr*g[...,None],a[...,3]]),n)
for n in ["heta_big.png","tomatoheta.png"]:
    a=load(n); rgb=a[...,:3]; L=lum(rgb); m=np.median(L[a[...,3]>0.5])
    k=(L/m)[...,None]; save(np.dstack([STEM*np.clip(k,0.4,1.8),a[...,3]]),n)
print("ok")
