// Стиль карти закладів: денний (кремові об'ємні будинки, зелені парки) і нічний (темний, світлі вікна).
// Основа карти: OpenFreeMap (безкоштовно, без ключа, дані OpenStreetMap, уся Україна), схема OpenMapTiles.
import type { StyleSpecification, LayerSpecification } from '@maplibre/maplibre-react-native';

export type MapTheme = 'day' | 'night';

export type Palette = {
  land: string; water: string; park: string; minor: string; minorCase: string; major: string; majorCase: string; rail: string;
  bldLow: string; bldHigh: string; outline: string | null; label: string; labelHalo: string;
  dot: string; ring: string; glow: string; // glow = "r,g,b"
  crowns: string[]; tops: string[]; trunk: string;
  ui: { bg: string; panel: string; raised: string; text: string; dim: string; hair: string; accent: string; accentText: string };
};

export const PALETTES: Record<MapTheme, Palette> = {
  day: {
    land: '#ece8dc', water: '#4f93d2', park: '#b6d46f', minor: '#ffffff', minorCase: '#d6d0c1', major: '#fbfaf5', majorCase: '#cfc8b6', rail: '#bdb6a6',
    bldLow: '#f2eee4', bldHigh: '#ffffff', outline: 'rgba(90,84,72,0.55)', label: 'rgba(40,38,34,0.7)', labelHalo: '#f4f1e8',
    dot: '#16181b', ring: '#ffffff', glow: '22,24,27',
    crowns: ['#6fa52f', '#7fb03a', '#88b83f', '#79aa35'], tops: ['#93c24c', '#9fcb52', '#a8d35c'], trunk: '#8a6a45',
    ui: { bg: '#ece8dc', panel: '#16181b', raised: '#22252a', text: '#ffffff', dim: 'rgba(255,255,255,0.62)', hair: 'rgba(255,255,255,0.10)', accent: '#ffffff', accentText: '#0d0e10' },
  },
  night: {
    land: '#0d0e10', water: '#060708', park: '#141719', minor: '#1c1e21', minorCase: '#141518', major: '#2a2c30', majorCase: '#141518', rail: '#232529',
    bldLow: '#1a1c20', bldHigh: '#2d3035', outline: null, label: 'rgba(255,255,255,0.42)', labelHalo: '#0d0e10',
    dot: '#ffffff', ring: '#0d0e10', glow: '255,255,255',
    crowns: ['#1a201d', '#1d2420', '#202723'], tops: ['#252d28', '#29312c'], trunk: '#141618',
    ui: { bg: '#0d0e10', panel: '#17181b', raised: '#212327', text: '#ffffff', dim: 'rgba(255,255,255,0.62)', hair: 'rgba(255,255,255,0.10)', accent: '#ffffff', accentText: '#0d0e10' },
  },
};

const NAME: any = ['coalesce', ['get', 'name:uk'], ['get', 'name']];
const HEIGHT: any = ['coalesce', ['get', 'render_height'], 10];
const RISE = (h: any): any => ['interpolate', ['linear'], ['zoom'], 13, 0, 14.2, h];
export const PARK_LAYERS = ['park-fill', 'wood-fill'];

export function buildStyle(theme: MapTheme): StyleSpecification {
  const C = PALETTES[theme];
  const L = (id: string, type: string, layer: string, paint: any, filter?: any, extra?: any): LayerSpecification =>
    ({ id, type, source: 'omt', 'source-layer': layer, paint, ...(filter ? { filter } : {}), ...(extra || {}) }) as LayerSpecification;
  const roadsMinor = ['in', ['get', 'class'], ['literal', ['minor', 'service', 'tertiary']]];
  const roadsMajor = ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]];

  const layers: LayerSpecification[] = [
    { id: 'bg', type: 'background', paint: { 'background-color': C.land } } as LayerSpecification,
    L('park-fill', 'fill', 'park', { 'fill-color': C.park }),
    L('wood-fill', 'fill', 'landcover', { 'fill-color': C.park }, ['in', ['get', 'class'], ['literal', ['wood', 'grass']]]),
    L('water', 'fill', 'water', { 'fill-color': C.water }),
    L('rail', 'line', 'transportation', { 'line-color': C.rail, 'line-width': 1, 'line-dasharray': [2, 2] }, ['==', ['get', 'class'], 'rail']),
    L('minor-case', 'line', 'transportation', { 'line-color': C.minorCase, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.8, 17, 11] }, roadsMinor, { minzoom: 12 }),
    L('minor', 'line', 'transportation', { 'line-color': C.minor, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.4, 17, 9] }, roadsMinor, { minzoom: 12 }),
    L('major-case', 'line', 'transportation', { 'line-color': C.majorCase, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 1.5, 17, 18] }, roadsMajor),
    L('major', 'line', 'transportation', { 'line-color': C.major, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 8, 0.6, 17, 14] }, roadsMajor),
  ];
  if (C.outline) layers.push(L('bld-outline', 'line', 'building', { 'line-color': C.outline, 'line-width': 0.7 }, undefined, { minzoom: 14 }));
  layers.push(L('bld', 'fill-extrusion', 'building', {
    'fill-extrusion-color': ['interpolate', ['linear'], HEIGHT, 0, C.bldLow, 60, C.bldHigh],
    'fill-extrusion-height': RISE(HEIGHT),
    'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
    'fill-extrusion-opacity': theme === 'day' ? 0.92 : 1,
    'fill-extrusion-vertical-gradient': true,
  }, undefined, { minzoom: 13 }));
  if (theme === 'night') {
    // світлі вікна: візерунок на стінах + дах звичайного кольору зверху
    layers.push(L('bld-windows', 'fill-extrusion', 'building', {
      'fill-extrusion-pattern': 'win', 'fill-extrusion-height': RISE(HEIGHT),
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-vertical-gradient': false,
    }, undefined, { minzoom: 14 }));
    layers.push(L('bld-roof', 'fill-extrusion', 'building', {
      'fill-extrusion-color': C.bldHigh, 'fill-extrusion-base': RISE(HEIGHT), 'fill-extrusion-height': RISE(['+', HEIGHT, 0.4]),
    }, undefined, { minzoom: 14 }));
  }
  layers.push(
    L('street-names', 'symbol', 'transportation_name', { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.2 }, undefined, {
      minzoom: 14, layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10, 17, 12.5], 'text-max-angle': 30 },
    }),
    L('place-names', 'symbol', 'place', { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
      ['in', ['get', 'class'], ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter']]], {
        maxzoom: 15, layout: { 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 13, 11], 'text-transform': 'uppercase', 'text-letter-spacing': 0.1, 'text-max-width': 8 },
      }),
  );

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    light: { anchor: 'viewport', color: '#ffffff', intensity: theme === 'day' ? 0.5 : 0.35, position: [1.3, 200, 35] },
    sources: { omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap, OpenFreeMap' } },
    layers,
  } as StyleSpecification;
}
