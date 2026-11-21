import { describe, expect, it } from 'vitest';
import { defaultPhase, resolvePhase, sanitizeRoutine, transposeRoutineBetween, type Routine } from './routine';
import { describeStrings, isSkipping, normalizeStrings, onStrings, stringIndex } from './strings';
import { STANDARD_TUNING, threeNpsPosition } from '../fretboard';
import { buildScale } from '../theory';

describe('strings of an exercise (M4)', () => {
  it('guitarist numbering: string 1 is the high E, string 6 the low E', () => {
    expect(stringIndex(1)).toBe(5);
    expect(stringIndex(6)).toBe(0);
    expect(STANDARD_TUNING[stringIndex(6)]).toBe(40);
    expect(STANDARD_TUNING[stringIndex(1)]).toBe(64);
  });

  it('textbook: G major 3NPS from the root on strings 1–3 has three notes per string, nine in all', () => {
    const shape = threeNpsPosition(buildScale('G', 'ionian'), 0);
    if (!shape) throw new Error('no shape');
    const top = onStrings(shape.notes, [1, 2, 3]);
    expect(top.length).toBe(9);
    expect(new Set(top.map((n) => n.string))).toEqual(new Set([3, 4, 5]));
  });

  it('a phase on 6-4-2 plays only those strings, still in scale order, with string skipping recognised', () => {
    const phase = defaultPhase('s', { strings: [2, 4, 6], position: { kind: 'caged', form: 'E' } });
    const resolved = resolvePhase(phase);
    expect(resolved.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(new Set(resolved.sequence.map((n) => n.string))).toEqual(new Set([0, 2, 4]));
    const midis = resolved.sequence.map((n) => n.midi);
    expect(midis).toEqual([...midis].sort((a, b) => a - b));
    expect(isSkipping([2, 4, 6])).toBe(true);
    expect(isSkipping([1, 2, 3])).toBe(false);
  });

  it('a set with no notes of the shape is an error with a fix', () => {
    const phase = defaultPhase('s', { strings: [1], position: { kind: 'range', low: 0, high: 0 }, scaleId: 'ionian', tonic: 'F#' });
    const resolved = resolvePhase(phase);
    const error = resolved.issues.find((i) => i.level === 'error');
    expect(error?.fix?.change).toEqual({ strings: [] });
    expect(resolved.sequence).toEqual([]);
  });

  it('arpeggio phases keep to the strings too', () => {
    const phase = defaultPhase('a', { kind: 'arpeggio', chord: 'Cmaj7', strings: [1, 2, 3, 4] });
    const resolved = resolvePhase(phase);
    expect(resolved.sequence.length).toBeGreaterThan(3);
    expect(resolved.sequence.every((n) => n.string >= 2)).toBe(true);
  });

  it('strings survive saving and a key change; garbage is dropped', () => {
    const routine: Routine = { name: 'x', phases: [defaultPhase('a', { strings: [3, 1] as never })] };
    const saved = sanitizeRoutine(JSON.parse(JSON.stringify(routine)), routine);
    expect(saved.phases[0]?.strings).toEqual([1, 3]);
    expect(transposeRoutineBetween(saved, 'C', 'D').phases[0]?.strings).toEqual([1, 3]);
    expect(normalizeStrings([7, 'a', 2, 2])).toEqual([2]);
    expect(normalizeStrings([1, 2, 3, 4, 5, 6])).toEqual([]);
    expect(describeStrings([2, 4, 6])).toContain('salto di corda');
  });
});
