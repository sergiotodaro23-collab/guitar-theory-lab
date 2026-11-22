import { describe, expect, it } from 'vitest';
import { threeNpsPosition } from '../fretboard';
import { buildScale } from '../theory';
import { SEQUENCE_PATTERNS, generateSequence, groupPermutations, parseCustomPattern, type ExerciseSpec } from './index';

const cMajor = buildScale('C', 'ionian');
const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
const seq = (text: string, extra: Partial<ExerciseSpec> = {}) =>
  generateSequence(scale, cMajor, { kind: 'custom', interval: 3, direction: 'up', pairMotion: 'ascending', customPattern: parseCustomPattern(text, { chromatic: true }) ?? [1], ...extra });
const names = (text: string, count: number, extra: Partial<ExerciseSpec> = {}) => seq(text, extra).slice(0, count).map((n) => n.name);

describe('generative sequences (M5)', () => {
  it('groups of 3, 4 and 5 in C, from every degree', () => {
    expect(names('1 2 3', 9)).toEqual(['C', 'D', 'E', 'D', 'E', 'F', 'E', 'F', 'G']);
    expect(names('1 2 3 4', 8)).toEqual(['C', 'D', 'E', 'F', 'D', 'E', 'F', 'G']);
    expect(names('1 2 3 4 5', 10)).toEqual(['C', 'D', 'E', 'F', 'G', 'D', 'E', 'F', 'G', 'A']);
  });

  it('broken fourths (1 4) and the triad pattern 1 3 5 3', () => {
    expect(names('1 4', 6)).toEqual(['C', 'F', 'D', 'G', 'E', 'A']);
    expect(names('1 3 5 3', 8)).toEqual(['C', 'E', 'G', 'E', 'D', 'F', 'A', 'F']);
  });

  it('each group as written, reversed, or alternating up and down', () => {
    expect(names('1 2 3 4', 8, { groupMotion: 'descending' })).toEqual(['F', 'E', 'D', 'C', 'G', 'F', 'E', 'D']);
    expect(names('1 2 3 4', 12, { groupMotion: 'alternating' })).toEqual(['C', 'D', 'E', 'F', 'G', 'F', 'E', 'D', 'E', 'F', 'G', 'A']);
  });

  it('irregular groupings keep their shape: 3+2', () => {
    expect(names('1 2 3 1 2', 10)).toEqual(['C', 'D', 'E', 'C', 'D', 'D', 'E', 'F', 'D', 'E']);
  });

  it('a chromatic approach is a semitone below its degree, spelled with a sharp, on the fretboard', () => {
    const run = seq('3c 3 2 1');
    expect(run.slice(0, 4).map((n) => n.name)).toEqual(['D#', 'E', 'D', 'C']);
    const [approach, target] = run;
    expect((target?.midi ?? 0) - (approach?.midi ?? 0)).toBe(1);
    expect(approach?.fret).toBeGreaterThanOrEqual(0);
    // A natural half step (E under F) stays diatonic in name: no invented sharp.
    expect(names('4c 4', 2)).toEqual(['E', 'F']);
    expect(names('1 2 3 5c 5', 5)).toEqual(['C', 'D', 'E', 'F#', 'G']);
  });

  it('chromatic steps parse only where allowed; every ready-made pattern is valid', () => {
    expect(parseCustomPattern('3c 3')).toBeNull();
    expect(parseCustomPattern('3c 3', { chromatic: true })).toEqual([-3, 3]);
    expect(parseCustomPattern('3c', { chromatic: true })).toBeNull();
    expect(parseCustomPattern('0 2', { chromatic: true })).toBeNull();
    for (const p of SEQUENCE_PATTERNS) expect(parseCustomPattern(p.text, { chromatic: true }), p.label).not.toBeNull();
  });

  it('permutations of a group of 4 are the 24 orderings, starting 1 2 3 4 and ending 4 3 2 1', () => {
    const perms = groupPermutations(4);
    expect(perms).toHaveLength(24);
    expect(perms[0]).toEqual([1, 2, 3, 4]);
    expect(perms.at(-1)).toEqual([4, 3, 2, 1]);
    expect(new Set(perms.map((p) => p.join())).size).toBe(24);
    expect(groupPermutations(3)).toHaveLength(6);
  });
});
