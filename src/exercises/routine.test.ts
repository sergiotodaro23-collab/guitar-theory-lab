import { describe, expect, it } from 'vitest';
import { cagedPosition } from '../fretboard';
import { buildScale } from '../theory';
import { ticksPerBar, type Meter } from '../timeline';
import { ROUTINE_TEMPLATES, defaultPhase, planRoutine, resolvePhase, routineTrack, sanitizeRoutine, type Routine } from './routine';

const FOUR: Meter = { beatsPerBar: 4, beatUnit: 4 };
const names = (notes: readonly { name: string }[]) => notes.map((n) => n.name);

describe('routine phases', () => {
  it('plays C major up in the C form, then down in the G form, on the real shapes of the key', () => {
    const routine: Routine = {
      name: 'C su, G giù',
      phases: [
        defaultPhase('a', { position: { kind: 'caged', form: 'C' }, direction: 'up' }),
        defaultPhase('b', { position: { kind: 'caged', form: 'G' }, direction: 'down' }),
      ],
    };
    const plan = planRoutine(routine, FOUR);
    const [up, down] = plan.phases;
    const scale = buildScale('C', 'ionian');
    const cForm = cagedPosition(scale, 'C').notes;
    const gForm = cagedPosition(scale, 'G').notes;

    // Same notes as the fretboard engine's shapes, nothing invented.
    expect(up?.notes).toEqual(cForm);
    expect(down?.notes).toEqual(gForm);
    // Ascending and descending by pitch.
    const upMidi = up?.sequence.map((n) => n.midi) ?? [];
    const downMidi = down?.sequence.map((n) => n.midi) ?? [];
    expect(upMidi).toEqual([...upMidi].sort((a, b) => a - b));
    expect(downMidi).toEqual([...downMidi].sort((a, b) => b - a));
    // Every note belongs to C major, in both phases.
    for (const n of [...(up?.sequence ?? []), ...(down?.sequence ?? [])]) expect('CDEFGAB').toContain(n.name);
    // G form of C major: root on string 6 at fret 8, window 5–8.
    expect(down?.lowFret).toBeGreaterThanOrEqual(4);
    expect(down?.highFret).toBeLessThanOrEqual(8);
    // The second phase starts on a downbeat.
    expect((down?.startTick ?? 1) % ticksPerBar(FOUR)).toBe(0);
  });

  it('builds the classical melodic minor: raised 6 and 7 going up, natural going down', () => {
    const template = ROUTINE_TEMPLATES.find((t) => t.name.includes('melodica classica'));
    expect(template).toBeDefined();
    const plan = planRoutine(template as Routine, FOUR);
    const up = names(plan.phases[0]?.sequence ?? []);
    const down = names(plan.phases[1]?.sequence ?? []);
    expect(up).toContain('F#');
    expect(up).toContain('G#');
    expect(up).not.toContain('F');
    expect(down).toContain('F');
    expect(down).toContain('G');
    expect(down).not.toContain('G#');
    // Same position for both: the hand does not move (G# reaches one fret lower).
    expect(Math.abs((plan.phases[0]?.lowFret ?? 0) - (plan.phases[1]?.lowFret ?? 9))).toBeLessThanOrEqual(1);
    expect(plan.phases[0]?.highFret).toBe(plan.phases[1]?.highFret);
  });

  it('switches between 3NPS patterns of the same key', () => {
    const plan = planRoutine(ROUTINE_TEMPLATES[2] as Routine, FOUR);
    const [a, b] = plan.phases;
    expect(a?.sequence).toHaveLength(18);
    expect(b?.sequence).toHaveLength(18);
    expect(a?.sequence[0]?.name).toBe('G');
    // Pattern from degree 3 descends, so it ends on its lowest note, B.
    expect(b?.sequence[b.sequence.length - 1]?.name).toBe('B');
  });

  it('reports 3NPS on a pentatonic and offers a CAGED alternative that works', () => {
    const phase = defaultPhase('x', { tonic: 'A', scaleId: 'minorPentatonic', position: { kind: '3nps', start: 0 } });
    const resolved = resolvePhase(phase);
    expect(resolved.sequence).toHaveLength(0);
    const issue = resolved.issues.find((i) => i.level === 'error');
    expect(issue?.fix).toBeDefined();
    const fixed = resolvePhase({ ...phase, ...issue?.fix?.change });
    expect(fixed.issues.filter((i) => i.level === 'error')).toHaveLength(0);
    expect(fixed.sequence.length).toBeGreaterThan(0);
  });

  it('moves a shape up an octave only when it still fits in 24 frets', () => {
    const e = resolvePhase(defaultPhase('e', { position: { kind: 'caged', form: 'E' }, octave: 1 }));
    expect(e.lowFret).toBe(19);
    expect(e.highFret).toBeLessThanOrEqual(24);
    const c = resolvePhase(defaultPhase('c', { position: { kind: 'caged', form: 'C' }, octave: 1 }));
    expect(c.sequence).toHaveLength(0);
    expect(c.issues[0]?.fix?.change).toEqual({ octave: 0 });
  });

  it('keeps a fret range inside its frets, one note per pitch', () => {
    const r = resolvePhase(defaultPhase('r', { position: { kind: 'range', low: 5, high: 8 } }));
    expect(r.notes.every((n) => n.fret >= 5 && n.fret <= 8)).toBe(true);
    const midis = r.notes.map((n) => n.midi);
    expect(new Set(midis).size).toBe(midis.length);
    expect(r.issues).toHaveLength(0);
    const wide = resolvePhase(defaultPhase('w', { position: { kind: 'range', low: 3, high: 12 } }));
    expect(wide.issues[0]?.level).toBe('warning');
  });

  it('applies interval sequences inside a phase', () => {
    const r = resolvePhase(defaultPhase('i', { kind: 'interval', interval: 3, direction: 'up' }));
    // E form of C major starts on B at fret 7: B–D, C–E, D–F…
    expect(names(r.sequence.slice(0, 6))).toEqual(['B', 'D', 'C', 'E', 'D', 'F']);
  });
});

