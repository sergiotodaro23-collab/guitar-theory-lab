import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { compatibleScales, overlayScale, shownScaleFor } from './noteScale';
import { DEFAULT_SETTINGS } from './settings';

const harmony = { ...DEFAULT_SETTINGS, mode: 'harmony' as const, harmonyKey: 'C', harmonyMode: 'ionian' as const };

describe('N5 · the Note views follow the chord in play', () => {
  it('by default: G7 in C major shows G mixolydian, Dm7 D dorian, Bm7b5 B locrian', () => {
    expect(DEFAULT_SETTINGS.contextScales).toBe(true);
    expect(shownScaleFor(harmony, parseChord('G7'))).toMatchObject({ tonic: 'G', scaleId: 'mixolydian', source: 'context' });
    expect(shownScaleFor(harmony, parseChord('Dm7'))).toMatchObject({ tonic: 'D', scaleId: 'dorian' });
    expect(shownScaleFor(harmony, parseChord('Bm7b5'))).toMatchObject({ tonic: 'B', scaleId: 'locrian' });
  });

  it('in A minor (aeolian) the same G7 is still G mixolydian, and Fmaj7 is F lydian', () => {
    const am = { ...harmony, harmonyKey: 'A', harmonyMode: 'aeolian' as const };
    expect(shownScaleFor(am, parseChord('G7'))).toMatchObject({ tonic: 'G', scaleId: 'mixolydian' });
    expect(shownScaleFor(am, parseChord('Fmaj7'))).toMatchObject({ tonic: 'F', scaleId: 'lydian' });
  });

  it('a secondary dominant (A7 → Dm in C) takes mixolydian on its own root', () => {
    expect(shownScaleFor(harmony, parseChord('A7'))).toMatchObject({ tonic: 'A', scaleId: 'mixolydian' });
  });

  it('with the context off, outside the progression labs, or with no chord: the reference scale', () => {
    expect(shownScaleFor({ ...harmony, contextScales: false }, parseChord('G7')).source).toBe('reference');
    expect(shownScaleFor({ ...harmony, mode: 'fretboard' }, parseChord('G7')).source).toBe('reference');
    expect(shownScaleFor(harmony, null)).toMatchObject({ tonic: DEFAULT_SETTINGS.tonic, scaleId: DEFAULT_SETTINGS.scaleId, source: 'reference' });
  });
});

describe('N5 · compatible scales on the chord', () => {
  it('G7: mixolydian first (shown), every alternative holds G B D F', () => {
    const list = compatibleScales(parseChord('G7'), { tonic: 'G', scaleId: 'mixolydian' });
    expect(list[0]).toMatchObject({ scaleId: 'mixolydian', current: true });
    expect(list.filter((s) => s.current)).toHaveLength(1);
    expect(list.map((s) => s.scaleId)).not.toContain('ionian');
    expect(list.map((s) => s.scaleId)).not.toContain('dorian');
  });

  it('Cmaj7: ionian and lydian; Am7: dorian, phrygian, aeolian, minor pentatonic among them', () => {
    expect(compatibleScales(parseChord('Cmaj7'), { tonic: 'C', scaleId: 'ionian' }).map((s) => s.scaleId)).toEqual(expect.arrayContaining(['ionian', 'lydian']));
    const am = compatibleScales(parseChord('Am7'), { tonic: 'A', scaleId: 'aeolian' }).map((s) => s.scaleId);
    expect(am[0]).toBe('aeolian');
    expect(am).toEqual(expect.arrayContaining(['dorian', 'phrygian', 'minorPentatonic']));
    expect(am).not.toContain('harmonicMinor');
  });
});

describe('N5 · overlaying a compatible scale', () => {
  it('adds a visible layer with that scale once, and stops at the limit', () => {
    const main = { tonic: 'G', scaleId: 'mixolydian' as const };
    const one = overlayScale([], { tonic: 'G', scaleId: 'minorBlues' }, main, 'a');
    expect(one).toEqual([expect.objectContaining({ id: 'a', tonic: 'G', scaleId: 'minorBlues', visible: true })]);
    expect(overlayScale(one, { tonic: 'G', scaleId: 'minorBlues' }, main, 'b')).toBe(one);
    let many = one;
    for (const id of ['b', 'c', 'd', 'e']) many = overlayScale(many, { tonic: 'G', scaleId: id === 'b' ? 'ionian' : id === 'c' ? 'dorian' : id === 'd' ? 'lydian' : 'aeolian' }, main, id);
    expect(many).toHaveLength(4);
  });
});
