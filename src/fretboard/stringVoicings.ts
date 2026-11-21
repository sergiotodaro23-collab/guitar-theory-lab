/**
 * Voicing engine on string sets (HA3): close, drop 2, drop 3, drop 2&4,
 * shell and quartal voicings, every inversion, placed on a chosen group of
 * strings (1-2-3, 2-3-4, 6-4-3-2 …). The spacing is worked out from the
 * chord, never read from a table of shapes; the neck only decides where each
 * spacing can be fretted. Which tones a dense chord keeps and which it drops
 * is part of the result, and so is how hard the shape is for the hand.
 *
 * Strings: index 0 is the low E (string 6), index 5 the high E (string 1),
 * as in `positions.ts`. String sets are given and shown with the guitarist's
 * numbers (1 = high E).
 */
import { mod, type Chord, type ChordTone, type Scale } from '../theory';
import { DEFAULT_FRETS, STANDARD_TUNING, type FretNote } from './positions';

export type VoicingType = 'close' | 'drop2' | 'drop3' | 'drop24' | 'shell' | 'quartal';
export const VOICING_TYPES: readonly VoicingType[] = ['close', 'drop2', 'drop3', 'drop24', 'shell', 'quartal'];
export const VOICING_TYPE_NAMES: Readonly<Record<VoicingType, string>> = {
  close: 'Posizione stretta', drop2: 'Drop 2', drop3: 'Drop 3', drop24: 'Drop 2&4', shell: 'Shell', quartal: 'Quartale',
};

/** A group of strings, guitarist numbering (1 = high E), written from the highest string: "1-2-3". */
export interface StringSet {
  readonly id: string;
  /** Guitarist numbers, high to low as written. */
  readonly numbers: readonly number[];
}

const set = (...numbers: number[]): StringSet => ({ id: numbers.join('-'), numbers });

/** The string groups each voicing type is played on, as method books teach them. */
export const STRING_SETS: Readonly<Record<VoicingType, readonly StringSet[]>> = {
  close: [set(1, 2, 3), set(2, 3, 4), set(3, 4, 5), set(4, 5, 6), set(1, 2, 3, 4), set(2, 3, 4, 5), set(3, 4, 5, 6)],
  drop2: [set(1, 2, 3, 4), set(2, 3, 4, 5), set(3, 4, 5, 6)],
  drop3: [set(1, 2, 3, 5), set(2, 3, 4, 6)],
  drop24: [set(1, 2, 4, 5), set(2, 3, 5, 6)],
  shell: [set(3, 4, 6), set(3, 4, 5), set(2, 3, 5), set(4, 5, 6)],
  quartal: [set(1, 2, 3), set(2, 3, 4), set(3, 4, 5), set(4, 5, 6), set(1, 2, 3, 4), set(2, 3, 4, 5), set(3, 4, 5, 6)],
};

export const findStringSet = (id: string): StringSet | null => {
  const numbers = id.split('-').map(Number);
  if (numbers.length < 3 || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 6) || new Set(numbers).size !== numbers.length) return null;
  return set(...numbers);
};

/** String indices (0 = low E) of a set, low to high. */
export const stringIndices = (s: StringSet, strings = 6): readonly number[] => [...s.numbers].map((n) => strings - n).sort((a, b) => a - b);

export interface StringVoicing {
  readonly type: VoicingType;
  readonly stringSet: string;
  /** One entry per string, low E first: fret or null (not played). */
  readonly frets: readonly (number | null)[];
  /** Sounding notes, low to high. */
  readonly notes: readonly FretNote[];
  /** Chord degree of each note, low to high. */
  readonly degrees: readonly string[];
  /** 0 root, 1 third, 2 fifth, 3 seventh in the bass; null when a tension is the bass (rootless voicings). */
  readonly inversion: number | null;
  /** Degrees of the chord this voicing leaves out. */
  readonly omitted: readonly string[];
  /** Fretted span: highest minus lowest fretted note. */
  readonly span: number;
  /** 1 easy … 5 hard: stretch, four different frets, positions high on the neck. */
  readonly difficulty: number;
}

