import { describe, expect, it } from 'vitest';
import { TONICS, parseNote, spelledIntervalBetween, transposeBySpelled, noteName } from '../theory';
import { defaultPhase, routineTrack, sanitizeRoutine, transposeRoutineBetween, type Routine } from './routine';

const METER = { beatsPerBar: 4, beatUnit: 4 } as const;
const tonics = (r: Routine) => r.phases.map((p) => `${p.tonic} ${p.scaleId}`);

// The owner's case (21 November 2026): an exercise written with C major as reference.
const owner = (secondTonic: string): Routine => ({
  name: 'La minore naturale su, melodica giù',
  phases: [
    defaultPhase('a', { tonic: 'A', scaleId: 'aeolian', direction: 'up' }),
    defaultPhase('b', { tonic: secondTonic, scaleId: 'melodicMinor', direction: 'down' }),
  ],
});

describe('relational transposition (M1)', () => {
  it('C → D: A natural minor + A melodic minor become B natural minor + B melodic minor', () => {
    expect(tonics(transposeRoutineBetween(owner('A'), 'C', 'D'))).toEqual(['B aeolian', 'B melodicMinor']);
  });

  it('C → D: Ab melodic minor as second scale becomes Bb melodic minor, not A#', () => {
    expect(tonics(transposeRoutineBetween(owner('Ab'), 'C', 'D'))).toEqual(['B aeolian', 'Bb melodicMinor']);
  });

  it('keeps the scales: a minor phase is never swapped for the relative minor of the new key', () => {
    const moved = transposeRoutineBetween(owner('A'), 'C', 'G');
    // Relative minor of G would be E; the relation C→A (a major sixth) gives E too, but as the same scale type, and
    // for C→Eb the result is C minor, a major sixth above Eb, never the relative of the original key.
    expect(tonics(moved)).toEqual(['E aeolian', 'E melodicMinor']);
    expect(tonics(transposeRoutineBetween(owner('A'), 'C', 'Eb'))).toEqual(['C aeolian', 'C melodicMinor']);
  });

  it('the letters of the key change matter: C → Db and C → C# spell the same keys differently', () => {
    expect(tonics(transposeRoutineBetween(owner('Ab'), 'C', 'Db'))).toEqual(['Bb aeolian', 'A melodicMinor']);
    expect(tonics(transposeRoutineBetween(owner('A'), 'C', 'C#'))).toEqual(['A# aeolian', 'A# melodicMinor']);
  });

  it('a fixed phase stays where it is while the others follow', () => {
    const routine: Routine = { name: 'misto', phases: [
      defaultPhase('a', { tonic: 'A', scaleId: 'aeolian' }),
      defaultPhase('b', { tonic: 'E', scaleId: 'phrygian', link: 'fixed' }),
    ] };
    expect(tonics(transposeRoutineBetween(routine, 'C', 'D'))).toEqual(['B aeolian', 'E phrygian']);
  });

  it('chords move by the same spelled interval, slash bass included', () => {
    const routine: Routine = { name: 'ii–V', phases: [
      defaultPhase('a', { kind: 'arpeggio', chord: 'Dm7', tonic: 'D', scaleId: 'dorian' }),
      defaultPhase('b', { kind: 'arpeggio', chord: 'G7/B', tonic: 'G', scaleId: 'mixolydian' }),
    ] };
    const inEb = transposeRoutineBetween(routine, 'C', 'Eb');
    expect(inEb.phases.map((p) => [p.tonic, p.chord])).toEqual([['F', 'Fm7'], ['Bb', 'Bb7/D']]);
  });

  it('every key to every key: the interval between phase tonics and the key is kept, and the music moves with it', () => {
    const base = owner('Ab');
    for (const from of TONICS) {
      // Write the routine under `from` first, so the relation is the same as under C.
      const written = transposeRoutineBetween(base, 'C', from);
      const ref = routineTrack(written, METER);
      for (const to of TONICS) {
        const moved = transposeRoutineBetween(written, from, to);
        moved.phases.forEach((phase, i) => {
          expect(TONICS, `${from}→${to}`).toContain(phase.tonic);
          const before = written.phases[i];
          if (!before) throw new Error('phase lost');
          expect(phase.scaleId).toBe(before.scaleId);
          const step = spelledIntervalBetween(parseNote(from), parseNote(to)).semitones;
          const expectedPc = (spelledIntervalBetween(parseNote('C'), parseNote(before.tonic)).semitones + step) % 12;
          expect(spelledIntervalBetween(parseNote('C'), parseNote(phase.tonic)).semitones, `${from}→${to}`).toBe(expectedPc);
        });
        const track = routineTrack(moved, METER);
        expect(track?.events.length).toBe(ref?.events.length);
      }
    }
  });

  it('there and back returns the same routine', () => {
    for (const to of TONICS) {
      const back = transposeRoutineBetween(transposeRoutineBetween(owner('Ab'), 'C', to), to, 'C');
      expect(tonics(back).map((t) => t.split(' ')[1])).toEqual(['aeolian', 'melodicMinor']);
      // Pitch classes return exactly; spelling may fall back to the enharmonic only where the key forced it.
      expect(back.phases.map((p) => spelledIntervalBetween(parseNote('C'), parseNote(p.tonic)).semitones)).toEqual([9, 8]);
    }
  });

  it('old saved routines without a link follow the key', () => {
    const raw = JSON.parse(JSON.stringify(owner('A'))) as { phases: Record<string, unknown>[] };
    raw.phases.forEach((p) => delete p.link);
    expect(sanitizeRoutine(raw, owner('A')).phases.map((p) => p.link)).toEqual(['follow', 'follow']);
  });
});

describe('spelled intervals in the theory engine', () => {
  it('textbook: a major second from Ab is Bb, a minor second from A is Bb, an augmented unison from A is A#', () => {
    expect(noteName(transposeBySpelled(parseNote('Ab'), { letters: 1, semitones: 2 }))).toBe('Bb');
    expect(noteName(transposeBySpelled(parseNote('A'), { letters: 1, semitones: 1 }))).toBe('Bb');
    expect(noteName(transposeBySpelled(parseNote('A'), { letters: 0, semitones: 1 }))).toBe('A#');
    expect(spelledIntervalBetween(parseNote('C'), parseNote('Db'))).toEqual({ letters: 1, semitones: 1 });
    expect(spelledIntervalBetween(parseNote('C'), parseNote('C#'))).toEqual({ letters: 0, semitones: 1 });
  });

  it('never returns a double accidental or Cb, Fb, E#, B#', () => {
    expect(noteName(transposeBySpelled(parseNote('F#'), { letters: 0, semitones: 1 }))).toBe('G');
    expect(noteName(transposeBySpelled(parseNote('Eb'), { letters: 1, semitones: 1 }, true))).toBe('E');
    expect(noteName(transposeBySpelled(parseNote('B'), { letters: 0, semitones: 1 }))).toBe('C');
  });
});
