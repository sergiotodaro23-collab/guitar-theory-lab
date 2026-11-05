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

export interface Chord {
  readonly symbol: string;
  readonly root: SpelledNote;
  readonly rootName: string;
  readonly suffix: string;
  readonly family: ChordFamily;
  readonly tones: readonly ChordTone[];
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
  const root = parseNote(match[1] as string);
  const rawSuffix = match[2] as string;
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
  return { symbol: `${rootName}${suffix}`, root, rootName, suffix, family: quality.family, tones };
}

export function tryParseChord(symbol: string): Chord | null {
  try {
    return parseChord(symbol);
  } catch {
    return null;
  }
}
