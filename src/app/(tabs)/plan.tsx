import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Directions, Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeInDown, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Header } from '../../components/Header';
import { Menu } from '../../components/Menu';
import { Plaque } from '../../components/Plaque';
import { Plate } from '../../components/Plate';
import { Lock } from '../../components/Premium';
import { Screen } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { useScale } from '../../components/scale';
import { Slot, useStore } from '../../components/store';
import { byId, DAYS, MEALS, Recipe, recipes, shortDate, weekDates, weekKey, weekLabel } from '../../data';
import { font, fontMedium, sage, useTheme } from '../../theme';
import { uah } from '../../data/prices';

const SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
const HEADS = ['сніданок', 'обід', 'вечеря'];
const WEEK_NAMES: Record<number, string> = { [-1]: 'минулий тиждень', 0: 'цей тиждень', 1: 'наступний тиждень' };
const today = (new Date().getDay() + 6) % 7;
const line = 'rgba(255,255,255,0.14)';
const HOLD = 380; // ms to hold a dish before it is picked up
const icon = {
  heart: require('../../../assets/icons/heart.svg'),
  heartFill: require('../../../assets/icons/heart-fill.svg'),
  bookmark: require('../../../assets/icons/bookmark.svg'),
  bookmarkFill: require('../../../assets/icons/bookmark-fill.svg'),
  replace: require('../../../assets/icons/replace.svg'),
  trash: require('../../../assets/icons/trash.svg'),
  open: require('../../../assets/icons/open.svg'),
  chevron: require('../../../assets/icons/chevron.svg'),
};
const buzz = () => Haptics.selectionAsync().catch(() => {});
const sameSlot = (a: Slot | null, b: Slot) => !!a && a.week === b.week && a.day === b.day && a.meal === b.meal;

type Drag = { slot: Slot; recipe: Recipe } | null;

