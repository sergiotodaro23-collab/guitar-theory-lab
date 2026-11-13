import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../app/settings';
import { parseChord } from '../../../theory';
import { detailsModel } from './details';

describe('Dettagli', () => {
  it('reads the studied scale in the scale lab: C major, its formula and notes', () => {
    const m = detailsModel({ ...DEFAULT_SETTINGS, mode: 'fretboard', tonic: 'C', scaleId: 'ionian' }, null, null);
    expect(m.scale.tonic).toBe('C');
    expect(m.scale.formula).toBe('1 – 2 – 3 – 4 – 5 – 6 – 7');
    expect(m.scale.notes).toBe('C – D – E – F – G – A – B');
    expect(m.chord).toBeNull();
    expect(m.next).toBeNull();
  });

  it('D dorian keeps its own formula and spelling', () => {
    const m = detailsModel({ ...DEFAULT_SETTINGS, mode: 'fretboard', tonic: 'D', scaleId: 'dorian' }, null, null);
    expect(m.scale.formula).toBe('1 – 2 – b3 – 4 – 5 – 6 – b7');
    expect(m.scale.notes).toBe('D – E – F – G – A – B – C');
  });

  it('ii–V in C: Dm7 is ii7, its guide tones are F and C, and they resolve by step into G7', () => {
    const s = { ...DEFAULT_SETTINGS, mode: 'harmony' as const, harmonyKey: 'C', harmonyMode: 'ionian' as const };
    const m = detailsModel(s, parseChord('Dm7'), parseChord('G7'));
    expect(m.chord?.tones).toBe('D (1) · F (b3) · A (5) · C (b7)');
    expect(m.chord?.guide).toBe('F (b3) · C (b7)');
    expect(m.chord?.numeral).toBe('ii7');
    expect(m.chord?.bass).toBe('fondamentale al basso');
    expect(m.next?.symbol).toBe('G7');
    // Textbook voice leading: the seventh of ii falls a semitone to the third of V; the third stays as the seventh.
    expect(m.next?.motion).toContain('C (b7) → B (3): scende di 1 semitono');
    expect(m.next?.motion).toContain('F (b3) resta e diventa b7');
    expect(m.next?.common).toEqual(['D: 1 → 5', 'F: b3 → b7']);
  });

  it('V–I in C: the leading tone rises a semitone, the seventh falls a semitone', () => {
    const s = { ...DEFAULT_SETTINGS, mode: 'jam' as const, harmonyKey: 'C', harmonyMode: 'ionian' as const };
    const m = detailsModel(s, parseChord('G7'), parseChord('Cmaj7'));
    expect(m.chord?.numeral).toBe('V7');
    expect(m.next?.motion).toEqual(['B (3) resta e diventa 7', 'F (b7) → E (3): scende di 1 semitono']);
  });

  it('a slash chord names its bass and inversion', () => {
    const m = detailsModel({ ...DEFAULT_SETTINGS, mode: 'fretboard' }, parseChord('C/E'), null);
    expect(m.chord?.bass).toBe('E al basso · primo rivolto');
    expect(m.next).toBeNull();
  });
});
