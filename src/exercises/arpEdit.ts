/**
 * Arpeggio editing (AR6): change one note of the played line without
 * touching the others, write a route by hand, and check it against
 * ergonomic limits. The line stays a list of places on the neck; every edit
 * names the note by its index in the line it was made on. Pure: no DOM.
 */
import { DEFAULT_FRETS, STANDARD_TUNING, type FretNote } from '../fretboard';
import { mod } from '../theory';
import { HAND_SPAN, fingerLine } from './arpShapes';

/** One note of the line moved to another place (same pitch or not), or removed (`to` null). */
export interface ArpEdit {
  readonly index: number;
  readonly to: { readonly string: number; readonly fret: number } | null;
}

const place = (string: number, fret: number, tuning: readonly number[]): FretNote => {
  const midi = (tuning[string] as number) + fret;
  return { string, fret, midi, pc: mod(midi, 12) };
};

const onNeck = (string: number, fret: number, tuning: readonly number[], frets: number) =>
  Number.isInteger(string) && Number.isInteger(fret) && string >= 0 && string < tuning.length && fret >= 0 && fret <= frets;

/** A short signature of a line: the edits made on it apply only to that line. */
export const lineKey = (line: readonly FretNote[]): string => line.map((n) => `${n.string}:${n.fret}`).join(' ');

/** The line with the edits applied in order; edits pointing outside the line or off the neck are skipped. */
export function applyEdits(line: readonly FretNote[], edits: readonly ArpEdit[], tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly FretNote[] {
  const out: (FretNote | null)[] = [...line];
  for (const e of edits) {
    if (e.index < 0 || e.index >= out.length) continue;
    if (e.to === null) { out[e.index] = null; continue; }
    if (!onNeck(e.to.string, e.to.fret, tuning, frets)) continue;
    out[e.index] = place(e.to.string, e.to.fret, tuning);
  }
  return out.filter((n): n is FretNote => n !== null);
}

/** Replace the edit for `index` (one edit per note: the latest choice wins). */
export const withEdit = (edits: readonly ArpEdit[], edit: ArpEdit): readonly ArpEdit[] =>
  [...edits.filter((e) => e.index !== edit.index), edit].sort((a, b) => a.index - b.index);

/** The same pitch on the other strings, thicker to thinner. */
export function samePitchPlaces(note: FretNote, tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly FretNote[] {
  const out: FretNote[] = [];
  tuning.forEach((open, string) => {
    const fret = note.midi - open;
    if (string !== note.string && fret >= 0 && fret <= frets) out.push(place(string, fret, tuning));
  });
  return out;
}

/** The next pitch up (dir 1) or down (-1) whose pitch class is allowed, on the same string; null off the neck. */
export function stepOnString(note: FretNote, allowed: ReadonlySet<number>, dir: 1 | -1, tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): FretNote | null {
  for (let fret = note.fret + dir; fret >= 0 && fret <= frets; fret += dir) {
    const n = place(note.string, fret, tuning);
    if (allowed.has(n.pc)) return n;
  }
  return null;
}

/**
 * A route written by hand: places as string/fret with guitarists' string
 * numbers (1 is the high E), "6/8 5/7 5/10 4/9" or "6-8, 5-7". Every token
 * is checked; the notes come back with the errors, in Italian, by position.
 */
export function parseRoute(text: string, tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): { readonly notes: readonly FretNote[]; readonly errors: readonly string[] } {
  const tokens = text.trim().split(/[\s,;]+/).filter(Boolean);
  const notes: FretNote[] = [];
  const errors: string[] = [];
  tokens.forEach((token, i) => {
    const m = /^(\d+)[/:.-](\d+)$/.exec(token);
    if (!m) { errors.push(`Nota ${i + 1}: «${token}» non è corda/tasto (per esempio 5/7).`); return; }
    const guitarString = Number(m[1]);
    const fret = Number(m[2]);
    const string = tuning.length - guitarString;
    if (guitarString < 1 || guitarString > tuning.length) { errors.push(`Nota ${i + 1}: la corda ${guitarString} non esiste (1–${tuning.length}).`); return; }
    if (fret > frets) { errors.push(`Nota ${i + 1}: il tasto ${fret} è oltre il ${frets}.`); return; }
    notes.push(place(string, fret, tuning));
  });
  if (tokens.length > 64) errors.push('Al massimo 64 note.');
  return { notes: notes.slice(0, 64), errors };
}

/** A line as a hand-written route, the inverse of `parseRoute`. */
export const formatRoute = (line: readonly FretNote[], strings = STANDARD_TUNING.length): string =>
  line.map((n) => `${strings - n.string}/${n.fret}`).join(' ');

export interface ErgoRules {
  /** Widest hand position, in frets from index to little finger (4 = five frets, the usual stretch). */
  readonly maxStretch: number;
  /** Widest jump between two fretted notes in a row before it counts as a leap. */
  readonly maxJump: number;
  /** Most changes of hand position over the line. */
  readonly maxShifts: number;
  readonly allowOpen: boolean;
}
export const DEFAULT_ERGO: ErgoRules = { maxStretch: HAND_SPAN, maxJump: 5, maxShifts: 4, allowOpen: true };

export type ErgoKind = 'stretch' | 'jump' | 'shifts' | 'open' | 'outside';
export interface ErgoIssue {
  /** Index of the note in the line where the problem shows. */
  readonly index: number;
  readonly kind: ErgoKind;
  /** Frets of the stretch or jump; number of shifts. */
  readonly amount: number;
}

/**
 * What a hand would find hard in a line. A position is the run of notes the
 * engine fingers without moving the hand; its span is checked against the
 * stretch, the frets between neighbours against the jump, the number of
 * positions against the shifts. Notes outside `allowed` (the chord tones and
 * whatever the pattern brings in) are flagged too, not refused.
 */
export function ergonomicIssues(line: readonly FretNote[], rules: ErgoRules = DEFAULT_ERGO, allowed?: ReadonlySet<number>): readonly ErgoIssue[] {
  const issues: ErgoIssue[] = [];
  line.forEach((n, i) => {
    if (n.fret === 0 && !rules.allowOpen) issues.push({ index: i, kind: 'open', amount: 0 });
    if (allowed && !allowed.has(n.pc)) issues.push({ index: i, kind: 'outside', amount: 0 });
    const prev = line[i - 1];
    if (prev && prev.fret > 0 && n.fret > 0) {
      const jump = Math.abs(n.fret - prev.fret);
      if (jump > rules.maxJump) issues.push({ index: i, kind: 'jump', amount: jump });
    }
  });
  // Positions as the engine fingers them, but split wherever the user's stretch is exceeded.
  let lo = Infinity;
  let hi = -Infinity;
  let positions = 1;
  line.forEach((n, i) => {
    if (n.fret === 0) return;
    const nlo = Math.min(lo, n.fret);
    const nhi = Math.max(hi, n.fret);
    if (nhi - nlo > HAND_SPAN) {
      positions += 1;
      if (positions - 1 === rules.maxShifts + 1) issues.push({ index: i, kind: 'shifts', amount: positions - 1 });
      lo = n.fret; hi = n.fret;
      return;
    }
    if (nhi - nlo > rules.maxStretch && hi - lo <= rules.maxStretch) issues.push({ index: i, kind: 'stretch', amount: nhi - nlo });
    lo = nlo; hi = nhi;
  });
  return issues.sort((a, b) => a.index - b.index);
}

/** The hand positions of a line, for the count shown with the route. */
export const shiftCount = (line: readonly FretNote[]): number => fingerLine(line).shifts.length;
