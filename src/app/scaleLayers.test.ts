import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { MAX_EXTRA_SCALES, addLayer, isCrowded, moveLayer, sanitizeLayers, visibleLayers, type ScaleLayer } from './scaleLayers';

const C_MAJOR = { tonic: 'C', scaleId: 'ionian' as const };

describe('scale layers', () => {
  it('starts from the relative minor pentatonic of a major key, or the same-root one of a minor key', () => {
    expect(addLayer([], C_MAJOR, 'a')[0]).toMatchObject({ tonic: 'A', scaleId: 'minorPentatonic', visible: true });
    expect(addLayer([], { tonic: 'E', scaleId: 'dorian' }, 'a')[0]).toMatchObject({ tonic: 'E', scaleId: 'minorPentatonic' });
    expect(addLayer([], { tonic: 'Eb', scaleId: 'ionian' }, 'a')[0]?.tonic).toBe('C');
  });

  it('shows at most two scales by default: later layers start hidden, with their own colour', () => {
    let layers: readonly ScaleLayer[] = [];
    for (let i = 0; i < 6; i += 1) layers = addLayer(layers, C_MAJOR, `l${i}`);
    expect(layers).toHaveLength(MAX_EXTRA_SCALES);
    expect(layers.map((l) => l.visible)).toEqual([true, false, false, false]);
    expect(new Set(layers.map((l) => l.color)).size).toBe(4);
    expect(isCrowded(layers)).toBe(false);
    expect(isCrowded(layers.map((l) => ({ ...l, visible: true })))).toBe(true);
  });

  it('keeps list positions for visible layers so pips do not jump when one hides', () => {
    const layers = addLayer(addLayer(addLayer([], C_MAJOR, 'a'), C_MAJOR, 'b'), C_MAJOR, 'c').map((l) => ({ ...l, visible: l.id !== 'b' }));
    expect(visibleLayers(layers).map((v) => v.index)).toEqual([0, 2]);
    expect(visibleLayers(layers)[0]?.scale.tones.map((t) => t.name)).toEqual(['A', 'C', 'D', 'E', 'G']);
  });

  it('reorders without losing layers', () => {
    const layers = addLayer(addLayer([], C_MAJOR, 'a'), C_MAJOR, 'b');
    expect(moveLayer(layers, 1, 0).map((l) => l.id)).toEqual(['b', 'a']);
    expect(moveLayer(layers, 0, -1)).toBe(layers);
  });
});

describe('scale layer persistence', () => {
  it('migrates the old single second scale', () => {
    const migrated = sanitizeSettings({ ...DEFAULT_SETTINGS, scaleLayers: undefined, secondScaleOn: true, secondTonic: 'E', secondScaleId: 'minorBlues' });
    expect(migrated.scaleLayers).toHaveLength(1);
    expect(migrated.scaleLayers[0]).toMatchObject({ tonic: 'E', scaleId: 'minorBlues', visible: true });
    expect(sanitizeLayers({ secondScaleOn: false })).toEqual([]);
  });

  it('repairs bad fields and caps the list at four extras', () => {
    const raw = { scaleLayers: [{ id: 'x', tonic: 'H', scaleId: 'dorian', opacity: 9, color: 'plaid', region: 'moon' }, ...Array.from({ length: 6 }, () => ({}))] };
    const layers = sanitizeLayers(raw);
    expect(layers).toHaveLength(4);
    expect(layers[0]).toMatchObject({ id: 'x', tonic: 'A', scaleId: 'dorian', opacity: 1, color: 'teal', region: 'position', visible: true });
    expect(new Set(layers.map((l) => l.id)).size).toBe(4);
  });

  it('round-trips through JSON with the rest of the settings', () => {
    const settings = { ...DEFAULT_SETTINGS, scaleLayers: addLayer([], C_MAJOR, 'a') };
    expect(sanitizeSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
  });
});
