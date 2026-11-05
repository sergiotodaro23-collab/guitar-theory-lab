/**
 * Music Theory Engine: spelled notes and pitch arithmetic.
 *
 * A note keeps its letter, because C# and Db are the same key on the fretboard
 * but not the same note in a chord. Pitch is an integer MIDI number.
 */
export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

export interface SpelledNote {
  /** Index in LETTERS. */
  readonly letter: number;
  /** Semitones relative to the natural letter: -1 flat, +1 sharp. */
  readonly accidental: number;
}

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function parseNote(name: string): SpelledNote {
  const match = /^([A-Ga-g])(#{1,2}|b{1,2}|x)?$/.exec(name.trim());
  if (!match) throw new Error(`Nota non valida: "${name}"`);
  const letter = LETTERS.indexOf((match[1] as string).toUpperCase() as Letter);
  const acc = match[2] ?? '';
  const accidental = acc === 'x' ? 2 : acc.startsWith('#') ? acc.length : -acc.length;
  return { letter, accidental };
}

export function noteName(note: SpelledNote): string {
  const accidental = note.accidental > 0 ? '#'.repeat(note.accidental) : 'b'.repeat(-note.accidental);
  return `${LETTERS[note.letter] as Letter}${accidental}`;
}

export function pitchClass(note: SpelledNote): number {
  return mod((LETTER_PC[note.letter] as number) + note.accidental, 12);
}

/** Semitones above the root for degrees 1..7 of a major scale. */
const MAJOR_DEGREE_SEMITONES: readonly number[] = [0, 2, 4, 5, 7, 9, 11];

/** A degree such as "b3", "#11" or "7". */
export interface Degree {
  readonly number: number;
  readonly alter: number;
}

export function parseDegree(text: string): Degree {
  const match = /^(bb|b|##|#)?(\d{1,2})$/.exec(text);
  if (!match) throw new Error(`Grado non valido: "${text}"`);
  const prefix = match[1] ?? '';
  const alter = prefix.startsWith('#') ? prefix.length : -prefix.length;
  return { number: Number(match[2]), alter };
}

export function degreeSemitones(degree: Degree): number {
  const zero = degree.number - 1;
  const octaves = Math.floor(zero / 7);
  return (MAJOR_DEGREE_SEMITONES[mod(zero, 7)] as number) + 12 * octaves + degree.alter;
}

/** Spell a degree above a root, keeping the letter that the degree requires. */
export function spellDegree(root: SpelledNote, degree: Degree): SpelledNote {
  const letter = mod(root.letter + degree.number - 1, 7);
  const natural = LETTER_PC[letter] as number;
  const target = pitchClass(root) + degreeSemitones(degree);
  let accidental = mod(target - natural, 12);
  if (accidental > 6) accidental -= 12;
  return { letter, accidental };
}

const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Name for a pitch class with no harmonic context. */
export function chromaticName(pc: number, preferFlat = false): string {
  return (preferFlat ? CHROMATIC_FLAT : CHROMATIC_SHARP)[mod(pc, 12)] as string;
}

export const TONICS: readonly string[] = [
  'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B',
];

/** MIDI number (C4 = 60) to equal-temperament frequency. */
export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

/**
 * Index on the diatonic staff for a pitch spelled with a letter.
 * Used to count generic intervals: C4 to E4 is a third whatever the accidentals.
 */
export function diatonicIndex(midi: number, note: SpelledNote): number {
  const octave = Math.floor((midi - note.accidental) / 12) - 1;
  return octave * 7 + note.letter;
}

const TRANSPOSE_LETTER_STEPS: readonly number[] = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];

/** Transpose keeping readable spelling: no double accidentals, Cb, Fb, E# or B#. */
export function transposeNote(note: SpelledNote, semitones: number): SpelledNote {
  const shift = mod(semitones, 12);
  const letter = mod(note.letter + (TRANSPOSE_LETTER_STEPS[shift] as number), 7);
  const target = pitchClass(note) + shift;
  let accidental = mod(target - (LETTER_PC[letter] as number), 12);
  if (accidental > 6) accidental -= 12;
  const result = { letter, accidental };
  const name = noteName(result);
  if (Math.abs(accidental) >= 2 || ['Cb', 'Fb', 'E#', 'B#'].includes(name)) {
    return parseNote(chromaticName(target, note.accidental < 0));
  }
  return result;
}
