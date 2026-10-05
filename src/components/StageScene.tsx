import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import type { SceneLayer } from '../data/scenes';

// A cooking step's animated scene: background-free cutouts that drift, drop, get cut in half
// and steam on a square stage. Ported from the recipe-page demo (RecipeStageVisual), with the
// CSS keyframes redone as Animated interpolations. The scene replays from the start each time
// its step becomes active; with Reduce Motion on, every layer simply shows its final pose.

const native = Platform.OS !== 'web';
const ease = Easing.bezier(0.33, 1, 0.68, 1);

export function StageScene({ layers, size, active }: { layers: SceneLayer[]; size: number; active: boolean }) {
  // Each activation is a new "take": remounting the layers replays every entrance.
  const [run, setRun] = useState(0);
  const [wasActive, setWasActive] = useState(false);
  const still = useReduceMotion();

  if (active !== wasActive) {
    setWasActive(active);
    if (active) setRun(run + 1);
  }

  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      {run > 0 && (
        <Frame key={run} still={still}>
          {layers.map((layer, i) =>
            layer.fx === 'steam' ? (
              still ? null : <Steam key={i} layer={layer} size={size} />
            ) : layer.anim === 'cut' ? (
              <Cut key={i} layer={layer} size={size} still={still} />
            ) : still && layer.anim === 'dropFade' ? null : (
              <Plain key={i} layer={layer} size={size} still={still} />
            ),
          )}
        </Frame>
      )}
    </View>
  );
}

function useReduceMotion() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setOn);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => sub.remove();
  }, []);
  return on;
}

// One value running 0 → 1 once the layer mounts (or sitting at 1 when motion is reduced).
function useProgress(duration: number, delay: number, still: boolean, easing = ease) {
  const [t] = useState(() => new Animated.Value(still ? 1 : 0));
  useEffect(() => {
    if (still) return;
    const a = Animated.timing(t, { toValue: 1, duration, delay: delay * 1000, easing, useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [t, duration, delay, still, easing]);
  return t;
}

function Frame({ still, children }: { still: boolean; children: React.ReactNode }) {
  const t = useProgress(300, 0, still);
  return <Animated.View style={{ position: 'absolute', inset: 0, opacity: t }}>{children}</Animated.View>;
}

// Where a layer sits: centred on (x, y), w% of the stage wide, with its static tilt.
function box(layer: SceneLayer, size: number) {
  const w = (layer.w / 100) * size;
  const h = w * (layer.aspect ?? 1);
  return {
    w,
    h,
    style: {
      position: 'absolute' as const,
      left: (layer.x / 100) * size - w / 2,
      top: (layer.y / 100) * size - h / 2,
      width: w,
      height: h,
      transform: [{ rotate: `${layer.rotate ?? 0}deg` }],
    },
  };
}

const lerp = (t: Animated.Value, inputRange: number[], outputRange: number[] | string[]) =>
  t.interpolate({ inputRange, outputRange: outputRange as any, extrapolate: 'clamp' });

function entrance(anim: SceneLayer['anim'], t: Animated.Value, h: number) {
  switch (anim) {
    case 'dropIn':
      return {
        opacity: lerp(t, [0, 0.35, 1], [0, 1, 1]),
        transform: [
          { translateY: lerp(t, [0, 0.35, 0.62, 0.8, 1], [-1.6 * h, -0.67 * h, 0.05 * h, -0.03 * h, 0]) },
          { rotate: lerp(t, [0, 0.35, 0.62, 0.8, 1], ['-40deg', '-15deg', '4deg', '-2deg', '0deg']) },
        ],
      };
    case 'dropFade':
      return {
        opacity: lerp(t, [0, 0.25, 0.72, 1], [0, 1, 0.95, 0]),
        transform: [
          { translateY: lerp(t, [0, 0.25, 0.72, 1], [-1.2 * h, -0.78 * h, 0, 0.09 * h]) },
          { rotate: lerp(t, [0, 0.25, 0.72, 1], ['-8deg', '-5deg', '0deg', '0deg']) },
          { scale: lerp(t, [0, 0.25, 0.72, 1], [0.9, 0.87, 0.82, 0.6]) },
        ],
      };
    case 'zoomIn':
      return {
        opacity: lerp(t, [0, 0.05, 1], [0, 1, 1]),
        transform: [{ scale: lerp(t, [0, 1], [1.14, 1]) }],
      };
    default:
      return {
        opacity: t,
        transform: [{ translateY: lerp(t, [0, 1], [0.09 * h, 0]) }, { scale: lerp(t, [0, 1], [0.93, 1]) }],
      };
  }
}

const timing: Record<string, [number, (v: number) => number]> = {
  driftIn: [800, ease],
  dropIn: [900, Easing.out(Easing.quad)],
  dropFade: [1400, Easing.linear],
  zoomIn: [4500, Easing.bezier(0.16, 1, 0.3, 1)],
};

function Plain({ layer, size, still }: { layer: SceneLayer; size: number; still: boolean }) {
  const { h, style } = box(layer, size);
  const anim = layer.anim ?? 'driftIn';
  const [duration, easing] = timing[anim] ?? timing.driftIn;
  const t = useProgress(duration, layer.delay ?? 0, still, easing);
  const bob = useFloat(!!layer.float && !still, h);
  return (
    <View style={style}>
      <Animated.View style={[{ flex: 1 }, entrance(anim, t, h)]}>
        <Animated.View style={{ flex: 1, transform: [{ translateY: bob }] }}>
          <Image source={layer.src} style={{ flex: 1 }} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// Lazy bobbing after the entrance: 6 s each way, starting a second in.
function useFloat(on: boolean, h: number) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!on) return;
    const a = Animated.sequence([
      Animated.delay(1000),
      Animated.loop(
        Animated.sequence([
          Animated.timing(y, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
          Animated.timing(y, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: native }),
        ]),
      ),
    ]);
    a.start();
    return () => a.stop();
  }, [on, y]);
  return y.interpolate({ inputRange: [0, 1], outputRange: [-0.012 * h, 0.014 * h] });
}

// Juice drops: fixed paths fanning out from the cut, bent down by "gravity".
const DROPS = Array.from({ length: 9 }, (_, k) => {
  const angle = (k / 9) * Math.PI * 2 + 0.45;
  const dist = 46 + (k % 3) * 20;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist * 0.75 - 16, size: 4.5 + (k % 3) * 2.2 };
});

