/** From a frequency to a note name and cents, against a configurable A4. Pure. */

export const DEFAULT_A4 = 440;
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export interface NoteReading {
  readonly midi: number;
  /** Sharp spelling: a heard pitch carries no key, so no letter choice is implied. */
  readonly name: string;
  readonly octave: number;
  /** −50…+50 from the nearest equal-tempered note. */
  readonly cents: number;
}

export const midiToFrequency = (midi: number, a4 = DEFAULT_A4): number => a4 * 2 ** ((midi - 69) / 12);
export const frequencyToMidi = (frequency: number, a4 = DEFAULT_A4): number => 69 + 12 * Math.log2(frequency / a4);
export const centsBetween = (frequency: number, target: number): number => 1200 * Math.log2(frequency / target);

export function noteOf(frequency: number, a4 = DEFAULT_A4): NoteReading {
  const exact = frequencyToMidi(frequency, a4);
  const midi = Math.round(exact);
  return { midi, name: NAMES[((midi % 12) + 12) % 12] ?? 'C', octave: Math.floor(midi / 12) - 1, cents: Math.round((exact - midi) * 100 * 10) / 10 };
}
