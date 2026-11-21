import { describe, expect, it } from 'vitest';
import { formatRhythm, isRhythmError, layoutRhythm, parseRhythm, uniformRhythm, valueTicks, type RhythmStep } from './rhythm';
import { defaultPhase, planRoutine, routineTrack, sanitizeRoutine, type Routine } from './routine';

const FOUR = { beatsPerBar: 4, beatUnit: 4 } as const;
const THREE = { beatsPerBar: 3, beatUnit: 4 } as const;
const SIX_EIGHT = { beatsPerBar: 6, beatUnit: 8 } as const;

const steps = (text: string): readonly RhythmStep[] => {
  const parsed = parseRhythm(text);
  if (isRhythmError(parsed)) throw new Error(parsed.error);
  return parsed;
};

/** A pentatonic box: five notes per octave, one phase. */
const pentatonic = (extra: Parameters<typeof defaultPhase>[1] = {}): Routine => ({
  name: 'pentatonica',
  phases: [defaultPhase('p', { tonic: 'A', scaleId: 'minorPentatonic', position: { kind: 'caged', form: 'E' }, direction: 'up', ...extra })],
});

describe('note values (M3)', () => {
  it('textbook values in ticks at 480 to the quarter', () => {
    expect(valueTicks({ base: 1, dotted: false, tuplet: 1 })).toBe(1920);
    expect(valueTicks({ base: 4, dotted: true, tuplet: 1 })).toBe(720);
    expect(valueTicks({ base: 8, dotted: true, tuplet: 1 })).toBe(360);
    expect(valueTicks({ base: 8, dotted: false, tuplet: 3 })).toBe(160);
    expect(valueTicks({ base: 16, dotted: false, tuplet: 5 })).toBe(96);
    expect(valueTicks({ base: 16, dotted: false, tuplet: 6 })).toBe(80);
    expect(valueTicks({ base: 32, dotted: false, tuplet: 1 })).toBe(60);
    expect(valueTicks({ base: 32, dotted: false, tuplet: 5 })).toBe(48);
  });

  it('a three-triplet cycle fills one beat; a quintuplet cycle fills one beat', () => {
    expect(layoutRhythm(3, steps('8t 8t 8t')).lengthTicks).toBe(480);
    expect(layoutRhythm(5, steps('16q 16q 16q 16q 16q')).lengthTicks).toBe(480);
  });

  it('parses, formats back, and explains mistakes in Italian', () => {
    expect(formatRhythm(steps('8. 16 r8 _8 8t 16q 16s'))).toBe('8. 16 r8 _8 8t 16q 16s');
    expect(isRhythmError(parseRhythm(''))).toBe(true);
    expect(isRhythmError(parseRhythm('r8 r8'))).toBe(true);
    expect(isRhythmError(parseRhythm('_8 8'))).toBe(true);
    expect(isRhythmError(parseRhythm('7'))).toBe(true);
    expect(isRhythmError(parseRhythm('8tq'))).toBe(true);
    const error = parseRhythm('8 x');
    expect(isRhythmError(error) && error.error).toContain('«x»');
  });

  it('notes per beat mean the beat of the meter: eighths in 4/4, sixteenths in 6/8', () => {
    expect(formatRhythm(uniformRhythm(FOUR, 2))).toBe('8');
    expect(formatRhythm(uniformRhythm(FOUR, 3))).toBe('8t');
    expect(formatRhythm(uniformRhythm(SIX_EIGHT, 2))).toBe('16');
    expect(formatRhythm(uniformRhythm(SIX_EIGHT, 1))).toBe('8');
  });
});

describe('laying notes on a rhythm', () => {
  it('rests use time but no notes; ties lengthen the note before', () => {
    const layout = layoutRhythm(3, steps('4 r8 8 _8'));
    expect(layout.notes.map((n) => [n.tick, n.writtenTicks])).toEqual([[0, 480], [720, 480], [1200, 480]]);
    // The cycle starts again on the third note: quarter at 1200, and the run ends with it.
    expect(layout.lengthTicks).toBe(1680);
  });

  it('dotted eighth and sixteenth alternate on the notes', () => {
    expect(layoutRhythm(4, steps('8. 16')).notes.map((n) => n.tick)).toEqual([0, 360, 480, 840]);
  });

  it('articulation shortens what sounds, never where the note falls', () => {
    const legato = layoutRhythm(2, steps('8'), 'legato');
    const staccato = layoutRhythm(2, steps('8'), 'staccato');
    expect(staccato.notes.map((n) => n.tick)).toEqual(legato.notes.map((n) => n.tick));
    expect(legato.notes.map((n) => n.durationTicks)).toEqual([240, 240]);
    expect(staccato.notes.map((n) => n.durationTicks)).toEqual([120, 120]);
  });
});

