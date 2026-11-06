import { mod, noteName, parseDegree, parseNote, pitchClass, spellDegree, degreeSemitones, type SpelledNote } from './notes';

export type ChordFamily = 'major' | 'dominant' | 'minor' | 'halfDiminished' | 'diminished' | 'augmented' | 'suspended';

export interface ChordTone {
  /** Label as a chord symbol reads it: "3", "b7", "13". */
  readonly degree: string;
  readonly note: SpelledNote;
  readonly name: string;
  readonly pc: number;
  /** Semitones above the root, reduced to one octave. */
  readonly semitones: number;
}

export interface ChordBass {
  readonly note: SpelledNote;
  readonly name: string;
  readonly pc: number;
  /** Chord degree when the bass is a chord tone ("3" in C/E), null for a foreign bass (D/C). */
  readonly degree: string | null;
  /** 0 root position, 1 first, 2 second, 3 third inversion; null when no inversion applies. */
  readonly inversion: number | null;
}

export interface Chord {
  readonly symbol: string;
  readonly root: SpelledNote;
  readonly rootName: string;
  readonly suffix: string;
  readonly family: ChordFamily;
  readonly tones: readonly ChordTone[];
  /** Slash bass; null means the root is in the bass. */
  readonly bass: ChordBass | null;
}