function mix(hex: string, other: number, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * amount + other * (1 - amount)));
  return `rgb(${ch.join(',')})`;
}

// Cut in half: the halves lie together until a knife flash passes, then part; optional splash.
function Cut({ layer, size, still }: { layer: SceneLayer; size: number; still: boolean }) {
  const { w, h, style } = box(layer, size);
  const delay = layer.delay ?? 0;
  const t = useProgress(800, delay, still);
  const c = useProgress(1600, delay, still, Easing.linear);
  const half = (side: -1 | 1) => ({
    position: 'absolute' as const,
    inset: 0,
    transform: [
      { translateX: lerp(c, [0, 0.45, 0.7, 1], [0, 0, 0.065 * w * side, 0.08 * w * side]) },
      { translateY: lerp(c, [0, 0.45, 0.7, 1], side < 0 ? [0, 0, 0.015 * h, 0.025 * h] : [0, 0, 0.03 * h, 0.045 * h]) },
      { rotate: lerp(c, [0, 0.45, 0.7, 1], side < 0 ? ['0deg', '0deg', '-5deg', '-6deg'] : ['0deg', '0deg', '5deg', '6deg']) },
    ],
  });
  const knifeH = 1.24 * h;

  return (
    <View style={style}>
      <Animated.View style={[{ flex: 1 }, entrance('driftIn', t, h)]}>
        <Animated.View style={half(-1)}>
          <View style={{ position: 'absolute', left: 0, top: 0, width: w / 2, height: h, overflow: 'hidden' }}>
            <Image source={layer.src} style={{ width: w, height: h }} contentFit="contain" />
          </View>
        </Animated.View>
        <Animated.View style={half(1)}>
          <View style={{ position: 'absolute', left: w / 2, top: 0, width: w / 2, height: h, overflow: 'hidden' }}>
            <Image source={layer.src} style={{ width: w, height: h, marginLeft: -w / 2 }} contentFit="contain" />
          </View>
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            left: w / 2 - 1.5,
            top: -0.12 * h,
            width: 3,
            height: knifeH,
            opacity: lerp(c, [0, 0.3, 0.38, 0.48, 1], [0, 0, 1, 0, 0]),
            transform: [
              { rotate: '6deg' },
              { translateY: lerp(c, [0, 0.3, 0.38, 0.48, 1], [-0.14 * knifeH, -0.14 * knifeH, 0, 0.08 * knifeH, 0.08 * knifeH]) },
              { scaleY: lerp(c, [0, 0.3, 0.38, 1], [0.4, 0.4, 1, 1]) },
            ],
          }}
        >
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.85)', 'transparent']} style={{ flex: 1 }} />
        </Animated.View>

        {layer.splash && !still
          ? DROPS.map((d, k) => {
              const s = (d.size / 100) * w;
              return (
                <Animated.View
                  key={k}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: lerp(c, [0, 0.44, 0.5, 1], [0, 0, 1, 0]),
                    transform: [
                      { translateX: lerp(c, [0, 0.44, 1], [0, 0, (d.dx / 100) * w]) },
                      { translateY: lerp(c, [0, 0.44, 1], [0, 0, (d.dy / 100) * h]) },
                    ],
                  }}
                >
                  <Animated.View
                    style={{
                      position: 'absolute',
                      left: 0.49 * w - s / 2,
                      top: 0.46 * h - s / 2,
                      width: s,
                      height: s,
                      transform: [
                        { translateY: lerp(c, [0, 0.56, 1], [0, 0, 0.8 * s]) },
                        { rotate: lerp(c, [0, 0.56, 1], ['35deg', '35deg', '60deg']) },
                        { scale: lerp(c, [0, 0.44, 0.56, 1], [0.4, 0.4, 1, 0.55]) },
                      ],
                    }}
                  >
                    <LinearGradient
                      colors={[mix(layer.splash!, 255, 0.78), mix(layer.splash!, 0, 0.82)]}
                      start={{ x: 0.3, y: 0.25 }}
                      end={{ x: 0.8, y: 0.9 }}
                      style={{ flex: 1, borderRadius: s / 2, borderBottomLeftRadius: s * 0.12 }}
                    />
                  </Animated.View>
                </Animated.View>
              );
            })
          : null}
      </Animated.View>
    </View>
  );
}

