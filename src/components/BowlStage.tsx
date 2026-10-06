import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import type { BowlBit } from '../data/narration';
import type { SceneLayer } from '../data/scenes';
import { StageScene, useReduceMotion } from './StageScene';

// A narrated step: the step's scene on top and, under it, the bowl the whole recipe goes into.
// When a hands-on line is confirmed, what it makes flies from the scene into the bowl and stays
// there; "stir" spins the bowl's contents, and serving swaps the bowl for the real dish.
// The bowl is drawn, not a picture: a white rim and a shaded inside, squashed into a 3/4 view.
// Food has weight here: pieces lift toward the camera before they fly, the bowl dips when they
// land, stirring tosses the contents, and the served dish turns slowly like a turntable shot.

const native = Platform.OS !== 'web';
const FLIGHT = 760;
const STAGGER = 70;

export type BowlItem = { key: string; bit: BowlBit; born: number };
export type Flight = { key: number; from: number; bits: BowlBit[] };

type Props = {
  layers: SceneLayer[];
  size: number;
  active: boolean;
  focus?: number;
  items: BowlItem[];
  // The key of the latest "готово": items born with it pop in (after their flight, if any).
  fresh: number;
  flight?: Flight;
  stir: number;
  served?: { src: number };
};

export function BowlStage({ layers, size, active, focus, items, fresh, flight, stir, served }: Props) {
  const still = useReduceMotion();
  const B = size * 0.9;
  const rimTop = size * 0.92;
  const cx = size / 2;
  const cy = rimTop + B * 0.25;
  const inner = B * 0.86;
  // Where a bit lands, in this view's coordinates (the inside is squashed to half height).
  const spot = (b: BowlBit) => ({ x: cx + ((b.x - 50) / 100) * inner, y: cy + ((b.y - 50) / 100) * inner * 0.5 });
  const flying = flight && !still && layers[flight.from]?.src !== undefined;
  const bump = useBump(flying ? flight!.key : 0, FLIGHT + 40, stir, still);

  return (
    <View style={{ width: size, height: cy + B * 0.4 }} pointerEvents="none">
      <StageScene layers={layers} size={size} active={active} focus={focus} />

      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: `50% ${cy + B * 0.3}px`,
          transform: [
            { translateY: bump.interpolate({ inputRange: [-1, 0, 1], outputRange: [-B * 0.03, 0, B * 0.025] }) },
            { scaleX: bump.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.98, 1, 1.025] }) },
            { scaleY: bump.interpolate({ inputRange: [-1, 0, 1], outputRange: [1.02, 1, 0.97] }) },
          ],
        }}
      >
        {/* The bowl's body: a deeper ellipse peeking out under the rim. */}
        <View style={{ position: 'absolute', left: cx - B / 2, top: cy + B * 0.06 - B / 2, width: B, height: B, transform: [{ scaleY: 0.66 }] }}>
          <LinearGradient colors={['#FFFFFF', '#CFCBC3']} style={{ flex: 1, borderRadius: B / 2 }} />
        </View>
        {/* The rim, and the inside the contents sit in. */}
        <View style={{ position: 'absolute', left: cx - B / 2, top: cy - B / 2, width: B, height: B, transform: [{ scaleY: 0.5 }] }}>
          <View style={{ flex: 1, borderRadius: B / 2, backgroundColor: '#F7F5F0', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }}>
              <LinearGradient colors={['#C9C5BD', '#EFECE6']} style={{ position: 'absolute', inset: 0 }} />
              <Contents items={items} inner={inner} fresh={fresh} delayed={!!flying} stir={stir} still={still} hidden={!!served} />
            </View>
          </View>
          {served && <Served src={served.src} size={B} still={still} />}
        </View>
      </Animated.View>

      {flying &&
        flight!.bits.map((b, n) => (
          <Flyer
            key={`${flight!.key}.${n}`}
            layer={layers[flight!.from]}
            bit={b}
            size={size}
            to={spot(b)}
            inner={inner}
            delay={n * STAGGER}
            buzz={n === 0}
          />
        ))}
    </View>
  );
}

