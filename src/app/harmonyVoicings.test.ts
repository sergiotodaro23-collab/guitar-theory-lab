import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settings';
import { functionalProgression, harmonizationProgression, progressionVoicings, voicingMidis } from './harmonyVoicings';
import { buildTracks, manualCompMidis } from './tracks';
import { stringVoicingKey } from '../fretboard';

const harmony = (change: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, mode: 'harmony', voicingOn: true, ...change });

describe('Harmony Lab voicings (HA5)', () => {
  it('harmonizes a scale into a progression, each chord repeated for its inversions', () => {
    const p = harmonizationProgression('C', 'ionian', 'triad', 3);
    expect(p.chords.map((c) => c.symbol)).toEqual(['C', 'C', 'C', 'Dm', 'Dm', 'Dm', 'Em', 'Em', 'Em', 'F', 'F', 'F', 'G', 'G', 'G', 'Am', 'Am', 'Am', 'Bdim', 'Bdim', 'Bdim']);
    expect(harmonizationProgression('A', 'harmonicMinor', 'seventh').chords.map((c) => c.symbol)[4]).toBe('E7');
  });

  it('climbing on strings 1-2-3: three different inversions of C, each above the last', () => {
    const s = harmony({ progression: harmonizationProgression('C', 'ionian', 'triad', 3), voicingType: 'close', voicingSet: '1-2-3', voicingMove: 'climb', voicingNear: 0 });
    const vs = progressionVoicings(s).slice(0, 3);
    expect(new Set(vs.map((v) => v?.inversion))).toEqual(new Set([0, 1, 2]));
    const basses = vs.map((v) => v?.notes[0]?.midi ?? 0);
    expect(basses[1]).toBeGreaterThan(basses[0] as number);
    expect(basses[2]).toBeGreaterThan(basses[1] as number);
    for (const v of vs) expect(v?.notes.every((n) => n.string >= 3)).toBe(true);
  });

  it('fixed inversion: every chord of the ii–V–I in root position on 2-3-4-5', () => {
    const s = harmony({ progression: functionalProgression('ii-V-I', 'C'), voicingType: 'drop2', voicingSet: '2-3-4-5', voicingMove: 'fixed', voicingInversion: 0 });
    expect(progressionVoicings(s).map((v) => v?.inversion)).toEqual([0, 0, 0]);
    expect(progressionVoicings(s).map((v) => v?.degrees[0])).toEqual(['1', '1', '1']);
  });

  it('the comping plays the voicing the board draws', () => {
    const s = harmony({ progression: functionalProgression('ii-V-I', 'C'), voicingType: 'drop2', voicingSet: '1-2-3-4', compOn: true });
    const midis = voicingMidis(s);
    const comp = buildTracks(s).comp;
    const first = comp?.events[0]?.payload as { midis: readonly number[] } | undefined;
    expect(first?.midis).toEqual(midis[0]);
    expect(manualCompMidis(s, 1)).toEqual(midis[1]);
    // Off: the comping keeps its own voicing.
    const off = buildTracks({ ...s, voicingOn: false }).comp?.events[0]?.payload as { midis: readonly number[] } | undefined;
    expect(off?.midis).not.toEqual(midis[0]);
  });

  it('tritone substitutes in the functional progression', () => {
    expect(functionalProgression('ii-V-I', 'C', true).chords.map((c) => c.symbol)).toEqual(['Dm7', 'Db7', 'Cmaj7']);
  });

  it('quartal voicings take the fourths of each chord’s own scale', () => {
    const s = harmony({ progression: functionalProgression('ii-V-I', 'C'), voicingType: 'quartal', voicingSet: '1-2-3-4' });
    const vs = progressionVoicings(s);
    expect(vs.every((v) => v !== null)).toBe(true);
  });

  it('the full chord on four to six strings', () => {
    const s = harmony({ progression: functionalProgression('ii-V-I', 'C'), voicingType: 'full' });
    for (const v of progressionVoicings(s)) expect(v?.notes.length).toBeGreaterThanOrEqual(3);
  });

  it('saved settings keep the voicing choice and reject nonsense', () => {
    const kept = sanitizeSettings({ voicingOn: true, voicingType: 'drop3', voicingSet: '2-3-4-6', voicingMove: 'climb', voicingInversion: 2, voicingNear: 9 });
    expect([kept.voicingOn, kept.voicingType, kept.voicingSet, kept.voicingMove, kept.voicingInversion, kept.voicingNear]).toEqual([true, 'drop3', '2-3-4-6', 'climb', 2, 9]);
    const bad = sanitizeSettings({ voicingType: 'drop9', voicingSet: '1-1-7', voicingInversion: 5 });
    expect([bad.voicingType, bad.voicingSet, bad.voicingInversion]).toEqual(['drop2', '1-2-3-4', 0]);
  });

  it('voicings are off by default: nothing changes for existing sessions', () => {
    expect(progressionVoicings(harmony({ voicingOn: false }))).toEqual([]);
    const s = harmony({ progression: functionalProgression('ii-V-I', 'C'), voicingSet: '1-2-3-4' });
    expect(progressionVoicings(s).map((v) => (v ? stringVoicingKey(v) : null)).every(Boolean)).toBe(true);
  });
});

describe('Harmony Lab starter presets (HA5)', () => {
  it('at least six per level, each loads and voices every chord of its progression', async () => {
    const { HARMONY_PRESETS } = await import('./harmonyPresets');
    const { EXERCISE_LEVELS } = await import('../exercises');
    for (const level of EXERCISE_LEVELS) expect(HARMONY_PRESETS.filter((p) => p.level === level).length, level).toBeGreaterThanOrEqual(6);
    for (const p of HARMONY_PRESETS) {
      const s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...p.data });
      expect(s.voicingType, p.id).toBe(p.data.voicingType);
      expect(s.voicingSet, p.id).toBe(p.data.voicingSet);
      const vs = progressionVoicings(s);
      expect(vs.length, p.id).toBe(s.progression.chords.length);
      expect(vs.every((v) => v !== null), p.id).toBe(true);
    }
  });
});
