import { describe, expect, it } from 'vitest';
import { STUDY_PRESETS } from './builtins';
import { DEFAULT_SETTINGS, currentExerciseSequence, currentPositionNotes, sanitizeSettings, type Settings } from './settings';
import { buildTracks } from './tracks';
import { defaultView } from './chordViews';
import { withChord } from '../jam';
import { parseChord } from '../theory';

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

describe('the exercise follows each chord\'s view (P1-14)', () => {
  const progression = { name: 't', chords: [withChord('Dm7'), withChord('G7')] };
  const [dm, g] = progression.chords;
  const base = { mode: 'harmony' as const, exerciseOn: true, progression, notesPerBeat: 2 as const };
  it('a chord with a view plays its own notes for its bar, the other the general exercise', () => {
    const views = { [g?.id ?? '']: { ...defaultView(parseChord('G7')), show: 'arpeggio' as const } };
    const tracks = buildTracks(s({ ...base, chordViews: views }));
    const events = tracks.exercise?.events ?? [];
    const bar = 1920;
    const second = events.filter((e) => e.tick >= bar && e.tick < 2 * bar);
    expect(second).toHaveLength(8);
    expect(second.every((e) => [2, 5, 7, 11].includes((e.payload as { midi: number }).midi % 12))).toBe(true);
    expect(tracks.exercise?.lengthTicks).toBe(2 * bar);
    // The first chord has no view: the general exercise (C major in the default settings).
    const first = events.filter((e) => e.tick < bar);
    expect(first.every((e) => [0, 2, 4, 5, 7, 9, 11].includes((e.payload as { midi: number }).midi % 12))).toBe(true);
    expect(dm).toBeDefined();
  });
  it('switching it off brings back the single exercise', () => {
    const views = { [g?.id ?? '']: defaultView(parseChord('G7')) };
    const settings = s({ ...base, chordViews: views, exerciseFollowsView: false });
    expect(buildTracks(settings).exercise?.events).toHaveLength(currentExerciseSequence(settings).length);
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

describe('arpeggios lab tracks', () => {
  it('plays one chord as a looping exercise with no chord track', () => {
    const t = buildTracks(sanitizeSettings({ ...DEFAULT_SETTINGS, mode: 'arpeggio', arpSource: 'chord', arpSymbol: 'G7', arpLow: 2 }));
    expect(t.chords).toBeNull();
    const pcs = new Set(t.exercise?.events.map((e) => (e.payload as { midi: number }).midi % 12));
    expect([...pcs].every((pc) => [7, 11, 2, 5].includes(pc))).toBe(true);
  });
  it('follows the shared progression with chords and comping', () => {
    const t = buildTracks(sanitizeSettings({ ...DEFAULT_SETTINGS, mode: 'arpeggio', arpSource: 'progression' }));
    expect(t.chords).not.toBeNull();
    expect(t.exercise?.lengthTicks).toBe(t.chords?.lengthTicks);
  });
  it('plays nothing for an unknown chord instead of failing', () => {
    expect(buildTracks(sanitizeSettings({ ...DEFAULT_SETTINGS, mode: 'arpeggio', arpSymbol: 'Hx' })).exercise).toBeNull();
  });
});

describe('neck tunings (P1-05)', () => {
  it('presets and a custom tuning give the open strings', async () => {
    const { tuningOf, sanitizeTuning } = await import('./settings');
    expect(tuningOf(s({ neckTuning: 'drop-d' }))).toEqual([38, 45, 50, 55, 59, 64]);
    expect(tuningOf(s({ neckTuning: 'custom', customTuning: [36, 43, 50, 55, 59, 64] }))).toEqual([36, 43, 50, 55, 59, 64]);
    expect(sanitizeTuning([40, 45, 50, 55, 59])).toBeNull();
    expect(sanitizeTuning([40, 60, 50, 55, 59, 64])).toBeNull();
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, neckTuning: 'custom', customTuning: [1, 2, 3, 4, 5, 6] }).customTuning).toEqual([40, 45, 50, 55, 59, 64]);
  });
  it('in Drop D the whole neck has D on the open sixth string, and the exercise follows the tuning', () => {
    const drop = s({ neckTuning: 'drop-d', tonic: 'D', scaleId: 'ionian', positionType: 'neck' });
    expect(currentPositionNotes(drop).find((n) => n.string === 0 && n.fret === 0)?.midi).toBe(38);
    // E form of D major in Drop D: every note is a D major note at a real place of the retuned string.
    const shape = currentPositionNotes(s({ neckTuning: 'drop-d', tonic: 'D', scaleId: 'ionian', positionType: 'caged', cagedForm: 'E' }));
    for (const n of shape) expect(n.midi).toBe([38, 45, 50, 55, 59, 64][n.string]! + n.fret);
    expect(currentExerciseSequence(drop).length).toBeGreaterThan(0);
  });
});
