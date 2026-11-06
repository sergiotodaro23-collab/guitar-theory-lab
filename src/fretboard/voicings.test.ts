import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { chordVoicings, voicingKey } from './voicings';

const shapes = (symbol: string) => chordVoicings(parseChord(symbol), { perPosition: Infinity }).map(voicingKey);

describe('chord voicings', () => {
  it.each([
    ['C', 'x-3-2-0-1-0'],
    ['G', '3-2-0-0-0-3'],
    ['E', '0-2-2-1-0-0'],
    ['Am', 'x-0-2-2-1-0'],
    ['D', 'x-x-0-2-3-2'],
    ['F', '1-3-3-2-1-1'],
    ['Bm', 'x-2-4-4-3-2'],
    ['Cmaj7', 'x-3-2-0-0-0'],
    ['G7', '3-2-0-0-0-1'],
    ['Dm7', 'x-x-0-2-1-1'],
    ['A7', 'x-0-2-0-2-0'],
    ['Em7', '0-2-2-0-3-0'],
    ['C/E', '0-3-2-0-1-0'],
    ['G/B', 'x-2-0-0-0-3'],
  ])('finds the textbook %s shape %s', (symbol, shape) => {
    expect(shapes(symbol)).toContain(shape);
  });

  it('puts the requested bass at the bottom and only chord tones above it', () => {
    for (const symbol of ['C', 'Am7', 'C/E', 'G7/F', 'D/C', 'Fmaj7#11', 'Bm7b5']) {
      const chord = parseChord(symbol);
      const bass = chord.bass?.pc ?? chord.tones[0]?.pc;
      const pcs = new Set([...chord.tones.map((t) => t.pc), bass]);
      const voicings = chordVoicings(chord);
      expect(voicings.length, symbol).toBeGreaterThan(0);
      for (const v of voicings) {
        const lowest = [...v.notes].sort((a, b) => a.midi - b.midi)[0];
        expect(lowest?.pc, `${symbol} ${voicingKey(v)}`).toBe(bass);
        for (const n of v.notes) expect(pcs.has(n.pc)).toBe(true);
        const fretted = v.notes.filter((n) => n.fret > 0).map((n) => n.fret);
        if (fretted.length) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('keeps every tone of a seventh chord and the guide tones of a thirteenth', () => {
    for (const v of chordVoicings(parseChord('Cm7'))) expect(new Set(v.degrees)).toEqual(new Set(['1', 'b3', '5', 'b7']));
    for (const v of chordVoicings(parseChord('G13'))) {
      expect(v.degrees).toContain('3');
      expect(v.degrees).toContain('b7');
      expect(v.degrees).toContain('13');
    }
  });

  it('never offers an all-open shape with a skipped string', () => {
    for (const symbol of ['Em7', 'Em', 'E7', 'Am7']) {
      for (const v of chordVoicings(parseChord(symbol), { perPosition: Infinity })) {
        if (v.frets.every((f) => f === null || f === 0)) {
          const first = v.frets.findIndex((f) => f !== null);
          const last = v.frets.length - 1 - [...v.frets].reverse().findIndex((f) => f !== null);
          expect(v.frets.slice(first, last + 1).includes(null), `${symbol} ${voicingKey(v)}`).toBe(false);
        }
      }
    }
    // Both textbook open Em7 shapes are fine as the first choice.
    const first = chordVoicings(parseChord('Em7'))[0];
    expect(first && ['0-2-0-0-0-0', '0-2-2-0-3-0'].includes(voicingKey(first))).toBe(true);
  });

  it('covers the whole neck, ordered by position, up to fret 24', () => {
    const v = chordVoicings(parseChord('A'));
    const bases = v.map((x) => x.baseFret);
    expect(bases).toEqual([...bases].sort((a, b) => a - b));
    expect(Math.max(...bases)).toBeGreaterThan(12);
    expect(v.every((x) => x.notes.every((n) => n.fret <= 24))).toBe(true);
  });

  it('still voices a dense altered chord on guide tones', () => {
    const v = chordVoicings(parseChord('G7alt'));
    expect(v.length).toBeGreaterThan(0);
    for (const x of v) {
      expect(x.degrees).toContain('3');
      expect(x.degrees).toContain('b7');
    }
  });
});
