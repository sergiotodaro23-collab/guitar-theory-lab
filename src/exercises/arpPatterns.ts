/**
 * Arpeggio vocabulary beyond straight runs (AR2–AR4): chord-tone
 * permutations with octave leaps, enclosures, triad pairs, upper structures
 * and irregular groupings. Each pattern turns the notes a shape offers into
 * a played line, ascending; the caller applies the direction. Pure: no DOM.
 */
import { DEFAULT_FRETS, STANDARD_TUNING, pitchesInWindow, type FretNote } from '../fretboard';
import { diatonicChord, tritoneSubstitute } from '../harmony';
import { mod, parseChord, parseDegree, spellDegree, noteName, type Chord, type Scale } from '../theory';
import type { ArpDirection } from './arpeggio';

export type ArpPattern = 'none' | 'perm' | 'enclosure' | 'pair' | 'upper' | 'group' | 'quartal' | 'overlay';
export const ARP_PATTERNS: readonly ArpPattern[] = ['none', 'perm', 'enclosure', 'pair', 'upper', 'group', 'quartal', 'overlay'];
export const ARP_PATTERN_NAMES: Readonly<Record<ArpPattern, string>> = {
  none: 'Arpeggio diretto',
  perm: 'Permutazione',
  enclosure: 'Enclosure',
  pair: 'Triad pair',
  upper: 'Upper structure',
  group: 'Gruppi irregolari',
  quartal: 'Quarte diatoniche',
  overlay: 'Sovrapposizione',
};

/** Permutations of the chord tones the method books drill, written with chord degrees; 8 is the root an octave up. */
export const PERMUTATIONS: readonly string[] = ['1 3 5 7', '1 5 3 7', '1 3 7 5', '1 7 5 3', '3 1 5 7', '1 5 7 3', '1 3 5 8', '1 8 5 3', '1 5 8 3', '3 5 7 9'];

const byPitch = (a: FretNote, b: FretNote) => a.midi - b.midi;

/** "1 5 3 7" → [1, 5, 3, 7]; null when a token is not a degree number from 1 to 13. */
export function parsePermutation(text: string): readonly number[] | null {
  const tokens = text.trim().split(/[\s,-]+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return null;
  const numbers = tokens.map(Number);
  return numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 13) ? numbers : null;
}

