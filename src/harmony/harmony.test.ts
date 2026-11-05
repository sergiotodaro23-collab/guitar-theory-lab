import { describe, expect, it } from 'vitest';
import { parseChord, parseNote, pitchClass } from '../theory';
import { classifyTone, commonTones, functionsAcross, guideToneMotion, guideTones, resolveTone, targetingPath } from './index';

const pc = (n: string) => pitchClass(parseNote(n));
const fn = (note: string, chord: string, options = {}) => classifyTone(pc(note), parseChord(chord), options);

describe('harmonic function of a note', () => {
  it('reads E as 3 of Cmaj7, 9 of Dm9, 13 of G13', () => {
    const [a, b, c] = functionsAcross(pc('E'), ['Cmaj7', 'Dm9', 'G13'].map(parseChord));
    expect(a?.fn).toMatchObject({ degree: '3', role: 'chord-tone', isGuideTone: true });
    expect(b?.fn).toMatchObject({ degree: '9', role: 'chord-tone', isGuideTone: false });
    expect(c?.fn).toMatchObject({ degree: '13', role: 'chord-tone', isGuideTone: false });
  });
  it('labels a non-chord E as a tension over Dm7 and G7', () => {
    expect(fn('E', 'Dm7')).toMatchObject({ degree: '9', role: 'tension' });
    expect(fn('E', 'G7')).toMatchObject({ degree: '13', role: 'tension' });
  });
  it('flags the 11 of a major seventh as contextual, not absolute', () => {
    expect(fn('F', 'Cmaj7')).toMatchObject({ degree: '11', role: 'avoid', contextual: true });
    expect(fn('F', 'Cmaj7').reason).toMatch(/nona minore/);
    expect(fn('F', 'Cmaj7', { profile: 'modal' }).role).toBe('tension');
  });
  it('accepts altered tensions on dominants but not on major sevenths', () => {
    expect(fn('Ab', 'G7')).toMatchObject({ degree: 'b9', role: 'tension' });
    expect(fn('A#', 'G7').degree).toBe('#9');
    expect(fn('Db', 'Cmaj7')).toMatchObject({ degree: 'b9', role: 'outside' });
  });
  it('spells non-chord tones against the chord root', () => {
    expect(fn('A#', 'G7').name).toBe('A#');
    expect(fn('Bb', 'G7').name).toBe('A#');
    expect(fn('Ab', 'G7').name).toBe('Ab');
  });
  it('flags a note outside chord and scale', () => {
    expect(fn('F#', 'Dm7')).toMatchObject({ role: 'outside' });
    expect(fn('C#', 'Cmaj7', { scalePcs: new Set([0, 2, 4]) })).toMatchObject({ role: 'outside', contextual: false });
  });
  it('gives chord tones priority over the extension table', () => {
    expect(fn('F', 'C7sus4')).toMatchObject({ role: 'chord-tone', degree: '4', isGuideTone: true });
    expect(fn('F', 'Cm11')).toMatchObject({ role: 'chord-tone', degree: '11' });
  });
  it('keeps the b3 name on a minor chord family lookalike', () => {
    expect(fn('Eb', 'Csus4').degree).toBe('b3');
    expect(fn('Eb', 'C7').degree).toBe('#9');
  });
});

describe('guide tones and voice leading', () => {
  it('finds 3 and 7', () => {
    expect(guideTones(parseChord('Dm7')).map((t) => t.name)).toEqual(['F', 'C']);
    expect(guideTones(parseChord('G7')).map((t) => t.name)).toEqual(['B', 'F']);
    expect(guideTones(parseChord('C6')).map((t) => t.name)).toEqual(['E', 'A']);
    expect(guideTones(parseChord('G7sus4')).map((t) => t.name)).toEqual(['C', 'F']);
  });
  it('resolves the textbook ii–V–I guide tones', () => {
    const dmG = guideToneMotion(parseChord('Dm7'), parseChord('G7'));
    expect(dmG.map((m) => [m.fromPc, m.toPc])).toEqual([[pc('F'), pc('F')], [pc('C'), pc('B')]]);
    const gC = guideToneMotion(parseChord('G7'), parseChord('Cmaj7'));
    expect(gC.map((m) => [m.fromPc, m.toPc])).toEqual([[pc('B'), pc('B')], [pc('F'), pc('E')]]);
  });
  it('resolves a tension to the nearest tone of the next chord', () => {
    const result = resolveTone(pc('Ab'), parseChord('G7'), parseChord('Cmaj7'));
    expect(result).toMatchObject({ toPc: pc('G'), motion: -1, fromDegree: 'b9', kind: 'tension' });
  });
  it('moves only when it must, and never further than a whole tone', () => {
    expect(resolveTone(pc('Ab'), parseChord('Fm'), parseChord('C'))).toMatchObject({ toPc: pc('G') });
    expect(resolveTone(pc('C'), parseChord('Dm7'), parseChord('G7'))).toMatchObject({ toPc: pc('B'), motion: -1, kind: 'guide-tone' });
    // F is b3 of Dm7 and b7 of G7: it stays and changes function.
    expect(resolveTone(pc('F'), parseChord('Dm7'), parseChord('G7'))).toBeNull();
    expect(resolveTone(pc('F'), parseChord('F'), parseChord('A'))).toMatchObject({ toPc: pc('E'), motion: -1 });
  });
  it('lists common tones with both functions', () => {
    expect(commonTones(parseChord('Dm7'), parseChord('G7'))).toEqual(
      expect.arrayContaining([{ pc: pc('D'), from: '1', to: '5' }, { pc: pc('F'), from: 'b3', to: 'b7' }]),
    );
  });
  it('targets one chord tone per chord with minimum motion', () => {
    const path = targetingPath(['Dm7', 'G7', 'Cmaj7'].map(parseChord), [60, 62, 64, 65, 67, 69, 71, 72], 65);
    expect(path).toEqual([65, 65, 64]);
  });
});
