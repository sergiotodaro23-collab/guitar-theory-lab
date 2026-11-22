import { describe, expect, it } from 'vitest';
import { CHORD_ROOT_GLYPH, LEGEND_GLYPH, ROLE_GLYPH, glyphGeometry, markerGlyph } from './glyphs';
import { legendEntries, type LegendKind } from './legend';
import { buildMarkerLayer, type Marker } from './markers';
import { buildScale, parseChord } from '../theory';
import { allFretNotes } from '../fretboard';

const signature = (kind: LegendKind) => `${LEGEND_GLYPH[kind].shape}/${LEGEND_GLYPH[kind].style}`;

describe('N2 · geometric legend', () => {
  it('the four shapes of the spec are all in use: circle, square, diamond, triangle', () => {
    const shapes = new Set(Object.values(LEGEND_GLYPH).map((g) => g.shape));
    expect([...shapes].sort()).toEqual(['circle', 'diamond', 'square', 'triangle']);
  });

  it('tonic and chord root are squares, tension a diamond, avoid a filled triangle, the arpeggio an outline triangle', () => {
    expect(ROLE_GLYPH.root).toMatchObject({ shape: 'square', style: 'filled' });
    expect(LEGEND_GLYPH['chord-root']).toBe(CHORD_ROOT_GLYPH);
    expect(ROLE_GLYPH.tension.shape).toBe('diamond');
    expect(ROLE_GLYPH.avoid).toMatchObject({ shape: 'triangle', style: 'filled' });
    expect(LEGEND_GLYPH.arpeggio).toMatchObject({ shape: 'triangle', style: 'outline' });
    expect(LEGEND_GLYPH.voicing).toMatchObject({ shape: 'square', style: 'outline' });
  });

  it('on a chord every role a guitarist must tell apart has its own shape, colour aside', () => {
    // With a chord the neck shows root, other chord tones, guide tones, tensions, avoid and outside notes together.
    const kinds: LegendKind[] = ['chord-root', 'chord-tone', 'tension', 'avoid', 'outside'];
    expect(new Set(kinds.map(signature)).size).toBe(kinds.length);
    // A scale alone: tonic and scale notes differ by shape.
    expect(signature('root')).not.toBe(signature('scale'));
  });

  it('every legend kind has a glyph and a shape name to read', () => {
    for (const spec of Object.values(LEGEND_GLYPH)) expect(spec.shapeName.length).toBeGreaterThan(0);
  });

  it('a square is as wide as the circle it replaces and stays square', () => {
    const square = glyphGeometry('square', 100, 50, 13);
    expect(square).toMatchObject({ kind: 'rect', rotate: 0 });
    if (square.kind === 'rect') expect(square.size).toBeCloseTo(23.4);
    expect(glyphGeometry('diamond', 0, 0, 10)).toMatchObject({ kind: 'rect', rotate: 45 });
  });

  it('G7 over C major: G is drawn as a square, B and F (guide tones) as circles, and the legend lists the chord root', () => {
    const chord = parseChord('G7');
    const scale = buildScale('C', 'ionian');
    const notes = allFretNotes().filter((n) => n.fret >= 2 && n.fret <= 5);
    const { markers } = buildMarkerLayer({ notes, scale, chord, nextChord: null, chords: [chord], chordIndex: 0, focus: 'all', profile: 'chord-scale', labelMode: 'note', pinnedPc: null, overlays: [], wholeNeck: false });
    const byPc = (pc: number) => markers.filter((m) => m.pc === pc) as Marker[];
    expect(byPc(7).every((m) => markerGlyph(m).shape === 'square')).toBe(true);
    expect(byPc(11).every((m) => markerGlyph(m).shape === 'circle')).toBe(true);
    expect(byPc(5).every((m) => markerGlyph(m).shape === 'circle')).toBe(true);
    const kinds = legendEntries(markers, { played: false }).map((e) => e.kind);
    expect(kinds[0]).toBe('chord-root');
    expect(kinds).toContain('guide');
  });
});