// Everything in the bowl. Stirring turns it all once around.
function Contents({
  items,
  inner,
  fresh,
  delayed,
  stir,
  still,
  hidden,
}: {
  items: BowlItem[];
  inner: number;
  fresh: number;
  delayed: boolean;
  stir: number;
  still: boolean;
  hidden: boolean;
}) {
  const [turn] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!stir || still) return;
    turn.setValue(0);
    const a = Animated.timing(turn, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [stir, still, turn]);
  useEffect(() => {
    const a = Animated.timing(fade, { toValue: hidden ? 0 : 1, duration: 500, useNativeDriver: native });
    a.start();
    return () => a.stop();
  }, [hidden, fade]);
  // Drawn bits (leaves, sauce) first so the cutouts sit on top of the leaf bed.
  const leaves = items.filter((i) => i.bit.fx === 'leaves');
  const sauce = items.filter((i) => i.bit.fx === 'sauce');
  const cutouts = items.filter((i) => !i.bit.fx);
  let n = 0;
  const pop = (i: BowlItem) => (i.born === fresh ? (delayed ? FLIGHT + n++ * STAGGER : 0) : -1);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fade,
        // Tossed rather than spun: it all jumps up toward the camera, turns over and drops back.
        transform: [
          { translateY: turn.interpolate({ inputRange: [0, 0.35, 0.75, 0.88, 1], outputRange: [0, -inner * 0.1, 0, -inner * 0.015, 0] }) },
          { scale: turn.interpolate({ inputRange: [0, 0.35, 0.75, 1], outputRange: [1, 1.12, 0.98, 1] }) },
          { rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      {leaves.map((i) => (
        <Pop key={i.key} delay={i.born === fresh ? 0 : -1} still={still} style={{ position: 'absolute', inset: 0 }}>
          <Leaves inner={inner} />
        </Pop>
      ))}
      {cutouts.map((i) => {
        const w = (i.bit.w / 100) * inner;
        const h = w * (i.bit.aspect ?? 1);
        return (
          <Pop
            key={i.key}
            delay={pop(i)}
            still={still}
            style={{
              position: 'absolute',
              left: (i.bit.x / 100) * inner - w / 2,
              top: (i.bit.y / 100) * inner - h / 2,
              width: w,
              height: h,
              transform: [{ rotate: `${i.bit.rotate ?? 0}deg` }],
            }}
          >
            <Image source={i.bit.src} style={{ flex: 1 }} contentFit="contain" />
          </Pop>
        );
      })}
      {sauce.map((i) => (
        <Pop key={i.key} delay={i.born === fresh ? 0 : -1} still={still} style={{ position: 'absolute', inset: 0 }}>
          <Sauce inner={inner} />
        </Pop>
      ))}
    </Animated.View>
  );
}

// Lands with a little bounce after `delay` ms; -1 means it was already there.
function Pop({ delay, still, style, children }: { delay: number; still: boolean; style: any; children: React.ReactNode }) {
  const [t] = useState(() => new Animated.Value(delay < 0 || still ? 1 : 0));
  useEffect(() => {
    if (delay < 0 || still) return;
    const a = Animated.sequence([Animated.delay(delay), Animated.spring(t, { toValue: 1, friction: 4.5, tension: 140, useNativeDriver: native })]);
    a.start();
    return () => a.stop();
  }, [t, delay, still]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
          // Lands flat and springs back: wider and lower first, then its own shape.
          transform: [
            ...(style.transform ?? []),
            { scaleX: t.interpolate({ inputRange: [0, 1, 2], outputRange: [1.25, 1, 0.75] }) },
            { scaleY: t.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 1.4] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// A torn-lettuce bed: overlapping leaves fanned around the bowl.
const LEAVES = Array.from({ length: 11 }, (_, k) => {
  const a = (k / 11) * Math.PI * 2;
  const r = k % 2 ? 0.26 : 0.14;
  return { x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r, w: 0.34 + (k % 3) * 0.05, rot: (a * 180) / Math.PI + 90, light: k % 3 === 0 };
});

function Leaves({ inner }: { inner: number }) {
  return (
    <>
      {LEAVES.map((l, k) => {
        const w = l.w * inner;
        const h = w * 0.62;
        return (
          <View
            key={k}
            style={{
              position: 'absolute',
              left: l.x * inner - w / 2,
              top: l.y * inner - h / 2,
              width: w,
              height: h,
              transform: [{ rotate: `${l.rot}deg` }],
            }}
          >
            <LinearGradient
              colors={l.light ? ['#B9DB7A', '#5E9E35'] : ['#8CC152', '#3F7A26']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderTopLeftRadius: h, borderBottomRightRadius: h, borderTopRightRadius: h * 0.3, borderBottomLeftRadius: h * 0.3 }}
            />
          </View>
        );
      })}
    </>
  );
}

// Mustard dressing: glossy drizzle blobs with whole seeds.
const DRIZZLE = Array.from({ length: 11 }, (_, k) => ({
  x: 0.5 + Math.cos(k * 2.4) * (0.06 + (k % 4) * 0.08),
  y: 0.5 + Math.sin(k * 2.4) * (0.06 + (k % 4) * 0.08),
  w: 0.12 + (k % 3) * 0.05,
  rot: k * 47,
}));

function Sauce({ inner }: { inner: number }) {
  return (
    <>
      {DRIZZLE.map((d, k) => {
        const w = d.w * inner;
        return (
          <View
            key={k}
            style={{
              position: 'absolute',
              left: d.x * inner - w / 2,
              top: d.y * inner - w * 0.11,
              width: w,
              height: w * 0.22,
              transform: [{ rotate: `${d.rot}deg` }],
            }}
          >
            <LinearGradient colors={['#A8541F', '#5E230B']} style={{ flex: 1, borderRadius: w, opacity: 0.8 }} />
            <View
              style={{
                position: 'absolute',
                left: w * 0.25,
                top: w * 0.03,
                width: w * 0.12,
                height: w * 0.12,
                borderRadius: w,
                backgroundColor: '#D9A441',
              }}
            />
            <View
              style={{
                position: 'absolute',
                left: w * 0.6,
                top: w * 0.06,
                width: w * 0.1,
                height: w * 0.1,
                borderRadius: w,
                backgroundColor: '#E2B455',
              }}
            />
          </View>
        );
      })}
    </>
  );
}

// The real, finished dish taking the bowl's place: it comes up toward the camera, then turns
// slowly on the spot like a turntable shot (the bowl's 3/4 squash makes the turn read as 3D).
function Served({ src, size, still }: { src: number; size: number; still: boolean }) {
  const [t] = useState(() => new Animated.Value(still ? 1 : 0));
  const [spin] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const a = Animated.parallel([
      Animated.spring(t, { toValue: 1, friction: 7, tension: 40, useNativeDriver: native }),
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: native })),
    ]);
    a.start();
    return () => a.stop();
  }, [t, spin, still]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        inset: 0,
        opacity: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.3, 1.06] }) },
          { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
        ],
      }}
    >
      <Image source={src} style={{ flex: 1 }} contentFit="contain" />
    </Animated.View>
  );
}

