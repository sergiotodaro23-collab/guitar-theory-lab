import { describe, expect, it } from 'vitest';
import { overlayChord, patternLine, quartalLine, tensionsOver } from './arpPatterns';
import { DEFAULT_ERGO, applyEdits, ergonomicIssues, formatRoute, lineKey, parseRoute, samePitchPlaces, stepOnString, withEdit } from './arpEdit';
import { buildScale, mod, parseChord, noteName } from '../theory';
import { allFretNotes, type FretNote } from '../fretboard';

const note = (string: number, fret: number): FretNote => {
  const midi = ([40, 45, 50, 55, 59, 64][string] as number) + fret;
  return { string, fret, midi, pc: mod(midi, 12) };
};
const names = (line: readonly FretNote[]) => line.map((n) => ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][n.pc]);

describe('diatonic fourths (AR4)', () => {
  it('C major from C: C F B E A D, each a perfect or the one augmented fourth above', () => {
    const scale = buildScale('C', 'ionian');
    const notes = allFretNotes().filter((n) => scale.tones.some((t) => t.pc === n.pc) && n.midi >= 48 && n.midi <= 90);
    const line = quartalLine(parseChord('Cmaj7'), scale, notes);
    expect(names(line).slice(0, 8)).toEqual(['C', 'F', 'B', 'E', 'A', 'D', 'G', 'C']);
    const steps = line.slice(1).map((n, i) => n.midi - (line[i] as FretNote).midi);
    expect(steps.slice(0, 5)).toEqual([5, 6, 5, 5, 5]);
    expect(steps.every((d) => d === 5 || d === 6)).toBe(true);
  });

  it('D dorian from D, the So What sound: D G C F', () => {
    const scale = buildScale('D', 'dorian');
    const notes = allFretNotes().filter((n) => n.midi >= 50 && n.midi <= 66 && scale.tones.some((t) => t.pc === n.pc));
    expect(names(quartalLine(parseChord('Dm7'), scale, notes)).slice(0, 4)).toEqual(['D', 'G', 'C', 'F']);
  });

  it('inside a hand position the chain stops where the frets end', () => {
    const scale = buildScale('C', 'ionian');
    const line = patternLine(parseChord('Cmaj7'), [note(1, 3), note(5, 7)], { pattern: 'quartal', perm: [], upper: 'II', group: 3, direction: 'up', scale }).sequence;
    expect(line.length).toBeGreaterThanOrEqual(4);
    for (const n of line) expect(n.fret >= 3 && n.fret <= 7).toBe(true);
    expect(line[0]?.pc).toBe(0);
  });
});

describe('overlays (AR4)', () => {
  it('Em7 from the third of Cmaj7: the 9 comes in', () => {
    const c = parseChord('Cmaj7');
    const over = overlayChord(c, buildScale('C', 'ionian'), '3');
    expect(over?.symbol).toBe('Em7');
    expect(tensionsOver(c, over!)).toEqual(['3', '5', '7', '9']);
  });

  it('Em7b5 over C7 is C9; Cmaj7 over Am7 is Am9; G7 from the fifth of Cmaj7', () => {
    expect(overlayChord(parseChord('C7'), buildScale('C', 'mixolydian'), '3')?.symbol).toBe('Em7b5');
    expect(overlayChord(parseChord('Am7'), buildScale('A', 'dorian'), '3')?.symbol).toBe('Cmaj7');
    expect(overlayChord(parseChord('Cmaj7'), buildScale('C', 'ionian'), '5')?.symbol).toBe('G7');
    expect(overlayChord(parseChord('Cmaj7'), buildScale('C', 'lydian'), '5')?.symbol).toBe('Gmaj7');
  });

  it('the tritone substitute only over a dominant: Db7 over G7, with b9, 3, b5 (#11), b7', () => {
    const g7 = parseChord('G7');
    const db7 = overlayChord(g7, buildScale('G', 'mixolydian'), 'tritone');
    expect(db7?.symbol).toBe('Db7');
    expect(new Set(tensionsOver(g7, db7!))).toEqual(new Set(['b9', '#11', 'b7', '3']));
    expect(overlayChord(parseChord('Cmaj7'), buildScale('C', 'ionian'), 'tritone')).toBeNull();
    expect(noteName(db7!.root)).toBe('Db');
  });
});

