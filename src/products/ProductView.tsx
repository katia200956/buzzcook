/* eslint-disable react/no-unknown-property -- three.js JSX props (intensity, args, object) */
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleProp, View, ViewStyle } from 'react-native';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { findProduct, Finish, Product } from './catalog';
import { applySkin } from './skin';

// A single library product rendered in 3D. It slowly turns on its own; dragging a finger
// rotates it in any direction, and letting go hands it back to the slow spin.

// Rotation of one product: a slow spin, overridden by finger drags.
class Spin {
  x = 0.35;
  y = 0;
  private dragging = false;
  private from = { x: 0, y: 0 };

  pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      this.dragging = true;
      this.from = { x: this.x, y: this.y };
    },
    onPanResponderMove: (_, g) => {
      this.y = this.from.y + g.dx * 0.012;
      this.x = this.from.x + g.dy * 0.012;
    },
    onPanResponderRelease: () => (this.dragging = false),
    onPanResponderTerminate: () => (this.dragging = false),
  });

  tick(dt: number, autoRotate: boolean) {
    if (autoRotate && !this.dragging) this.y += dt * 0.6;
  }
}

export function ProductView({
  product,
  size = 240,
  autoRotate = true,
  style,
}: {
  /** A Product, or a name/id looked up with findProduct. */
  product: Product | string;
  size?: number;
  autoRotate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const p = typeof product === 'string' ? findProduct(product) : product;
  const [spin] = useState(() => new Spin());

  if (!p) return <View style={[{ width: size, height: size }, style]} />;

  return (
    <View style={[{ width: size, height: size }, style]} {...spin.pan.panHandlers}>
      <Canvas camera={{ position: [0, 0, 3.2], fov: 35 }} style={{ flex: 1 }}>
        <ambientLight intensity={0.7} />
        <hemisphereLight args={['#fff6ea', '#5a4a3a', 0.9]} />
        <directionalLight position={[2, 4, 3]} intensity={2.2} />
        <directionalLight position={[-3, 1, -2]} intensity={0.6} />
        <Suspense fallback={null}>
          <Model url={p.model} finish={p.finish} spin={spin} autoRotate={autoRotate} />
        </Suspense>
      </Canvas>
    </View>
  );
}

function Model({ url, finish, spin, autoRotate }: { url: string; finish: Finish; spin: Spin; autoRotate: boolean }) {
  const gltf = useLoader(GLTFLoader, url);
  const group = useRef<THREE.Group>(null);

  // Center the model and scale its longest side to 1.6 units so every product fills the view alike.
  const scene = useMemo(() => {
    const obj = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    applyFinish(obj, finish, 1 / Math.max(size.x, size.y, size.z));
    obj.position.sub(center);
    const wrap = new THREE.Group();
    wrap.add(obj);
    wrap.scale.setScalar(1.6 / Math.max(size.x, size.y, size.z));
    return wrap;
  }, [gltf, finish]);

  useFrame((_, dt) => {
    spin.tick(dt, autoRotate);
    group.current?.rotation.set(spin.x, spin.y, 0);
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}


// How the surface reads: a clear coat over the scanned textures gives the wet, freshly washed
// gloss of fruit and cut flesh; dry foods (bread, cheese) keep a soft satin look; skin is a
// whole fruit or vegetable with the procedural skin from skin.ts and a soft satin sheen.
const finishes: Record<
  Exclude<Finish, 'natural'>,
  { roughness: number; clearcoat: number; clearcoatRoughness: number; specularIntensity?: number; color?: string }
> = {
  juicy: { roughness: 0.32, clearcoat: 0.15, clearcoatRoughness: 0.1 },
  wet: { roughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.08 },
  satin: { roughness: 0.7, clearcoat: 0, clearcoatRoughness: 0.5 },
  // Matched to a studio photo of real beefsteak tomatoes; color deepens the flat generated red.
  skin: { roughness: 0.38, clearcoat: 0, clearcoatRoughness: 0.5, specularIntensity: 0.8, color: '#e6c2bc' },
};

// Cut faces made in Blender (src/products/README.md) carry a material named "flesh": the inside of
// the product, always freshly cut and wet, whatever the finish of the skin around it.
const flesh = { roughness: 0.2, clearcoat: 0.35, clearcoatRoughness: 0.12 };

function applyFinish(root: THREE.Object3D, finish: Finish, scale: number) {
  if (finish === 'natural') return;
  const { color, ...f } = finishes[finish];
  const convert = (src: THREE.MeshStandardMaterial) => {
    if (src.name.startsWith('flesh')) {
      return new THREE.MeshPhysicalMaterial({ name: src.name, map: src.map, metalness: 0, ...flesh });
    }
    const material = new THREE.MeshPhysicalMaterial({
      name: src.name,
      map: src.map,
      normalMap: src.normalMap,
      roughnessMap: finish === 'skin' ? null : src.roughnessMap,
      color: color ?? '#ffffff',
      metalness: 0,
      ...f,
    });
    if (finish === 'skin') applySkin(material, scale);
    return material;
  };
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => convert(m as THREE.MeshStandardMaterial))
      : convert(mesh.material as THREE.MeshStandardMaterial);
  });
}
