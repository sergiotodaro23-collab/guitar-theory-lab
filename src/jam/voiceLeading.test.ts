import { describe, expect, it } from 'vitest';
import { mod, parseChord } from '../theory';
import { PPQ } from '../timeline';
import { compTrack, withChord } from './progression';
import { COMP_HIGH, COMP_LOW, largestLeap, motion, positions, upperTones, voiceLead } from './voiceLeading';

const chords = (...symbols: string[]) => symbols.map((s) => parseChord(s));
const pcs = (v: readonly number[]) => v.map((m) => mod(m, 12));
const leaps = (vs: readonly (readonly number[])[], loop: boolean) =>
  vs.map((v, i) => (i + 1 < vs.length ? largestLeap(v, vs[i + 1] as number[]) : loop ? largestLeap(v, vs[0] as number[]) : 0));

describe('comping voice leading (J5)', () => {
  it('ii–V–I in C: the third of Dm7 (F) is held as the seventh of G7, which falls a half step to E, the third of Cmaj7', () => {
    const [dm, g, c] = voiceLead(chords('Dm7', 'G7', 'Cmaj7'), false) as number[][];
    const f = dm?.find((m) => mod(m, 12) === 5);
    expect(g).toContain(f);
    expect(c).toContain((f as number) - 1);
    // B, the third of G7, resolves up to C or down a half step to B held as the seventh of Cmaj7.
    const b = g?.find((m) => mod(m, 12) === 11) as number;
    expect(c?.some((m) => m === b || m === b + 1)).toBe(true);
    expect(Math.max(...leaps([dm, g, c] as number[][], false))).toBeLessThanOrEqual(2);
  });

  it('a 12-bar blues in F and the rhythm-changes A section move no voice more than a major third, the loop back included', () => {
    const blues = chords('F7', 'Bb7', 'F7', 'F7', 'Bb7', 'Bb7', 'F7', 'D7', 'Gm7', 'C7', 'F7', 'C7');
    const rhythm = chords('Bbmaj7', 'G7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7');
    for (const prog of [blues, rhythm]) expect(Math.max(...leaps(voiceLead(prog, true), true))).toBeLessThanOrEqual(4);
  });

  it('every voicing keeps the guide tones, stays in F3–E5 and does not drift over a long cycle of fifths', () => {
    const cycle = chords('C7', 'F7', 'Bb7', 'Eb7', 'Ab7', 'Db7', 'Gb7', 'B7', 'E7', 'A7', 'D7', 'G7');
    const voiced = voiceLead(cycle, true);
    voiced.forEach((v, i) => {
      const chord = cycle[i]!;
      const third = chord.tones.find((t) => t.degree === '3')?.pc;
      const seventh = chord.tones.find((t) => t.degree === 'b7')?.pc;
      expect(pcs(v)).toEqual(expect.arrayContaining([third, seventh]));
      expect(Math.min(...v)).toBeGreaterThanOrEqual(COMP_LOW);
      expect(Math.max(...v)).toBeLessThanOrEqual(COMP_HIGH);
    });
    const centres = voiced.map((v) => v.reduce((a, b) => a + b, 0) / v.length);
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(7);
  });

  it('upper tones: guide tones first, at most four, the root only for a triad that needs a third voice', () => {
    expect(upperTones(parseChord('G13')).slice(0, 2)).toEqual([11, 5]);
    expect(upperTones(parseChord('C9'))).toHaveLength(4);
    expect([...upperTones(parseChord('C'))].sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it('positions are close or drop-2, all inside the register; motion matches voices low to high', () => {
    const all = positions([0, 4, 7, 11]);
    expect(all.length).toBeGreaterThan(4);
    expect(all).toContainEqual([55, 59, 60, 64]); // G B C E, close
    expect(all).toContainEqual([52 + 12, 67, 71, 72].sort((a, b) => a - b)); // close, higher
    expect(motion([60, 64, 67], [60, 65, 69])).toBe(3);
  });

  it('the comping track uses the led voicings over the chord bass', () => {
    const p = { name: 't', chords: ['Dm7', 'G7', 'Cmaj7'].map((c) => withChord(c)) };
    const events = compTrack(p, { beatsPerBar: 4, beatUnit: 4 }, 'sustain', false).events;
    expect(events.map((e) => e.tick)).toEqual([0, PPQ * 4, PPQ * 8]);
    const upper = events.map((e) => e.payload.midis.slice(1));
    expect(upper).toEqual(voiceLead(chords('Dm7', 'G7', 'Cmaj7'), false));
    expect(mod(events[1]?.payload.midis[0] ?? 0, 12)).toBe(7);
  });
});
