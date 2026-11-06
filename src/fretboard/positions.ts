/**
 * Fretboard & Fingering Engine. Strings are numbered as a guitarist does:
 * index 0 is the low E (string 6), index 5 is the high E (string 1).
 */
import { diatonicIndex, mod, type Scale, type SpelledNote } from '../theory';

export const STANDARD_TUNING: readonly number[] = [40, 45, 50, 55, 59, 64];
/** Frets 0–24 inclusive: every position of a 24-fret neck is reachable. */
export const DEFAULT_FRETS = 24;

export interface FretPosition {
  readonly string: number;
  readonly fret: number;
}

export interface FretNote extends FretPosition {
  readonly midi: number;
  readonly pc: number;
}

export const midiAt = (pos: FretPosition, tuning = STANDARD_TUNING): number => (tuning[pos.string] as number) + pos.fret;

export function allFretNotes(frets = DEFAULT_FRETS, tuning = STANDARD_TUNING): readonly FretNote[] {
  const notes: FretNote[] = [];
  tuning.forEach((open, string) => {
    for (let fret = 0; fret <= frets; fret += 1) {
      notes.push({ string, fret, midi: open + fret, pc: mod(open + fret, 12) });
    }
  });
  return notes;
}

export type CagedForm = 'C' | 'A' | 'G' | 'E' | 'D';
export const CAGED_FORMS: readonly CagedForm[] = ['C', 'A', 'G', 'E', 'D'];

/**
 * Each form is anchored on the root of the parent major key on one string.
 * low/high are the fret window relative to that root.
 */
const CAGED_WINDOWS: Readonly<Record<CagedForm, { rootString: number; low: number; high: number }>> = {
  C: { rootString: 1, low: -3, high: 0 },
  A: { rootString: 1, low: -1, high: 3 },
  G: { rootString: 0, low: -3, high: 0 },
  E: { rootString: 0, low: -1, high: 2 },
  D: { rootString: 2, low: -1, high: 3 },
};

export interface ScalePosition {
  readonly label: string;
  readonly notes: readonly FretNote[];
}

export interface FingeredNote extends FretNote {
  /** 1 index, 2 middle, 3 ring, 4 pinky; 0 for an open string. */
  readonly finger: number;
}

const byPitchThenString = (a: FretNote, b: FretNote) => a.midi - b.midi || a.string - b.string;

/** Keep a note only once when two strings reach the same pitch inside a shape. */
function uniquePitches(notes: readonly FretNote[]): readonly FretNote[] {
  const seen = new Set<number>();
  return [...notes].sort(byPitchThenString).filter((note) => {
    if (seen.has(note.midi)) return false;
    seen.add(note.midi);
    return true;
  });
}

function parentRootPc(scale: Scale): number {
  return mod((scale.tones[0] as Scale['tones'][number]).pc + scale.definition.parentOffset, 12);
}

/**
 * CAGED position for any scale. The shape comes from the parent major key, so
 * D dorian in E form uses the C major E form. Scale tones a window leaves out
 * (F# in the G form, say) are added on the nearest string, so the position never
 * skips a degree.
 */
export function cagedPosition(scale: Scale, form: CagedForm, frets = DEFAULT_FRETS, tuning = STANDARD_TUNING): ScalePosition {
  const window = CAGED_WINDOWS[form];
  const open = tuning[window.rootString] as number;
  let rootFret = mod(parentRootPc(scale) - mod(open, 12), 12);
  // The window must fit on the neck with one fret to spare below for stretches.
  while (rootFret + window.low < 1) rootFret += 12;
  const low = rootFret + window.low;
  const high = rootFret + window.high;
  const pcs = new Set(scale.tones.map((tone) => tone.pc));

  const inWindow: FretNote[] = [];
  tuning.forEach((openMidi, string) => {
    for (let fret = low; fret <= Math.min(high, frets); fret += 1) {
      const midi = openMidi + fret;
      if (pcs.has(mod(midi, 12))) inWindow.push({ string, fret, midi, pc: mod(midi, 12) });
    }
  });

  return {
    label: `Forma ${form}`,
    notes: fillGaps(uniquePitches(inWindow), scale, low, high, frets, tuning),
  };
}

function fillGaps(
  notes: readonly FretNote[],
  scale: Scale,
  low: number,
  high: number,
  frets: number,
  tuning: readonly number[],
): readonly FretNote[] {
  const pcs = new Set(scale.tones.map((tone) => tone.pc));
  const result = [...notes];
  const first = notes[0];
  const last = notes[notes.length - 1];
  if (!first || !last) return notes;
  for (let midi = first.midi + 1; midi < last.midi; midi += 1) {
    if (!pcs.has(mod(midi, 12)) || result.some((note) => note.midi === midi)) continue;
    let best: FretNote | undefined;
    let bestCost = Infinity;
    tuning.forEach((open, string) => {
      const fret = midi - open;
      if (fret < 0 || fret > frets) return;
      const cost = fret < low ? low - fret : fret > high ? fret - high + 0.25 : 0;
      if (cost < bestCost) {
        bestCost = cost;
        best = { string, fret, midi, pc: mod(midi, 12) };
      }
    });
    if (best) result.push(best);
  }
  return [...result].sort(byPitchThenString);
}

