// Карта закладів поруч: нативна MapLibre, справжня геолокація, денний і нічний стиль.
// Потрібна своя збірка (development build), в Expo Go не працює.
import {
  Camera, type CameraRef, GeoJSONSource, Images, Layer, LocationManager, Map, type MapRef, UserLocation,
} from '@maplibre/maplibre-react-native';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Dimensions, FlatList, Linking, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  buildTrees, cuisineText, distance, distText, type Dish, type LngLat, type Place, placesToGeoJSON, walkText,
} from './geo';
import { buildStyle, type MapTheme, PALETTES, PARK_LAYERS } from './style';

const WIN = require('../../../assets/map/win.png');
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const PEEK = 300;

type Props = {
  places: Place[];
  /** Повне меню закладу, якщо застосунок його має. Інакше показуємо dishes із самої точки. */
  getMenu?: (id: string) => Promise<Dish[] | null>;
  /** Центр, коли геолокація ще не відома (наприклад, центр обраного міста). */
  fallbackCenter?: LngLat;
  theme?: MapTheme;
};

const autoTheme = (): MapTheme => { const h = new Date().getHours(); return h >= 18 || h < 7 ? 'night' : 'day'; };

export const FoodMap = memo(function FoodMap({ places, getMenu, fallbackCenter = [30.5236, 50.4503], theme: forced }: Props) {
  const insets = useSafeAreaInsets();
  const [theme, setTheme] = useState<MapTheme>(forced ?? autoTheme());
  const C = PALETTES[theme];
  const mapStyle = useMemo(() => buildStyle(theme), [theme]);
  const mapRef = useRef<MapRef>(null);
  const camRef = useRef<CameraRef>(null);

  // ---- геолокація ----
  const [me, setMe] = useState<LngLat | null>(null);
  useEffect(() => {
    let alive = true;
    const onPos = (p: { coords: { longitude: number; latitude: number } }) => alive && setMe([p.coords.longitude, p.coords.latitude]);
    LocationManager.requestPermissions().then((ok) => {
      if (!ok || !alive) return;
      LocationManager.setMinDisplacement(5);
      LocationManager.addListener(onPos);
      LocationManager.getCurrentPosition().then((p) => p && onPos(p));
    });
    return () => { alive = false; LocationManager.removeListener(onPos); };
  }, []);
  const centeredOnce = useRef(false);
  useEffect(() => {
    if (me && !centeredOnce.current) { centeredOnce.current = true; camRef.current?.jumpTo({ center: me, zoom: 15.3, pitch: 58, bearing: -24 }); }
  }, [me]);

  // ---- заклади ----
  const [showAll, setShowAll] = useState(false);
  const [showHeat, setShowHeat] = useState(true);
  const [is3d, setIs3d] = useState(true);
  const venues = useMemo(() => placesToGeoJSON(places), [places]);
  const [center, setCenter] = useState<LngLat>(fallbackCenter);
  const ref: LngLat = me ?? center;
  const [rx, ry] = ref;
  const nearby = useMemo(
    () => places.map((p, i) => ({ p, i, m: distance([rx, ry], [p.lon, p.lat]) })).filter((x) => x.p.status !== 'none').sort((a, b) => a.m - b.m).slice(0, 14),
    [places, rx, ry],
  );

  // ---- 3D-дерева (перебудовуються, коли карта зупинилась) ----
  const [trees, setTrees] = useState<GeoJSON.FeatureCollection>(EMPTY);
  const onRegionDidChange = useCallback(async (e: any) => {
    const v = e.nativeEvent;
    setCenter(v.center);
    if (v.zoom < 14.5) { setTrees(EMPTY); return; }
    try {
      const parks = await mapRef.current?.queryRenderedFeatures({ layers: PARK_LAYERS });
      if (parks) setTrees(buildTrees(parks, v.bounds, C));
    } catch { /* карта ще вантажиться */ }
  }, [C]);

  // ---- шторка ----
  const H = Dimensions.get('window').height;
  const FULL = H * 0.88;
  const [y] = useState(() => new Animated.Value(FULL)); // 0 = повністю відкрита, FULL = схована
  const [sheet, setSheet] = useState<'hidden' | 'peek' | 'full'>('hidden');
  const go = useCallback((s: 'hidden' | 'peek' | 'full') => {
    setSheet(s);
    Animated.spring(y, { toValue: s === 'full' ? 0 : s === 'peek' ? FULL - PEEK : FULL, useNativeDriver: true, damping: 22, stiffness: 220 }).start();
  }, [FULL, y]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
    onPanResponderRelease: (_, g) => {
      if (g.dy < -30) go('full');
      else if (g.dy > 30) go(sheet === 'full' ? 'peek' : 'hidden');
    },
  }), [go, sheet]);

  const [sel, setSel] = useState<Place | null>(null);
  const [menu, setMenu] = useState<Dish[] | null>(null);
  const open = useCallback((p: Place) => {
    setSel(p); setMenu(null); go('peek');
    camRef.current?.easeTo({ center: [p.lon, p.lat], zoom: 16, duration: 900, padding: { top: 80, bottom: PEEK, left: 0, right: 0 } });
    if (p.status === 'none') return;
    (getMenu ? getMenu(p.id) : Promise.resolve(null)).then((d) => setMenu(d && d.length ? d : p.dishes ?? [])).catch(() => setMenu(p.dishes ?? []));
  }, [getMenu, go]);
  const close = useCallback(() => { go('hidden'); setSel(null); }, [go]);

  // ---- пошук ----
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return [];
    return places.filter((p) => p.name.toLowerCase().includes(s))
      .map((p) => ({ p, m: distance([rx, ry], [p.lon, p.lat]) }))
      .sort((a, b) => Number(a.p.status === 'none') - Number(b.p.status === 'none') || a.m - b.m).slice(0, 6);
  }, [q, places, rx, ry]);

  const toggle3d = () => { const n = !is3d; setIs3d(n); camRef.current?.easeTo({ center: ref, pitch: n ? 58 : 0, bearing: n ? -24 : 0, duration: 600 }); };
  const toMe = () => { close(); if (me) camRef.current?.flyTo({ center: me, zoom: 15.3, pitch: is3d ? 58 : 0, bearing: is3d ? -24 : 0, duration: 1100 }); };
  const route = (p: Place) => {
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${p.lat},${p.lon}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}&travelmode=walking`;
    Linking.openURL(url);
  };

  const s = useMemo(() => makeStyles(C), [C]);
  const glow = (a: number) => `rgba(${C.glow},${a})`;

  return (
    <View style={[s.root, { backgroundColor: C.land }]}>
      <Map
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        compass={false}
        attributionPosition={{ bottom: 8, left: 8 }}
        onRegionDidChange={onRegionDidChange}
        onPress={() => { if (sheet !== 'hidden') close(); }}
      >
        <Camera ref={camRef} initialViewState={{ center: me ?? fallbackCenter, zoom: 15.3, pitch: 58, bearing: -24 }} minZoom={5} maxZoom={18.5} />
        <Images images={{ win: WIN }} />

        <GeoJSONSource id="trees" data={trees}>
          <Layer type="fill-extrusion" id="tree-parts" minzoom={14.5}
            style={{ fillExtrusionColor: ['get', 'col'], fillExtrusionBase: ['get', 'base'], fillExtrusionHeight: ['get', 'top'], fillExtrusionVerticalGradient: true }} />
        </GeoJSONSource>

        <GeoJSONSource id="venues" data={venues} hitbox={{ top: 18, bottom: 18, left: 18, right: 18 }}
          onPress={(e) => { const f = e.nativeEvent.features?.[0]; const i = f?.properties?.i; if (i != null) open(places[i]); }}>
          <Layer type="heatmap" id="heat" maxzoom={16} filter={['!=', ['get', 'k'], 'n']}
            style={{
              visibility: showHeat ? 'visible' : 'none',
              heatmapWeight: ['match', ['get', 'k'], 'c', 1, 0.6],
              heatmapIntensity: ['interpolate', ['linear'], ['zoom'], 10, 0.6, 15, 1.6],
              heatmapRadius: ['interpolate', ['linear'], ['zoom'], 10, 14, 13, 26, 15, 44],
              heatmapColor: ['interpolate', ['linear'], ['heatmap-density'], 0, glow(0), 0.15, glow(0.05), 0.4, glow(0.12), 0.7, glow(0.22), 1, glow(0.38)],
              heatmapOpacity: ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 0.55, 15.5, 0],
            }} />
          <Layer type="circle" id="v-none" minzoom={13.5} filter={['==', ['get', 'k'], 'n']}
            style={{ visibility: showAll ? 'visible' : 'none', circleColor: C.dot, circleOpacity: 0.35, circleRadius: ['interpolate', ['linear'], ['zoom'], 13.5, 1.8, 17, 4], circlePitchAlignment: 'viewport' }} />
          <Layer type="circle" id="v-glow" minzoom={11.5} filter={['==', ['get', 'k'], 'c']}
            style={{ circleColor: C.dot, circleOpacity: 0.16, circleBlur: 1, circleRadius: ['interpolate', ['linear'], ['zoom'], 12, 6, 17, 22], circlePitchAlignment: 'viewport' }} />
          <Layer type="circle" id="v-review" minzoom={11.5} filter={['==', ['get', 'k'], 'r']}
            style={{ circleColor: C.ring, circleStrokeColor: C.dot, circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 12, 1, 17, 2.4], circleRadius: ['interpolate', ['linear'], ['zoom'], 12, 2, 17, 7], circlePitchAlignment: 'viewport' }} />
          <Layer type="circle" id="v-menu" minzoom={11.5} filter={['==', ['get', 'k'], 'c']}
            style={{ circleColor: C.dot, circleStrokeColor: C.ring, circleStrokeWidth: ['interpolate', ['linear'], ['zoom'], 12, 0.6, 17, 2.5], circleRadius: ['interpolate', ['linear'], ['zoom'], 12, 2.6, 17, 9], circlePitchAlignment: 'viewport' }} />
        </GeoJSONSource>

        {sel && (
          <GeoJSONSource id="sel" data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [sel.lon, sel.lat] } }}>
            <Layer type="circle" id="sel-ring" style={{ circleRadius: 16, circleColor: 'rgba(0,0,0,0)', circleStrokeWidth: 2.5, circleStrokeColor: C.dot, circlePitchAlignment: 'viewport' }} />
          </GeoJSONSource>
        )}

        <UserLocation animated heading accuracy={false} />
      </Map>

      {/* верх: пошук і фільтри */}
      <View style={[s.top, { paddingTop: insets.top + 8, paddingLeft: Math.max(16, insets.left), paddingRight: Math.max(16, insets.right) }]} pointerEvents="box-none">
        <View style={s.search}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Де поїсти?" placeholderTextColor={C.ui.dim} style={s.searchInput} returnKeyType="search" />
        </View>
        {results.length > 0 && (
          <View style={s.results}>
            {results.map(({ p, m }) => (
              <Pressable key={p.id} style={s.resultRow} onPress={() => { setQ(''); open(p); }}>
                <Dot k={p.status} C={C} />
                <Text style={s.resultName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.resultDist}>{distText(m)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip on={!showAll} label="З меню" onPress={() => setShowAll(false)} s={s} />
          <Chip on={showAll} label="Усі заклади" onPress={() => setShowAll((v) => !v)} s={s} />
          <Chip on={showHeat} label="Де людно з їжею" onPress={() => setShowHeat((v) => !v)} s={s} />
        </ScrollView>
      </View>

      {/* кнопки справа */}
      {sheet !== 'full' && (
        <View style={[s.fabs, { right: Math.max(16, insets.right), bottom: (sheet === 'peek' ? PEEK : 190) + insets.bottom }]}>
          <Pressable style={s.fab} onPress={() => setTheme((t) => (t === 'day' ? 'night' : 'day'))}><Text style={s.fabText}>{theme === 'day' ? '☾' : '☀'}</Text></Pressable>
          <Pressable style={s.fab} onPress={toggle3d}><Text style={s.fabText}>{is3d ? '2D' : '3D'}</Text></Pressable>
          <Pressable style={s.fab} onPress={toMe}><Text style={s.fabText}>➤</Text></Pressable>
        </View>
      )}

      {/* стрічка "Поруч" */}
      {sheet === 'hidden' && nearby.length > 0 && (
        <View style={[s.near, { paddingBottom: insets.bottom + 12 }]}>
          <Text style={[s.nearTitle, { paddingLeft: Math.max(16, insets.left) }]}>{me ? 'ПОРУЧ З ТОБОЮ' : 'ПОРУЧ'}</Text>
          <FlatList
            horizontal showsHorizontalScrollIndicator={false} data={nearby} keyExtractor={(x) => x.p.id}
            contentContainerStyle={{ paddingHorizontal: Math.max(16, insets.left), gap: 10 }}
            snapToInterval={210} decelerationRate="fast"
            renderItem={({ item: { p, m } }) => {
              const d = distText(m).split(' ');
              return (
                <Pressable style={s.card} onPress={() => open(p)}>
                  <Text style={s.cardTitle} numberOfLines={2}>{p.name}</Text>
                  <Text style={s.cardBig}>{d[0]}<Text style={s.cardSmall}> {d[1]} · {Math.max(1, Math.round(m / 80))} хв</Text></Text>
                  <View style={s.row}><Dot k={p.status} C={C} dark /><Text style={s.cardMeta}>{p.status === 'confirmed' ? 'меню є' : 'меню на перевірці'}</Text></View>
                </Pressable>
              );
            }}
          />
        </View>
      )}

      {/* шторка закладу */}
      <Animated.View style={[s.sheet, { height: FULL, transform: [{ translateY: y }] }]}>
        <View {...pan.panHandlers}>
          <Pressable style={s.grab} onPress={() => go(sheet === 'full' ? 'peek' : 'full')}><View style={s.grabBar} /></Pressable>
          {sel && (
            <View style={s.head}>
              <View style={s.row}>
                <Text style={s.title}>{sel.name}</Text>
                <Pressable style={s.x} onPress={close} hitSlop={10}><Text style={s.xText}>✕</Text></Pressable>
              </View>
              <Text style={s.sub}>{[sel.type, cuisineText(sel.cuisine)].filter(Boolean).join(' · ')}{sel.address ? `\n${sel.address}` : ''}</Text>
              <View style={s.facts}>
                <View style={s.fact}><Dot k={sel.status} C={C} dark /><Text style={s.factText}>{sel.status === 'confirmed' ? 'Меню є' : sel.status === 'review' ? 'Меню на перевірці' : 'Меню ще немає'}</Text></View>
                {me && <View style={s.fact}><Text style={s.factText}>{distText(distance(me, [sel.lon, sel.lat]))} · {walkText(distance(me, [sel.lon, sel.lat]))}</Text></View>}
                {!!sel.price_range && <View style={s.fact}><Text style={s.factText}>{sel.price_range}</Text></View>}
                {!!menu?.length && <View style={s.fact}><Text style={s.factText}>Страва ≈ {median(menu)} ₴</Text></View>}
              </View>
              <View style={s.acts}>
                <Pressable style={[s.btn, s.btnPrimary, sel.status === 'none' && { opacity: 0.4 }]} disabled={sel.status === 'none'} onPress={() => go('full')}>
                  <Text style={[s.btnText, { color: C.ui.accentText }]}>Відкрити меню</Text>
                </Pressable>
                <Pressable style={s.btn} onPress={() => route(sel)}><Text style={s.btnText}>Маршрут</Text></Pressable>
              </View>
            </View>
          )}
        </View>
        {sel && <MenuList place={sel} menu={menu} s={s} />}
      </Animated.View>
    </View>
  );
});

function median(menu: Dish[]) {
  const p = menu.map((d) => d.price_uah ?? 0).filter((x) => x > 0).sort((a, b) => a - b);
  return p.length ? Math.round(p[Math.floor(p.length / 2)] / 10) * 10 : '—';
}

function MenuList({ place, menu, s }: { place: Place; menu: Dish[] | null; s: ReturnType<typeof makeStyles> }) {
  if (place.status === 'none') return <Text style={s.empty}>Для цього закладу ми ще не знайшли меню.</Text>;
  if (!menu) return <Text style={s.empty}>Завантажую меню…</Text>;
  if (!menu.length) return <Text style={s.empty}>Меню є, але страви ще не вивантажені.</Text>;
  const groups: [string, Dish[]][] = [];
  for (const d of menu) { const c = d.category || 'Меню'; const g = groups.find((x) => x[0] === c); if (g) g[1].push(d); else groups.push([c, [d]]); }
  return (
    <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 40 }}>
      {place.status === 'review' && <Text style={s.note}>Це меню ще перевіряємо: ціни могли змінитися.</Text>}
      {groups.map(([cat, list]) => (
        <View key={cat}>
          <Text style={s.cat}>{cat.toUpperCase()}</Text>
          {list.map((d, i) => (
            <View key={i} style={s.dish}>
              <View style={{ flex: 1 }}>
                <Text style={s.dishName}>{d.name}</Text>
                {!!(d.weight || d.description) && <Text style={s.dishDesc}>{[d.weight, d.description].filter(Boolean).join(' · ')}</Text>}
              </View>
              {d.price_uah != null && <Text style={s.dishPrice}>{Math.round(d.price_uah)} ₴</Text>}
            </View>
          ))}
        </View>
      ))}
      {!!place.menu_url && <Text style={s.note} onPress={() => Linking.openURL(place.menu_url!)}>Повне меню на сайті закладу ›</Text>}
    </ScrollView>
  );
}

function Dot({ k, C, dark }: { k: Place['status']; C: (typeof PALETTES)['day']; dark?: boolean }) {
  const col = dark ? C.ui.text : C.ui.text;
  if (k === 'confirmed') return <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: col }} />;
  if (k === 'review') return <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: col }} />;
  return <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: col, opacity: 0.4 }} />;
}

function Chip({ on, label, onPress, s }: { on: boolean; label: string; onPress: () => void; s: ReturnType<typeof makeStyles> }) {
  return <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]}><Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text></Pressable>;
}

function makeStyles(C: (typeof PALETTES)['day']) {
  const U = C.ui;
  const shadow = { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 };
  return StyleSheet.create({
    root: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    top: { position: 'absolute', left: 0, right: 0, top: 0, gap: 10 },
    search: { height: 46, borderRadius: 23, backgroundColor: U.panel, borderWidth: 1, borderColor: U.hair, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, ...shadow },
    searchIcon: { color: U.dim, fontSize: 20 },
    searchInput: { flex: 1, color: U.text, fontSize: 16, fontWeight: '500' },
    results: { backgroundColor: U.panel, borderRadius: 18, borderWidth: 1, borderColor: U.hair, overflow: 'hidden', ...shadow },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: U.hair },
    resultName: { flex: 1, color: U.text, fontSize: 15, fontWeight: '600' },
    resultDist: { color: U.dim, fontSize: 13, fontVariant: ['tabular-nums'] },
    chips: { gap: 8 },
    chip: { height: 32, paddingHorizontal: 13, borderRadius: 16, backgroundColor: U.panel, borderWidth: 1, borderColor: U.hair, justifyContent: 'center' },
    chipOn: { backgroundColor: U.accent, borderColor: U.accent },
    chipText: { color: U.text, fontSize: 13, fontWeight: '600' },
    chipTextOn: { color: U.accentText },
    fabs: { position: 'absolute', gap: 10 },
    fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: U.panel, borderWidth: 1, borderColor: U.hair, alignItems: 'center', justifyContent: 'center', ...shadow },
    fabText: { color: U.text, fontSize: 14, fontWeight: '700' },
    near: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    nearTitle: { color: C === PALETTES.day ? 'rgba(22,24,27,0.6)' : U.dim, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 10 },
    card: { width: 200, backgroundColor: U.panel, borderRadius: 20, borderWidth: 1, borderColor: U.hair, padding: 14, gap: 8 },
    cardTitle: { color: U.text, fontSize: 15, fontWeight: '600', minHeight: 38 },
    cardBig: { color: U.text, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] },
    cardSmall: { color: U.dim, fontSize: 12, fontWeight: '500' },
    cardMeta: { color: U.dim, fontSize: 12.5 },
    sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: U.panel, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: U.hair, ...shadow },
    grab: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    grabBar: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
    head: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
    title: { flex: 1, color: U.text, fontSize: 21, fontWeight: '800' },
    x: { width: 34, height: 34, borderRadius: 17, backgroundColor: U.raised, alignItems: 'center', justifyContent: 'center' },
    xText: { color: U.text, fontSize: 14, fontWeight: '700' },
    sub: { color: U.dim, fontSize: 14, lineHeight: 20 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    fact: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: U.raised },
    factText: { color: U.text, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
    acts: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: U.raised, borderWidth: 1, borderColor: U.hair, alignItems: 'center', justifyContent: 'center' },
    btnPrimary: { backgroundColor: U.accent, borderColor: U.accent },
    btnText: { color: U.text, fontSize: 15, fontWeight: '700' },
    body: { flex: 1, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: U.hair },
    cat: { color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginTop: 18, marginBottom: 4 },
    dish: { flexDirection: 'row', gap: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: U.hair },
    dishName: { color: U.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
    dishDesc: { color: U.dim, fontSize: 13, lineHeight: 18, marginTop: 3 },
    dishPrice: { color: U.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
    note: { color: U.dim, fontSize: 13, lineHeight: 19, marginVertical: 14 },
    empty: { color: U.dim, fontSize: 14, textAlign: 'center', padding: 28 },
  });
}