export interface StringVoicingOptions {
  readonly tuning?: readonly number[];
  readonly frets?: number;
  /** Widest fretted span allowed: 3 is index to pinky in four frets; 4 allows a stretch. */
  readonly maxSpan?: number;
  /** Degrees the player chooses to leave out ("5", "1"); they are never forced back in. */
  readonly omit?: readonly string[];
  /** Quartal voicings stack fourths of this scale. Without it, the chord's own tones are stacked. */
  readonly scale?: Scale;
}

const degreeNumber = (degree: string): number => Number(degree.replace(/[#b]/g, ''));

/** 0 root, 1 third (or the sus note), 2 fifth, 3 seventh or sixth; null for tensions. */
export function inversionOfDegree(degree: string): number | null {
  const n = degreeNumber(degree);
  if (n === 1) return 0;
  if (n === 2 || n === 3 || n === 4) return 1;
  if (n === 5) return 2;
  if (n === 6 || n === 7) return 3;
  return null;
}

/** The tones a chord cannot lose: third (or sus note), seventh (or sixth), and an altered fifth. */
const isEssential = (t: ChordTone, chord: Chord): boolean => {
  const n = degreeNumber(t.degree);
  if (n === 3 || n === 7) return true;
  if ((n === 2 || n === 4) && chord.family === 'suspended') return true;
  if (n === 6 && !chord.tones.some((x) => degreeNumber(x.degree) === 7)) return true;
  if (n === 5 && t.degree !== '5') return true;
  return false;
};

/** Order in which a guitarist drops tones from a dense chord: fifth, root, then the lower tensions. */
const OMIT_ORDER = ['5', '1', '11', '9'];

export interface ToneChoice {
  /** Tones voiced, in chord order (doubled root last when the chord is smaller than the set). */
  readonly tones: readonly ChordTone[];
  readonly omitted: readonly string[];
}

/**
 * The tones `voices` notes can carry. A small chord doubles its root; a dense
 * one drops the fifth, then the root, then the lowest tensions, keeping the
 * guide tones and any altered fifth. The player's own omissions come first.
 */
export function chooseTones(chord: Chord, voices: number, omit: readonly string[] = []): ToneChoice {
  let tones = chord.tones.filter((t) => !omit.includes(t.degree) || isEssential(t, chord));
  const omitted = chord.tones.filter((t) => !tones.includes(t)).map((t) => t.degree);
  // A flat ninth over its own root is a minor ninth: four-voice 7b9 voicings leave the root out (B D F Ab for G7b9).
  const order = chord.tones.some((t) => t.degree === 'b9') ? ['1', ...OMIT_ORDER.filter((d) => d !== '1')] : OMIT_ORDER;
  for (const degree of order) {
    if (tones.length <= voices) break;
    const t = tones.find((x) => x.degree === degree);
    if (t && !isEssential(t, chord)) {
      tones = tones.filter((x) => x !== t);
      omitted.push(degree);
    }
  }
  while (tones.length > voices) {
    // Still too many: drop the lowest non-essential tension left.
    const t = tones.find((x) => !isEssential(x, chord) && degreeNumber(x.degree) > 7) ?? tones.find((x) => !isEssential(x, chord));
    if (!t) break;
    tones = tones.filter((x) => x !== t);
    omitted.push(t.degree);
  }
  if (tones.length > voices) return { tones: tones.slice(0, voices), omitted };
  const root = tones.find((t) => t.degree === '1') ?? tones[0];
  const filled = [...tones];
  while (filled.length < voices && root) filled.push(root);
  return { tones: filled, omitted };
}

/** A spacing: semitones above the bass for each voice, low to high, with the degree of each voice. */
interface Spacing {
  readonly offsets: readonly number[];
  readonly degrees: readonly string[];
}

/** Close position from tone k upward: each voice the next tone above the previous, within an octave. */
function closeFrom(tones: readonly ChordTone[], k: number): { pitch: number; degree: string }[] {
  const rotated = [...tones.slice(k), ...tones.slice(0, k)];
  const out: { pitch: number; degree: string }[] = [];
  for (const t of rotated) {
    const previous = out[out.length - 1];
    let pitch = t.semitones;
    if (previous) while (pitch <= previous.pitch) pitch += 12;
    out.push({ pitch, degree: t.degree });
  }
  return out;
}

const DROPS: Readonly<Record<'close' | 'drop2' | 'drop3' | 'drop24', readonly number[]>> = {
  close: [], drop2: [2], drop3: [3], drop24: [2, 4],
};

function normalize(voices: readonly { pitch: number; degree: string }[]): Spacing {
  const sorted = [...voices].sort((a, b) => a.pitch - b.pitch);
  const bass = sorted[0]?.pitch ?? 0;
  return { offsets: sorted.map((v) => v.pitch - bass), degrees: sorted.map((v) => v.degree) };
}

/** Every inversion of a close or drop voicing: drop the n-th voice from the top an octave. */
function dropSpacings(tones: readonly ChordTone[], type: 'close' | 'drop2' | 'drop3' | 'drop24'): readonly Spacing[] {
  const drops = DROPS[type];
  if (drops.some((d) => d > tones.length)) return [];
  return tones.map((_, k) => {
    const close = closeFrom(tones, k);
    const voices = close.map((v, i) => (drops.includes(close.length - i) ? { ...v, pitch: v.pitch - 12 } : v));
    return normalize(voices);
  });
}

/** Shells: root in the bass, then third and seventh in either order (R-3-7, R-7-3). */
function shellSpacings(chord: Chord, voices: number): readonly Spacing[] {
  const root = chord.tones[0];
  const third = chord.tones.find((t) => [2, 3, 4].includes(degreeNumber(t.degree)));
  const seventh = chord.tones.find((t) => degreeNumber(t.degree) === 7) ?? chord.tones.find((t) => degreeNumber(t.degree) === 6)
    ?? chord.tones.find((t) => degreeNumber(t.degree) === 5);
  if (!root || !third || !seventh || voices !== 3) return [];
  const up = (from: number, to: number) => { let p = to; while (p <= from) p += 12; return p; };
  const a3 = up(0, third.semitones);
  const a7 = up(a3, seventh.semitones);
  const b7 = up(0, seventh.semitones);
  const b3 = up(b7, third.semitones);
  return [
    { offsets: [0, a3, a7], degrees: ['1', third.degree, seventh.degree] },
    { offsets: [0, b7, b3], degrees: ['1', seventh.degree, third.degree] },
  ];
}

/** Degree of a pitch class above the chord root, as the quartal stack names it. */
const DEGREE_BY_SEMITONE = ['1', 'b9', '9', '#9', '3', '11', '#11', '5', 'b13', '13', 'b7', '7'];
function degreeIn(chord: Chord, pc: number): string {
  const tone = chord.tones.find((t) => t.pc === pc);
  if (tone) return tone.degree;
  const semis = mod(pc - (chord.tones[0]?.pc ?? 0), 12);
  if (semis === 3 && !chord.tones.some((t) => t.degree === '3')) return 'b3';
  return DEGREE_BY_SEMITONE[semis] as string;
}

/**
 * Quartal stacks: fourths of the scale (three scale steps each), from each
 * degree. A stack is kept when it carries the chord's third (or sus note) and,
 * with four voices, its seventh: the colour of the chord in fourths.
 */
function quartalSpacings(chord: Chord, voices: number, scale: Scale | undefined): readonly Spacing[] {
  const pcs = scale && scale.tones.length === 7 ? scale.tones.map((t) => t.pc) : null;
  const third = chord.tones.find((t) => [2, 3, 4].includes(degreeNumber(t.degree)));
  const seventh = chord.tones.find((t) => [6, 7].includes(degreeNumber(t.degree)));
  const out: Spacing[] = [];
  if (pcs) {
    for (let start = 0; start < 7; start += 1) {
      const stack: number[] = [];
      let pitch = mod((pcs[start] as number) - (chord.tones[0]?.pc ?? 0), 12);
      for (let v = 0; v < voices; v += 1) {
        if (v > 0) {
          const next = pcs[(start + 3 * v) % 7] as number;
          const step = mod(next - (pcs[(start + 3 * (v - 1)) % 7] as number), 12);
          pitch += step;
        }
        stack.push(pitch);
      }
      const stackPcs = stack.map((p) => mod(p + (chord.tones[0]?.pc ?? 0), 12));
      if (third && !stackPcs.includes(third.pc)) continue;
      if (voices >= 4 && seventh && !stackPcs.includes(seventh.pc)) continue;
      // Only fourths, perfect or augmented: a stack across the scale's tritone is still quartal.
      out.push({ offsets: stack.map((p) => p - (stack[0] as number)), degrees: stackPcs.map((pc) => degreeIn(chord, pc)) });
    }
    return out;
  }
  // No scale: perfect fourths from each chord tone, kept when every note is in the chord or its tensions.
  for (const t of chord.tones) {
    const offsets = Array.from({ length: voices }, (_, v) => v * 5);
    const stackPcs = offsets.map((o) => mod(t.pc + o, 12));
    if (third && !stackPcs.includes(third.pc)) continue;
    out.push({ offsets, degrees: stackPcs.map((pc) => degreeIn(chord, pc)) });
  }
  return out;
}

function difficultyOf(frets: readonly number[], span: number): number {
  const fretted = frets.filter((f) => f > 0);
  const distinct = new Set(fretted).size;
  const high = fretted.length ? Math.min(...fretted) : 0;
  let d = 1;
  if (span >= 2) d += 1;
  if (span >= 3) d += 1;
  if (span >= 4) d += 1;
  if (distinct >= 4) d += 1;
  if (high >= 15) d += 0.5;
  return Math.min(5, Math.round(d));
}

/** Every place on the neck where a spacing fits the strings, with each voice on its own string. */
function place(spacing: Spacing, strings: readonly number[], type: VoicingType, setId: string, chord: Chord, omitted: readonly string[], o: StringVoicingOptions): StringVoicing[] {
  const tuning = o.tuning ?? STANDARD_TUNING;
  const frets = o.frets ?? DEFAULT_FRETS;
  const maxSpan = o.maxSpan ?? 4;
  const bassString = strings[0] as number;
  const bassPc = mod((chord.tones.find((t) => t.degree === spacing.degrees[0])?.pc ?? degreePc(chord, spacing.degrees[0] as string)), 12);
  const out: StringVoicing[] = [];
  for (let bassFret = 0; bassFret <= frets; bassFret += 1) {
    const bassMidi = (tuning[bassString] as number) + bassFret;
    if (mod(bassMidi, 12) !== bassPc) continue;
    const fretsPerVoice = spacing.offsets.map((offset, i) => bassMidi + offset - (tuning[strings[i] as number] as number));
    if (fretsPerVoice.some((f) => f < 0 || f > frets)) continue;
    const fretted = fretsPerVoice.filter((f) => f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    if (span > maxSpan) continue;
    // Open strings only beside a hand in the first position.
    if (fretsPerVoice.includes(0) && fretted.some((f) => f > 5)) continue;
    const byString: (number | null)[] = tuning.map(() => null);
    strings.forEach((s, i) => { byString[s] = fretsPerVoice[i] as number; });
    const notes = strings.map((s, i) => {
      const fret = fretsPerVoice[i] as number;
      const midi = (tuning[s] as number) + fret;
      return { string: s, fret, midi, pc: mod(midi, 12) };
    });
    out.push({
      type, stringSet: setId, frets: byString, notes, degrees: spacing.degrees,
      inversion: inversionOfDegree(spacing.degrees[0] as string), omitted, span,
      difficulty: difficultyOf(fretsPerVoice, span),
    });
  }
  return out;
}

function degreePc(chord: Chord, degree: string): number {
  const root = chord.tones[0]?.pc ?? 0;
  const i = DEGREE_BY_SEMITONE.indexOf(degree);
  return mod(root + (i < 0 ? 0 : i), 12);
}

/**
 * All voicings of one type on one string set, every inversion, all along the
 * neck, ordered from the lowest bass up: walking the list climbs through the
 * inversions.
 */
export function stringSetVoicings(chord: Chord, type: VoicingType, stringSet: StringSet | string, o: StringVoicingOptions = {}): readonly StringVoicing[] {
  const s = typeof stringSet === 'string' ? findStringSet(stringSet) : stringSet;
  if (!s) return [];
  const tuning = o.tuning ?? STANDARD_TUNING;
  const strings = stringIndices(s, tuning.length);
  const voices = strings.length;
  let spacings: readonly Spacing[];
  let omitted: readonly string[] = [];
  if (type === 'shell') {
    spacings = shellSpacings(chord, voices);
    omitted = chord.tones.filter((t) => !spacings[0]?.degrees.includes(t.degree)).map((t) => t.degree);
  } else if (type === 'quartal') {
    spacings = quartalSpacings(chord, voices, o.scale);
  } else {
    const choice = chooseTones(chord, voices, o.omit);
    omitted = choice.omitted;
    spacings = dropSpacings(choice.tones, type);
  }
  const seen = new Set<string>();
  const out: StringVoicing[] = [];
  for (const spacing of spacings) {
    for (const v of place(spacing, strings, type, s.id, chord, omitted, o)) {
      const key = v.frets.map((f) => (f === null ? 'x' : f)).join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(v);
    }
  }
  return out.sort((a, b) => (a.notes[0]?.midi ?? 0) - (b.notes[0]?.midi ?? 0) || (a.notes[a.notes.length - 1]?.midi ?? 0) - (b.notes[b.notes.length - 1]?.midi ?? 0));
}

export const stringVoicingKey = (v: StringVoicing): string => v.frets.map((f) => (f === null ? 'x' : String(f))).join('-');

/** Semitones each voice moves from one voicing to the next, voice by voice from the bottom. */
export function voiceMotion(from: StringVoicing, to: StringVoicing): readonly number[] {
  const a = from.notes.map((n) => n.midi);
  const b = to.notes.map((n) => n.midi);
  const n = Math.min(a.length, b.length);
  return Array.from({ length: n }, (_, i) => (b[i] as number) - (a[i] as number));
}

const motionCost = (from: StringVoicing, to: StringVoicing): number => {
  const moves = voiceMotion(from, to).map(Math.abs);
  const fretShift = Math.abs(lowFret(to) - lowFret(from));
  // Total motion first, then no single voice leaping, then the hand staying put.
  return moves.reduce((s, m) => s + m, 0) + Math.max(0, ...moves) * 0.5 + fretShift * 0.15;
};

const lowFret = (v: StringVoicing): number => {
  const fretted = v.notes.map((n) => n.fret).filter((f) => f > 0);
  return fretted.length ? Math.min(...fretted) : 0;
};

/**
 * Voice leading over a progression: one voicing per chord, chosen together
 * (dynamic programming) so the sum of the voices' motion is the least. With
 * `near`, the first chord sits as close as possible to that fret.
 */
export function leadVoicings(candidates: readonly (readonly StringVoicing[])[], near?: number): readonly (StringVoicing | null)[] {
  if (candidates.length === 0) return [];
  type Cell = { cost: number; from: number };
  const table: Cell[][] = [];
  candidates.forEach((options, i) => {
    table[i] = options.map((v) => {
      if (i === 0) return { cost: near === undefined ? 0 : Math.abs(lowFret(v) - near) * 0.5 + v.difficulty * 0.1, from: -1 };
      const previous = candidates[i - 1] as readonly StringVoicing[];
      const before = table[i - 1] as Cell[];
      let best: Cell = { cost: Infinity, from: -1 };
      previous.forEach((p, j) => {
        const c = (before[j] as Cell).cost + motionCost(p, v) + v.difficulty * 0.1;
        if (c < best.cost) best = { cost: c, from: j };
      });
      // A chord after one with no voicing starts afresh.
      if (previous.length === 0) best = { cost: v.difficulty * 0.1, from: -1 };
      return best;
    });
  });
  const result: (StringVoicing | null)[] = candidates.map(() => null);
  let index = -1;
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const row = table[i] as Cell[];
    if (index < 0) {
      let best = Infinity;
      row.forEach((c, j) => { if (c.cost < best) { best = c.cost; index = j; } });
    }
    if (index < 0) continue;
    result[i] = (candidates[i] as readonly StringVoicing[])[index] ?? null;
    index = (row[index] as Cell).from;
  }
  return result;
}

/**
 * Climb: each chord takes the next voicing above the previous one on the same
 * strings (the next inversion up the neck), starting from the lowest; past
 * the top of the neck it starts again from the bottom.
 */
export function climbVoicings(candidates: readonly (readonly StringVoicing[])[]): readonly (StringVoicing | null)[] {
  let previous: StringVoicing | null = null;
  return candidates.map((options) => {
    if (options.length === 0) return null;
    const above = previous ? options.find((v) => (v.notes[0]?.midi ?? 0) > (previous?.notes[0]?.midi ?? 0)) : options[0];
    previous = above ?? options[0] ?? null;
    return previous;
  });
}
