import * as Speech from 'expo-speech';
import { useEffect, useState } from 'react';
import { isAction, type Line } from '../data/narration';

// Plays a step's lines one by one. With a voice it speaks each line and moves on when the
// speech ends; without one (audio off, or no Ukrainian voice on the phone) it holds each line
// for about its reading time. A hands-on line that is not done yet stops the run: `waiting`
// turns on until `done(i)` reports it confirmed, then the run carries on. `jump(i, true)` (a tap
// on a line) reads that line again even if it is already done.

let ukVoice: Promise<string | null> | null = null;
// The first Ukrainian voice the device has, or null. Asked once per app run.
const findUkVoice = () =>
  (ukVoice ??= Speech.getAvailableVoicesAsync()
    .then((vs) => vs.find((v) => v.language.toLowerCase().startsWith('uk'))?.identifier ?? null)
    .catch(() => null));

const readMs = (text: string) => 900 + text.length * 55;

export function useNarration(lines: Line[] | undefined, stepKey: number, voiceOn: boolean, done: (i: number) => boolean) {
  const n = lines?.length ?? 0;
  // Start after the last hands-on line already confirmed, so coming back doesn't re-ask.
  const startAt = () => {
    let at = 0;
    lines?.forEach((l, i) => {
      if (isAction(l) && done(i)) at = i + 1;
    });
    return at;
  };
  const fresh = () => ({ step: stepKey, idx: startAt(), said: false, force: false });
  const [state, setState] = useState(fresh);
  // A new step (or a new recipe): reset during render rather than in an effect.
  if (state.step !== stepKey) setState(fresh());
  const { idx, said, force } = state.step === stepKey ? state : fresh();
  const line = idx < n ? lines![idx] : undefined;
  const lineDone = line ? isAction(line) && done(idx) : false;
  const skip = lineDone && !force;

  const jump = (i: number, again = false) => setState({ step: stepKey, idx: Math.max(0, Math.min(i, n)), said: false, force: again });

  // A hands-on line that got confirmed (by "готово" or earlier): go on to the next one.
  if (skip && state.step === stepKey) setState({ ...state, idx: idx + 1, said: false, force: false });

  useEffect(() => {
    if (!line || said || skip) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (!alive) return;
      setState((s) => {
        if (s.step !== stepKey || s.idx !== idx) return s;
        return isAction(line) && !lineDone ? { ...s, said: true } : { ...s, idx: idx + 1, said: false, force: false };
      });
    };
    const hold = () => {
      timer = setTimeout(finish, readMs(line.text));
    };
    if (voiceOn) {
      findUkVoice().then((voice) => {
        if (!alive) return;
        if (!voice) return hold();
        Speech.speak((line.say ?? line.text).replace(/\*\*/g, ''), {
          language: 'uk-UA',
          voice,
          onDone: finish,
          onError: hold,
        });
      });
    } else hold();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      Speech.stop();
    };
  }, [line, said, skip, lineDone, voiceOn, idx, stepKey]);

  return {
    idx,
    // The current hands-on line has been read and waits for "готово".
    waiting: !!line && isAction(line) && said && !lineDone,
    focus: line?.focus,
    jump,
  };
}
