import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Belt } from '../components/Belt';
import { Plate } from '../components/Plate';
import { PosterPanel } from '../components/PosterRow';
import { Screen } from '../components/Screen';
import { useScale } from '../components/scale';
import { Provider, useStore } from '../components/store';
import { byId } from '../data';
import { titleStyle, useTheme } from '../theme';

// Sign-in: Apple, Google or e-mail, or skip for now. Sign-in is a stub until real keys exist:
// the button waits a beat and stores the chosen provider locally.
const buttons: { id: Provider; label: string; icon: number; bg: string; fg: string; rim?: string }[] = [
  { id: 'apple', label: 'Продовжити з Apple', icon: require('../../assets/icons/apple.svg'), bg: '#000000', fg: '#FFFFFF' },
  { id: 'google', label: 'Продовжити з Google', icon: require('../../assets/icons/google.svg'), bg: '#FFFFFF', fg: '#1F1F1F', rim: 'rgba(0,0,0,0.12)' },
  { id: 'email', label: 'Увійти з e-mail', icon: require('../../assets/icons/mail.svg'), bg: 'rgba(24,24,27,0.72)', fg: '#FFFFFF', rim: 'rgba(255,255,255,0.25)' },
];

export default function Login() {
  const k = useScale();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, continueAsGuest } = useStore();
  const [busy, setBusy] = useState<Provider | null>(null);
  const hero = byId('salat')!;

  const go = (p: Provider) => {
    if (busy) return;
    setBusy(p);
    setTimeout(() => {
      signIn(p);
      router.replace('/');
    }, 700);
  };

  return (
    <Screen>
      {t.poster ? (
        <PosterPanel tilt={-4} style={{ left: 14 * k, top: insets.top + 136 * k, width: 236 * k, height: 128 * k, borderRadius: 26 * k }} />
      ) : (
        <Belt />
      )}
      <View style={{ position: 'absolute', left: 31 * k, top: insets.top + 90 * k }}>
        <Plate recipe={hero} size={199 * k} />
      </View>

      {/* Fade the belt out behind the text so the title and buttons read cleanly. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${t.bg[1]}00`, `${t.bg[1]}E6`, t.bg[1]]}
        locations={[0, 0.45, 1]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' }}
      />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: 22 * k, paddingBottom: insets.bottom + 28 * k }}>
        <View style={[s.logo, { width: 56 * k, height: 56 * k, marginBottom: 14 * k }]}>
          <Image source={require('../../assets/figma/target.svg')} style={{ width: 38 * k, height: 38 * k }} />
        </View>
        <Text style={titleStyle(t, 52 * k)}>buzzcook</Text>
        <Text style={{ fontFamily: t.font, fontSize: 22 * k, lineHeight: 26 * k, color: t.textSoft, marginBottom: 24 * k }}>
          план на тиждень і готування крок за кроком
        </Text>

        <View style={{ gap: 10 * k }}>
          {buttons.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => go(b.id)}
              disabled={!!busy}
              accessibilityRole="button"
              accessibilityLabel={b.label}
              style={({ pressed }) => [
                s.btn,
                { height: 54 * k, gap: 10 * k, backgroundColor: b.bg, borderColor: b.rim ?? b.bg, opacity: busy && busy !== b.id ? 0.5 : 1 },
                { transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              {busy === b.id ? (
                <ActivityIndicator color={b.fg} />
              ) : (
                <>
                  <Image source={b.icon} style={{ width: 22 * k, height: 22 * k }} />
                  <Text style={{ fontFamily: t.fontMedium, fontSize: 23 * k, color: b.fg }}>{b.label}</Text>
                </>
              )}
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            continueAsGuest();
            router.replace('/');
          }}
          hitSlop={10}
          style={{ alignSelf: 'center', marginTop: 16 * k }}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: t.font, fontSize: 20 * k, color: t.text, textDecorationLine: 'underline' }}>пізніше</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  logo: { borderRadius: 100, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: 100, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 16px rgba(0,0,0,0.18)' },
});
