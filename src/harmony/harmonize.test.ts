import { describe, expect, it } from 'vitest';
import { harmonize, harmonySymbols } from './harmonize';
import { PROGRESSION_KIND_NAMES, diatonicSubstitutes, progressionSymbols, secondaryDominant, tritoneSubstitute, withTritoneSubs, type ProgressionKind } from './progressions';
import { TONICS, parseChord } from '../theory';

const symbols = (tonic: string, id: Parameters<typeof harmonize>[1], kind: Parameters<typeof harmonize>[2]) => harmonize(tonic, id, kind).map((d) => d.chord?.symbol ?? null);
const numerals = (tonic: string, id: Parameters<typeof harmonize>[1], kind: Parameters<typeof harmonize>[2]) => harmonize(tonic, id, kind).map((d) => d.numeral);

describe('harmonize (HA1): tables from the method books', () => {
  it('C major in triads and seventh chords', () => {
    expect(symbols('C', 'ionian', 'triad')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(numerals('C', 'ionian', 'triad')).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(symbols('C', 'ionian', 'seventh')).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
    expect(numerals('C', 'ionian', 'seventh')).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
  });

  it('A natural minor', () => {
    expect(symbols('A', 'aeolian', 'triad')).toEqual(['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G']);
    expect(symbols('A', 'aeolian', 'seventh')).toEqual(['Am7', 'Bm7b5', 'Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7']);
    expect(numerals('A', 'aeolian', 'seventh')).toEqual(['i7', 'iiø7', 'bIIImaj7', 'iv7', 'v7', 'bVImaj7', 'bVII7']);
  });

  it('A harmonic minor: augmented III, dominant V, diminished seventh on the leading tone', () => {
    expect(symbols('A', 'harmonicMinor', 'triad')).toEqual(['Am', 'Bdim', 'Caug', 'Dm', 'E', 'F', 'G#dim']);
    expect(symbols('A', 'harmonicMinor', 'seventh')).toEqual(['AmMaj7', 'Bm7b5', 'Cmaj7#5', 'Dm7', 'E7', 'Fmaj7', 'G#dim7']);
    expect(numerals('A', 'harmonicMinor', 'seventh')[2]).toBe('bIII+maj7');
  });

  it('A melodic minor (jazz): two dominants, two half-diminished', () => {
    expect(symbols('A', 'melodicMinor', 'triad')).toEqual(['Am', 'Bm', 'Caug', 'D', 'E', 'F#dim', 'G#dim']);
    expect(symbols('A', 'melodicMinor', 'seventh')).toEqual(['AmMaj7', 'Bm7', 'Cmaj7#5', 'D7', 'E7', 'F#m7b5', 'G#m7b5']);
  });

  it('keeps the letters of the key: E# in F# harmonic minor, flats in Eb major', () => {
    expect(symbols('F#', 'harmonicMinor', 'seventh')).toEqual(['F#mMaj7', 'G#m7b5', 'Amaj7#5', 'Bm7', 'C#7', 'Dmaj7', 'E#dim7']);
    expect(symbols('Eb', 'ionian', 'seventh')).toEqual(['Ebmaj7', 'Fm7', 'Gm7', 'Abmaj7', 'Bb7', 'Cm7', 'Dm7b5']);
  });

  it('sus chords only where the scale gives a perfect fourth or major second with a perfect fifth', () => {
    expect(symbols('C', 'ionian', 'sus4')).toEqual(['Csus4', 'Dsus4', 'Esus4', null, 'Gsus4', 'Asus4', null]);
    expect(symbols('C', 'ionian', 'sus2')).toEqual(['Csus2', 'Dsus2', null, 'Fsus2', 'Gsus2', 'Asus2', null]);
    expect(harmonySymbols('C', 'ionian', 'sus4')).toHaveLength(5);
  });

  it('every tonic gives seven named seventh chords in the four scales', () => {
    for (const tonic of TONICS) {
      for (const id of ['ionian', 'aeolian', 'harmonicMinor', 'melodicMinor'] as const) {
        expect(harmonySymbols(tonic, id, 'seventh')).toHaveLength(7);
      }
    }
  });

  it('pentatonics have no seven-degree harmonization', () => {
    expect(harmonize('C', 'majorPentatonic', 'triad')).toEqual([]);
  });
});

describe('progressions and substitutions (HA4)', () => {
  it('ii–V–I in major and minor, spelled in the key', () => {
    expect(progressionSymbols('ii-V-I', 'C')).toEqual(['Dm7', 'G7', 'Cmaj7']);
    expect(progressionSymbols('ii-V-I', 'Bb')).toEqual(['Cm7', 'F7', 'Bbmaj7']);
    expect(progressionSymbols('ii-V-I', 'F#')).toEqual(['G#m7', 'C#7', 'F#maj7']);
    expect(progressionSymbols('ii-V-I', 'Gb')).toEqual(['Abm7', 'Db7', 'Gbmaj7']);
    expect(progressionSymbols('ii-V-i', 'C')).toEqual(['Dm7b5', 'G7b9', 'Cm7']);
  });

  it('turnarounds', () => {
    expect(progressionSymbols('I-vi-ii-V', 'F')).toEqual(['Fmaj7', 'Dm7', 'Gm7', 'C7']);
    expect(progressionSymbols('iii-VI-ii-V', 'C')).toEqual(['Em7', 'A7', 'Dm7', 'G7']);
    expect(progressionSymbols('secondary-chain', 'C')).toEqual(['E7', 'A7', 'D7', 'G7', 'Cmaj7']);
  });

  it('every kind parses in every key', () => {
    for (const key of TONICS) {
      for (const kind of Object.keys(PROGRESSION_KIND_NAMES) as ProgressionKind[]) {
        for (const symbol of progressionSymbols(kind, key)) expect(() => parseChord(symbol)).not.toThrow();
      }
    }
  });

  it('secondary dominants: V7 of the target', () => {
    expect(secondaryDominant('Dm7')).toBe('A7');
    expect(secondaryDominant('Em')).toBe('B7');
    expect(secondaryDominant('F#m')).toBe('C#7');
    expect(secondaryDominant('Bb')).toBe('F7');
  });

  it('tritone substitutes, spelled on the flat second of the resolution', () => {
    expect(tritoneSubstitute('G7')).toBe('Db7');
    expect(tritoneSubstitute('D7')).toBe('Ab7');
    expect(tritoneSubstitute('C7')).toBe('Gb7');
    expect(tritoneSubstitute('B7')).toBe('F7');
    expect(tritoneSubstitute('A7b9')).toBe('Eb7b9');
    expect(tritoneSubstitute('Db7')).toBe('G7');
    // Guide tones swap: the third of G7 (B) is the seventh of Db7 (Cb = B).
    const g7 = parseChord('G7');
    const db7 = parseChord('Db7');
    expect(g7.tones.find((t) => t.degree === '3')?.pc).toBe(db7.tones.find((t) => t.degree === 'b7')?.pc);
    expect(() => tritoneSubstitute('Cmaj7')).toThrow();
    expect(withTritoneSubs(['Dm7', 'G7', 'Cmaj7'])).toEqual(['Dm7', 'Db7', 'Cmaj7']);
    expect(progressionSymbols('ii-bII7-I', 'C')).toEqual(['Dm7', 'Db7', 'Cmaj7']);
  });

  it('diatonic substitutes by function', () => {
    expect(diatonicSubstitutes('C', 'I')).toEqual(['Em7', 'Am7']);
    expect(diatonicSubstitutes('C', 'IV')).toEqual(['Dm7']);
    expect(diatonicSubstitutes('C', 'V')).toEqual(['Bm7b5']);
  });
});
