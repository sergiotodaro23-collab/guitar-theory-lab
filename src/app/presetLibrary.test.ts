import { describe, expect, it } from 'vitest';
import { MemoryStorage, PresetRepository } from '../persistence/presets';
import { STUDY_PRESETS } from './builtins';
import { NO_FILTER, buildLibrary, describePreset, filterLibrary, libraryKeys } from './presetLibrary';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('preset library', () => {
  const library = buildLibrary([]);

  it('describes every starter preset from its own data', () => {
    const byId = Object.fromEntries(library.map((e) => [e.id, e]));
    expect(byId['thirds-c']).toMatchObject({ lab: 'fretboard', type: 'Intervalli', key: 'C', level: 'Base', source: 'builtin' });
    expect(byId['thirds-c']?.summary).toBe('C Maggiore (ionica) · CAGED E · 72 BPM');
    expect(byId['fourths-dorian']).toMatchObject({ type: 'Intervalli', key: 'D' });
    expect(byId['sequence-1235']).toMatchObject({ type: 'Sequenza', key: 'G' });
    // A routine carries its own scales phase by phase: the library does not invent one key for it.
    expect(byId['routine-caged-c-g']).toMatchObject({ type: 'Percorso', key: '' });
    expect(byId['arp-cmaj7-inversions']).toMatchObject({ lab: 'arpeggio', type: 'Arpeggi', key: 'C' });
    expect(byId['guide-251']).toMatchObject({ lab: 'harmony', type: 'Armonia', key: 'C' });
    expect(byId['guide-251']?.summary).toContain('Dm7 – G7 – Cmaj7');
    expect(byId['blues-a']).toMatchObject({ lab: 'jam', type: 'Jam', key: 'A' });
    expect(library).toHaveLength(STUDY_PRESETS.length);
  });

  it('every starter preset still loads into valid settings', () => {
    for (const preset of STUDY_PRESETS) {
      const loaded = sanitizeSettings({ ...DEFAULT_SETTINGS, ...preset.data });
      expect(loaded.mode, preset.id).toBe(preset.data.mode);
      // A preset on a progression brings the key of its analysis: loading it never leaves the numerals in the previous key.
      if (preset.data.progression) expect(preset.data.harmonyKey, preset.id).toBeTruthy();
    }
    const blues = STUDY_PRESETS.find((p) => p.id === 'blues-a');
    expect(sanitizeSettings({ ...DEFAULT_SETTINGS, harmonyKey: 'Eb', ...blues?.data })).toMatchObject({ harmonyKey: 'A', harmonyMode: 'ionian' });
  });

  it('filters combine, and the search ignores case and accents', () => {
    expect(filterLibrary(library, { ...NO_FILTER, lab: 'fretboard' }).every((e) => e.lab === 'fretboard')).toBe(true);
    expect(filterLibrary(library, { ...NO_FILTER, lab: 'fretboard', type: 'Intervalli', level: 'Base' }).map((e) => e.id)).toEqual(['thirds-c']);
    expect(filterLibrary(library, { ...NO_FILTER, key: 'A' }).map((e) => e.id)).toEqual(['sixths-harmonic', 'blues-a']);
    expect(filterLibrary(library, { ...NO_FILTER, query: 'DORICO quarte' }).map((e) => e.id)).toEqual(['fourths-dorian']);
    expect(filterLibrary(library, { ...NO_FILTER, query: 'ii-v-i' })).toHaveLength(0);
    expect(filterLibrary(library, { ...NO_FILTER, query: 'ii–V–I' }).map((e) => e.id)).toEqual(['arp-251-connected', 'guide-251', 'thirds-251']);
    expect(filterLibrary(library, { ...NO_FILTER, lab: 'jam', level: 'Avanzato' })).toEqual([]);
    expect(libraryKeys(library)).toEqual(['C', 'D', 'A', 'G']);
  });

  it('the user’s presets follow the starters, newest first, with no level; rename and delete keep the rest', () => {
    let time = Date.UTC(2026, 10, 13, 8, 0, 0);
    const repo = new PresetRepository(new MemoryStorage(), () => new Date(time += 60_000));
    const first = repo.save('Seste dorico', 'study', { mode: 'fretboard', tonic: 'D', scaleId: 'dorian', exerciseOn: true, exerciseKind: 'interval', exerciseMode: 'single', bpm: 90 });
    const second = repo.save('Blues mio', 'study', { mode: 'jam', tonic: 'E', harmonyKey: 'E', bpm: 100 });
    if (!first.ok || !second.ok) throw new Error('save failed');
    const lib = buildLibrary(repo.list('study'));
    expect(lib.slice(-2).map((e) => e.name)).toEqual(['Blues mio', 'Seste dorico']);
    expect(lib.at(-1)).toMatchObject({ source: 'user', level: null, type: 'Intervalli', key: 'D' });
    expect(filterLibrary(lib, { ...NO_FILTER, source: 'user', key: 'E' }).map((e) => e.name)).toEqual(['Blues mio']);
    // A level filter shows starters only: the user's presets carry none.
    expect(filterLibrary(lib, { ...NO_FILTER, level: 'Base' }).every((e) => e.source === 'builtin')).toBe(true);

    expect(repo.rename(first.preset.id, '  ').ok).toBe(false);
    expect(repo.rename(first.preset.id, 'Blues mio')).toMatchObject({ ok: false, error: 'Esiste già un preset con questo nome.' });
    expect(repo.rename('nope', 'X').ok).toBe(false);
    const renamed = repo.rename(first.preset.id, 'Seste in Re dorico');
    expect(renamed.ok && renamed.preset.id).toBe(first.preset.id);
    expect(repo.list('study').map((p) => p.name).sort()).toEqual(['Blues mio', 'Seste in Re dorico']);
    expect(repo.list('study').find((p) => p.id === first.preset.id)?.data).toMatchObject({ tonic: 'D', bpm: 90 });
    repo.remove(second.preset.id);
    expect(buildLibrary(repo.list('study')).filter((e) => e.source === 'user').map((e) => e.name)).toEqual(['Seste in Re dorico']);
  });

  it('a preset with almost nothing in it is still described without guessing', () => {
    expect(describePreset('x', 'Vuoto', 'user', {})).toMatchObject({ lab: 'fretboard', type: 'Scala', key: '', summary: '', level: null });
  });
});