describe('a pentatonic cycle across the bar line (the owner\'s example)', () => {
  const firstNotes = (routine: Routine, meter = FOUR) => (routineTrack(routine, meter)?.events ?? []).map((e) => e.tick);

  it('five notes in eighths in 4/4: the second cycle starts on the "and" of beat 3, the third on beat 2 of bar 2', () => {
    const layout = layoutRhythm(15, steps('8'));
    expect(layout.notes[5]?.tick).toBe(1200); // bar 1, beat 3 and
    expect(layout.notes[10]?.tick).toBe(2400);
    expect((layout.notes[10]?.tick ?? 0) - 1920).toBe(480);
  });

  it('a whole phase repeated in eighths runs on along the cycle and ends on a bar line', () => {
    const plan = planRoutine(pentatonic({ rhythm: '8', repeats: 2 }), FOUR);
    const phase = plan.phases[0];
    if (!phase) throw new Error('no phase');
    const n = phase.sequence.length;
    const ticks = phase.timed.map((t) => t.tick);
    expect(ticks[n]).toBe(n * 240);
    // The phase still ends on a bar line.
    expect(phase.lengthTicks % 1920).toBe(0);
    expect(phase.lengthTicks).toBe(Math.ceil((2 * n * 240) / 1920) * 1920);
  });

  it('with "every repetition on the downbeat" the second time starts on the next bar', () => {
    const plan = planRoutine(pentatonic({ rhythm: '8', repeats: 2, repeatStart: 'bar' }), FOUR);
    const phase = plan.phases[0];
    if (!phase) throw new Error('no phase');
    const n = phase.sequence.length;
    expect(phase.timed[n]?.tick).toBe(Math.ceil((n * 240) / 1920) * 1920);
  });

  it('the same notes in 3/4 and in 6/8 fall where those meters put them', () => {
    const inThree = planRoutine(pentatonic({ rhythm: '8', repeats: 2 }), THREE).phases[0];
    const inSix = planRoutine(pentatonic({ rhythm: '8', repeats: 2 }), SIX_EIGHT).phases[0];
    if (!inThree || !inSix) throw new Error('no phase');
    // Same written eighths, same ticks; only the bars (and so the phase length) change.
    expect(inSix.timed.map((t) => t.tick)).toEqual(inThree.timed.map((t) => t.tick));
    expect(inThree.lengthTicks % 1440).toBe(0);
    expect(inSix.lengthTicks % 1440).toBe(0);
  });

  it('separation bars add whole bars of silence after the phase', () => {
    const plain = planRoutine(pentatonic({ rhythm: '8' }), FOUR);
    const spaced = planRoutine(pentatonic({ rhythm: '8', barsAfter: 2 }), FOUR);
    expect(spaced.lengthTicks).toBe(plain.lengthTicks + 2 * 1920);
    expect(firstNotes(pentatonic({ rhythm: '8', barsAfter: 2 }))).toEqual(firstNotes(pentatonic({ rhythm: '8' })));
  });

  it('a phase without a rhythm plays as before: notes per beat, full length', () => {
    const track = routineTrack(pentatonic({ notesPerBeat: 2 }), FOUR);
    expect(track?.events.slice(0, 3).map((e) => [e.tick, e.payload.durationTicks])).toEqual([[0, 240], [240, 240], [480, 240]]);
  });

  it('saved routines keep a valid rhythm and drop an invalid one', () => {
    const raw = JSON.parse(JSON.stringify(pentatonic({ rhythm: '8. 16', barsAfter: 9, articulation: 'staccato' }))) as Routine;
    const kept = sanitizeRoutine(raw, pentatonic());
    expect(kept.phases[0]?.rhythm).toBe('8. 16');
    expect(kept.phases[0]?.barsAfter).toBe(4);
    expect(kept.phases[0]?.articulation).toBe('staccato');
    const broken = sanitizeRoutine({ ...raw, phases: [{ ...raw.phases[0], rhythm: 'zz' }] }, pentatonic());
    expect(broken.phases[0]?.rhythm).toBe('');
  });
});
