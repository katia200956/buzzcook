// Екран "Карта поруч": нативна карта закладів (Київ і Львів поки що; нові міста додаються як *-slim.json).
import { Stack } from 'expo-router';

import { FoodMap } from '../components/foodmap/FoodMap';
import type { Place } from '../components/foodmap/geo';

const PLACES: Place[] = [
  ...(require('../data/map/kyiv-slim.json') as Place[]),
  ...(require('../data/map/lviv-slim.json') as Place[]),
];

export default function FoodMapScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FoodMap places={PLACES} />
    </>
  );
}
