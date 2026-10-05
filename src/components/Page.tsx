import { ReactNode, useState } from 'react';
import { ScrollView } from 'react-native';
import { Header } from './Header';
import { Menu } from './Menu';
import { Screen } from './Screen';
import { useScale } from './scale';

// Plain page without the belt (Figma "recipe process"): header on top, text column from x78.
export function Page({ children }: { children: ReactNode }) {
  const k = useScale();
  const [menu, setMenu] = useState(false);
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: 205 * k, paddingBottom: 150 * k, paddingLeft: 78 * k, paddingRight: 40 * k }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      <Header logo={false} onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
    </Screen>
  );
}