describe('note-by-note editing (AR6)', () => {
  const line = [note(0, 8), note(1, 7), note(1, 10), note(2, 10)]; // C E G B on strings 6-5-5-4

  it('moving one note leaves the others where they were', () => {
    const edited = applyEdits(line, [{ index: 1, to: { string: 0, fret: 12 } }]);
    expect(edited.map((n) => [n.string, n.fret])).toEqual([[0, 8], [0, 12], [1, 10], [2, 10]]);
    expect(edited[1]?.midi).toBe(line[1]?.midi);
    expect(applyEdits(line, [{ index: 2, to: null }])).toHaveLength(3);
    expect(applyEdits(line, [{ index: 9, to: null }, { index: 0, to: { string: 7, fret: 1 } }])).toEqual(line);
  });

  it('one edit per note, the latest wins; the same pitch elsewhere and the next chord tone', () => {
    const edits = withEdit(withEdit([], { index: 1, to: null }), { index: 1, to: { string: 0, fret: 12 } });
    expect(edits).toEqual([{ index: 1, to: { string: 0, fret: 12 } }]);
    expect(samePitchPlaces(note(1, 7)).map((n) => [n.string, n.fret])).toEqual([[0, 12], [2, 2]]);
    const cmaj7 = new Set(parseChord('Cmaj7').tones.map((t) => t.pc));
    expect(stepOnString(note(1, 7), cmaj7, 1)?.fret).toBe(10);
    expect(stepOnString(note(1, 7), cmaj7, -1)?.fret).toBe(3);
    expect(lineKey(line)).toBe('0:8 1:7 1:10 2:10');
  });

  it('a route by hand: guitarists’ string numbers, checked token by token', () => {
    const { notes, errors } = parseRoute('6/8 5-7 5:10 4/10');
    expect(errors).toEqual([]);
    expect(notes).toEqual(line);
    expect(formatRoute(line)).toBe('6/8 5/7 5/10 4/10');
    const bad = parseRoute('6/8 7/3 2/30 x');
    expect(bad.notes).toHaveLength(1);
    expect(bad.errors).toHaveLength(3);
    expect(bad.errors[0]).toContain('corda 7');
  });

  it('ergonomics: a stretch past the chosen span, a leap, too many shifts, open strings, notes outside', () => {
    expect(ergonomicIssues(line)).toEqual([]);
    expect(ergonomicIssues(line, { ...DEFAULT_ERGO, maxStretch: 2 }).map((i) => i.kind)).toEqual(['stretch']);
    const leap = [note(0, 3), note(1, 12)];
    expect(ergonomicIssues(leap)).toEqual([{ index: 1, kind: 'jump', amount: 9 }]);
    const climbing = [note(0, 1), note(0, 7), note(0, 13), note(0, 19)];
    expect(ergonomicIssues(climbing, { ...DEFAULT_ERGO, maxJump: 12, maxShifts: 1 }).filter((i) => i.kind === 'shifts')).toEqual([{ index: 2, kind: 'shifts', amount: 2 }]);
    expect(ergonomicIssues([note(1, 0)], { ...DEFAULT_ERGO, allowOpen: false })[0]?.kind).toBe('open');
    const cmaj7 = new Set(parseChord('Cmaj7').tones.map((t) => t.pc));
    expect(ergonomicIssues([note(1, 3), note(1, 5)], DEFAULT_ERGO, cmaj7)).toEqual([{ index: 1, kind: 'outside', amount: 0 }]);
  });
});