/** Semitones above the root for a degree number of this chord, or null when the chord has no such tone. */
function degreeOffset(chord: Chord, n: number): number | null {
  if (n === 8) return 12;
  const tone = chord.tones.find((t) => Number(t.degree.replace(/[#b]/g, '')) === n);
  if (!tone) return null;
  return tone.semitones + (n > 7 ? 12 : 0);
}

/**
 * A permutation in cells of one octave: from each root of the shape, the
 * chord degrees in the written order (1 5 3 7 = root, fifth, down to the
 * third, up to the seventh). A cell the shape cannot complete is left out.
 */
export function permutationLine(chord: Chord, notes: readonly FretNote[], order: readonly number[]): readonly FretNote[] {
  const rootPc = chord.tones[0]?.pc ?? 0;
  const sorted = [...notes].sort(byPitch);
  const byMidi = new Map<number, FretNote>();
  for (const n of sorted) if (!byMidi.has(n.midi)) byMidi.set(n.midi, n);
  const offsets = order.map((n) => degreeOffset(chord, n));
  if (offsets.some((o) => o === null)) return [];
  const line: FretNote[] = [];
  for (const root of sorted.filter((n) => n.pc === rootPc)) {
    const cell = (offsets as number[]).map((o) => byMidi.get(root.midi + o));
    if (cell.every((n): n is FretNote => n !== undefined)) line.push(...cell);
  }
  return line;
}

/**
 * Enclosures: every chord tone of the run approached from the scale step
 * above and the chromatic step below, then the target (F–Eb–E onto the third
 * of Cmaj7). The approach notes stay on the target's string, so the hand
 * does not move; an approach that would leave the neck is skipped.
 */
export function enclosureLine(run: readonly FretNote[], scale: Scale, tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly FretNote[] {
  const pcs = new Set(scale.tones.map((t) => t.pc));
  const at = (target: FretNote, semitones: number): FretNote | null => {
    const fret = target.fret + semitones;
    if (fret < 0 || fret > frets) return null;
    const midi = (tuning[target.string] as number) + fret;
    return { string: target.string, fret, midi, pc: mod(midi, 12) };
  };
  return [...run].sort(byPitch).flatMap((target) => {
    const above = pcs.has(mod(target.pc + 1, 12)) ? 1 : 2;
    return [at(target, above), at(target, -1), target].filter((n): n is FretNote => n !== null);
  });
}

/**
 * The triad pair of a seven-note scale: two triads on adjacent degrees with
 * no common tone, both major where the scale has such a pair (IV and V of
 * the major scale, F and G in C), else both minor, else the first found.
 */
export function triadPair(scale: Scale): readonly [Chord, Chord] | null {
  const tones = scale.tones;
  if (tones.length !== 7) return null;
  const triad = (k: number): Chord | null => {
    const r = tones[k % 7] as { name: string; pc: number };
    const third = mod((tones[(k + 2) % 7]?.pc ?? 0) - r.pc, 12);
    const fifth = mod((tones[(k + 4) % 7]?.pc ?? 0) - r.pc, 12);
    const suffix = third === 4 && fifth === 7 ? '' : third === 3 && fifth === 7 ? 'm' : null;
    return suffix === null ? null : parseChord(`${r.name}${suffix}`);
  };
  const pairs: (readonly [Chord, Chord])[] = [];
  for (let k = 0; k < 7; k += 1) {
    const a = triad(k);
    const b = triad(k + 1);
    if (!a || !b) continue;
    if (a.tones.some((t) => b.tones.some((u) => u.pc === t.pc))) continue;
    pairs.push([a, b]);
  }
  const major = pairs.find(([a, b]) => a.family === 'major' && b.family === 'major');
  const minor = pairs.find(([a, b]) => a.family === 'minor' && b.family === 'minor');
  return major ?? minor ?? pairs[0] ?? null;
}

/**
 * Alternating triads, three notes each, always moving up: the next group
 * starts on the nearest note of the other triad above the last one played.
 */
export function triadPairLine(a: Chord, b: Chord, notes: readonly FretNote[]): readonly FretNote[] {
  const sorted = [...notes].sort(byPitch);
  const pcsA = new Set(a.tones.map((t) => t.pc));
  const pcsB = new Set(b.tones.map((t) => t.pc));
  const line: FretNote[] = [];
  let last = -Infinity;
  for (let group = 0; ; group += 1) {
    const pcs = group % 2 === 0 ? pcsA : pcsB;
    const next = sorted.filter((n) => n.midi > last && pcs.has(n.pc));
    // One note of each pitch: the first occurrence going up.
    const seen = new Set<number>();
    const three = next.filter((n) => (seen.has(n.midi) ? false : (seen.add(n.midi), true))).slice(0, 3);
    if (three.length < 3) break;
    line.push(...three);
    last = (three[2] as FretNote).midi;
  }
  return line;
}

export type UpperStructure = 'II' | 'bIII' | 'IV' | 'bV' | 'V' | 'bVI' | 'VI';
export const UPPER_STRUCTURES: readonly UpperStructure[] = ['II', 'bIII', 'IV', 'bV', 'V', 'bVI', 'VI'];
const UST_DEGREE: Readonly<Record<UpperStructure, string>> = { II: '2', bIII: 'b3', IV: '4', bV: 'b5', V: '5', bVI: 'b6', VI: '6' };

/** The major triad on a degree of the chord's root: II over C7 is D (9, #11, 13), bVI is Ab (b13, 1, #9). */
export function upperStructure(chord: Chord, which: UpperStructure): Chord {
  const root = spellDegree(chord.root, parseDegree(UST_DEGREE[which]));
  return parseChord(noteName(root));
}

/** What an upper-structure triad adds over its chord, as degrees of the chord: "9 #11 13". */
export const upperStructureTensions = (chord: Chord, which: UpperStructure): readonly string[] => tensionsOver(chord, upperStructure(chord, which));

/** The tones of `other` named as degrees of `chord`: its own degree where they share a tone, else the tension. */
export function tensionsOver(chord: Chord, other: Chord): readonly string[] {
  const triad = other;
  const names = ['1', 'b9', '9', '#9', '3', '11', '#11', '5', 'b13', '13', 'b7', '7'];
  return triad.tones.map((t) => {
    const own = chord.tones.find((c) => c.pc === t.pc);
    if (own) return own.degree;
    const semis = mod(t.pc - (chord.tones[0]?.pc ?? 0), 12);
    return names[semis] as string;
  });
}

/**
 * Diatonic fourths (AR4): from the chord's root, every fourth note of its
 * scale in turn (C F B E A D in C major), each pitch the nearest one above
 * the last, as long as the hand position offers it. Perfect fourths, and the
 * one augmented fourth the scale holds. Seven-note scales only.
 */
export function quartalLine(chord: Chord, scale: Scale, notes: readonly FretNote[]): readonly FretNote[] {
  const tones = scale.tones;
  if (tones.length !== 7) return [];
  const rootPc = chord.tones[0]?.pc ?? 0;
  let k = tones.findIndex((t) => t.pc === rootPc);
  if (k < 0) return [];
  const sorted = [...notes].sort(byPitch);
  const first = sorted.find((n) => n.pc === rootPc);
  if (!first) return [];
  const line: FretNote[] = [first];
  for (;;) {
    k = (k + 3) % 7;
    const pc = tones[k]?.pc;
    const last = line[line.length - 1] as FretNote;
    const next = sorted.find((n) => n.pc === pc && n.midi > last.midi && n.midi - last.midi <= 6);
    if (!next) break;
    line.push(next);
  }
  return line;
}

export type Overlay = '3' | '5' | '7' | 'tritone';
export const OVERLAYS: readonly Overlay[] = ['3', '5', '7', 'tritone'];
export const OVERLAY_NAMES: Readonly<Record<Overlay, string>> = { '3': 'Dalla terza', '5': 'Dalla quinta', '7': 'Dalla settima', tritone: 'Sostituto di tritono' };

/**
 * The seventh chord played over another (AR4): the diatonic one built on its
 * third, fifth or seventh in its scale (Em7 over Cmaj7 gives the 9, Em7b5
 * over C7 is C9), or the tritone substitute over a dominant (Db7 over G7).
 * Null where there is none: a tritone over a chord that is not a dominant.
 */
export function overlayChord(chord: Chord, scale: Scale, which: Overlay): Chord | null {
  if (which === 'tritone') return chord.family === 'dominant' ? parseChord(tritoneSubstitute(chord)) : null;
  const degree = Number(which) - 1;
  // The scale starts on the chord's root (its chord-scale), so chord degree n is scale degree n.
  if ((scale.tones[0]?.pc ?? -1) !== chord.tones[0]?.pc) return null;
  return diatonicChord(scale.tonicName, scale.definition.id, degree, 'seventh');
}

/** The notes of any chord inside a hand position starting at `low`. */
export const windowNotes = (chord: Chord, low: number, span: number, tuning: readonly number[] = STANDARD_TUNING): readonly FretNote[] =>
  [...pitchesInWindow(chord.tones.map((t) => t.pc), low, low + span, tuning)].sort(byPitch);

/**
 * Irregular groups: N notes up from each note of the run in turn (1-2-3,
 * 2-3-4 … for groups of three). Against a meter that divides by 2 or 4 the
 * groups cross the beat: the accents fall on the first note of each group.
 */
export function groupedLine(run: readonly FretNote[], size: number): readonly FretNote[] {
  const sorted = [...run].sort(byPitch);
  const line: FretNote[] = [];
  for (let i = 0; i + size <= sorted.length; i += 1) line.push(...sorted.slice(i, i + size));
  return line;
}

/** Up, down (the line reversed), or both without repeating the turning note. */
export function directedLine(up: readonly FretNote[], direction: ArpDirection): readonly FretNote[] {
  const down = [...up].reverse();
  switch (direction) {
    case 'up': return up;
    case 'down': return down;
    case 'updown': return [...up, ...down.slice(1)];
    case 'downup': return [...down, ...up.slice(1)];
  }
}

export interface PatternChoice {
  readonly pattern: ArpPattern;
  /** Permutation order, chord degrees ("1 5 3 7"). */
  readonly perm: readonly number[];
  readonly upper: UpperStructure;
  readonly overlay?: Overlay;
  /** Notes per group for irregular groups. */
  readonly group: number;
  readonly direction: ArpDirection;
  /** The chord's scale: enclosure steps and triad pairs come from it. */
  readonly scale: Scale;
  readonly tuning?: readonly number[];
}

/** One note per pitch, low to high: where two strings give the same pitch, the thicker string's. */
function uniquePitches(notes: readonly FretNote[]): readonly FretNote[] {
  const byMidi = new Map<number, FretNote>();
  for (const n of [...notes].sort((a, b) => a.midi - b.midi || a.string - b.string)) if (!byMidi.has(n.midi)) byMidi.set(n.midi, n);
  return [...byMidi.values()];
}

/**
 * A pattern applied to the notes a shape offers (`shapeNotes`: the hand
 * position, CAGED form or route): the line to play and the notes to draw.
 * Patterns that bring in other notes (enclosures, triad pairs, upper
 * structures) stay in the frets the shape covers.
 */
export function patternLine(chord: Chord, shapeNotes: readonly FretNote[], c: PatternChoice): { readonly sequence: readonly FretNote[]; readonly notes: readonly FretNote[] } {
  const tuning = c.tuning ?? STANDARD_TUNING;
  const run = uniquePitches(shapeNotes);
  const frets = shapeNotes.map((n) => n.fret);
  const low = frets.length ? Math.min(...frets) : 0;
  const span = Math.max(4, frets.length ? Math.max(...frets) - low : 4);
  let up: readonly FretNote[] = [];
  switch (c.pattern) {
    case 'none': up = run; break;
    case 'perm': up = permutationLine(chord, run, c.perm); break;
    case 'enclosure': up = enclosureLine(run, c.scale, tuning); break;
    case 'pair': {
      const pair = triadPair(c.scale);
      if (pair) {
        const pcs = [...pair[0].tones, ...pair[1].tones].map((t) => t.pc);
        up = triadPairLine(pair[0], pair[1], uniquePitches(pitchesInWindow(pcs, low, low + span, tuning)));
      }
      break;
    }
    case 'upper': up = uniquePitches(windowNotes(upperStructure(chord, c.upper), low, span, tuning)); break;
    case 'group': up = groupedLine(run, Math.max(2, c.group)); break;
    case 'quartal': up = quartalLine(chord, c.scale, uniquePitches(pitchesInWindow(c.scale.tones.map((t) => t.pc), low, low + span, tuning))); break;
    case 'overlay': {
      const over = overlayChord(chord, c.scale, c.overlay ?? '3');
      if (over) up = uniquePitches(windowNotes(over, low, span, tuning));
      break;
    }
  }
  const drawn = new Map<string, FretNote>();
  for (const n of up) drawn.set(`${n.string}:${n.fret}`, n);
  return { sequence: directedLine(up, c.direction), notes: [...drawn.values()] };
}
