import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, View } from 'react-native';
import type { SceneLayer } from '../data/scenes';

// A cooking step's animated scene: background-free cutouts that drift, drop, get cut in half
// and steam on a square stage. Ported from the recipe-page demo (RecipeStageVisual), with the
// CSS keyframes redone as Animated interpolations. The scene replays from the start each time
// its step becomes active; with Reduce Motion on, every layer simply shows its final pose.
// `focus` brings one layer forward (a little bigger) and dims the rest, for narrated steps.
// The motion follows food-film footage: a camera that slowly dollies in and leans toward the
// product being talked about, products with weight (they fall, squash and settle), a hero turn
// under a warm light for the focused one, and pans that toss what is in them.

const native = Platform.OS !== 'web';
const ease = Easing.bezier(0.33, 1, 0.68, 1);

export function StageScene({ layers, size, active, focus }: { layers: SceneLayer[]; size: number; active: boolean; focus?: number }) {
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
        <Frame key={run} still={still} size={size} target={focus === undefined ? undefined : layers[focus]}>
          {layers.map((layer, i) => {
            const emph = focus === undefined ? 0 : focus === i ? 1 : -1;
            return layer.fx === 'steam' ? (
              still ? null : <Steam key={i} layer={layer} size={size} />
            ) : layer.anim === 'cut' ? (
              <Cut key={i} layer={layer} size={size} still={still} emph={emph} />
            ) : still && layer.anim === 'dropFade' ? null : (
              <Plain key={i} layer={layer} size={size} still={still} emph={emph} toss={layer.toss ? i : undefined} />
            );
          })}
        </Frame>
      )}
    </View>
  );
}

export function useReduceMotion() {
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

// A looping 0 → 1 (→ 0 when `back`), `period` ms each way, after `delay` ms. Turned off, it
// stays where it was, so whatever it drives can fade out instead of snapping back.
function useLoop(on: boolean, period: number, delay = 0, back = true, easing = Easing.inOut(Easing.sin)) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!on) return;
    const leg = (to: number) => Animated.timing(v, { toValue: to, duration: period, easing, useNativeDriver: native });
    const a = Animated.sequence([Animated.delay(delay), Animated.loop(back ? Animated.sequence([leg(1), leg(0)]) : leg(1))]);
    a.start();
    return () => a.stop();
  }, [on, v, period, delay, back, easing]);
  return v;
}

// The camera: a slow dolly in for the whole take, and a lean toward the layer in focus
// (closer, and pulled a little toward the middle), like a food film cutting to a close-up.
function Frame({ still, size, target, children }: { still: boolean; size: number; target?: SceneLayer; children: React.ReactNode }) {
  const t = useProgress(300, 0, still);
  const dolly = useLoop(!still, 7000);
  const [cam] = useState(() => ({ z: new Animated.Value(0), x: new Animated.Value(0), y: new Animated.Value(0) }));
  const on = !!target && !still;
  const tx = on ? ((50 - target!.x) / 100) * size * 0.3 : 0;
  const ty = on ? ((50 - target!.y) / 100) * size * 0.3 : 0;
  // Small things get a real close-up; something that already fills the frame, only a nudge.
  const zoom = on ? Math.min(0.1, 3 / target!.w) : 0;
  useEffect(() => {
    const spring = (v: Animated.Value, to: number) => Animated.spring(v, { toValue: to, friction: 9, tension: 32, useNativeDriver: native });
    const a = Animated.parallel([spring(cam.z, zoom), spring(cam.x, tx), spring(cam.y, ty)]);
    a.start();
    return () => a.stop();
  }, [cam, zoom, tx, ty]);
  const scale = Animated.add(dolly.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }), cam.z);
  return (
    <Animated.View
      style={{ position: 'absolute', inset: 0, opacity: t, transform: [{ translateX: cam.x }, { translateY: cam.y }, { scale }] }}
    >
      {children}
    </Animated.View>
  );
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

