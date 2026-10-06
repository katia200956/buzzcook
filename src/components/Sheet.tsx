import { BlurView } from 'expo-blur';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { useScale } from './scale';

// Bottom sheet that opens like Apple's: springs up from the bottom over a dimmed screen,
// has a grabber, and follows your finger when dragged down to close.
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [leaving, setLeaving] = useState(false);
  const [y] = useState(() => new Animated.Value(height));
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    y.setValue(height);
    Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 260, mass: 0.9 }).start();
  }, [open, y, height]);

  // Slide down first, then tell the parent it is closed.
  const close = () => {
    setLeaving(true);
    Animated.timing(y, { toValue: height, duration: 240, useNativeDriver: true }).start(() => {
      setLeaving(false);
      onClose();
    });
  };
  useEffect(() => {
    closeRef.current = close;
  });

  // closeRef is only read inside the gesture callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 1.1) closeRef.current();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 260 }).start();
      },
    }),
  );

  const dim = y.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Modal visible={open || leaving} transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: dim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Закрити" />
      </Animated.View>
      <Animated.View
        {...pan.panHandlers}
        style={[
          s.sheet,
          {
            paddingBottom: insets.bottom + 24 * k,
            borderTopLeftRadius: 34 * k,
            borderTopRightRadius: 34 * k,
            transform: [{ translateY: y }],
          },
        ]}
      >
        <BlurView intensity={60} tint={t.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.sheet }]} />
        <View style={[s.grabber, { marginTop: 8 * k, marginBottom: 14 * k, width: 38 * k, height: 5 * k, backgroundColor: t.textSoft }]} />
        <View style={{ paddingHorizontal: 22 * k }}>{children}</View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden', boxShadow: '0px -8px 30px rgba(0,0,0,0.25)' },
  grabber: { alignSelf: 'center', borderRadius: 3 },
});
