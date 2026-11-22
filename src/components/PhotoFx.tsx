import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { Fx, PhotoStep } from '../data';

// A background-free step photo that lives a little: it breathes, and each step adds one small
// code-drawn effect (oil bubbles in the pan, a stream of condensed milk, flour falling into
// the bowl). Everything is plain Animated views, so it costs nothing to make and runs offline.
export function PhotoFx({ step, width, active = true }: { step: PhotoStep; width: number; active?: boolean }) {
  const height = width / step.aspect;
  const [breath] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }).start();
    loop.start();
    return () => loop.stop();
  }, [active, breath, enter]);

  const settle = step.fx === 'settle';
  const style = {
    width,
    height,
    transform: [
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
      { rotate: breath.interpolate({ inputRange: [0, 1], outputRange: ['-0.6deg', '0.6deg'] }) },
      ...(settle ? [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }] : []),
    ],
    opacity: settle ? enter.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }) : 1,
  };

  return (
    <View style={{ width, height }} accessibilityRole="image">
      <Animated.View style={style}>
        <Image source={step.src} style={{ width, height }} contentFit="contain" transition={250} />
      </Animated.View>
      {active && <Effect fx={step.fx} width={width} height={height} />}
    </View>
  );
}

function Effect({ fx, width, height }: { fx: Fx; width: number; height: number }) {
  if (fx === 'sizzle') return <Sizzle width={width} height={height} />;
  if (fx === 'drizzle') return <Drizzle width={width} height={height} />;
  if (fx === 'sprinkle') return <Sprinkle width={width} height={height} />;
  if (fx === 'mash') return <Mash width={width} height={height} />;
  return null;
}

// A repeating 0→1 driver with its own delay, for one particle.
function useCycle(duration: number, delay: number) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay]);
  return v;
}

function seeded(n: number, seed: number) {
  let s = seed;
  return Array.from({ length: n }, () => {
    s = (s * 16807) % 2147483647;
    const a = (s % 1000) / 1000;
    s = (s * 16807) % 2147483647;
    const b = (s % 1000) / 1000;
    s = (s * 16807) % 2147483647;
    const c = (s % 1000) / 1000;
    return [a, b, c] as const;
  });
}

// Oil bubbles popping across the pan, and a soft wisp of steam rising above it.
function Sizzle({ width, height }: { width: number; height: number }) {
  const pts = useMemo(() => seeded(16, 7), []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {pts.map(([a, b, c], i) => {
        const ang = a * Math.PI * 2;
        const r = 0.12 + b * 0.24;
        return (
          <Bubble
            key={i}
            x={(0.55 + Math.cos(ang) * r * 0.85) * width}
            y={(0.46 + Math.sin(ang) * r) * height}
            size={(3 + c * 5) * (width / 300)}
            delay={Math.round(c * 1400 + i * 90)}
          />
        );
      })}
      {[0, 1, 2].map((i) => (
        <Steam key={i} x={(0.4 + i * 0.13) * width} y={0.3 * height} w={width * 0.16} delay={i * 900} />
      ))}
    </View>
  );
}

function Bubble({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const v = useCycle(700, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: size,
        borderWidth: 1,
        borderColor: 'rgba(255,240,200,0.85)',
        backgroundColor: 'rgba(255,236,190,0.18)',
        opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.9, 0.6, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1.3] }) }],
      }}
    />
  );
}

function Steam({ x, y, w, delay }: { x: number; y: number; w: number; delay: number }) {
  const v = useCycle(2600, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y,
        width: w,
        height: w * 1.6,
        borderRadius: w,
        backgroundColor: 'rgba(255,255,255,0.16)',
        opacity: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -w * 1.8] }) },
          { scaleX: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] }) },
        ],
      }}
    />
  );
}

// A thin stream of condensed milk pours onto the plate, then a drop lands and spreads.
function Drizzle({ width, height }: { width: number; height: number }) {
  const v = useCycle(2400, 600);
  const x = 0.42 * width;
  const land = 0.36 * height;
  const top = 0.04 * height;
  const w = Math.max(2, width / 110);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: x - w / 2,
          top,
          width: w,
          height: land - top,
          borderRadius: w,
          backgroundColor: '#F3E8C4',
          transformOrigin: 'top',
          opacity: v.interpolate({ inputRange: [0, 0.05, 0.6, 0.75], outputRange: [0, 1, 1, 0] }),
          transform: [{ scaleY: v.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }) }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: x - w * 3,
          top: land - w,
          width: w * 6,
          height: w * 2.4,
          borderRadius: w * 3,
          backgroundColor: '#F3E8C4',
          opacity: v.interpolate({ inputRange: [0, 0.28, 0.35, 0.9, 1], outputRange: [0, 0, 1, 1, 0] }),
          transform: [{ scaleX: v.interpolate({ inputRange: [0.3, 0.7], outputRange: [0.3, 1.6], extrapolate: 'clamp' }) }],
        }}
      />
    </View>
  );
}

// Flour and sugar dust falling into the bowl.
function Sprinkle({ width, height }: { width: number; height: number }) {
  const pts = useMemo(() => seeded(14, 11), []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {pts.map(([a, b, c], i) => (
        <Fleck
          key={i}
          x={(0.36 + a * 0.22) * width}
          from={-0.05 * height}
          to={(0.3 + b * 0.2) * height}
          size={(2 + c * 2.5) * (width / 300)}
          delay={Math.round(i * 160 + c * 500)}
        />
      ))}
    </View>
  );
}

function Fleck({ x, from, to, size, delay }: { x: number; from: number; to: number; size: number; delay: number }) {
  const v = useCycle(1300, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: 0,
        width: size,
        height: size,
        borderRadius: size,
        backgroundColor: '#FFFDF6',
        borderWidth: 0.5,
        borderColor: 'rgba(170,150,120,0.5)',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }],
      }}
    />
  );
}

// The fork mashes the curd: little crumbs hop up from the bowl and fall back.
function Mash({ width, height }: { width: number; height: number }) {
  const pts = useMemo(() => seeded(10, 5), []);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {pts.map(([a, b, c], i) => (
        <Crumb key={i} x={(0.3 + a * 0.22) * width} y={(0.38 + b * 0.25) * height} size={(3 + c * 4) * (width / 300)} delay={Math.round(i * 220)} />
      ))}
    </View>
  );
}

function Crumb({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const v = useCycle(800, delay);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size * 0.8,
        borderRadius: size,
        backgroundColor: '#FFFCF2',
        borderWidth: 0.5,
        borderColor: 'rgba(170,150,120,0.6)',
        opacity: v.interpolate({ inputRange: [0, 0.1, 0.9, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 3, 0] }) }],
      }}
    />
  );
}