// Focus for narrated steps: 1 brings the layer toward the screen, -1 sends it back and dims it,
// 0 leaves it as it is.
function useEmphasis(emph: number) {
  const [v] = useState(() => new Animated.Value(emph));
  useEffect(() => {
    const a = Animated.spring(v, { toValue: emph, friction: 8, tension: 45, useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [v, emph]);
  return v;
}

// The layer's box, with the focus applied around its centre. In focus the product lifts off the
// table toward the camera, a warm light comes up behind it and it slowly turns to show itself,
// like a hero shot; the rest steps back out of focus.
function Emph({
  style,
  w,
  size,
  emph,
  still,
  children,
}: {
  style: ReturnType<typeof box>['style'];
  w: number;
  size: number;
  emph: number;
  still: boolean;
  children: React.ReactNode;
}) {
  const v = useEmphasis(emph);
  // How much closer it comes: a lot for a tomato, a little for a pan that fills the stage.
  const near = 1 + Math.min(0.28, (0.08 * size) / w);
  const spin = useLoop(emph > 0 && !still, 5200, 250, false, Easing.linear);
  const lit = v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
  // One slow sway per loop, as wide as the focus is strong, so it fades out with it.
  const turn = Animated.multiply(lerp(spin, SWAY.map((_, k) => k / 8), SWAY), lit);
  const g = w * 1.25;
  return (
    <Animated.View
      style={[
        style,
        { opacity: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.3, 1, 1] }), zIndex: emph > 0 ? 1 : 0 },
      ]}
    >
      {!still && (
        <Animated.View
          style={{
            position: 'absolute',
            left: (style.width - g) / 2,
            top: (style.height - g) / 2,
            width: g,
            height: g,
            borderRadius: g / 2,
            backgroundColor: 'rgba(255,160,90,0.16)',
            boxShadow: `0px 0px ${g * 0.35}px ${g * 0.18}px rgba(255,150,80,0.2)`,
            opacity: lit,
            transform: [{ scale: lit.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        />
      )}
      <Animated.View
        style={{
          flex: 1,
          transform: still
            ? []
            : [
                { perspective: 600 },
                { translateY: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, -0.06 * style.height] }) },
                { scale: v.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.94, 1, near] }) },
                { rotateY: turn.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] }) },
                { rotate: turn.interpolate({ inputRange: [-1, 1], outputRange: ['1.5deg', '-1.5deg'] }) },
              ],
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const SWAY = [0, 0.71, 1, 0.71, 0, -0.71, -1, -0.71, 0];

const lerp = (t: Animated.Value | Animated.AnimatedInterpolation<number>, inputRange: number[], outputRange: number[] | string[]) =>
  t.interpolate({ inputRange, outputRange: outputRange as any, extrapolate: 'clamp' });

// Falling: gravity to the floor (a little stretched on the way down), a squash on impact,
// one small hop and settle. Keyframes at these points of the drop's run.
const FALL = [0, 0.18, 0.36, 0.46, 0.55, 0.66, 0.78, 0.88, 1];
const fallY = [-1.7, -1.52, -0.97, -0.51, 0, -0.14, 0, -0.03, 0];

