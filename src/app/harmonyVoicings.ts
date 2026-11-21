/**
 * Harmony Lab voicings (HA3–HA5, D-64): one engine voicing per chord of the
 * progression, chosen by voice leading, by climbing the inversions, or by a
 * fixed inversion. What the board draws and what the comping plays come from
 * here, so the two never disagree. Pure.
 */
import { chordVoicings, climbVoicings, findStringSet, leadVoicings, stringSetVoicings, type StringVoicing } from '../fretboard';
import { HARMONY_KIND_NAMES, PROGRESSION_KIND_NAMES, chordOrigin, harmonySymbols, progressionSymbols, withTritoneSubs, type HarmonyKind, type ProgressionKind } from '../harmony';
import { parsedChords, withChord, type Progression } from '../jam';
import { SCALES, buildScale, type Chord, type ScaleId } from '../theory';
import { tuningOf, type Settings } from './settings';

export type VoicingSettings = Pick<Settings, 'voicingOn' | 'voicingType' | 'voicingSet' | 'voicingMove' | 'voicingInversion' | 'voicingNear' | 'progression' | 'harmonyKey' | 'harmonyMode' | 'neckTuning' | 'customTuning'>;

/** The full chord of D-10 (four to six strings) in the shape of a string-set voicing. */
function fullVoicings(chord: Chord, tuning: readonly number[]): readonly StringVoicing[] {
  return chordVoicings(chord, { tuning, perPosition: 2 }).map((v) => {
    const notes = [...v.notes].sort((a, b) => a.midi - b.midi);
    const fretted = notes.map((n) => n.fret).filter((f) => f > 0);
    const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
    const bass = notes[0];
    const bassTone = chord.tones.findIndex((t) => t.pc === bass?.pc);
    const pcs = new Set(notes.map((n) => n.pc));
    return {
      type: 'close' as const,
      stringSet: notes.map((n) => tuning.length - n.string).sort((a, b) => a - b).join('-'),
      frets: v.frets,
      notes,
      degrees: v.degrees,
      inversion: bassTone < 0 ? null : Math.min(3, bassTone),
      omitted: chord.tones.filter((t) => !pcs.has(t.pc)).map((t) => t.degree),
      span,
      difficulty: Math.min(5, 1 + Math.max(0, span - 1) + (notes.length >= 6 ? 1 : 0)),
    };
  });
}

/** Every voicing a chord can take with the current choice of type and strings. */
export function voicingOptions(chord: Chord, s: VoicingSettings): readonly StringVoicing[] {
  const tuning = tuningOf(s);
  if (s.voicingType === 'full') return fullVoicings(chord, tuning);
  const set = findStringSet(s.voicingSet);
  if (!set) return [];
  const origin = s.voicingType === 'quartal' ? chordOrigin(chord, s.harmonyKey, s.harmonyMode).scale : null;
  const scale = s.voicingType === 'quartal' ? buildScale(origin?.tonic ?? s.harmonyKey, origin?.scaleId ?? s.harmonyMode) : undefined;
  return stringSetVoicings(chord, s.voicingType, set, { tuning, ...(scale ? { scale } : {}) });
}

const lowFret = (v: StringVoicing): number => Math.min(...v.notes.map((n) => n.fret).filter((f) => f > 0), 24);

/** One voicing per chord; null where the chord has none on these strings. */
export function chooseVoicings(chords: readonly Chord[], s: VoicingSettings): readonly (StringVoicing | null)[] {
  const options = chords.map((c) => voicingOptions(c, s));
  if (s.voicingMove === 'climb') {
    // Start from the voicing nearest the chosen fret, then walk up.
    return climbVoicings(options.map((o, i) => (i === 0 ? [...o].sort((a, b) => Math.abs(lowFret(a) - s.voicingNear) - Math.abs(lowFret(b) - s.voicingNear)).slice(0, 1).concat(o) : o)));
  }
  if (s.voicingMove === 'fixed') {
    const fixed = options.map((o) => o.filter((v) => v.inversion === s.voicingInversion));
    // A chord without that inversion here falls back on voice leading among its own voicings.
    return leadVoicings(fixed.map((f, i) => (f.length ? f : (options[i] ?? []))), s.voicingNear);
  }
  return leadVoicings(options, s.voicingNear);
}

const cache = new Map<string, readonly (StringVoicing | null)[]>();

/** The progression's voicings, worked out once per choice. Empty when voicings are off. */
export function progressionVoicings(s: VoicingSettings): readonly (StringVoicing | null)[] {
  if (!s.voicingOn) return [];
  const tuning = tuningOf(s);
  const key = [s.voicingType, s.voicingSet, s.voicingMove, s.voicingInversion, s.voicingNear, s.harmonyKey, s.harmonyMode, tuning.join(','), s.progression.chords.map((c) => c.symbol).join(' ')].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const result = chooseVoicings(parsedChords(s.progression), s);
  if (cache.size > 64) cache.clear();
  cache.set(key, result);
  return result;
}

/** MIDI notes of each chord's voicing, for the comping; null keeps the comping's own voicing. */
export const voicingMidis = (s: VoicingSettings): readonly (readonly number[] | null)[] =>
  progressionVoicings(s).map((v) => (v ? v.notes.map((n) => n.midi) : null));

/** Voice motion in semitones from each chord's voicing to the next one (looping back to the first). */
export function voicingMotions(voicings: readonly (StringVoicing | null)[]): readonly (readonly number[] | null)[] {
  return voicings.map((v, i) => {
    const next = voicings[(i + 1) % voicings.length];
    if (!v || !next || voicings.length < 2) return null;
    const n = Math.min(v.notes.length, next.notes.length);
    return Array.from({ length: n }, (_, k) => (next.notes[k]?.midi ?? 0) - (v.notes[k]?.midi ?? 0));
  });
}

/** Home mode for the analysis of a harmonized scale: the church mode nearest to it. */
export const analysisModeOf = (scaleId: ScaleId): ScaleId => (scaleId === 'ionian' ? 'ionian' : 'aeolian');

/**
 * A harmonized scale as a progression (HA5): every degree in turn, one bar
 * each, each chord `repeat` times so the voicings can walk through its
 * inversions before moving on.
 */
export function harmonizationProgression(tonic: string, scaleId: ScaleId, kind: HarmonyKind, repeat = 1): Progression {
  const symbols = harmonySymbols(tonic, scaleId, kind);
  const chords = symbols.flatMap((symbol) => Array.from({ length: Math.max(1, repeat) }, () => withChord(symbol, { value: 1, unit: 'bars' })));
  return { name: `${tonic} ${SCALES[scaleId].name}: ${HARMONY_KIND_NAMES[kind].toLowerCase()}`, chords };
}

/** A functional progression (ii–V–I, turnarounds), optionally with tritone substitutes, two bars a chord except the last. */
export function functionalProgression(kind: ProgressionKind, key: string, tritone = false): Progression {
  const base = progressionSymbols(kind, key);
  const symbols = tritone ? withTritoneSubs(base) : base;
  return {
    name: `${PROGRESSION_KIND_NAMES[kind]}${tritone ? ' con sostituti di tritono' : ''} in ${key}`,
    chords: symbols.map((symbol) => withChord(symbol, { value: 1, unit: 'bars' })),
  };
}
