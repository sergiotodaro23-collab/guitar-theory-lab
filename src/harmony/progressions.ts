/**
 * Functional progressions and substitutions (HA4): ii–V–I in major and minor,
 * turnarounds, secondary dominants, tritone and diatonic substitutions. Every
 * symbol is spelled from the key with its letter, so Db7 is never C#7 in C.
 * Pure: returns chord symbols, the labs turn them into progressions.
 */
import { mod, noteName, parseChord, parseDegree, parseNote, pitchClass, spellDegree, type Chord, type SpelledNote } from '../theory';

/** A note's name with a double accidental respelled on the neighbouring letter (Ebb → D, F## → G): the chord parser reads single accidentals. */
export function plainName(note: SpelledNote): string {
  if (Math.abs(note.accidental) < 2) return noteName(note);
  const pc = pitchClass(note);
  const letter = mod(note.letter + (note.accidental > 0 ? 1 : -1), 7);
  let accidental = mod(pc - pitchClass({ letter, accidental: 0 }), 12);
  if (accidental > 6) accidental -= 12;
  return noteName({ letter, accidental });
}

/** The note a degree above the key's tonic, without double accidentals. */
const rootOn = (key: string, degree: string): string => plainName(spellDegree(parseNote(key), parseDegree(degree)));

const at = (key: string, degree: string, suffix: string): string => `${rootOn(key, degree)}${suffix}`;

export type ProgressionKind =
  | 'ii-V-I' | 'ii-V-i' | 'I-vi-ii-V' | 'iii-VI-ii-V' | 'I-VI7-ii-V' | 'ii-bII7-I' | 'secondary-chain';

export const PROGRESSION_KIND_NAMES: Readonly<Record<ProgressionKind, string>> = {
  'ii-V-I': 'ii–V–I maggiore',
  'ii-V-i': 'iiø–V7(♭9)–i minore',
  'I-vi-ii-V': 'Turnaround I–vi–ii–V',
  'iii-VI-ii-V': 'Turnaround iii–VI7–ii–V',
  'I-VI7-ii-V': 'Turnaround con dominante secondaria I–VI7–ii–V',
  'ii-bII7-I': 'ii–♭II7–I (sostituto di tritono)',
  'secondary-chain': 'Catena di dominanti III7–VI7–II7–V7–I',
};

/** Four-note chords on the key, as a jazz player reads them. */
export function progressionSymbols(kind: ProgressionKind, key: string): readonly string[] {
  switch (kind) {
    case 'ii-V-I': return [at(key, '2', 'm7'), at(key, '5', '7'), at(key, '1', 'maj7')];
    case 'ii-V-i': return [at(key, '2', 'm7b5'), at(key, '5', '7b9'), at(key, '1', 'm7')];
    case 'I-vi-ii-V': return [at(key, '1', 'maj7'), at(key, '6', 'm7'), at(key, '2', 'm7'), at(key, '5', '7')];
    case 'iii-VI-ii-V': return [at(key, '3', 'm7'), at(key, '6', '7'), at(key, '2', 'm7'), at(key, '5', '7')];
    case 'I-VI7-ii-V': return [at(key, '1', 'maj7'), at(key, '6', '7'), at(key, '2', 'm7'), at(key, '5', '7')];
    case 'ii-bII7-I': return [at(key, '2', 'm7'), at(key, 'b2', '7'), at(key, '1', 'maj7')];
    case 'secondary-chain': return [at(key, '3', '7'), at(key, '6', '7'), at(key, '2', '7'), at(key, '5', '7'), at(key, '1', 'maj7')];
  }
}

/** V7 of a chord: the dominant a perfect fifth above its root (A7 for Dm7). */
export function secondaryDominant(target: Chord | string, suffix = '7'): string {
  const chord = typeof target === 'string' ? parseChord(target) : target;
  return `${rootOn(chord.rootName, '5')}${suffix}`;
}

/**
 * Tritone substitute of a dominant: the dominant a diminished fifth away,
 * spelled on the flat second of its resolution (G7 → Db7, never C#7). The
 * guide tones swap: the 3rd of one is the 7th of the other.
 */
export function tritoneSubstitute(dominant: Chord | string): string {
  const chord = typeof dominant === 'string' ? parseChord(dominant) : dominant;
  if (chord.family !== 'dominant') throw new Error(`Il sostituto di tritono vale per un accordo di dominante, non per ${chord.symbol}`);
  // The resolution is a fifth below; its flat second is the substitute.
  const resolution = rootOn(chord.rootName, '4');
  const base = chord.suffix.startsWith('7') || /^(9|11|13)$/.test(chord.suffix) ? chord.suffix : '7';
  return `${rootOn(resolution, 'b2')}${base}`;
}

/** Diatonic substitutes by shared function: tonic I ↔ iii, vi; subdominant IV ↔ ii; dominant V ↔ vii. */
export function diatonicSubstitutes(key: string, numeral: 'I' | 'IV' | 'V'): readonly string[] {
  switch (numeral) {
    case 'I': return [at(key, '3', 'm7'), at(key, '6', 'm7')];
    case 'IV': return [at(key, '2', 'm7')];
    case 'V': return [at(key, '7', 'm7b5')];
  }
}

/** The same progression with every dominant on the way replaced by its tritone substitute (the last chord is kept). */
export function withTritoneSubs(symbols: readonly string[]): readonly string[] {
  return symbols.map((symbol, i) => {
    if (i === symbols.length - 1) return symbol;
    const chord = parseChord(symbol);
    return chord.family === 'dominant' ? tritoneSubstitute(chord) : symbol;
  });
}
