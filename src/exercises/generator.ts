/**
 * Exercise Generator: turns a fingered scale position into a note sequence, then
 * into a timeline track. It knows nothing about audio or the screen.
 */
import { spellPosition, type FretNote, type SpelledFretNote } from '../fretboard';
import type { Scale } from '../theory';
import { ticksPerBar, ticksPerBeat, type Meter, type NotePayload, type Track } from '../timeline';

export type ExerciseKind = 'scale' | 'interval' | 'custom';
export type Direction = 'up' | 'down' | 'updown';
export type PairMotion = 'ascending' | 'descending' | 'alternating';
/** Generic interval: 2 = second ... 8 = octave. */
export type IntervalNumber = 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const INTERVAL_NAMES: Readonly<Record<IntervalNumber, string>> = {
  2: 'Seconde', 3: 'Terze', 4: 'Quarte', 5: 'Quinte', 6: 'Seste', 7: 'Settime', 8: 'Ottave',
};

export interface ExerciseSpec {
  readonly kind: ExerciseKind;
  readonly interval: IntervalNumber;
  readonly direction: Direction;
  readonly pairMotion: PairMotion;
  /** Scale steps relative to each start note, 1-based: "1 3 2 4". */
  readonly customPattern: readonly number[];
}

export function parseCustomPattern(text: string): readonly number[] | null {
  const parts = text.trim().split(/[\s,;-]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 32) return null;
  const numbers = parts.map(Number);
  if (numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 24)) return null;
  return numbers;
}

function intervalPairs(notes: readonly SpelledFretNote[], interval: IntervalNumber): readonly [SpelledFretNote, SpelledFretNote][] {
  const pairs: [SpelledFretNote, SpelledFretNote][] = [];
  for (const note of notes) {
    // Counted on the staff, so a third is a third in a pentatonic too; where the
    // scale has no such note the pair is simply skipped.
    const target = notes.find((other) => other.staff === note.staff + interval - 1);
    if (target) pairs.push([note, target]);
  }
  return pairs;
}

function orderPair(pair: [SpelledFretNote, SpelledFretNote], index: number, motion: PairMotion): readonly SpelledFretNote[] {
  const [low, high] = pair;
  if (motion === 'ascending') return [low, high];
  if (motion === 'descending') return [high, low];
  return index % 2 === 0 ? [low, high] : [high, low];
}

function applyDirection<T>(groups: readonly (readonly T[])[], direction: Direction, reverseGroup: (group: readonly T[]) => readonly T[]): readonly T[] {
  const up = groups;
  const down = [...groups].reverse().map(reverseGroup);
  if (direction === 'up') return up.flat();
  if (direction === 'down') return down.flat();
  return [...up, ...down.slice(1)].flat();
}

/** Note order for an exercise. Input is any position; order is by pitch. */
export function generateSequence(position: readonly FretNote[], scale: Scale, spec: ExerciseSpec): readonly SpelledFretNote[] {
  const notes = [...spellPosition(position, scale)].sort((a, b) => a.midi - b.midi);
  if (notes.length === 0) return [];

  if (spec.kind === 'scale') {
    return applyDirection(notes.map((n) => [n]), spec.direction, (g) => g);
  }

  if (spec.kind === 'interval') {
    const groups = intervalPairs(notes, spec.interval).map((pair, i) => orderPair(pair, i, spec.pairMotion));
    return applyDirection(groups, spec.direction, (g) => [...g].reverse());
  }

  const maxOffset = Math.max(...spec.customPattern) - 1;
  const groups: (readonly SpelledFretNote[])[] = [];
  for (let start = 0; start + maxOffset < notes.length; start += 1) {
    groups.push(spec.customPattern.map((step) => notes[start + step - 1] as SpelledFretNote));
  }
  return applyDirection(groups, spec.direction, (g) => [...g].reverse());
}

/** Rests up to the bar line, so every repetition starts on the downbeat. */
export function exerciseTrack(sequence: readonly FretNote[], meter: Meter, notesPerBeat: number): Omit<Track<NotePayload>, 'originTick'> {
  const step = ticksPerBeat(meter) / notesPerBeat;
  const bar = ticksPerBar(meter);
  const lengthTicks = Math.max(bar, Math.ceil((sequence.length * step) / bar) * bar);
  return {
    id: 'exercise',
    lengthTicks,
    loop: true,
    events: sequence.map((note, index) => ({
      tick: index * step,
      payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks: step, index },
    })),
  };
}

export interface ExerciseSpan {
  readonly tick: number;
  readonly lengthTicks: number;
  readonly sequence: readonly FretNote[];
}

/**
 * An exercise that changes with the chord: each chord plays its own sequence
 * from its first note, on the shared grid (P1-14: the exercise follows the
 * chord's view). Notes never spill into the next chord.
 */
export function progressionExerciseTrack(spans: readonly ExerciseSpan[], meter: Meter, notesPerBeat: number, lengthTicks: number, loop: boolean): Omit<Track<NotePayload>, 'originTick'> {
  const step = ticksPerBeat(meter) / notesPerBeat;
  const events: { tick: number; payload: NotePayload }[] = [];
  for (const span of spans) {
    if (span.sequence.length === 0) continue;
    const count = Math.floor(span.lengthTicks / step);
    for (let i = 0; i < count; i += 1) {
      const note = span.sequence[i % span.sequence.length] as FretNote;
      events.push({ tick: span.tick + i * step, payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks: step, index: events.length } });
    }
  }
  return { id: 'exercise', lengthTicks, loop, events };
}
