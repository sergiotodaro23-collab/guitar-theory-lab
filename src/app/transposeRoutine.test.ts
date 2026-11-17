import { beforeEach, describe, expect, it } from 'vitest';
import { ROUTINE_TEMPLATES } from '../exercises';
import { TONICS, parseNote, pitchClass } from '../theory';
import { DEFAULT_SETTINGS, boardContext } from './settings';
import { useApp } from './store';
import { buildTracks } from './tracks';

/**
 * A1: changing the key must move the advanced exercise (the routine): what
 * the sequencer plays, what the board shows for each phase, and the phases
 * themselves. Before, the phases kept their own tonics and nothing moved.
 */
const pc = (name: string) => pitchClass(parseNote(name));
const played = () => (buildTracks(useApp.getState().settings).exercise?.events ?? []).map((e) => (e.payload as { midi: number }).midi % 12);

describe('changing key with an advanced exercise active', () => {
  beforeEach(() => {
    useApp.setState({ settings: { ...DEFAULT_SETTINGS, tonic: 'C', exerciseOn: true, exerciseMode: 'routine', routine: ROUTINE_TEMPLATES[0] ?? DEFAULT_SETTINGS.routine } });
  });

  it('every key: playback, phases and the board move by the interval between the old key and the new one', () => {
    for (const template of ROUTINE_TEMPLATES) {
      for (const key of TONICS) {
        useApp.setState({ settings: { ...useApp.getState().settings, tonic: 'C', routine: template } });
        const before = played();
        const beforeBoard = template.phases.map((_, i) => pc(boardContext(useApp.getState().settings, i).scale.tonicName));
        useApp.getState().update({ tonic: key });
        const interval = pc(key);
        const after = useApp.getState().settings;
        expect(after.tonic).toBe(key);
        expect(played(), `${template.name} → ${key}`).toEqual(before.map((p) => (p + interval) % 12));
        expect(after.routine.phases.map((p) => pc(p.tonic))).toEqual(template.phases.map((p) => (pc(p.tonic) + interval) % 12));
        // The board shows, for every phase, the scale the sequencer plays.
        expect(template.phases.map((_, i) => pc(boardContext(after, i).scale.tonicName)), `${template.name} → ${key}`).toEqual(beforeBoard.map((p) => (p + interval) % 12));
      }
    }
  });

  it('key changes add up: C → E → Bb is the same as C → Bb', () => {
    const direct = (() => { useApp.getState().update({ tonic: 'Bb' }); return played(); })();
    useApp.setState({ settings: { ...useApp.getState().settings, tonic: 'C', routine: ROUTINE_TEMPLATES[0] ?? DEFAULT_SETTINGS.routine } });
    useApp.getState().update({ tonic: 'E' });
    useApp.getState().update({ tonic: 'Bb' });
    expect(played()).toEqual(direct);
  });

  it('a change that brings its own routine (a preset, the editor) is not transposed again; other changes leave the routine alone', () => {
    const own = ROUTINE_TEMPLATES[1] ?? DEFAULT_SETTINGS.routine;
    useApp.getState().update({ tonic: 'G', routine: own });
    expect(useApp.getState().settings.routine).toBe(own);
    const kept = useApp.getState().settings.routine;
    useApp.getState().update({ bpm: 132 });
    useApp.getState().update({ tonic: 'G' });
    useApp.getState().update({ scaleId: 'dorian' });
    expect(useApp.getState().settings.routine).toBe(kept);
  });

  it('the routine follows the key also while another exercise mode is shown, so coming back to it finds it in the key', () => {
    useApp.getState().update({ exerciseMode: 'single' });
    const template = useApp.getState().settings.routine;
    useApp.getState().update({ tonic: 'D' });
    expect(useApp.getState().settings.routine.phases.map((p) => pc(p.tonic))).toEqual(template.phases.map((p) => (pc(p.tonic) + 2) % 12));
  });
});
