import { describe, expect, it } from 'vitest';
import { cagedPosition } from '../fretboard';
import { buildScale, parseChord } from '../theory';
import { buildMarkerLayer, type MarkerInput } from './markers';

const scale = buildScale('C', 'ionian');
const notes = cagedPosition(scale, 'A').notes;
const chords = ['Dm7', 'G7', 'Cmaj7'].map(parseChord);

const input = (over: Partial<MarkerInput> = {}): MarkerInput => ({
  notes, scale, chord: chords[0] ?? null, nextChord: chords[1] ?? null, chords, chordIndex: 0, focus: 'all',
  profile: 'chord-scale', labelMode: 'function', pinnedPc: null, secondScale: null, wholeNeck: false, ...over,
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
  it('marks a pinned note at every location and a second scale', () => {
    const second = buildScale('E', 'minorBlues');
    const { markers } = buildMarkerLayer(input({ pinnedPc: 4, secondScale: second, chord: null, nextChord: null }));
    expect(markers.filter((m) => m.pinned).every((m) => m.pc === 4)).toBe(true);
    expect(markers.filter((m) => m.pinned).length).toBeGreaterThan(1);
    expect(markers.find((m) => m.pc === 10)).toMatchObject({ role: 'second-scale', inSecondScale: true });
  });
  it('labels fingers on request', () => {
    const { markers } = buildMarkerLayer(input({ chord: null, nextChord: null, labelMode: 'finger' }));
    for (const m of markers) expect(['1', '2', '3', '4']).toContain(m.label);
  });
});
