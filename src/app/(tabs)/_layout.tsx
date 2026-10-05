import { Tabs } from 'expo-router';
import { TabBar } from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="process" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="recipe/[id]" options={{ href: null }} />
    </Tabs>
  );
}
