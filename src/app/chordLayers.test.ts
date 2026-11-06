import { describe, expect, it } from 'vitest';
import { buildScale } from '../theory';
import { MAX_CHORDS, addChordLayer, clampActive, moveChordLayer, resolveChordLayer, sanitizeChordLayers, type ChordLayer } from './chordLayers';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

const C = buildScale('C', 'ionian');

describe('chord layers', () => {
  it('suggests the diatonic sevenths of the main key, in order, up to eight chords', () => {
    let layers: readonly ChordLayer[] = [];
    for (let i = 0; i < 10; i += 1) layers = addChordLayer(layers, C, `c${i}`);
    expect(layers).toHaveLength(MAX_CHORDS);
    expect(layers.map((l) => l.symbol)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5', 'Cmaj7']);
  });

  it('falls back to repeating the last chord for scales without seven notes', () => {
    const penta = buildScale('A', 'minorPentatonic');
    const layers = addChordLayer(addChordLayer([], penta, 'a'), penta, 'b');
    expect(layers.map((l) => l.symbol)).toEqual(['A7', 'A7']);
  });

  it('resolves the chosen shape and drops one the symbol no longer has', () => {
    const r = resolveChordLayer({ id: 'x', symbol: 'C', visible: true, voicing: 0 });
    expect(r.chord?.symbol).toBe('C');
    expect(r.shape?.frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(resolveChordLayer({ id: 'x', symbol: 'C', visible: true, voicing: 999 }).shape).toBeNull();
    expect(resolveChordLayer({ id: 'x', symbol: 'Hmaj7', visible: true, voicing: 0 }).chord).toBeNull();
  });

  it('reorders and keeps the active chord inside the list', () => {
    const layers = addChordLayer(addChordLayer([], C, 'a'), C, 'b');
    expect(moveChordLayer(layers, 1, 0).map((l) => l.id)).toEqual(['b', 'a']);
    expect(clampActive(5, layers)).toBe(1);
    expect(clampActive(-2, layers)).toBe(0);
    expect(clampActive('x', layers)).toBe(0);
  });
});

describe('chord layer persistence', () => {
  it('migrates the old overlay chord into the main chord', () => {
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, chordLayers: undefined, overlayChord: 'Dm7' });
    expect(s.chordLayers.map((l) => l.symbol)).toEqual(['Dm7']);
    expect(sanitizeChordLayers({ overlayChord: '  ' })).toEqual([]);
  });

  it('repairs bad fields and caps the list', () => {
    const layers = sanitizeChordLayers({ chordLayers: [{ symbol: 'G7', voicing: -3, visible: 'yes' }, ...Array.from({ length: 12 }, () => ({}))] });
    expect(layers).toHaveLength(MAX_CHORDS);
    expect(layers[0]).toMatchObject({ symbol: 'G7', voicing: null, visible: true });
  });

  it('round-trips with the rest of the settings', () => {
    const settings = { ...DEFAULT_SETTINGS, chordLayers: addChordLayer([], C, 'a'), activeChord: 0 };
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
});
