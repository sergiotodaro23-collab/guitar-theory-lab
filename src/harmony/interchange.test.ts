import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { chordOrigin, numeralOf } from './interchange';

const origin = (symbol: string, key = 'C', mode: Parameters<typeof chordOrigin>[2] = 'ionian') => chordOrigin(parseChord(symbol), key, mode);

describe('roman numerals', () => {
  it.each([
    ['Dm7', 'ii7'], ['G7', 'V7'], ['Cmaj7', 'Imaj7'], ['Bm7b5', 'viiø7'], ['Fm', 'iv'], ['Bb7', 'bVII7'], ['Abmaj7', 'bVImaj7'], ['Ebmaj7', 'bIIImaj7'], ['Bdim7', 'vii°7'],
  ])('%s in C is %s', (symbol, numeral) => {
    expect(numeralOf(parseChord(symbol), 0)).toBe(numeral);
  });
});

describe('where a chord comes from, in C major', () => {
  it('diatonic chords take the mode on their degree: Dm7 dorian, G7 mixolydian, Em7 phrygian, Fmaj7 lydian', () => {
    expect(origin('Dm7')).toMatchObject({ kind: 'diatonic', scale: { tonic: 'D', scaleId: 'dorian' } });
    expect(origin('G7')).toMatchObject({ kind: 'diatonic', scale: { tonic: 'G', scaleId: 'mixolydian' } });
    expect(origin('Em7')).toMatchObject({ kind: 'diatonic', scale: { tonic: 'E', scaleId: 'phrygian' } });
    expect(origin('Fmaj7')).toMatchObject({ kind: 'diatonic', scale: { tonic: 'F', scaleId: 'lydian' } });
  });

  it('the minor iv is borrowed from C aeolian and wants F dorian', () => {
    expect(origin('Fm7')).toMatchObject({ kind: 'borrowed', numeral: 'iv7', source: 'aeolian', scale: { tonic: 'F', scaleId: 'dorian' } });
  });
  it('bVII7 (the backdoor dominant) from C aeolian: Bb mixolydian', () => {
    expect(origin('Bb7')).toMatchObject({ kind: 'borrowed', source: 'aeolian', scale: { tonic: 'Bb', scaleId: 'mixolydian' } });
  });
  it('bVImaj7 from aeolian is lydian; bIImaj7 from phrygian is lydian too', () => {
    expect(origin('Abmaj7')).toMatchObject({ kind: 'borrowed', source: 'aeolian', scale: { scaleId: 'lydian' } });
    expect(origin('Dbmaj7')).toMatchObject({ kind: 'borrowed', source: 'phrygian', scale: { tonic: 'Db', scaleId: 'lydian' } });
  });
  it('A7 is the secondary dominant of ii; D7 of V; E7 of vi with the minor warning', () => {
    expect(origin('A7')).toMatchObject({ kind: 'secondary', numeral: 'V7/ii' });
    expect(origin('D7')).toMatchObject({ kind: 'secondary', numeral: 'V7/V' });
    expect(origin('E7').text).toContain('♭13');
  });
  it('a chord from nowhere in the key is chromatic, with no scale forced on it', () => {
    expect(origin('Emaj7')).toMatchObject({ kind: 'chromatic', scale: null });
  });
});

describe('in A minor (aeolian)', () => {
  it('E7 is borrowed from A harmonic minor; Bm7b5 is diatonic locrian', () => {
    // V7 of the tonic is not a secondary dominant: the raised seventh comes from harmonic minor.
    expect(origin('E7', 'A', 'aeolian')).toMatchObject({ kind: 'borrowed', source: 'harmonicMinor', numeral: 'V7' });
    expect(origin('Bm7b5', 'A', 'aeolian')).toMatchObject({ kind: 'diatonic', scale: { tonic: 'B', scaleId: 'locrian' } });
    expect(origin('F#m7b5', 'A', 'aeolian')).toMatchObject({ kind: 'borrowed', source: 'dorian', numeral: 'viø7', scale: { tonic: 'F#', scaleId: 'locrian' } });
    // A dominant a fifth above a diatonic chord reads first as its secondary dominant.
    expect(origin('D7', 'A', 'aeolian')).toMatchObject({ kind: 'secondary', numeral: 'V7/bVII' });
  });
});
