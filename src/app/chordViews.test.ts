import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import {
  MAX_ARPEGGIO_LAYERS, MAX_VISIBLE_OVERLAYS, addArpeggio, chordAsScale, copyView, defaultScaleFor, defaultView,
  clampRange, sanitizeChordViews, viewForChord, viewNotes, viewOverlays, type ChordView,
} from './chordViews';

const pcsOf = (notes: readonly { pc: number }[]) => [...new Set(notes.map((n) => n.pc))].sort((a, b) => a - b);

describe('chord-scales as a starting point', () => {
  it.each([
    ['Cmaj7', 'ionian'], ['Dm7', 'dorian'], ['G7', 'mixolydian'], ['Bm7b5', 'locrian'], ['Am', 'aeolian'], ['CmMaj7', 'melodicMinor'], ['Cmaj7#11', 'lydian'],
  ])('%s → %s', (symbol, scale) => {
    expect(defaultScaleFor(parseChord(symbol))).toBe(scale);
  });

  it('a fresh view uses the chord root: G7 → G mixolydian, E shape, every function', () => {
    expect(defaultView(parseChord('G7'))).toMatchObject({ show: 'scale', tonic: 'G', scaleId: 'mixolydian', positionType: 'caged', cagedForm: 'E', focus: 'all' });
  });
});

describe('ii–V–I in C, one view per chord (the owner\'s example)', () => {
  const dm7 = parseChord('Dm7');
  const g7 = parseChord('G7');
  const cmaj7 = parseChord('Cmaj7');
  const dmView: ChordView = { ...defaultView(dm7), show: 'arpeggio' };
  const gView: ChordView = defaultView(g7);
  const cView: ChordView = { ...defaultView(cmaj7), show: 'arpeggio', focus: 'guide' };

  it('Dm7: only the arpeggio — D F A C and nothing else', () => {
    expect(pcsOf(viewNotes(dmView, dm7))).toEqual([0, 2, 5, 9]);
  });

  it('G7: the G mixolydian scale — the seven notes of C major, from G', () => {
    expect(pcsOf(viewNotes(gView, g7))).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('Cmaj7: its arpeggio in the box, with the guide-tone focus', () => {
    expect(pcsOf(viewNotes(cView, cmaj7))).toEqual([0, 4, 7, 11]);
    expect(cView.focus).toBe('guide');
  });

  it('an arpeggio stays inside the frets of the chosen shape', () => {
    const shape = viewNotes({ ...dmView, show: 'scale' }, dm7).map((n) => n.fret);
    const arp = viewNotes(dmView, dm7).map((n) => n.fret);
    expect(Math.min(...arp)).toBeGreaterThanOrEqual(Math.min(...shape));
    expect(Math.max(...arp)).toBeLessThanOrEqual(Math.max(...shape));
  });

  it('the board finds the view of the playing chord by its id; others follow the general settings', () => {
    const ids = ['a', 'b', 'c'];
    const views = { a: dmView, c: cView };
    expect(viewForChord(views, ids, 0)).toBe(dmView);
    expect(viewForChord(views, ids, 1)).toBeNull();
    expect(viewForChord(views, ids, 2)).toBe(cView);
    expect(viewForChord(views, ids, null)).toBeNull();
  });
});

describe('overlays: five scales, eight arpeggios, four drawn at once', () => {
  it('an arpeggio overlay reads as a scale of chord tones with the chord degrees', () => {
    const scale = chordAsScale(parseChord('G7'));
    expect(scale.tones.map((t) => `${t.name}:${t.degree}`)).toEqual(['G:1', 'B:3', 'D:5', 'F:b7']);
  });

  it('up to eight arpeggio overlays; past four visible, new ones start hidden', () => {
    let view = defaultView(parseChord('C'));
    for (let i = 0; i < 10; i += 1) view = addArpeggio(view, 'Am7', `a${i}`);
    expect(view.arpeggios).toHaveLength(MAX_ARPEGGIO_LAYERS);
    expect(view.arpeggios.filter((a) => a.visible)).toHaveLength(MAX_VISIBLE_OVERLAYS);
    expect(viewOverlays(view).map((o) => o.kind)).toEqual(Array(8).fill('arpeggio'));
  });

  it('a copy is independent: new overlay ids', () => {
    const view = addArpeggio(defaultView(parseChord('C')), 'Em7', 'x1');
    expect(copyView(view).arpeggios[0]?.id).not.toBe('x1');
  });
});

describe('saved views', () => {
  it('keeps valid views of chords still in the progression, drops the rest', () => {
    const good = defaultView(parseChord('G7'));
    const views = sanitizeChordViews({ a: good, gone: good, b: { tonic: 'H', scaleId: 'ionian' }, c: { ...good, arpeggios: [{ id: 'z', symbol: 'Qx9' }] } }, ['a', 'b', 'c']);
    expect(Object.keys(views)).toEqual(['a', 'c']);
    expect(views.a).toEqual(good);
    expect(views.c?.arpeggios).toEqual([]);
  });
});

describe('free fret range and colours (P1-14 completions)', () => {
  const g7 = parseChord('G7');
  it('a view on frets 12–15 draws only there, scale or arpeggio', () => {
    const view: ChordView = { ...defaultView(g7), positionType: 'range', rangeLow: 12, rangeHigh: 15 };
    const scale = viewNotes(view, g7);
    expect(scale.every((n) => n.fret >= 12 && n.fret <= 15)).toBe(true);
    expect(pcsOf(scale)).toEqual([0, 2, 4, 5, 7, 9, 11]);
    const arp = viewNotes({ ...view, show: 'arpeggio' }, g7);
    expect(arp.every((n) => n.fret >= 12 && n.fret <= 15)).toBe(true);
    expect(pcsOf(arp)).toEqual([2, 5, 7, 11]);
  });
  it('a saved range is put in order and kept within twelve frets', () => {
    expect(clampRange(9, 5)).toEqual({ rangeLow: 5, rangeHigh: 9 });
    expect(clampRange(0, 24)).toEqual({ rangeLow: 0, rangeHigh: 12 });
    const saved = sanitizeChordViews({ a: { ...defaultView(g7), positionType: 'range', rangeLow: 20, rangeHigh: 3, arpeggios: [{ id: 'x', symbol: 'Dm7', visible: true, color: 'rose' }] } }, ['a']);
    expect(saved.a).toMatchObject({ positionType: 'range', rangeLow: 3, rangeHigh: 15 });
    expect(saved.a?.arpeggios[0]?.color).toBe('rose');
    // A view saved before ranges existed gets the default stretch.
    const old: Record<string, unknown> = { ...defaultView(g7) };
    delete old.rangeLow;
    delete old.rangeHigh;
    expect(sanitizeChordViews({ a: old }, ['a']).a).toMatchObject({ rangeLow: 5, rangeHigh: 9 });
  });
});