function entrance(anim: SceneLayer['anim'], t: Animated.Value, h: number) {
  switch (anim) {
    case 'dropIn':
      return {
        transformOrigin: '50% 90%',
        opacity: lerp(t, [0, 0.12, 1], [0, 1, 1]),
        transform: [
          { translateY: lerp(t, FALL, fallY.map((y) => y * h)) },
          { rotate: lerp(t, [0, 0.55, 0.78, 1], ['-35deg', '4deg', '-2deg', '0deg']) },
          { scaleX: lerp(t, FALL, [0.92, 0.92, 0.9, 0.9, 1.2, 0.95, 1.06, 0.99, 1]) },
          { scaleY: lerp(t, FALL, [1.1, 1.1, 1.12, 1.12, 0.78, 1.06, 0.95, 1.01, 1]) },
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
      // Arrives from just in front of the lens: a touch closer and lower, settling into place.
      return {
        opacity: lerp(t, [0, 0.4, 1], [0, 1, 1]),
        transform: [{ translateY: lerp(t, [0, 1], [0.08 * h, 0]) }, { scale: lerp(t, [0, 1], [1.16, 1]) }],
      };
  }
}

const timing: Record<string, [number, (v: number) => number]> = {
  driftIn: [1100, Easing.bezier(0.16, 1, 0.3, 1)],
  dropIn: [1000, Easing.linear],
  dropFade: [1400, Easing.linear],
  zoomIn: [4500, Easing.bezier(0.16, 1, 0.3, 1)],
};

// Pan tossing: every few seconds the pan dips and flicks, what is in it jumps up toward the
// camera with a turn and drops back with a bounce. `toss` is the layer's place in the scene,
// so each piece flies its own height and way round.
const TOSS_MS = 3400;

function tossStyle(t: Animated.Value, pan: boolean, n: number, size: number) {
  if (pan)
    return {
      transform: [
        { translateY: lerp(t, [0, 0.1, 0.2, 0.32, 0.5, 0.6], [0, 0.03 * size, -0.025 * size, 0.01 * size, 0.012 * size, 0]) },
        { rotate: lerp(t, [0, 0.1, 0.2, 0.32, 0.6], ['0deg', '3deg', '-4deg', '0deg', '0deg']) },
      ],
    };
  const lift = size * (0.2 + 0.06 * (n % 3));
  const way = n % 2 ? 1 : -1;
  const o = (n % 4) * 0.015;
  const at = [0, 0.14, 0.24, 0.32, 0.4, 0.5, 0.55, 0.6].map((x) => Math.min(1, x + o));
  return {
    transformOrigin: '50% 90%',
    transform: [
      { translateX: lerp(t, [at[0], at[1], at[5], 1], [0, 0, way * size * 0.03, 0]) },
      { translateY: lerp(t, at, [0, 0.02 * size, -0.75 * lift, -lift, -0.75 * lift, 0, -0.06 * lift, 0]) },
      { rotate: lerp(t, [at[1], at[5]], ['0deg', `${way * 360}deg`]) },
      { scale: lerp(t, [at[1], at[3], at[5]], [1, 1.18, 1]) },
      { scaleY: lerp(t, [at[4], at[5], at[6], at[7]], [1, 0.82, 1.05, 1]) },
    ],
  };
}

function Plain({ layer, size, still, emph, toss }: { layer: SceneLayer; size: number; still: boolean; emph: number; toss?: number }) {
  const { w, h, style } = box(layer, size);
  const anim = layer.anim ?? 'driftIn';
  const [duration, easing] = timing[anim] ?? timing.driftIn;
  const t = useProgress(duration, layer.delay ?? 0, still, easing);
  const bob = useFloat(!!layer.float && !still, h);
  const tossing = useLoop(toss !== undefined && !still, TOSS_MS, 2400, false, Easing.linear);
  return (
    <Emph style={style} w={w} size={size} emph={emph} still={still}>
      <Animated.View style={[{ flex: 1 }, entrance(anim, t, h)]}>
        <Animated.View
          style={[{ flex: 1, transform: [{ translateY: bob }] }, toss !== undefined && tossStyle(tossing, layer.toss === 'pan', toss, size)]}
        >
          <Image source={layer.src} style={{ flex: 1 }} contentFit="contain" />
        </Animated.View>
      </Animated.View>
    </Emph>
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
function Cut({ layer, size, still, emph }: { layer: SceneLayer; size: number; still: boolean; emph: number }) {
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
    <Emph style={style} w={w} size={size} emph={emph} still={still}>
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
    </Emph>
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
