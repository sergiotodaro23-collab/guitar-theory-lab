import { describe, expect, it } from 'vitest';
import { cagedPosition } from '../fretboard';
import { buildScale, parseChord } from '../theory';
import { buildMarkerLayer, type MarkerInput } from './markers';

const scale = buildScale('C', 'ionian');
const notes = cagedPosition(scale, 'A').notes;
const chords = ['Dm7', 'G7', 'Cmaj7'].map(parseChord);

const input = (over: Partial<MarkerInput> = {}): MarkerInput => ({
  notes, scale, chord: chords[0] ?? null, nextChord: chords[1] ?? null, chords, chordIndex: 0, focus: 'all',
  profile: 'chord-scale', labelMode: 'function', pinnedPc: null, overlays: [], wholeNeck: false, ...over,
});

describe('marker layer', () => {
  it('without a chord marks root and scale degrees', () => {
    const { markers } = buildMarkerLayer(input({ chord: null, nextChord: null, labelMode: 'degree' }));
    expect(markers.find((m) => m.pc === 0)).toMatchObject({ role: 'root', label: '1' });
    expect(markers.find((m) => m.pc === 2)).toMatchObject({ role: 'scale', label: '2' });
  });
  it('labels the same physical note differently per chord', () => {
    const e = (chord: string) => buildMarkerLayer(input({ chord: parseChord(chord) })).markers.find((m) => m.string === 2 && m.pc === 4);
    expect(e('Cmaj7')).toMatchObject({ label: '3', role: 'chord-tone', isGuide: true });
    expect(e('Dm9')).toMatchObject({ label: '9', role: 'chord-tone', isGuide: false });
    expect(e('G13')).toMatchObject({ label: '13', role: 'chord-tone' });
    expect(e('Cmaj7')?.fret).toBe(e('G13')?.fret);
  });
  it('adds chord tones outside the scale, inside the region', () => {
    const { markers } = buildMarkerLayer(input({ chord: parseChord('E7'), nextChord: null }));
    const gSharp = markers.filter((m) => m.pc === 8);
    expect(gSharp.length).toBeGreaterThan(0);
    const frets = notes.map((n) => n.fret);
    for (const m of gSharp) {
      expect(m.fret).toBeGreaterThanOrEqual(Math.min(...frets));
      expect(m.fret).toBeLessThanOrEqual(Math.max(...frets));
      expect(m.role).toBe('chord-tone');
    }
  });
  it('focus on guide tones dims everything else', () => {
    const { markers } = buildMarkerLayer(input({ focus: 'guide' }));
    for (const m of markers) expect(m.dim).toBe(!(m.pc === 5 || m.pc === 0));
  });
  it('common tones show both functions', () => {
    const { markers } = buildMarkerLayer(input({ focus: 'common' }));
    expect(markers.find((m) => m.pc === 5)).toMatchObject({ label: 'b3›b7', dim: false });
    expect(markers.find((m) => m.pc === 9)?.dim).toBe(true);
  });
  it('draws resolution arrows that land on the next chord', () => {
    const { arrows, markers } = buildMarkerLayer(input({ focus: 'resolution', chord: chords[1] ?? null, nextChord: chords[2] ?? null, chordIndex: 1 }));
    expect(arrows.length).toBeGreaterThan(0);
    const targetPcs = new Set(chords[2]?.tones.map((t) => t.pc));
    const open = [40, 45, 50, 55, 59, 64];
    for (const arrow of arrows) {
      const midi = (open[arrow.to.string] as number) + arrow.to.fret;
      expect(targetPcs.has(midi % 12)).toBe(true);
    }
    expect(markers.some((m) => m.dim)).toBe(true);
  });
  it('marks one target now and one next', () => {
    const { markers } = buildMarkerLayer(input({ focus: 'targeting' }));
    expect(markers.filter((m) => m.target === 'now').length).toBeGreaterThan(0);
    const now = markers.find((m) => m.target === 'now');
    expect(chords[0]?.tones.map((t) => t.pc)).toContain(now?.pc);
  });
  it('marks a pinned note at every location and an overlaid scale', () => {
    const second = buildScale('E', 'minorBlues');
    const { markers } = buildMarkerLayer(input({ pinnedPc: 4, overlays: [{ scale: second, index: 0, wholeNeck: false }], chord: null, nextChord: null }));
    expect(markers.filter((m) => m.pinned).every((m) => m.pc === 4)).toBe(true);
    expect(markers.filter((m) => m.pinned).length).toBeGreaterThan(1);
    // Bb is in E blues (b5) but not in C major: drawn on its own, labelled by E blues.
    expect(markers.find((m) => m.pc === 10)).toMatchObject({ role: 'other-scale', layers: [0], label: 'b5' });
    // E is in both: a main-scale marker that carries the overlay's pip.
    expect(markers.find((m) => m.pc === 4)).toMatchObject({ role: 'scale', layers: [0] });
    // F is only in C major.
    expect(markers.find((m) => m.pc === 5)?.layers).toEqual([]);
  });
  it('keeps each overlay on its list position and its region', () => {
    const relative = { scale: buildScale('A', 'aeolian'), index: 1, wholeNeck: false };
    const dorian = { scale: buildScale('C', 'dorian'), index: 3, wholeNeck: true };
    const { markers } = buildMarkerLayer(input({ overlays: [relative, dorian], chord: null, nextChord: null, labelMode: 'degree' }));
    const frets = notes.map((n) => n.fret);
    const [low, high] = [Math.min(...frets), Math.max(...frets)];
    // Every C major note is in A aeolian: index 1 on all of them inside the position.
    for (const m of markers.filter((m) => m.fret >= low && m.fret <= high && m.role !== 'other-scale')) expect(m.layers).toContain(1);
    // C dorian covers the whole neck, so its Eb appears far from the position.
    const farEb = markers.filter((m) => m.pc === 3 && (m.fret < low - 1 || m.fret > high + 1));
    expect(farEb.length).toBeGreaterThan(0);
    expect(farEb.every((m) => m.role === 'other-scale' && m.label === 'b3' && m.layers.join() === '3')).toBe(true);
    // Outside the position A aeolian adds nothing.
    expect(markers.filter((m) => m.fret > high + 1).every((m) => !m.layers.includes(1))).toBe(true);
  });
  it('outlines a chord shape, even where it leaves the scale position', () => {
    const shape = [{ string: 1, fret: 3 }, { string: 2, fret: 2 }, { string: 3, fret: 0 }, { string: 4, fret: 1 }, { string: 5, fret: 0 }];
    const { markers } = buildMarkerLayer(input({ chord: parseChord('C'), nextChord: null, voicing: shape }));
    const outlined = markers.filter((m) => m.inVoicing);
    expect(outlined.map((m) => `${m.string}:${m.fret}`).sort()).toEqual(shape.map((p) => `${p.string}:${p.fret}`).sort());
    expect(outlined.every((m) => m.role === 'chord-tone')).toBe(true);
  });
  it('labels fingers on request', () => {
    const { markers } = buildMarkerLayer(input({ chord: null, nextChord: null, labelMode: 'finger' }));
    for (const m of markers) expect(['1', '2', '3', '4']).toContain(m.label);
  });
});

describe('interval labels (P2-05)', () => {
  it('over Dm7, every note is named by its interval from D: F 3m, A 5G, C 7m, B 6M, E 2M', () => {
    const { markers } = buildMarkerLayer(input({ labelMode: 'interval' }));
    const at = (pc: number) => markers.find((m) => m.pc === pc)?.label;
    expect([at(2), at(5), at(9), at(0), at(11), at(4), at(7)]).toEqual(['U', '3m', '5G', '7m', '6M', '2M', '4G']);
  });
  it('without a chord, from the scale tonic', () => {
    const { markers } = buildMarkerLayer(input({ chord: null, nextChord: null, labelMode: 'interval' }));
    expect(markers.find((m) => m.pc === 4)?.label).toBe('3M');
    expect(markers.find((m) => m.pc === 5)?.label).toBe('4G');
  });
});
