import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { Animated, Easing, View } from 'react-native';

const puff = require('../../../assets/recipes/fx/puff.png');
const glowImg = require('../../../assets/recipes/fx/glow.png');
// Stable pseudo-random numbers in 0..1, so each puff keeps its own path between renders.
const rnd = (i: number, salt: number) => { const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return x - Math.floor(x); };

// Slow steam wisps over hot food: soft white puffs drift up, swell and fade, each on its own loop
// with a little sideways sway so they never move in step. `heat` scales how many and how visible.
export function Steam({ width, height, heat, glow, active, cy = 0.42 }: { width: number; height: number; heat: number; glow?: boolean; active: boolean; cy?: number }) {
  const n = Math.round(4 + heat * 6);
  const puffs = useMemo(
    () => Array.from({ length: n }, (_, i) => ({ v: new Animated.Value(0), x: 0.3 + rnd(i, 1) * 0.4, d: 3600 + rnd(i, 2) * 2400, delay: (i * 4200) / n, sway: (rnd(i, 3) - 0.5) * 0.12 })),
    [n],
  );
  const g = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    if (!active || heat <= 0) return;
    const loops = puffs.map((p) =>
      Animated.loop(Animated.sequence([Animated.delay(p.delay), Animated.timing(p.v, { toValue: 1, duration: p.d, easing: Easing.out(Easing.quad), useNativeDriver: true }), Animated.timing(p.v, { toValue: 0, duration: 0, useNativeDriver: true })])),
    );
    loops.forEach((l) => l.start());
    const gl = glow ? Animated.loop(Animated.sequence([Animated.timing(g, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(g, { toValue: 0.4, duration: 900, useNativeDriver: true })])) : null;
    gl?.start();
    return () => {
      loops.forEach((l) => l.stop());
      gl?.stop();
    };
  }, [active, heat, glow, puffs, g]);

  if (!active || heat <= 0) return null;
  const s = width * 0.34;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height }}>
      {glow && (
        <Animated.View style={{ position: 'absolute', left: width * 0.22, top: height * (cy - 0.06), width: width * 0.56, height: height * 0.1, opacity: g.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.32] }) }}>
          <Image source={glowImg} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      )}
      {puffs.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: width * p.x - s / 2, top: height * cy - s / 2, width: s, height: s * 1.3,
            opacity: p.v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.07 + heat * 0.06, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.32] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, width * p.sway, -width * p.sway * 0.5] }) },
              { scale: p.v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.7] }) },
            ],
          }}
        >
          <Image source={puff} style={{ width: '100%', height: '100%' }} />
        </Animated.View>
      ))}
    </View>
  );
}