/**
 * Every scale tone inside a fret window, one per pitch. For exercises bound to
 * a selected stretch of the neck rather than to a named shape.
 */
export function rangePosition(scale: Scale, lowFret: number, highFret: number, tuning = STANDARD_TUNING): ScalePosition {
  const low = Math.max(0, Math.min(lowFret, highFret));
  const high = Math.min(DEFAULT_FRETS, Math.max(lowFret, highFret));
  const pcs = new Set(scale.tones.map((tone) => tone.pc));
  const inWindow: FretNote[] = [];
  tuning.forEach((openMidi, string) => {
    for (let fret = low; fret <= high; fret += 1) {
      const midi = openMidi + fret;
      if (pcs.has(mod(midi, 12))) inWindow.push({ string, fret, midi, pc: mod(midi, 12) });
    }
  });
  return { label: `Tasti ${low}–${high}`, notes: uniquePitches(inWindow) };
}

/** The same shape twelve frets higher, or null when it would leave the neck. */
export function shiftOctave(notes: readonly FretNote[], frets = DEFAULT_FRETS): readonly FretNote[] | null {
  const shifted = notes.map((note) => ({ ...note, fret: note.fret + 12, midi: note.midi + 12 }));
  return shifted.every((note) => note.fret <= frets) ? shifted : null;
}

/** Starting degree for each 3NPS shape equals its index in the scale. */
export function threeNpsPosition(scale: Scale, startDegreeIndex: number, frets = DEFAULT_FRETS, tuning = STANDARD_TUNING): ScalePosition | null {
  if (scale.tones.length !== 7) return null;
  const size = 7;
  const start = mod(startDegreeIndex, size);
  const startPc = (scale.tones[start] as Scale['tones'][number]).pc;
  const lowOpen = tuning[0] as number;
  let startFret = mod(startPc - mod(lowOpen, 12), 12);

  for (let attempt = 0; attempt < 2; attempt += 1, startFret += 12) {
    const notes: FretNote[] = [];
    let midi = lowOpen + startFret;
    let degree = start;
    let valid = true;
    for (let string = 0; string < tuning.length && valid; string += 1) {
      for (let i = 0; i < 3; i += 1) {
        const fret = midi - (tuning[string] as number);
        if (fret < 0 || fret > frets) {
          valid = false;
          break;
        }
        notes.push({ string, fret, midi, pc: mod(midi, 12) });
        const nextDegree = (degree + 1) % size;
        const step = mod((scale.tones[nextDegree] as Scale['tones'][number]).pc - (scale.tones[degree] as Scale['tones'][number]).pc, 12);
        midi += step;
        degree = nextDegree;
      }
    }
    if (valid) return { label: `3NPS dal grado ${scale.tones[start]?.degree}`, notes };
  }
  return null;
}

/**
 * Index finger on the lowest fret of the shape; the rest by distance, one finger
 * per fret. Wider shapes shift the hand along the string, as 3NPS stretches do.
 */
export function fingerPosition(notes: readonly FretNote[]): readonly FingeredNote[] {
  const byString = new Map<number, FretNote[]>();
  for (const note of notes) {
    byString.set(note.string, [...(byString.get(note.string) ?? []), note]);
  }
  const fretted = notes.filter((n) => n.fret > 0).map((n) => n.fret);
  const lowest = fretted.length ? Math.min(...fretted) : 0;
  return notes.map((note) => {
    if (note.fret === 0) return { ...note, finger: 0 };
    const onString = (byString.get(note.string) ?? []).filter((n) => n.fret > 0).map((n) => n.fret);
    const stringLow = Math.min(...onString);
    const stringHigh = Math.max(...onString);
    const span = stringHigh - stringLow;
    const anchor = span > 3 ? stringLow : stringLow - lowest <= 3 - span ? lowest : stringLow;
    const raw = note.fret - anchor + 1;
    // Three notes spanning a major third: 1-2-4 or 1-3-4, not 1-3-5.
    return { ...note, finger: Math.min(4, Math.max(1, raw)) };
  });
}

export interface SpelledFretNote extends FretNote {
  readonly degree: string;
  readonly name: string;
  readonly note: SpelledNote;
  /** Staff index, for counting generic intervals. */
  readonly staff: number;
}

export function spellPosition(notes: readonly FretNote[], scale: Scale): readonly SpelledFretNote[] {
  return notes.flatMap((note) => {
    const tone = scale.tones.find((t) => t.pc === note.pc);
    if (!tone) return [];
    return [{ ...note, degree: tone.degree, name: tone.name, note: tone.note, staff: diatonicIndex(note.midi, tone.note) }];
  });
}