/** Bass on the third, fifth or seventh (sixth in a 6 chord) gives the classical inversions. */
function inversionOf(degree: string | null): number | null {
  if (degree === null) return null;
  const number = Number(degree.replace(/[#b]/g, ''));
  if (number === 1) return 0;
  if (number === 3) return 1;
  if (number === 5) return 2;
  if (number === 7 || number === 6) return 3;
  return null;
}

export const INVERSION_NAMES: readonly string[] = ['stato fondamentale', 'primo rivolto', 'secondo rivolto', 'terzo rivolto'];

/** "C/E" from a chord and a bass note name; the root as bass gives the plain chord. */
export function withBass(chord: Chord, bassName: string | null): Chord {
  const base = parseChord(`${chord.rootName}${chord.suffix}`);
  if (!bassName) return base;
  const note = parseNote(bassName);
  const pc = pitchClass(note);
  if (pc === base.tones[0]?.pc) return base;
  const tone = base.tones.find((t) => t.pc === pc);
  // A chord tone keeps the chord's own spelling: Cm/Eb, never Cm/D#.
  const spelled = tone ? tone.note : note;
  const name = noteName(spelled);
  const degree = tone?.degree ?? null;
  return { ...base, symbol: `${base.symbol}/${name}`, bass: { note: spelled, name, pc, degree, inversion: inversionOf(degree) } };
}

interface QualityEntry {
  readonly suffix: string;
  readonly formula: string;
  readonly family: ChordFamily;
}

/** Longer suffixes are tried first, so "maj13" never parses as "maj". */
const QUALITIES: readonly QualityEntry[] = [
  { suffix: '', formula: '1 3 5', family: 'major' },
  { suffix: 'maj7', formula: '1 3 5 7', family: 'major' },
  { suffix: 'maj9', formula: '1 3 5 7 9', family: 'major' },
  { suffix: 'maj13', formula: '1 3 5 7 9 13', family: 'major' },
  { suffix: 'maj7#11', formula: '1 3 5 7 #11', family: 'major' },
  { suffix: '6', formula: '1 3 5 6', family: 'major' },
  { suffix: '69', formula: '1 3 5 6 9', family: 'major' },
  { suffix: 'add9', formula: '1 3 5 9', family: 'major' },
  { suffix: 'm', formula: '1 b3 5', family: 'minor' },
  { suffix: 'm7', formula: '1 b3 5 b7', family: 'minor' },
  { suffix: 'm9', formula: '1 b3 5 b7 9', family: 'minor' },
  { suffix: 'm11', formula: '1 b3 5 b7 9 11', family: 'minor' },
  { suffix: 'm13', formula: '1 b3 5 b7 9 13', family: 'minor' },
  { suffix: 'm6', formula: '1 b3 5 6', family: 'minor' },
  { suffix: 'mMaj7', formula: '1 b3 5 7', family: 'minor' },
  { suffix: 'm7b5', formula: '1 b3 b5 b7', family: 'halfDiminished' },
  { suffix: 'dim', formula: '1 b3 b5', family: 'diminished' },
  { suffix: 'dim7', formula: '1 b3 b5 bb7', family: 'diminished' },
  { suffix: 'aug', formula: '1 3 #5', family: 'augmented' },
  { suffix: 'maj7#5', formula: '1 3 #5 7', family: 'augmented' },
  { suffix: '7', formula: '1 3 5 b7', family: 'dominant' },
  { suffix: '9', formula: '1 3 5 b7 9', family: 'dominant' },
  { suffix: '13', formula: '1 3 5 b7 9 13', family: 'dominant' },
  { suffix: '7b9', formula: '1 3 5 b7 b9', family: 'dominant' },
  { suffix: '7#9', formula: '1 3 5 b7 #9', family: 'dominant' },
  { suffix: '7#11', formula: '1 3 5 b7 #11', family: 'dominant' },
  { suffix: '7b13', formula: '1 3 5 b7 b13', family: 'dominant' },
  { suffix: '7#5', formula: '1 3 #5 b7', family: 'dominant' },
  { suffix: '7alt', formula: '1 3 b7 b9 #9 b13', family: 'dominant' },
  { suffix: '7sus4', formula: '1 4 5 b7', family: 'suspended' },
  { suffix: 'sus4', formula: '1 4 5', family: 'suspended' },
  { suffix: 'sus2', formula: '1 2 5', family: 'suspended' },
];

const ALIASES: Readonly<Record<string, string>> = {
  M7: 'maj7', Maj7: 'maj7', '∆': 'maj7', '∆7': 'maj7', maj: '', M: '', min: 'm', '-': 'm',
  min7: 'm7', '-7': 'm7', min9: 'm9', '-9': 'm9', ø: 'm7b5', ø7: 'm7b5', '-7b5': 'm7b5',
  o: 'dim', o7: 'dim7', '°': 'dim', '°7': 'dim7', '+': 'aug', '+7': '7#5', 'm(maj7)': 'mMaj7', mM7: 'mMaj7',
  dom7: '7', '6/9': '69', sus: 'sus4', alt: '7alt',
};

export const CHORD_SUFFIXES: readonly string[] = QUALITIES.map((q) => q.suffix);

export function parseChord(symbol: string): Chord {
  const match = /^\s*([A-Ga-g](?:#|b)?)(.*?)\s*$/.exec(symbol);
  if (!match) throw new Error(`Accordo non valido: "${symbol}"`);
  let rawSuffix = match[2] as string;
  // "6/9" is a quality, not a slash chord; any other "/X" names the bass.
  const slash = /^(.*)\/([A-Ga-g](?:#|b)?)$/.exec(rawSuffix);
  if (slash && !(rawSuffix in ALIASES)) {
    rawSuffix = slash[1] as string;
    const plain = parseChord(`${match[1] as string}${rawSuffix}`);
    return withBass(plain, slash[2] as string);
  }
  const root = parseNote(match[1] as string);
  const suffix = ALIASES[rawSuffix] ?? rawSuffix;
  const quality = QUALITIES.find((q) => q.suffix === suffix);
  if (!quality) throw new Error(`Qualità non riconosciuta: "${rawSuffix}"`);
  const tones = quality.formula.split(' ').map((degreeText) => {
    const degree = parseDegree(degreeText);
    const note = spellDegree(root, degree);
    return {
      degree: degreeText,
      note,
      name: noteName(note),
      pc: pitchClass(note),
      semitones: mod(degreeSemitones(degree), 12),
    };
  });
  const rootName = noteName(root);
  return { symbol: `${rootName}${suffix}`, root, rootName, suffix, family: quality.family, tones, bass: null };
}

export function tryParseChord(symbol: string): Chord | null {
  try {
    return parseChord(symbol);
  } catch {
    return null;
  }
}

const SEVENTH_SUFFIX: Readonly<Record<string, string>> = {
  '4,7,11': 'maj7', '4,7,10': '7', '3,7,10': 'm7', '3,6,10': 'm7b5', '3,6,9': 'dim7',
  '3,7,11': 'mMaj7', '4,8,11': 'maj7#5', '4,8,10': '7#5',
};

/**
 * Seventh chord built in thirds on a degree of a seven-note scale, spelled as
 * the scale spells it. Null for scales without seven notes.
 */
export function diatonicSeventh(scale: { readonly tones: readonly { readonly name: string; readonly pc: number }[] }, degreeIndex: number): Chord | null {
  const tones = scale.tones;
  if (tones.length !== 7) return null;
  const at = (offset: number) => tones[mod(degreeIndex + offset, 7)] as { name: string; pc: number };
  const root = at(0);
  const key = [2, 4, 6].map((o) => mod(at(o).pc - root.pc, 12)).join(',');
  const suffix = SEVENTH_SUFFIX[key];
  return suffix === undefined ? null : parseChord(`${root.name}${suffix}`);
}
