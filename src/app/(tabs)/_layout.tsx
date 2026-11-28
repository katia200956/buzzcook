import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useStore } from '../../components/store';

export default function TabsLayout() {
  const { ready, user, guest, onboarded } = useStore();
  // First launch: sign in (or choose "пізніше") before the app opens.
  if (ready && !user && !guest) return <Redirect href="/login" />;
  // Then a few questions for the calorie norm and food rules (skippable).
  if (ready && !onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' }, animation: 'none' }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="process" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />
      {/* Not a tab button: our own TabBar draws only the main tabs. SDK 58 makes href: null routes unreachable, so it stays a plain screen. */}
      <Tabs.Screen name="recipe/[id]" />
    </Tabs>
  );
}