// Rising steam: three soft puffs looping, staggered.
const PUFFS = [
  { left: 0.3, w: 0.44, after: 0 },
  { left: 0.08, w: 0.38, after: 1.2 },
  { left: 0.48, w: 0.34, after: 2.3 },
];

function Steam({ layer, size }: { layer: SceneLayer; size: number }) {
  const { w, style } = box({ ...layer, aspect: 1 }, size);
  return (
    <View style={style}>
      {PUFFS.map((p, i) => (
        <Puff key={i} left={p.left * w} size={p.w * w} delay={(layer.delay ?? 0) + p.after} />
      ))}
    </View>
  );
}

function Puff({ left, size, delay }: { left: number; size: number; delay: number }) {
  const [t] = useState(() => new Animated.Value(0));
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    anim.current = Animated.sequence([
      Animated.delay(delay * 1000),
      Animated.loop(Animated.timing(t, { toValue: 1, duration: 3400, easing: Easing.out(Easing.quad), useNativeDriver: native })),
    ]);
    anim.current.start();
    return () => anim.current?.stop();
  }, [t, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        bottom: 0,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.14)',
        boxShadow: `0px 0px ${size * 0.25}px ${size * 0.15}px rgba(255,255,255,0.12)`,
        opacity: lerp(t, [0, 0.22, 0.6, 1], [0, 0.75, 0.35, 0]),
        transform: [
          { translateY: lerp(t, [0, 1], [0.28 * size, -1.15 * size]) },
          { translateX: lerp(t, [0, 1], [0, 0.12 * size]) },
          { scale: lerp(t, [0, 1], [0.55, 1.35]) },
        ],
      }}
    />
  );
}
