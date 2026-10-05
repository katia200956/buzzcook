import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';
import { useStore } from '../../components/store';

export default function TabsLayout() {
  const { ready, user, guest } = useStore();
  // First launch: sign in (or choose "пізніше") before the app opens.
  if (ready && !user && !guest) return <Redirect href="/login" />;

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
      <Tabs.Screen name="recipe/[id]" options={{ href: null }} />
    </Tabs>
  );
}
