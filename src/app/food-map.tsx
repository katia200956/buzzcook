// Екран "Карта поруч": нативна карта закладів (11 міст України; нові міста додаються як *-slim.json).
import { Stack } from 'expo-router';

import { FoodMap } from '../components/foodmap/FoodMap';
import type { Place } from '../components/foodmap/geo';

// Усі міста з map-export; нове місто = новий рядок тут.
const PLACES: Place[] = [
  ...(require('../data/map/chernihiv-slim.json') as Place[]),
  ...(require('../data/map/chernivtsi-slim.json') as Place[]),
  ...(require('../data/map/dnipro-slim.json') as Place[]),
  ...(require('../data/map/ivano-frankivsk-slim.json') as Place[]),
  ...(require('../data/map/kharkiv-slim.json') as Place[]),
  ...(require('../data/map/kyiv-slim.json') as Place[]),
  ...(require('../data/map/lviv-slim.json') as Place[]),
  ...(require('../data/map/odesa-slim.json') as Place[]),
  ...(require('../data/map/poltava-slim.json') as Place[]),
  ...(require('../data/map/vinnytsia-slim.json') as Place[]),
  ...(require('../data/map/zaporizhzhia-slim.json') as Place[]),
];

export default function FoodMapScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FoodMap places={PLACES} />
    </>
  );
}