describe('routine track', () => {
  it('repeats phases, tags every note with its phase and fills whole bars', () => {
    const routine: Routine = {
      name: 'r',
      phases: [
        defaultPhase('a', { repeats: 2, notesPerBeat: 2 }),
        defaultPhase('b', { direction: 'down', notesPerBeat: 4 }),
      ],
    };
    const plan = planRoutine(routine, FOUR);
    const track = routineTrack(routine, FOUR);
    const first = plan.phases[0]?.sequence.length ?? 0;
    const second = plan.phases[1]?.sequence.length ?? 0;
    expect(track?.events).toHaveLength(first * 2 + second);
    expect(track?.events.filter((e) => e.payload.phase === 0)).toHaveLength(first * 2);
    expect((track?.lengthTicks ?? 1) % ticksPerBar(FOUR)).toBe(0);
    expect(track?.events.map((e) => e.payload.index)).toEqual(track?.events.map((_, i) => i));
    // Sixteenths in phase 2: 120 ticks apart at 480 PPQ.
    const phase2 = track?.events.filter((e) => e.payload.phase === 1) ?? [];
    expect((phase2[1]?.tick ?? 0) - (phase2[0]?.tick ?? 0)).toBe(120);
    expect(phase2[0]?.tick).toBe(plan.phases[1]?.startTick);
  });

  it('returns no track when no phase produces notes', () => {
    const routine: Routine = { name: 'x', phases: [defaultPhase('a', { scaleId: 'minorBlues', position: { kind: '3nps', start: 0 } })] };
    expect(routineTrack(routine, FOUR)).toBeNull();
  });
});

describe('routine persistence', () => {
  const fallback = ROUTINE_TEMPLATES[0] as Routine;
  it('falls back on foreign data', () => {
    expect(sanitizeRoutine(null, fallback)).toBe(fallback);
    expect(sanitizeRoutine({ phases: [] }, fallback)).toBe(fallback);
  });
  it('repairs bad fields and keeps good ones', () => {
    const r = sanitizeRoutine({ name: 'Mia', phases: [{ id: 'a', tonic: 'Q', scaleId: 'dorian', repeats: 99, position: { kind: 'range', low: -4, high: 40 } }, 'x'] }, fallback);
    expect(r.name).toBe('Mia');
    expect(r.phases).toHaveLength(1);
    expect(r.phases[0]).toMatchObject({ id: 'a', tonic: 'C', scaleId: 'dorian', repeats: 8, position: { kind: 'range', low: 0, high: 24 } });
  });
  it('round-trips through JSON', () => {
    const json = JSON.parse(JSON.stringify(fallback)) as unknown;
    expect(sanitizeRoutine(json, fallback)).toEqual(fallback);
  });
});
