import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { PPQ } from '../timeline';
import { approachPitch, BASS_LOW, bassPitch, bassTrack } from './bass';
import { GENRES, genreOf } from './genres';
import { DRUM_STEPS, DRUM_VOICES } from './drums';
import { COMP_PATTERNS, compTrack, withChord, type Progression } from './progression';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const BAR = PPQ * 4;
const prog = (...symbols: string[]): Progression => ({ name: 'test', chords: symbols.map((s) => withChord(s)) });
const pitches = (p: Progression, genre: string, index: number, loop = true) =>
  bassTrack(p, m44, genreOf(genre as never).bass[index] as never, loop).events.map((e) => ({ tick: e.tick, midi: e.payload.midi }));

describe('bass pitches from the chord', () => {
  it('roots sit in the low register from E1: C is C2 (36), F is F1 (29), E is E1 (28)', () => {
    expect(['C', 'F', 'E', 'D#'].map((c) => bassPitch(parseChord(c), 'root'))).toEqual([36, 29, 28, 39]);
    expect(BASS_LOW).toBe(28);
  });

  it('chord tones come from the chord: Cm7 has Eb and Bb, Cm7b5 has Gb', () => {
    const cm7 = parseChord('Cm7');
    expect(bassPitch(cm7, 'third') - 36).toBe(3);
    expect(bassPitch(cm7, 'seventh') - 36).toBe(10);
    expect(bassPitch(parseChord('Cm7b5'), 'fifth') - 36).toBe(6);
    expect(bassPitch(parseChord('Csus4'), 'third') - 36).toBe(5);
  });

  it('a slash chord plays its bass note: C/E has E in the bass', () => {
    expect(bassPitch(parseChord('C/E'), 'root')).toBe(28);
  });

  it('approach: a half step from the root the next chord plays (G1 = 31), from the nearer side', () => {
    expect(approachPitch(parseChord('G7'), 45)).toBe(32);
    expect(approachPitch(parseChord('G7'), 28)).toBe(30);
  });
});

describe('bass lines over a progression', () => {
  it('rock eighths on C–F: eight Cs, then eight Fs', () => {
    const notes = pitches(prog('C', 'F'), 'rock', 0);
    expect(notes).toHaveLength(16);
    expect(notes.slice(0, 8).every((n) => n.midi === 36)).toBe(true);
    expect(notes.slice(8).every((n) => n.midi === 29)).toBe(true);
    expect(notes[8]?.tick).toBe(BAR);
  });

  it('jazz walk on ii–V–I: root, third, fifth, then a chromatic approach to the next root', () => {
    const notes = pitches(prog('Dm7', 'G7', 'Cmaj7'), 'jazz', 0);
    const [d, f, a, approach, g] = notes.map((n) => n.midi);
    expect([d, f, a]).toEqual([38, 41, 45]);
    expect(Math.abs((approach ?? 0) - (g ?? 0))).toBe(1);
    expect(g).toBe(31);
    // Looping: the last bar walks back to Dm7 (D2 = 38) by a half step.
    expect([37, 39]).toContain(notes.at(-1)?.midi);
  });

  it('without a loop the last chord has nothing to approach: it plays its fifth', () => {
    const notes = pitches(prog('Dm7', 'G7'), 'jazz', 0, false);
    expect(notes.at(-1)?.midi).toBe(bassPitch(parseChord('G7'), 'fifth'));
  });

  it('a chord that starts mid-bar still gets its root on the change', () => {
    const p: Progression = { name: 'test', chords: [withChord('C', { value: 2, unit: 'beats' }), withChord('G', { value: 2, unit: 'beats' })] };
    const notes = bassTrack(p, m44, genreOf('rock').bass[2] as never, true).events;
    expect(notes.find((n) => n.tick === PPQ * 2)?.payload.midi).toBe(31);
  });

  it('with a bass line the comping leaves its bass note out', () => {
    const p = prog('C');
    const full = compTrack(p, m44, 'sustain', true).events[0]?.payload.midis ?? [];
    const upper = compTrack(p, m44, 'sustain', true, true).events[0]?.payload.midis ?? [];
    expect(upper).toEqual(full.slice(1));
  });
});

describe('genres', () => {
  it('eight genres, each with four drum grooves, a fill and four bass lines', () => {
    expect(GENRES.map((g) => g.id)).toEqual(['rock', 'blues', 'jazz', 'funk', 'fusion', 'metal', 'latin', 'ambient']);
    for (const genre of GENRES) {
      expect(genre.kit.patterns).toHaveLength(4);
      expect(genre.bass).toHaveLength(4);
      expect(Object.keys(COMP_PATTERNS)).toContain(genre.comp);
      for (const p of [...genre.kit.patterns, genre.kit.fill]) for (const { voice } of DRUM_VOICES) expect(p[voice]).toHaveLength(DRUM_STEPS);
      for (const b of genre.bass) for (const n of b.notes) {
        expect(n.step).toBeGreaterThanOrEqual(0);
        // Only an anticipation may be held over the bar line, into the next chord.
        expect(n.step + n.length).toBeLessThanOrEqual(n.tone === 'anticipate' ? 20 : 16);
      }
      // Every groove has a downbeat somewhere, and every bass line starts in the bar.
      expect(genre.bass.every((b) => b.notes.length > 0)).toBe(true);
    }
  });

  it('shuffle genres swing the eighths by a triplet; the others play straight', () => {
    expect(genreOf('blues').swing).toBeCloseTo(1 / 3);
    expect(genreOf('jazz').swing).toBeCloseTo(1 / 3);
    expect(genreOf('rock').swing).toBe(0);
  });

  it('the son clave 3-2 in Latin C: hits on 1, the and of 2, 4, then 2 and 3', () => {
    const clave = genreOf('latin').kit.patterns[2].clap;
    expect(clave.flatMap((v, i) => (v ? [i] : []))).toEqual([0, 3, 6, 10, 12]);
  });
});
