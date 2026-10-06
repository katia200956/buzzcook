import { Image } from 'expo-image';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Glass } from './Glass';
import { useScale } from './scale';

const icons: Record<string, number> = {
  index: require('../../assets/figma/home.svg'),
  plan: require('../../assets/icons/table.svg'),
  process: require('../../assets/figma/clipboard.svg'),
  cart: require('../../assets/figma/cart.svg'),
  profile: require('../../assets/figma/user.svg'),
};
const labels: Record<string, string> = { index: 'стрічка', plan: 'план', process: 'етапи', cart: 'покупки', profile: 'профіль' };
const MAIN = ['index', 'plan', 'process', 'cart'];

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

// Tab bar in the Apple Music layout that the Figma bar already hints at: a glass capsule
// with the main tabs (icon over label, a soft pill slides under the active one) and a
// separate round glass button for the profile, like Apple Music's search bubble.
export function TabBar({ state, navigation }: TabBarProps) {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const focused = state.routes[state.index]?.name;
  const active = icons[focused] ? focused : 'index';
  const routeOf = (name: string) => state.routes.find((r) => r.name === name)!;

  const barW = 296 * k;
  const slot = (barW - 12 * k) / MAIN.length;
  const idx = Math.max(0, MAIN.indexOf(active));
  const [pill] = useState(() => new Animated.Value(idx));
  useEffect(() => {
    Animated.spring(pill, { toValue: MAIN.indexOf(active), useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
  }, [active, pill]);

  const press = (name: string) => {
    const route = routeOf(name);
    const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!e.defaultPrevented && focused !== name) navigation.navigate(name);
  };
  const tint = t.tabTint;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 4 * k, 18 * k), alignItems: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 * k }}>
        <Glass radius={100} style={{ width: barW, height: 62 * k, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 * k }}>
          {MAIN.includes(active) && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 6 * k,
                top: 5 * k,
                width: slot,
                height: 52 * k,
                borderRadius: 100,
                backgroundColor: t.poster ? t.cta : 'rgba(255,255,255,0.20)',
                transform: [{ translateX: Animated.multiply(pill, slot) }],
              }}
            />
          )}
          {MAIN.map((name) => {
            const on = name === active;
            return (
              <Pressable
                key={name}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={labels[name]}
                onPress={() => press(name)}
                style={{ width: slot, height: 52 * k, alignItems: 'center', justifyContent: 'center', gap: 2 * k }}
              >
                <Image source={icons[name]} tintColor={t.poster && on ? '#FFFFFF' : tint} style={{ width: 22 * k, height: 22 * k, opacity: on ? 1 : 0.55 }} />
                <Text style={{ fontFamily: t.font, fontSize: 14 * k, lineHeight: 15 * k, color: t.poster && on ? '#FFFFFF' : tint, opacity: on ? 1 : 0.55 }}>
                  {labels[name]}
                </Text>
              </Pressable>
            );
          })}
        </Glass>

        <Pressable accessibilityRole="tab" accessibilityState={{ selected: active === 'profile' }} accessibilityLabel={labels.profile} onPress={() => press('profile')}>
          <Glass radius={100} strong={active === 'profile'} style={{ width: 62 * k, height: 62 * k, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={icons.profile} tintColor={tint} style={{ width: 24 * k, height: 24 * k, opacity: active === 'profile' ? 1 : 0.55 }} />
          </Glass>
        </Pressable>
      </View>
    </View>
  );
}