// The week as a table: a row per day (with its date), a column per meal; a skipped meal is an empty cell.
// Arrows or a horizontal swipe switch between last, this and next week.
// Tap a dish for its actions sheet. Hold a dish to select it: it lights up and a bar with five
// actions appears. Hold and drag to move it onto another cell (they swap; an empty cell takes it).
export default function Plan() {
  const k = useScale();
  const [menu, setMenu] = useState(false);
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { planOf, premium, swapMeals, resetPlan, setMeal, liked, toggleLiked, saved, toggleSaved, planWeek, profile } = useStore();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<{ slot: Slot; pick: boolean } | null>(null);
  const [swapFrom, setSwapFrom] = useState<Slot | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [drag, setDrag] = useState<Drag>(null);

  const tabBarTop = Math.max(insets.bottom - 4 * k, 18 * k) + 62 * k;
  const week = weekKey(offset);
  const dates = weekDates(offset);
  const plan = planOf(week);
  const at = (day: string, meal: string) => byId(plan.find((p) => p.day === day && p.meal === meal)?.recipe ?? '');
  const fromRecipe = swapFrom && at(swapFrom.day, swapFrom.meal);
  const selRecipe = selected && at(selected.day, selected.meal);

  // Drag state lives on the UI thread: finger position, cell rectangles (window coordinates,
  // measured when a hold starts) and the index of the cell under the finger.
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const hover = useSharedValue(-1);
  const rects = useSharedValue<number[][]>([]);
  const cells = useRef<(ComponentRef<typeof View> | null)[]>([]);
  const scroller = useRef<any>(null);
  const scrollY = useRef(0);

  const measure = () => {
    const out: number[][] = [];
    let left = cells.current.length;
    cells.current.forEach((v, i) =>
      v?.measureInWindow((x, y, w, h) => {
        out[i] = [x, y, w, h];
        if (--left === 0) rects.set(out);
      }),
    );
  };

  const goWeek = (to: number) => {
    if (to < -1 || to > 1) return;
    setSelected(null);
    setSwapFrom(null);
    setOffset(to);
  };

  const tap = (slot: Slot) => {
    if (selected) return setSelected(null);
    if (swapFrom) {
      if (!sameSlot(swapFrom, slot)) swapMeals(swapFrom, slot);
      return setSwapFrom(null);
    }
    setOpen({ slot, pick: false });
  };
  const hold = (slot: Slot) => {
    measure();
    setSwapFrom(null);
    setSelected(slot);
    buzz();
  };
  // When the hold ends without a drag, make sure the action bar does not cover the dish.
  const release = (slot: Slot) => {
    if (!sameSlot(selected, slot)) return;
    const idx = DAYS.indexOf(slot.day) * 3 + MEALS.indexOf(slot.meal);
    cells.current[idx]?.measureInWindow((_x, y, _w, h) => {
      const barTop = winH - (tabBarTop + 12 * k + 124 * k);
      const overlap = y + h + 8 * k - barTop;
      if (overlap > 0) scroller.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  };
  const dragStart = (slot: Slot) => {
    const recipe = at(slot.day, slot.meal);
    if (!recipe) return;
    setSelected(null);
    setDrag({ slot, recipe });
  };
  const drop = (idx: number) => {
    if (drag && idx >= 0) {
      const to = { week, day: DAYS[Math.floor(idx / 3)], meal: MEALS[idx % 3] };
      if (!sameSlot(drag.slot, to)) {
        swapMeals(drag.slot, to);
        buzz();
      }
    }
    setDrag(null);
  };

  // Cells get stable handlers so their gestures are not rebuilt mid-drag; the latest logic sits in a ref.
  const latest = useRef({ tap, hold, release, dragStart, drop });
  useEffect(() => {
    latest.current = { tap, hold, release, dragStart, drop };
  });
  const api = useMemo(
    () => ({
      tap: (s: Slot) => latest.current.tap(s),
      hold: (s: Slot) => latest.current.hold(s),
      release: (s: Slot) => latest.current.release(s),
      dragStart: (s: Slot) => latest.current.dragStart(s),
      drop: (i: number) => latest.current.drop(i),
    }),
    [],
  );

  const weekSwipe = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Fling().direction(Directions.LEFT).runOnJS(true).onEnd(() => goWeek(offset + 1)),
        Gesture.Fling().direction(Directions.RIGHT).runOnJS(true).onEnd(() => goWeek(offset - 1)),
      ),
    [offset],
  );

  const ghost = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.get() - 36 * k }, { translateY: dragY.get() - 36 * k }, { scale: 1.08 }],
  }));

  const txt = { fontFamily: font, color: '#FFFFFF' };

  const actions: { label: string; icon: number; run: () => void }[] = selRecipe
    ? [
        { label: 'вподобати', icon: liked.includes(selRecipe.id) ? icon.heartFill : icon.heart, run: () => toggleLiked(selRecipe.id) },
        { label: 'зберегти', icon: saved.includes(selRecipe.id) ? icon.bookmarkFill : icon.bookmark, run: () => toggleSaved(selRecipe.id) },
        {
          label: 'змінити',
          icon: icon.replace,
          run: () => {
            setOpen({ slot: selected!, pick: true });
            setSelected(null);
          },
        },
        {
          label: 'видалити',
          icon: icon.trash,
          run: () => {
            setMeal(selected!, null);
            setSelected(null);
          },
        },
        {
          label: 'відкрити',
          icon: icon.open,
          run: () => {
            setSelected(null);
            router.push(`/recipe/${selRecipe.id}`);
          },
        },
      ]
    : [];

  return (
    <Screen>
      <ScrollView
        ref={scroller}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={32}
        scrollEnabled={!drag}
        contentContainerStyle={{ paddingTop: 128 * k, paddingBottom: (selected ? 260 : 150) * k, paddingHorizontal: 14 * k }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 6 * k, marginBottom: 10 * k }}>
          <Text style={{ fontFamily: fontMedium, fontSize: 34 * k, lineHeight: 36 * k, color: t.text }}>план тижня</Text>
          <Text style={{ fontFamily: font, fontSize: 18 * k, color: t.textSoft }}>натисни або затисни страву, щоб змінити її</Text>
        </View>

        {/* Week switcher: only last, this and next week. */}
        <View style={[s.row, { alignItems: 'center', marginBottom: 10 * k, gap: 8 * k }]}>
          <WeekArrow dir={-1} disabled={offset <= -1} onPress={() => goWeek(offset - 1)} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 24 * k, color: t.text }}>{weekLabel(offset)}</Text>
            <Text style={{ fontFamily: font, fontSize: 16 * k, color: t.textSoft }}>{WEEK_NAMES[offset]}</Text>
          </View>
          <WeekArrow dir={1} disabled={offset >= 1} onPress={() => goWeek(offset + 1)} />
        </View>

        {swapFrom && (
          <Plaque radius={16 * k} style={{ marginBottom: 10 * k, borderWidth: 1.5, borderColor: sage }}>
            <View style={[s.row, { paddingHorizontal: 14 * k, paddingVertical: 10 * k, gap: 10 * k }]}>
              <Text style={[txt, { flex: 1, fontSize: 18 * k, lineHeight: 21 * k }]}>
                обери клітинку, з якою поміняти «{fromRecipe?.name.toLowerCase()}»
              </Text>
              <Pressable onPress={() => setSwapFrom(null)} hitSlop={10} accessibilityRole="button">
                <Text style={[txt, { fontFamily: fontMedium, fontSize: 18 * k, opacity: 0.8 }]}>скасувати</Text>
              </Pressable>
            </View>
          </Plaque>
        )}

        <GestureDetector gesture={weekSwipe}>
          <Animated.View key={week} entering={FadeIn.duration(180)}>
            <Plaque radius={20 * k}>
              <View style={[s.row, { borderBottomWidth: 1, borderColor: line }]}>
                <View style={{ width: 50 * k }} />
                {HEADS.map((h) => (
                  <Text key={h} style={[txt, s.head, { fontSize: 15 * k, paddingVertical: 10 * k, letterSpacing: 0.6 * k }]}>
                    {h}
                  </Text>
                ))}
              </View>

              {DAYS.map((day, d) => {
                const kcal = MEALS.reduce((sum, m) => sum + (at(day, m)?.kcal ?? 0), 0);
                const isToday = offset === 0 && d === today;
                return (
                  <View key={day} style={[s.row, d < DAYS.length - 1 && { borderBottomWidth: 1, borderColor: line }]}>
                    <View style={{ width: 50 * k, alignItems: 'center', justifyContent: 'center', gap: 3 * k, paddingVertical: 8 * k }}>
                      <View style={{ paddingHorizontal: 7 * k, borderRadius: 100, backgroundColor: isToday ? sage : 'transparent' }}>
                        <Text style={[txt, { fontFamily: fontMedium, fontSize: 22 * k, lineHeight: 26 * k }]}>{SHORT[d]}</Text>
                      </View>
                      <Text style={[txt, { fontSize: 14 * k, lineHeight: 15 * k, opacity: 0.8 }]}>{shortDate(dates[d])}</Text>
                      {premium ? (
                        <Text style={[txt, { fontSize: 13 * k, lineHeight: 14 * k, opacity: 0.7, textAlign: 'center' }]}>
                          {kcal}
                          {'\n'}ккал
                        </Text>
                      ) : (
                        <Lock size={12} />
                      )}
                    </View>
                    {MEALS.map((meal, m) => {
                      const slot = { week, day, meal };
                      const idx = d * 3 + m;
                      return (
                        <PlanCell
                          key={meal}
                          slot={slot}
                          idx={idx}
                          recipe={at(day, meal)}
                          liked={!!at(day, meal) && liked.includes(at(day, meal)!.id)}
                          selected={sameSlot(selected, slot) || sameSlot(swapFrom, slot)}
                          dimmed={sameSlot(drag?.slot ?? null, slot)}
                          cellRef={(v) => {
                            cells.current[idx] = v;
                          }}
                          onTap={api.tap}
                          onHold={api.hold}
                          onRelease={api.release}
                          onDragStart={api.dragStart}
                          onDrop={api.drop}
                          dragX={dragX}
                          dragY={dragY}
                          hover={hover}
                          rects={rects}
                        />
                      );
                    })}
                  </View>
                );
              })}
            </Plaque>
          </Animated.View>
        </GestureDetector>

        {offset === 0 && (
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              planWeek();
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignSelf: 'center', marginTop: 18 * k, backgroundColor: sage, borderRadius: 100, paddingHorizontal: 22 * k, height: 46 * k, justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}
          >
            <Text style={{ fontFamily: fontMedium, fontSize: 22 * k, color: '#FFFFFF' }}>скласти вечері в {uah(profile.budget)} з того, що вдома</Text>
          </Pressable>
        )}
        <Pressable onPress={() => resetPlan(week)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 * k }} accessibilityRole="button">
          <Text style={{ fontFamily: font, fontSize: 18 * k, color: t.textSoft }}>повернути план за замовчуванням</Text>
        </Pressable>
      </ScrollView>

      {/* The held dish follows the finger. */}
      {drag && (
        <Animated.View pointerEvents="none" style={[s.ghost, ghost]}>
          <Plate recipe={drag.recipe} size={72 * k} />
        </Animated.View>
      )}

      {/* Actions for the held dish, just above the tab bar. */}
      {selected && selRecipe && (
        <Animated.View
          // No exit animation: a fading bar would keep catching taps meant for the cells under it.
          entering={FadeInDown.duration(200)}
          style={{ position: 'absolute', left: 14 * k, right: 14 * k, bottom: tabBarTop + 12 * k, zIndex: 20 }}
        >
          <Plaque radius={22 * k} style={{ borderWidth: 1.5, borderColor: sage }}>
            <View style={[s.row, { alignItems: 'center', paddingHorizontal: 14 * k, paddingTop: 10 * k, gap: 8 * k }]}>
              <Text numberOfLines={1} style={[txt, { flex: 1, fontFamily: fontMedium, fontSize: 19 * k }]}>
                {selRecipe.name}
              </Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Зняти виділення">
                <Text style={[txt, { fontSize: 20 * k, opacity: 0.7 }]}>✕</Text>
              </Pressable>
            </View>
            <View style={[s.row, { paddingHorizontal: 6 * k, paddingVertical: 8 * k }]}>
              {actions.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={a.run}
                  accessibilityRole="button"
                  accessibilityLabel={a.label}
                  style={({ pressed }) => [s.action, { gap: 4 * k, paddingVertical: 6 * k, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
                >
                  <Image source={a.icon} style={{ width: 24 * k, height: 24 * k }} />
                  <Text style={[txt, { fontSize: 14 * k, opacity: 0.85 }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          </Plaque>
        </Animated.View>
      )}

      <Header onMenu={() => setMenu(true)} />
      <Menu open={menu} onClose={() => setMenu(false)} />
      <CellSheet
        slot={open?.slot ?? null}
        pick={open?.pick ?? false}
        onClose={() => setOpen(null)}
        onSwap={(slot) => {
          setOpen(null);
          setSwapFrom(slot);
        }}
      />
    </Screen>
  );
}

function WeekArrow({ dir, disabled, onPress }: { dir: 1 | -1; disabled: boolean; onPress: () => void }) {
  const k = useScale();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Попередній тиждень' : 'Наступний тиждень'}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ opacity: disabled ? 0.3 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Plaque radius={100} style={{ width: 44 * k, height: 44 * k, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={icon.chevron} style={{ width: 22 * k, height: 22 * k, transform: [{ rotate: dir < 0 ? '180deg' : '0deg' }] }} />
      </Plaque>
    </Pressable>
  );
}

// One meal cell. Tap → actions sheet. Hold → select. Hold and move → drag; the cell under the
// finger is found on the UI thread from the rectangles measured when the hold began.
function PlanCell(props: {
  slot: Slot;
  idx: number;
  recipe?: Recipe;
  liked: boolean;
  selected: boolean;
  dimmed: boolean;
  cellRef: (v: ComponentRef<typeof View> | null) => void;
  onTap: (s: Slot) => void;
  onHold: (s: Slot) => void;
  onRelease: (s: Slot) => void;
  onDragStart: (s: Slot) => void;
  onDrop: (idx: number) => void;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  hover: SharedValue<number>;
  rects: SharedValue<number[][]>;
}) {
  const { slot, idx, recipe: r, liked, selected, dimmed, cellRef, onTap, onHold, onRelease, onDragStart, onDrop, dragX, dragY, hover, rects } = props;
  const k = useScale();
  const has = !!r;
  const { week, day, meal } = slot;
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const moving = useSharedValue(false);

  const gesture = useMemo(() => {
    const slot = { week, day, meal };
    const tap = Gesture.Tap().runOnJS(true).onEnd(() => onTap(slot));
    // An empty cell can only be tapped (to add a dish); a disabled hold would keep the tap waiting.
    if (!has) return tap;
    const press = Gesture.LongPress()
      .minDuration(HOLD)
      .runOnJS(true)
      .onStart(() => onHold(slot))
      .onEnd(() => onRelease(slot));
    // Pan wakes up with the hold even if the finger stays put, so it only counts as a drag
    // once the finger has moved a few points; a still hold just selects the dish.
    const pan = Gesture.Pan()
      .activateAfterLongPress(HOLD)
      .onStart((e) => {
        ox.set(e.absoluteX);
        oy.set(e.absoluteY);
        moving.set(false);
      })
      .onUpdate((e) => {
        if (!moving.get()) {
          if (Math.hypot(e.absoluteX - ox.get(), e.absoluteY - oy.get()) < 8) return;
          moving.set(true);
          scheduleOnRN(onDragStart, slot);
        }
        dragX.set(e.absoluteX);
        dragY.set(e.absoluteY);
        const rs = rects.get();
        let found = -1;
        for (let i = 0; i < rs.length; i++) {
          const q = rs[i];
          if (q && e.absoluteX >= q[0] && e.absoluteX <= q[0] + q[2] && e.absoluteY >= q[1] && e.absoluteY <= q[1] + q[3]) found = i;
        }
        hover.set(found);
      })
      .onFinalize(() => {
        if (moving.get()) scheduleOnRN(onDrop, hover.get());
        moving.set(false);
        hover.set(-1);
      });
    return Gesture.Exclusive(Gesture.Simultaneous(pan, press), tap);
  }, [week, day, meal, has, onTap, onHold, onRelease, onDragStart, onDrop, dragX, dragY, hover, rects, ox, oy, moving]);

  // The drop target lights up while a dish hovers over it.
  const target = useAnimatedStyle(() => ({
    backgroundColor: hover.get() === idx ? 'rgba(91,107,69,0.55)' : selected ? 'rgba(91,107,69,0.45)' : 'transparent',
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        ref={cellRef as any}
        accessible
        role="button"
        aria-label={`${slot.day}, ${slot.meal.toLowerCase()}: ${r ? r.name : 'пропуск'}`}
        style={[
          s.cell,
          { paddingVertical: 8 * k, paddingHorizontal: 4 * k, borderLeftWidth: 1, borderColor: line },
          selected && { borderWidth: 2, borderColor: sage, transform: [{ scale: 1.04 }], zIndex: 2 },
          dimmed && { opacity: 0.3 },
          target,
        ]}
      >
        {r ? (
          <>
            <Plate recipe={r} size={52 * k} />
            <Text numberOfLines={2} style={[s.name, { fontSize: 14 * k, lineHeight: 15 * k, marginTop: 4 * k }]}>
              {r.name.toLowerCase()}
            </Text>
            {liked && <Image source={icon.heartFill} style={{ position: 'absolute', top: 6 * k, right: 6 * k, width: 13 * k, height: 13 * k }} />}
          </>
        ) : (
          <>
            <View style={[s.empty, { width: 52 * k, height: 52 * k, borderRadius: 26 * k }]}>
              <Text style={[s.name, { fontSize: 24 * k, opacity: 0.45 }]}>+</Text>
            </View>
            <Text style={[s.name, { fontSize: 14 * k, opacity: 0.65, marginTop: 4 * k }]}>пропуск</Text>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// Actions for one cell. "замінити" and an empty cell show the dish picker in the same sheet;
// "змінити" on the hold bar opens it straight on the picker.
function CellSheet({ slot, pick, onClose, onSwap }: { slot: Slot | null; pick: boolean; onClose: () => void; onSwap: (s: Slot) => void }) {
  const k = useScale();
  const t = useTheme();
  const { planOf, premium, setMeal, rank } = useStore();
  const [picking, setPicking] = useState(false);
  const [last, setLast] = useState<Slot | null>(null);
  // Keep the last slot so the content stays put while the sheet slides away.
  if (slot && slot !== last) {
    setLast(slot);
    setPicking(pick);
  }
  const cur = slot ?? last;
  if (!cur) return null;
  const r = byId(planOf(cur.week).find((p) => p.day === cur.day && p.meal === cur.meal)?.recipe ?? '');
  const showPicker = picking || !r;

  const txt = { fontFamily: font, fontSize: 21 * k, lineHeight: 25 * k, color: t.text };
  const group = { backgroundColor: t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)', borderRadius: 16 * k, overflow: 'hidden' as const };
  const sep = { height: StyleSheet.hairlineWidth, backgroundColor: t.textSoft, marginLeft: 16 * k, opacity: 0.5 };
  const rowS = { paddingHorizontal: 16 * k, paddingVertical: 12 * k, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 * k };

  // Same-meal dishes first (breakfast ideas for breakfast), each group in this person's order; unsuitable ones are left out.
  const options = rank(recipes)
    .sort((a, b) => Number(b.r.cat === cur.meal) - Number(a.r.cat === cur.meal))
    .filter((x) => x.r.id !== r?.id);

  const actions: [string, () => void, boolean?][] = r
    ? [
        ['відкрити рецепт', () => {
          onClose();
          router.push(`/recipe/${r.id}`);
        }],
        ['замінити страву', () => setPicking(true)],
        ['поміняти місцями з іншою', () => onSwap(cur)],
        ['пропустити цей прийом', () => {
          setMeal(cur, null);
          onClose();
        }, true],
      ]
    : [];

  return (
    <Sheet open={!!slot} onClose={onClose}>
      <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>
        {cur.day.toLowerCase()} · {cur.meal.toLowerCase()}
      </Text>
      {r && !showPicker && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 * k, marginTop: 6 * k, marginBottom: 14 * k }}>
          <Plate recipe={r} size={64 * k} />
          <View style={{ flex: 1 }}>
            <Text style={[txt, { fontFamily: fontMedium, fontSize: 26 * k, lineHeight: 28 * k }]}>{r.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
              <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>{r.total} хв ·</Text>
              {premium ? <Text style={[txt, { color: t.textSoft, fontSize: 18 * k }]}>{r.kcal} ккал</Text> : <Lock label="ккал" size={13} color={t.textSoft} />}
            </View>
          </View>
        </View>
      )}

      {!showPicker && (
        <View style={group}>
          {actions.map(([label, run, danger], i) => (
            <View key={label}>
              {i > 0 && <View style={sep} />}
              <Pressable onPress={run} style={({ pressed }) => [rowS, pressed && { opacity: 0.5 }]} accessibilityRole="button">
                <Text style={[txt, { flex: 1 }, danger && { color: t.mode === 'dark' ? '#FB923C' : '#B42318' }]}>{label}</Text>
                <Text style={[txt, { color: t.textSoft }]}>›</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {showPicker && (
        <>
          <Text style={[txt, { fontFamily: fontMedium, fontSize: 28 * k, lineHeight: 32 * k, marginTop: 4 * k, marginBottom: 10 * k }]}>
            {r ? 'на що замінити?' : 'додати страву'}
          </Text>
          <ScrollView style={{ maxHeight: 380 * k }} showsVerticalScrollIndicator={false}>
            <View style={group}>
              {options.map(({ r: o, why }, i) => (
                <View key={o.id}>
                  {i > 0 && <View style={sep} />}
                  <Pressable
                    onPress={() => {
                      setMeal(cur, o.id);
                      onClose();
                    }}
                    style={({ pressed }) => [rowS, { paddingVertical: 8 * k }, pressed && { opacity: 0.5 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`вибрати: ${o.name}`}
                  >
                    <Plate recipe={o} size={44 * k} />
                    <View style={{ flex: 1 }}>
                      <Text style={txt} numberOfLines={1}>{o.name}</Text>
                      <Text style={[txt, { fontSize: 16 * k, lineHeight: 18 * k, color: t.textSoft }]}>
                        {o.cat.toLowerCase()} · {o.total} хв{why ? ` · ${why}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
          {r && (
            <Pressable onPress={() => setPicking(false)} style={{ alignSelf: 'center', marginTop: 12 * k }} hitSlop={8}>
              <Text style={[txt, { color: t.textSoft }]}>назад</Text>
            </Pressable>
          )}
        </>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  head: { flex: 1, textAlign: 'center', opacity: 0.7, textTransform: 'uppercase' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font, color: '#FFFFFF', textAlign: 'center' },
  action: { flex: 1, alignItems: 'center' },
  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 50, boxShadow: '0px 14px 28px rgba(0,0,0,0.45)', borderRadius: 100 },
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
});
