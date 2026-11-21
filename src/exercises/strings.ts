/**
 * Strings an exercise may use (M4). Strings are named as a guitarist does,
 * 1 the high E and 6 the low E; the fretboard engine counts them the other
 * way (index 0 is the low E), so the conversion lives here only.
 */
import type { FretNote } from '../fretboard';

export type StringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export const ALL_STRINGS: readonly StringNumber[] = [1, 2, 3, 4, 5, 6];

/** Ready-made sets, string skipping included; any other set can be ticked by hand. */
export const STRING_SETS: readonly { readonly strings: readonly StringNumber[]; readonly label: string }[] = [
  { strings: [], label: 'Tutte le corde' },
  { strings: [1], label: 'Solo la 1ª' },
  { strings: [1, 2], label: '1ª e 2ª' },
  { strings: [1, 2, 3], label: '1ª, 2ª, 3ª' },
  { strings: [2, 3, 4], label: '2ª, 3ª, 4ª' },
  { strings: [3, 4, 5], label: '3ª, 4ª, 5ª' },
  { strings: [4, 5, 6], label: '4ª, 5ª, 6ª' },
  { strings: [1, 2, 3, 4], label: 'Prime quattro' },
  { strings: [3, 4, 5, 6], label: 'Ultime quattro' },
  { strings: [2, 4, 6], label: 'Salto di corda: 6ª, 4ª, 2ª' },
  { strings: [1, 3, 5], label: 'Salto di corda: 5ª, 3ª, 1ª' },
  { strings: [4, 6], label: 'Salto di corda: 6ª e 4ª' },
  { strings: [3, 5], label: 'Salto di corda: 5ª e 3ª' },
  { strings: [2, 4], label: 'Salto di corda: 4ª e 2ª' },
  { strings: [1, 3], label: 'Salto di corda: 3ª e 1ª' },
];

/** Engine index (0 low E) of a guitarist's string number (6 low E). */
export const stringIndex = (n: StringNumber, count = 6): number => count - n;

/** Sorted, unique, valid string numbers; empty means every string. */
export function normalizeStrings(raw: unknown): readonly StringNumber[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set(raw.filter((n): n is StringNumber => ALL_STRINGS.includes(n as StringNumber)));
  return set.size === 6 ? [] : [...set].sort((a, b) => a - b);
}

/** The notes of a shape that fall on the chosen strings. */
export function onStrings<T extends FretNote>(notes: readonly T[], strings: readonly StringNumber[], count = 6): readonly T[] {
  if (strings.length === 0) return notes;
  const allowed = new Set(strings.map((n) => stringIndex(n, count)));
  return notes.filter((note) => allowed.has(note.string));
}

/** True when the set leaves out a string between two it uses: string skipping. */
export const isSkipping = (strings: readonly StringNumber[]): boolean =>
  strings.some((n, i) => i > 0 && n - (strings[i - 1] as number) > 1);

export function describeStrings(strings: readonly StringNumber[]): string {
  if (strings.length === 0) return 'tutte le corde';
  const preset = STRING_SETS.find((s) => s.strings.length === strings.length && s.strings.every((n, i) => n === strings[i]));
  return preset ? preset.label.toLowerCase() : `corde ${strings.join(', ')}`;
}
