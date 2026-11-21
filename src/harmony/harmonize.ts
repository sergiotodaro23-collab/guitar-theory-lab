/**
 * Diatonic harmonization (HA1): the chord built in thirds (or as a sus) on
 * every degree of a seven-note scale, spelled as the scale spells it. Major,
 * natural, harmonic and melodic minor are the scales the labs study; every
 * other seven-note scale of the theory engine works the same way. Pure.
 */
import { buildScale, mod, parseChord, type Chord, type ScaleId, type SpelledNote } from '../theory';
import { numeralOf } from './interchange';
import { plainName } from './progressions';

/** The four scales Harmony Lab harmonizes by default. */
export const HARMONIZED_SCALES: readonly ScaleId[] = ['ionian', 'aeolian', 'harmonicMinor', 'melodicMinor'];

/**
 * triad 1-3-5; seventh 1-3-5-7; sus2 1-2-5 and sus4 1-4-5 from the scale's
 * own second and fourth (only where they give a named sus chord).
 */
export type HarmonyKind = 'triad' | 'seventh' | 'sus2' | 'sus4';
export const HARMONY_KINDS: readonly HarmonyKind[] = ['triad', 'seventh', 'sus2', 'sus4'];
export const HARMONY_KIND_NAMES: Readonly<Record<HarmonyKind, string>> = {
  triad: 'Triadi', seventh: 'Quadriadi', sus2: 'Triadi sus2', sus4: 'Triadi sus4',
};

const TRIAD: Readonly<Record<string, string>> = { '4,7': '', '3,7': 'm', '3,6': 'dim', '4,8': 'aug' };
const SEVENTH: Readonly<Record<string, string>> = {
  '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5', '3,6,9': 'dim7',
  '3,7,11': 'mMaj7', '4,8,11': 'maj7#5', '4,8,10': '7#5',
};
const SUS2: Readonly<Record<string, string>> = { '2,7': 'sus2' };
const SUS4: Readonly<Record<string, string>> = { '5,7': 'sus4' };

const STACKS: Readonly<Record<HarmonyKind, { readonly steps: readonly number[]; readonly table: Readonly<Record<string, string>> }>> = {
  triad: { steps: [2, 4], table: TRIAD },
  seventh: { steps: [2, 4, 6], table: SEVENTH },
  sus2: { steps: [1, 4], table: SUS2 },
  sus4: { steps: [3, 4], table: SUS4 },
};

export interface DiatonicChord {
  /** 0-based scale degree. */
  readonly degree: number;
  /** Roman numeral against the scale's tonic: "ii7", "III+maj7", "viiø7". */
  readonly numeral: string;
  /** Null when the stack has no name in the chord parser (a sus on a degree whose fourth is augmented). */
  readonly chord: Chord | null;
}

/** The chord of one kind on one degree, or null when that stack is not a chord the engine names. */
export function diatonicChord(tonic: string, scaleId: ScaleId, degree: number, kind: HarmonyKind): Chord | null {
  const tones = buildScale(tonic, scaleId).tones;
  if (tones.length !== 7) return null;
  const at = (offset: number) => tones[mod(degree + offset, 7)] as { name: string; pc: number; note: SpelledNote };
  const root = at(0);
  const { steps, table } = STACKS[kind];
  const key = steps.map((s) => mod(at(s).pc - root.pc, 12)).join(',');
  const suffix = table[key];
  // Theoretical keys (Gb minor and the like) put double flats on some roots: the chord takes the enharmonic name.
  return suffix === undefined ? null : parseChord(`${plainName(root.note)}${suffix}`);
}

/** Every degree of the scale, in order. Seven entries for a seven-note scale, none otherwise. */
export function harmonize(tonic: string, scaleId: ScaleId, kind: HarmonyKind): readonly DiatonicChord[] {
  const scale = buildScale(tonic, scaleId);
  if (scale.tones.length !== 7) return [];
  const tonicPc = scale.tones[0]?.pc ?? 0;
  return scale.tones.map((_, degree) => {
    const chord = diatonicChord(tonic, scaleId, degree, kind);
    return { degree, numeral: chord ? numeralOf(chord, tonicPc) : '—', chord };
  });
}

/** The symbols of a harmonization, skipping degrees with no named chord. */
export const harmonySymbols = (tonic: string, scaleId: ScaleId, kind: HarmonyKind): readonly string[] =>
  harmonize(tonic, scaleId, kind).flatMap((d) => (d.chord ? [d.chord.symbol] : []));
