import * as THREE from 'three';

// Procedural produce skin. Generated models come with flat, evenly coloured textures, which is
// what makes them read as plastic toys. This adds what a real fruit skin has on top: a slow drift
// of colour (deeper red to orange), tiny darker pores, uneven shine and micro-bumps. It works in
// the model's own space, so it needs no UVs and looks the same on every product it is applied to.

const noise = /* glsl */ `
varying vec3 vSkinPos;
uniform float uSkinScale; uniform float uBump; uniform float uTone;
float sk_hash(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float sk_noise(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
return mix(mix(mix(sk_hash(i),sk_hash(i+vec3(1,0,0)),f.x),mix(sk_hash(i+vec3(0,1,0)),sk_hash(i+vec3(1,1,0)),f.x),f.y),
mix(mix(sk_hash(i+vec3(0,0,1)),sk_hash(i+vec3(1,0,1)),f.x),mix(sk_hash(i+vec3(0,1,1)),sk_hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float sk_fbm(vec3 p){float a=0.5,s=0.;for(int i=0;i<4;i++){s+=a*sk_noise(p);p*=2.03;a*=0.5;}return s;}
`;

const color = /* glsl */ `#include <map_fragment>
vec3 sp = vSkinPos * uSkinScale;
float skLo = sk_fbm(sp * 3.0 + 7.0);
float skRed = smoothstep(0.08, 0.3, diffuseColor.r - diffuseColor.g);
vec3 skC = diffuseColor.rgb;
skC *= mix(1.0, mix(0.82, 1.08, skLo), uTone);
skC.g *= mix(1.0, mix(0.8, 1.35, sk_fbm(sp * 5.0 + 3.0)), skRed * uTone);
skC *= 1.0 - 0.07 * uTone * smoothstep(0.55, 0.9, sk_noise(sp * 140.0));
diffuseColor.rgb = skC;`;

const shine = /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (sk_fbm(sp * 18.0) - 0.5) * 0.25, 0.05, 1.0);`;

// Bump from a height field without a texture: the surface-gradient trick three.js uses for bump maps.
const bump = /* glsl */ `#include <normal_fragment_maps>
{
  float h = sk_noise(sp * 60.0) * 0.5 + sk_noise(sp * 160.0) * 0.35;
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float dhx = dFdx(h) * uBump, dhy = dFdy(h) * uBump;
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
  float det = dot(dpx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
}`;

/**
 * @param scale 1 / the model's longest side, so the pattern has the same size on every model.
 * @param bump micro-bump strength; tone: how much colour variation (0 = none).
 */
export function applySkin(material: THREE.MeshStandardMaterial, scale: number, bumpStrength = 0.002, tone = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkinScale = { value: scale };
    shader.uniforms.uBump = { value: bumpStrength };
    shader.uniforms.uTone = { value: tone };
    shader.vertexShader =
      'varying vec3 vSkinPos;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPos = position;');
    shader.fragmentShader =
      noise +
      shader.fragmentShader
        .replace('#include <map_fragment>', color)
        .replace('#include <roughnessmap_fragment>', shine)
        .replace('#include <normal_fragment_maps>', bump);
  };
  material.customProgramCacheKey = () => 'produce-skin';
  material.needsUpdate = true;
}
