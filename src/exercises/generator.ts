/**
 * Exercise Generator: turns a fingered scale position into a note sequence, then
 * into a timeline track. It knows nothing about audio or the screen.
 */
import { spellPosition, type FretNote, type SpelledFretNote } from '../fretboard';
import { chromaticName, parseNote, type Scale } from '../theory';
import { ticksPerBar, ticksPerBeat, type Meter, type NotePayload, type Subdivision, type Track } from '../timeline';
import { layoutRhythm, uniformRhythm, type Articulation, type RhythmStep } from './rhythm';

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
  /**
   * Scale steps relative to each start note, 1-based: "1 3 2 4". A negative
   * step (written "4c") is the chromatic note a semitone below that step (M5).
   */
  readonly customPattern: readonly number[];
  /** How each group of a sequence runs (M5): as written, reversed, or every other one reversed. */
  readonly groupMotion?: PairMotion;
}

/**
 * Steps of a sequence: numbers 1–24 separated by spaces or commas. With
 * `chromatic`, a step followed by «c» is the chromatic approach from below,
 * returned as a negative number ("3c 3" in C: D# E).
 */
export function parseCustomPattern(text: string, { chromatic = false }: { readonly chromatic?: boolean } = {}): readonly number[] | null {
  const parts = text.trim().split(/[\s,;-]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 32) return null;
  const numbers: number[] = [];
  for (const part of parts) {
    const match = /^(\d+)(c?)$/i.exec(part);
    if (!match || (match[2] && !chromatic)) return null;
    const n = Number(match[1]);
    if (n < 1 || n > 24) return null;
    numbers.push(match[2] ? -n : n);
  }
  if (!numbers.some((n) => n > 0)) return null;
  return numbers;
}

/** Ready-made sequences (M5): groups, broken intervals, permutations, irregular groupings, chromatic approaches. */
export const SEQUENCE_PATTERNS: readonly { readonly text: string; readonly label: string }[] = [
  { text: '1 2 3', label: 'Gruppi di 3' },
  { text: '1 2 3 4', label: 'Gruppi di 4' },
  { text: '1 2 3 4 5', label: 'Gruppi di 5' },
  { text: '1 2 3 4 5 6', label: 'Gruppi di 6' },
  { text: '1 3 2 4', label: 'Terze spezzate (1 3 2 4)' },
  { text: '1 2 3 5', label: '1-2-3-5' },
  { text: '1 3 5 3', label: 'Triade spezzata (1 3 5 3)' },
  { text: '1 4', label: 'Quarte (1 4)' },
  { text: '1 2 4 3', label: 'Permutazione 1 2 4 3' },
  { text: '1 4 3 2', label: 'Permutazione 1 4 3 2' },
  { text: '2 1 3 2', label: 'Permutazione 2 1 3 2' },
  { text: '1 2 3 1 2', label: 'Irregolare 3+2' },
  { text: '1 2 1 2 3', label: 'Irregolare 2+3' },
  { text: '1 2 3 5c 5', label: 'Approccio cromatico alla quinta' },
  { text: '3c 3 2 1', label: 'Approccio cromatico dal basso' },
];

/** All orderings of the steps 1…size (size 2–5), in lexicographic order: the permutations of a group. */
export function groupPermutations(size: number): readonly (readonly number[])[] {
  const n = Math.max(2, Math.min(5, Math.floor(size)));
  const out: number[][] = [];
  const walk = (prefix: number[], rest: number[]) => {
    if (rest.length === 0) out.push(prefix);
    rest.forEach((v, i) => walk([...prefix, v], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  walk([], Array.from({ length: n }, (_, i) => i + 1));
  return out;
}

/** The fretboard note a semitone below `target`: same string one fret down, else the next lower string. */
function approachFrom(target: SpelledFretNote, notes: readonly SpelledFretNote[]): SpelledFretNote | null {
  const midi = target.midi - 1;
  let place: { string: number; fret: number } | null = target.fret >= 1 ? { string: target.string, fret: target.fret - 1 } : null;
  if (!place) {
    const below = notes.find((n) => n.string === target.string - 1);
    if (below) {
      const fret = midi - (below.midi - below.fret);
      if (fret >= 0 && fret <= 24) place = { string: below.string, fret };
    }
  }
  if (!place) return null;
  const pc = ((midi % 12) + 12) % 12;
  const name = chromaticName(pc, false);
  return { ...place, midi, pc, degree: 'crom.', name, note: parseNote(name), staff: target.staff - (name[0] === target.name[0] ? 0 : 1) };
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

  const maxOffset = Math.max(...spec.customPattern.map(Math.abs)) - 1;
  const groups: (readonly SpelledFretNote[])[] = [];
  for (let start = 0; start + maxOffset < notes.length; start += 1) {
    const group = spec.customPattern.flatMap((step) => {
      const target = notes[start + Math.abs(step) - 1] as SpelledFretNote;
      if (step > 0) return [target];
      const approach = approachFrom(target, notes);
      return approach ? [approach] : [];
    });
    const motion = spec.groupMotion ?? 'ascending';
    const reversed = motion === 'descending' || (motion === 'alternating' && groups.length % 2 === 1);
    groups.push(reversed ? [...group].reverse() : group);
  }
  return applyDirection(groups, spec.direction, (g) => [...g].reverse());
}

/**
 * Rests up to the bar line, so every repetition starts on the downbeat. The
 * notes fall on `rhythm` (M3) when given, otherwise `notesPerBeat` to the beat.
 */
export function exerciseTrack(
  sequence: readonly FretNote[], meter: Meter, notesPerBeat: Subdivision,
  rhythm: readonly RhythmStep[] = uniformRhythm(meter, notesPerBeat), articulation: Articulation = 'legato',
): Omit<Track<NotePayload>, 'originTick'> {
  const bar = ticksPerBar(meter);
  const layout = layoutRhythm(sequence.length, rhythm, articulation);
  const lengthTicks = Math.max(bar, Math.ceil(layout.lengthTicks / bar) * bar);
  return {
    id: 'exercise',
    lengthTicks,
    loop: true,
    events: layout.notes.map(({ index, tick, durationTicks }) => {
      const note = sequence[index] as FretNote;
      return { tick, payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks, index } };
    }),
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
