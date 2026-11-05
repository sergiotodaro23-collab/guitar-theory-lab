import { describe, expect, it } from 'vitest';
import { cagedPosition, threeNpsPosition } from '../fretboard';
import { buildScale } from '../theory';
import { PPQ } from '../timeline';
import { exerciseTrack, generateSequence, parseCustomPattern, type ExerciseSpec, type IntervalNumber } from './index';

const base: ExerciseSpec = { kind: 'interval', interval: 3, direction: 'up', pairMotion: 'ascending', customPattern: [1, 3, 2, 4] };
const cMajor = buildScale('C', 'ionian');
const position = cagedPosition(cMajor, 'A').notes;
const meter = { beatsPerBar: 4, beatUnit: 4 } as const;

describe('interval exercises', () => {
  it.each([[2, 1, 2], [3, 3, 4], [4, 5, 6], [5, 6, 8], [6, 8, 9], [7, 10, 11]] as const)(
    'every %ith spans the right semitones', (interval, minSemi, maxSemi) => {
      const seq = generateSequence(position, cMajor, { ...base, interval: interval as IntervalNumber });
      expect(seq.length).toBeGreaterThan(0);
      for (let i = 0; i < seq.length; i += 2) {
        const gap = (seq[i + 1]?.midi ?? 0) - (seq[i]?.midi ?? 0);
        expect(gap).toBeGreaterThanOrEqual(minSemi);
        expect(gap).toBeLessThanOrEqual(maxSemi);
      }
    },
  );
  it('octaves are exactly 12 semitones with matching note names', () => {
    const seq = generateSequence(position, cMajor, { ...base, interval: 8 });
    for (let i = 0; i < seq.length; i += 2) {
      expect((seq[i + 1]?.midi ?? 0) - (seq[i]?.midi ?? 0)).toBe(12);
      expect(seq[i + 1]?.name).toBe(seq[i]?.name);
    }
  });
  it('produces the textbook thirds from C', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    const seq = generateSequence(scale, cMajor, base);
    expect(seq.slice(0, 6).map((n) => n.name)).toEqual(['C', 'E', 'D', 'F', 'E', 'G']);
  });
  it('supports descending and alternating pairs', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    expect(generateSequence(scale, cMajor, { ...base, pairMotion: 'descending' }).slice(0, 4).map((n) => n.name)).toEqual(['E', 'C', 'F', 'D']);
    expect(generateSequence(scale, cMajor, { ...base, pairMotion: 'alternating' }).slice(0, 4).map((n) => n.name)).toEqual(['C', 'E', 'F', 'D']);
  });
  it('goes down the same pairs in reverse', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    const up = generateSequence(scale, cMajor, base);
    const down = generateSequence(scale, cMajor, { ...base, direction: 'down' });
    expect(down.map((n) => n.midi)).toEqual([...up].reverse().map((n) => n.midi));
  });
  it('up and down does not repeat the turnaround pair', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    const up = generateSequence(scale, cMajor, base);
    const both = generateSequence(scale, cMajor, { ...base, direction: 'updown' });
    expect(both.length).toBe(up.length * 2 - 2);
  });
  it('finds only real thirds in a pentatonic', () => {
    const scale = buildScale('A', 'minorPentatonic');
    const seq = generateSequence(cagedPosition(scale, 'G').notes, scale, base);
    expect(seq.length).toBeGreaterThan(0);
    for (let i = 0; i < seq.length; i += 2) {
      const gap = (seq[i + 1]?.midi ?? 0) - (seq[i]?.midi ?? 0);
      expect([3, 4]).toContain(gap);
    }
  });
});

describe('custom sequences', () => {
  it('parses patterns and rejects garbage', () => {
    expect(parseCustomPattern('1 3 2 4')).toEqual([1, 3, 2, 4]);
    expect(parseCustomPattern('1-2-3')).toEqual([1, 2, 3]);
    expect(parseCustomPattern('1, 5')).toEqual([1, 5]);
    expect(parseCustomPattern('')).toBeNull();
    expect(parseCustomPattern('a b')).toBeNull();
    expect(parseCustomPattern('0 1')).toBeNull();
  });
  it('applies the pattern from each scale step', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    const seq = generateSequence(scale, cMajor, { ...base, kind: 'custom', customPattern: [1, 2, 3, 1] });
    expect(seq.slice(0, 8).map((n) => n.name)).toEqual(['C', 'D', 'E', 'C', 'D', 'E', 'F', 'D']);
  });
  it('plain scale run covers the position in order', () => {
    const scale = threeNpsPosition(cMajor, 0)?.notes ?? [];
    const seq = generateSequence(scale, cMajor, { ...base, kind: 'scale' });
    expect(seq.map((n) => n.midi)).toEqual([...scale].map((n) => n.midi));
  });
});

describe('exercise track', () => {
  it('places notes on the grid and rounds up to the bar', () => {
    const notes = threeNpsPosition(cMajor, 0)?.notes.slice(0, 5) ?? [];
    const track = exerciseTrack(notes, meter, 2);
    expect(track.events.map((e) => e.tick)).toEqual([0, 240, 480, 720, 960]);
    expect(track.lengthTicks).toBe(PPQ * 4);
    expect(exerciseTrack(notes, meter, 1).lengthTicks).toBe(PPQ * 8);
  });
  it('keeps a position for the highlight', () => {
    const notes = threeNpsPosition(cMajor, 0)?.notes.slice(0, 3) ?? [];
    expect(exerciseTrack(notes, meter, 4).events[2]?.payload).toMatchObject({ index: 2, string: notes[2]?.string, fret: notes[2]?.fret });
  });
});