// The bowl's reaction: a dip with a little wobble when food lands in it (after `after` ms), and a
// lift then a dip when it gets stirred. -1 is up, 1 is down.
function useBump(landing: number, after: number, stir: number, still: boolean) {
  const [v] = useState(() => new Animated.Value(0));
  const settle = () => Animated.spring(v, { toValue: 0, friction: 4, tension: 160, useNativeDriver: native });
  const to = (x: number, ms: number) => Animated.timing(v, { toValue: x, duration: ms, easing: Easing.out(Easing.quad), useNativeDriver: native });
  useEffect(() => {
    if (!landing || still) return;
    const a = Animated.sequence([Animated.delay(after), to(1, 90), settle()]);
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landing, after, still]);
  useEffect(() => {
    if (!stir || still) return;
    const a = Animated.sequence([to(-1, 380), Animated.delay(200), to(1, 220), settle()]);
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stir, still]);
  return v;
}

// One piece flying from its scene layer into the bowl on an arc, shrinking to its size there.
function Flyer({
  layer,
  bit,
  size,
  to,
  inner,
  delay,
  buzz,
}: {
  layer: SceneLayer;
  bit: BowlBit;
  size: number;
  to: { x: number; y: number };
  inner: number;
  delay: number;
  buzz: boolean;
}) {
  const [t] = useState(() => new Animated.Value(0));
  const target = (bit.w / 100) * inner;
  // A piece leaving a bigger layer (shrimps from the pan) starts at a believable size, not the pan's.
  const w = bit.src && bit.src !== layer.src ? Math.min((layer.w / 100) * size, target * 1.8) : (layer.w / 100) * size;
  const h = w * ((bit.src ? bit.aspect : layer.aspect) ?? 1);
  const from = { x: (layer.x / 100) * size, y: (layer.y / 100) * size };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  useEffect(() => {
    const a = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, { toValue: 1, duration: FLIGHT, easing: Easing.bezier(0.45, 0, 0.6, 1), useNativeDriver: native }),
    ]);
    a.start(({ finished }) => {
      if (finished && buzz) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    });
    return () => a.stop();
  }, [t, delay, buzz]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: from.x - w / 2,
        top: from.y - h / 2,
        width: w,
        height: h,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.9, 1], outputRange: [0, 1, 1, 0] }),
        // A beat of lift toward the camera, then a high arc down into the bowl with a turn.
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0, dx] }) },
          {
            translateY: t.interpolate({
              inputRange: [0, 0.18, 0.45, 0.7, 1],
              outputRange: [0, -size * 0.05, dy * 0.15 - size * 0.2, dy * 0.55, dy],
            }),
          },
          { rotate: t.interpolate({ inputRange: [0, 0.18, 1], outputRange: ['0deg', '-8deg', `${(bit.rotate ?? 0) + 200}deg`] }) },
          { scale: t.interpolate({ inputRange: [0, 0.18, 0.45, 1], outputRange: [1, 1.22, 1.1, target / w] }) },
        ],
      }}
    >
      <Image source={bit.src ?? layer.src} style={{ flex: 1 }} contentFit="contain" />
    </Animated.View>
  );
}
