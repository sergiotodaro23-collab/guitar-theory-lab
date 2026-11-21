import { describe, expect, it } from 'vitest';
import { enclosureLine, groupedLine, parsePermutation, permutationLine, triadPair, triadPairLine, upperStructure, upperStructureTensions, windowNotes, directedLine } from './arpPatterns';
import { buildScale, mod, parseChord } from '../theory';
import { allFretNotes, type FretNote } from '../fretboard';

const note = (string: number, fret: number): FretNote => {
  const midi = [40, 45, 50, 55, 59, 64][string] as number + fret;
  return { string, fret, midi, pc: mod(midi, 12) };
};
const neckBetween = (pcs: readonly number[], lowMidi: number, highMidi: number) =>
  allFretNotes().filter((n) => pcs.includes(n.pc) && n.midi >= lowMidi && n.midi <= highMidi);

describe('permutations (AR2)', () => {
  const cmaj7 = parseChord('Cmaj7');
  const notes = neckBetween(cmaj7.tones.map((t) => t.pc), 48, 84);

  it('1-5-3-7: root, up to the fifth, down to the third, up to the seventh, in each octave', () => {
    const line = permutationLine(cmaj7, notes, [1, 5, 3, 7]);
    expect(line.length % 4).toBe(0);
    expect(line.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < line.length; i += 4) {
      const root = (line[i] as FretNote).midi;
      expect(line.slice(i, i + 4).map((n) => n.midi - root)).toEqual([0, 7, 4, 11]);
    }
  });

  it('octave leaps: 1-3-5-8 and 1-8-5-3', () => {
    const up = permutationLine(cmaj7, notes, [1, 3, 5, 8]);
    expect(up.slice(0, 4).map((n) => n.midi - (up[0] as FretNote).midi)).toEqual([0, 4, 7, 12]);
    const leap = permutationLine(cmaj7, notes, [1, 8, 5, 3]);
    expect(leap.slice(0, 4).map((n) => n.midi - (leap[0] as FretNote).midi)).toEqual([0, 12, 7, 4]);
  });

  it('a degree the chord lacks gives no line; the text form is checked', () => {
    expect(permutationLine(parseChord('C'), notes, [1, 3, 5, 7])).toEqual([]);
    expect(parsePermutation('1 5 3 7')).toEqual([1, 5, 3, 7]);
    expect(parsePermutation('1-3-5-8')).toEqual([1, 3, 5, 8]);
    expect(parsePermutation('1 x 3')).toBeNull();
  });
});

describe('enclosures (AR3)', () => {
  it('scale step above, chromatic below, then the target, on the same string', () => {
    const scale = buildScale('C', 'ionian');
    // E on the B string (fret 5) and C on the B string (fret 1).
    const line = enclosureLine([note(4, 5), note(4, 1)], scale);
    expect(line.map((n) => n.midi)).toEqual([62, 59, 60, 65, 63, 64]);
    expect(line.every((n) => n.string === 4)).toBe(true);
  });

  it('an open-string target keeps only the approach that fits on the neck', () => {
    const line = enclosureLine([note(5, 0)], buildScale('C', 'ionian'));
    expect(line.map((n) => n.fret)).toEqual([1, 0]);
  });
});

describe('triad pairs (AR3)', () => {
  it('I and II of lydian (C and D in C lydian)', () => {
    expect(triadPair(buildScale('C', 'lydian'))?.map((c) => c.symbol)).toEqual(['C', 'D']);
  });

  it('IV and V of the major scale; IV and V of melodic minor; the parent scale of mixolydian', () => {
    expect(triadPair(buildScale('C', 'ionian'))?.map((c) => c.symbol)).toEqual(['F', 'G']);
    expect(triadPair(buildScale('A', 'melodicMinor'))?.map((c) => c.symbol)).toEqual(['D', 'E']);
    expect(triadPair(buildScale('C', 'mixolydian'))?.map((c) => c.symbol)).toEqual(['Bb', 'C']);
  });

  it('three notes of each triad in turn, always rising', () => {
    const [f, g] = [parseChord('F'), parseChord('G')];
    const notes = neckBetween([...f.tones, ...g.tones].map((t) => t.pc), 53, 90);
    const line = triadPairLine(f, g, notes);
    expect(line.length).toBeGreaterThanOrEqual(9);
    for (let i = 1; i < line.length; i += 1) expect((line[i] as FretNote).midi).toBeGreaterThan((line[i - 1] as FretNote).midi);
    const fPcs = new Set(f.tones.map((t) => t.pc));
    line.forEach((n, i) => expect(fPcs.has(n.pc)).toBe(Math.floor(i / 3) % 2 === 0));
  });
});

describe('upper structures (AR3)', () => {
  it('triads over C7 from the method books', () => {
    const c7 = parseChord('C7');
    expect(['II', 'bIII', 'bV', 'bVI', 'VI'].map((u) => upperStructure(c7, u as 'II').symbol)).toEqual(['D', 'Eb', 'Gb', 'Ab', 'A']);
    expect(upperStructureTensions(c7, 'II')).toEqual(['9', '#11', '13']);
    expect(upperStructureTensions(c7, 'bVI')).toEqual(['b13', '1', '#9']);
    expect(upperStructureTensions(c7, 'VI')).toEqual(['13', 'b9', '3']);
  });

  it('its notes inside a hand position', () => {
    const d = upperStructure(parseChord('C7'), 'II');
    const notes = windowNotes(d, 7, 4);
    expect(notes.length).toBeGreaterThan(5);
    expect(notes.every((n) => [2, 6, 9].includes(n.pc) && n.fret >= 7 && n.fret <= 11)).toBe(true);
  });
});

describe('irregular groups (AR4)', () => {
  it('groups of three over five notes: 1-2-3, 2-3-4, 3-4-5', () => {
    const run = [note(3, 5), note(3, 7), note(4, 5), note(4, 8), note(5, 7)];
    expect(groupedLine(run, 3).map((n) => n.midi)).toEqual([60, 62, 64, 62, 64, 67, 64, 67, 71]);
    expect(groupedLine(run, 5)).toHaveLength(5);
    expect(groupedLine(run, 7)).toHaveLength(0);
  });

  it('direction: down reverses, up-down turns without repeating the top', () => {
    const run = [note(3, 5), note(3, 7), note(4, 5)];
    expect(directedLine(run, 'updown').map((n) => n.midi)).toEqual([60, 62, 64, 62, 60]);
    expect(directedLine(run, 'down').map((n) => n.midi)).toEqual([64, 62, 60]);
  });
});
