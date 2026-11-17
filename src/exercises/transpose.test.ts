import { describe, expect, it } from 'vitest';
import { TONICS, parseNote, pitchClass } from '../theory';
const DEFAULT_METER = { beatsPerBar: 4, beatUnit: 4 } as const;
import { ROUTINE_TEMPLATES, defaultPhase, resolvePhase, routineTrack, transposeChordSymbol, transposeRoutine, type Routine } from './routine';

const pcs = (routine: Routine): number[] => (routineTrack(routine, DEFAULT_METER)?.events ?? []).map((e) => e.payload.midi % 12);
const pc = (name: string) => pitchClass(parseNote(name));

describe('transposing a routine (the advanced exercise) to another key', () => {
  it('every template, to every key: each note sounds the same interval higher, in the same order and rhythm', () => {
    for (const template of ROUTINE_TEMPLATES) {
      const original = routineTrack(template, DEFAULT_METER);
      if (!original) continue;
      for (let interval = 1; interval < 12; interval += 1) {
        const moved = transposeRoutine(template, interval);
        const track = routineTrack(moved, DEFAULT_METER);
        expect(track, `${template.name} +${interval}`).not.toBeNull();
        expect(track?.events.length, `${template.name} +${interval}`).toBe(original.events.length);
        expect(track?.lengthTicks).toBe(original.lengthTicks);
        expect(track?.events.map((e) => e.tick)).toEqual(original.events.map((e) => e.tick));
        expect(pcs(moved), `${template.name} +${interval}`).toEqual(pcs(template).map((p) => (p + interval) % 12));
        // Every phase still resolves without issues it did not have, with a tonic the app knows.
        moved.phases.forEach((phase, i) => {
          expect(TONICS).toContain(phase.tonic);
          const before = template.phases[i];
          if (!before) throw new Error('phase lost');
          expect(pc(phase.tonic)).toBe((pc(before.tonic) + interval) % 12);
          expect(resolvePhase(phase).issues.length).toBe(resolvePhase(before).issues.length);
          expect(phase.scaleId).toBe(before.scaleId);
          expect(phase.direction).toBe(before.direction);
        });
      }
    }
  });

  it('textbook cases: ii–V in C becomes ii–V in D; A harmonic material goes to C', () => {
    const iiV: Routine = { name: 'ii–V', phases: [
      defaultPhase('a', { kind: 'arpeggio', chord: 'Dm7', tonic: 'D', scaleId: 'dorian' }),
      defaultPhase('b', { kind: 'arpeggio', chord: 'G7', tonic: 'G', scaleId: 'mixolydian' }),
    ] };
    const inD = transposeRoutine(iiV, 2);
    expect(inD.phases.map((p) => [p.tonic, p.chord])).toEqual([['E', 'Em7'], ['A', 'A7']]);
    const inBb = transposeRoutine(iiV, -2);
    expect(inBb.phases.map((p) => [p.tonic, p.chord])).toEqual([['C', 'Cm7'], ['F', 'F7']]);
    expect(transposeChordSymbol('F#m7b5', 1)).toBe('Gm7b5');
    expect(transposeChordSymbol('C/E', 7)).toBe('G/B');
    expect(transposeChordSymbol('Bbmaj7', 2)).toBe('Cmaj7');
    expect(transposeChordSymbol('non un accordo', 2)).toBe('non un accordo');
  });

  it('there and back gives the same notes; twelve semitones change nothing', () => {
    for (const template of ROUTINE_TEMPLATES) {
      expect(pcs(transposeRoutine(transposeRoutine(template, 5), -5))).toEqual(pcs(template));
      expect(transposeRoutine(template, 12)).toBe(template);
      expect(transposeRoutine(template, 0)).toBe(template);
    }
  });

  it('a fret window moves with the key and stays on the neck', () => {
    const windowed: Routine = { name: 'finestra', phases: [defaultPhase('w', { tonic: 'C', position: { kind: 'range', low: 5, high: 9 } })] };
    expect(transposeRoutine(windowed, 2).phases[0]?.position).toEqual({ kind: 'range', low: 7, high: 11 });
    // Down a fourth would be the nearest (seven up is further than five down).
    expect(transposeRoutine(windowed, 7).phases[0]?.position).toEqual({ kind: 'range', low: 0, high: 4 });
    const high: Routine = { name: 'alta', phases: [defaultPhase('h', { tonic: 'C', position: { kind: 'range', low: 19, high: 24 } })] };
    const moved = transposeRoutine(high, 3).phases[0]?.position;
    expect(moved).toEqual({ kind: 'range', low: 10, high: 15 });
    expect(pcs(transposeRoutine(windowed, 2))).toEqual(pcs(windowed).map((p) => (p + 2) % 12));
  });
});
