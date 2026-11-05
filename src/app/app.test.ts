import { describe, expect, it } from 'vitest';
import { STUDY_PRESETS } from './builtins';
import { DEFAULT_SETTINGS, currentExerciseSequence, currentPositionNotes, sanitizeSettings, type Settings } from './settings';
import { buildTracks } from './tracks';

const s = (over: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...over });

describe('settings sanitising', () => {
  it('returns defaults for junk', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid values and replaces invalid ones', () => {
    const result = sanitizeSettings({ tonic: 'H', scaleId: 'dorian', bpm: 9999, interval: 12, swing: 9, volClick: -1 });
    expect(result.tonic).toBe('C');
    expect(result.scaleId).toBe('dorian');
    expect(result.bpm).toBe(280);
    expect(result.interval).toBe(3);
    expect(result.swing).toBe(0.5);
    expect(result.volClick).toBe(0);
  });
  it('rejects a progression that does not parse', () => {
    const bad = { chords: [{ id: 'a', symbol: 'Hm7', duration: { value: 1, unit: 'bars' } }], name: 'x' };
    expect(sanitizeSettings({ progression: bad }).progression).toEqual(DEFAULT_SETTINGS.progression);
    expect(sanitizeSettings({ progression: { chords: 'no' } }).progression).toEqual(DEFAULT_SETTINGS.progression);
  });
  it('accepts its own output unchanged', () => {
    expect(sanitizeSettings(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))).toEqual(DEFAULT_SETTINGS);
  });
});

describe('tracks per mode', () => {
  it('fretboard lab plays the exercise only', () => {
    const tracks = buildTracks(s({ mode: 'fretboard' }));
    expect(tracks.exercise).not.toBeNull();
    expect(tracks.chords).toBeNull();
    expect(tracks.comp).toBeNull();
  });
  it('harmony lab shares the timeline between exercise and chords', () => {
    const tracks = buildTracks(s({ mode: 'harmony', exerciseOn: true }));
    expect(tracks.exercise).not.toBeNull();
    expect(tracks.chords).not.toBeNull();
  });
  it('manual change mode has no chord track', () => {
    const tracks = buildTracks(s({ mode: 'harmony', changeMode: 'manual' }));
    expect(tracks.chords).toBeNull();
    expect(tracks.comp).toBeNull();
  });
  it('jam ends a non-looping progression and does not otherwise', () => {
    expect(buildTracks(s({ mode: 'jam', loop: false })).endTick).toBe(16 * 480 * 2 / 2);
    expect(buildTracks(s({ mode: 'jam', loop: true })).endTick).toBeNull();
    expect(buildTracks(s({ mode: 'jam', loop: false })).chords?.loop).toBe(false);
  });
  it('comp can be turned off', () => {
    expect(buildTracks(s({ mode: 'jam', compOn: false })).comp).toBeNull();
  });
  it('an unplayable pattern yields no exercise rather than an error', () => {
    const tracks = buildTracks(s({ exerciseKind: 'custom', customText: '24', positionType: '3nps' }));
    expect(tracks.exercise).toBeNull();
  });
});

describe('position selection', () => {
  it('falls back to CAGED for a pentatonic in 3NPS', () => {
    const notes = currentPositionNotes(s({ scaleId: 'minorPentatonic', tonic: 'A', positionType: '3nps' }));
    expect(notes.length).toBeGreaterThan(5);
  });
  it('whole-neck view exercises one shape', () => {
    const seq = currentExerciseSequence(s({ positionType: 'neck' }));
    const frets = seq.map((n) => n.fret);
    expect(Math.max(...frets) - Math.min(...frets)).toBeLessThanOrEqual(5);
  });
});

describe('built-in presets', () => {
  it('all survive sanitising with no field reset', () => {
    for (const preset of STUDY_PRESETS) {
      const merged = sanitizeSettings({ ...DEFAULT_SETTINGS, ...preset.data });
      for (const [key, value] of Object.entries(preset.data)) {
        expect(merged[key as keyof Settings], `${preset.id}.${key}`).toEqual(value);
      }
      expect(() => buildTracks(merged)).not.toThrow();
    }
  });
});
