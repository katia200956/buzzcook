import * as THREE from 'three';

// The inside of a cut product, built as real geometry in Blender (tools/*.py): the cut flesh, the
// gel in the seed chambers, the pith, the core, the seeds, and the calyx or stem. Each part comes in
// the GLB as a material with that name (STANDARD.md), and here gets the look it has in real life:
// - flesh: wet, with the colour shifting from the pale core through the bright walls to a deeper
//   red under the skin. Computed from the model's own coordinates (the tools' convention: diameter
//   1, standing on y = 0), so it follows the 3D shape instead of being a picture on the cut.
// - gel: clear and glossy, so the seeds sitting deeper inside the chambers show through it.
// - seeds: pale yellow with a soft wet sheen.
// - lemon juice: radial glossy sacs, see juiceMaterial.

const noise = /* glsl */ `
float fh(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float fn(vec3 x){vec3 i=floor(x);vec3 f=fract(x);f=f*f*(3.0-2.0*f);
return mix(mix(mix(fh(i),fh(i+vec3(1,0,0)),f.x),mix(fh(i+vec3(0,1,0)),fh(i+vec3(1,1,0)),f.x),f.y),
mix(mix(fh(i+vec3(0,0,1)),fh(i+vec3(1,0,1)),f.x),mix(fh(i+vec3(0,1,1)),fh(i+vec3(1,1,1)),f.x),f.y),f.z);}
`;

const fleshColor = /* glsl */ `#include <map_fragment>
{
  float r = length(vP.xz); float t = (vP.y - 0.4) / 0.4;
  float rb = 0.5 * sqrt(max(0.0, 1.0 - t * t));
  float ang = atan(vP.z, vP.x);
  float core = 1.0 - smoothstep(0.07, 0.15, r + (fn(vP * 40.0) - 0.5) * 0.04);
  vec3 c = mix(cFlesh, cCore, core * 0.85);
  c = mix(c, cCore, core * 0.4 * smoothstep(0.55, 0.8, fn(vec3(ang * 6.0, vP.y * 30.0, r * 20.0))));
  float vein = exp(-pow((r - (rb - 0.042)) / 0.01, 2.0)) * (0.5 + 0.5 * fn(vec3(ang * 25.0, vP.y * 40.0, 3.0)));
  c = mix(c, cVein, vein * 0.25);
  c = mix(c, cDeep, smoothstep(rb - 0.03, rb - 0.004, r) * 0.6);
  c *= 0.94 + 0.12 * fn(vP * 90.0);
  diffuseColor.rgb = c;
}`;

function fleshMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'flesh',
    roughness: 0.28,
    clearcoat: 0.55,
    clearcoatRoughness: 0.12,
    metalness: 0,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      cCore: { value: new THREE.Color('#f58a62') },
      cFlesh: { value: new THREE.Color('#ee3f1a') },
      cDeep: { value: new THREE.Color('#d8301a') },
      cVein: { value: new THREE.Color('#f7865a') },
    });
    shader.vertexShader =
      'varying vec3 vP;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    shader.fragmentShader =
      'varying vec3 vP;\nuniform vec3 cCore, cFlesh, cDeep, cVein;\n' +
      noise +
      shader.fragmentShader
        .replace('#include <map_fragment>', fleshColor)
        // A little light coming back out of the flesh, like real fruit does.
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.07;');
  };
  m.customProgramCacheKey = () => 'produce-flesh';
  return m;
}

// Citrus juice sacs: narrow across, long along the radius, so a cut shows radial glossy streaks
// with soft breaks between sacs. A relief in the lighting over the real segment geometry.
const vesicleRelief = /* glsl */ `
float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vesH(vec3 p, out float id){
  float r = length(p.xz); float a = atan(p.z, p.x);
  float col = floor(a * r / uCell.x);
  float fx = fract(a * r / uCell.x) - 0.5;
  float along = r / uCell.y + h2(vec2(col, 3.1)) * 7.0;
  float seg = fract(along);
  id = h2(vec2(col, floor(along)));
  float across = sqrt(max(0.0, 1.0 - 4.0 * fx * fx));
  float ends = smoothstep(0.0, 0.18, seg) * smoothstep(1.0, 0.82, seg);
  return across * (0.55 + 0.45 * ends) * (0.75 + 0.25 * id);
}
`;

function juiceMaterial(color: THREE.Color) {
  const m = new THREE.MeshPhysicalMaterial({ name: 'flesh', color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCell = { value: new THREE.Vector2(0.0012, 0.006) }; // sac width and length, metres
    shader.uniforms.uBump = { value: 0.0011 };
    shader.vertexShader =
      'varying vec3 vP;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    shader.fragmentShader =
      'varying vec3 vP;\nuniform vec2 uCell; uniform float uBump;\n' +
      vesicleRelief +
      shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\nfloat vesId; float vesh = vesH(vP, vesId);\ndiffuseColor.rgb *= mix(0.8, 1.08, vesh) * (0.93 + 0.14 * vesId);',
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
{
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  float dhx = dFdx(vesh) * uBump, dhy = dFdy(vesh) * uBump;
  vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
  float det = dot(dpx, r1);
  normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
}`,
        )
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.12;');
  };
  m.customProgramCacheKey = () => 'produce-juice';
  return m;
}

/**
 * The real-world material for an inside part, by its GLB material name, or null for other parts
 * (skin and peel, which ProductView handles). Colours come from the model; the tomato's flesh and
 * gel and the citrus juice have their own looks.
 */
export function insideMaterial(src: THREE.MeshStandardMaterial, base: string): THREE.Material | null {
  const name = src.name;
  const color = src.color.clone();
  if (base === 'tomato') {
    if (name.startsWith('flesh')) return fleshMaterial();
    if (name.startsWith('gel')) {
      return new THREE.MeshPhysicalMaterial({
        name,
        color: '#ff6a35',
        roughness: 0.04,
        metalness: 0,
        transmission: 0.75,
        thickness: 0.02,
        ior: 1.34,
        attenuationColor: new THREE.Color('#f37a4a'),
        attenuationDistance: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        emissive: new THREE.Color('#6a1604'),
        emissiveIntensity: 0.5,
      });
    }
    if (name.startsWith('seed')) {
      return new THREE.MeshPhysicalMaterial({
        name,
        color: '#efcb7a',
        roughness: 0.32,
        metalness: 0,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        emissive: new THREE.Color('#4a3006'),
        emissiveIntensity: 0.5,
      });
    }
    if (name.startsWith('calyx')) {
      return new THREE.MeshPhysicalMaterial({ name, color: '#3f7428', roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.3 });
    }
  }
  if (name.startsWith('flesh') && base === 'lemon') return juiceMaterial(color);
  if (name.startsWith('flesh')) {
    // Freshly cut flesh is wet; banana flesh is soft and only satin.
    const dry = base === 'banana';
    return new THREE.MeshPhysicalMaterial({ name, color, roughness: dry ? 0.5 : 0.25, metalness: 0, clearcoat: dry ? 0.15 : 0.6, clearcoatRoughness: 0.12 });
  }
  if (name.startsWith('pith') || name.startsWith('core')) {
    return new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.55, metalness: 0, sheen: 0.3, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  }
  if (name.startsWith('seed')) {
    return new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.35, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  }
  if (name.startsWith('gel')) {
    return new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.05, metalness: 0, transmission: 0.6, thickness: 0.002, ior: 1.34, clearcoat: 1 });
  }
  if (name.startsWith('calyx')) {
    return new THREE.MeshPhysicalMaterial({ name, color, roughness: 0.6, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.4 });
  }
  return null;
}
