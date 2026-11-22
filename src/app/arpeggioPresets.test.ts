import { describe, expect, it } from 'vitest';
import { ARPEGGIO_PRESETS } from './arpeggioPresets';
import { EXERCISE_LEVELS } from '../exercises';
import { DEFAULT_SETTINGS, arpeggioPlanOf, sanitizeSettings } from './settings';
import { buildTracks } from './tracks';
import { parsedChords } from '../jam';
import { tryParseChord } from '../theory';
import type { NotePayload } from '../timeline';

describe('Arpeggios Lab starter presets (AR7)', () => {
  it('at least six per level, ids unique', () => {
    for (const level of EXERCISE_LEVELS) expect(ARPEGGIO_PRESETS.filter((p) => p.level === level).length, level).toBeGreaterThanOrEqual(6);
    expect(new Set(ARPEGGIO_PRESETS.map((p) => p.id)).size).toBe(ARPEGGIO_PRESETS.length);
  });

  it('every preset loads, every chord has a playable line, and the exercise track plays it', () => {
    for (const p of ARPEGGIO_PRESETS) {
      const s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...p.data });
      expect(s.arpPattern, p.id).toBe(p.data.arpPattern);
      const chords = s.arpSource === 'chord' ? [tryParseChord(s.arpSymbol)] : parsedChords(s.progression);
      for (const chord of chords) {
        const plan = arpeggioPlanOf(chord, s);
        expect(plan?.playable, `${p.id} ${chord?.symbol}`).toBe(true);
        expect(plan?.sequence.length, `${p.id} ${chord?.symbol}`).toBeGreaterThan(2);
      }
      expect(buildTracks(s).exercise?.events.length, p.id).toBeGreaterThan(0);
    }
  });

  it('groups of three in sixteenths: the accent falls every three notes, across the beats of 4/4', () => {
    const p = ARPEGGIO_PRESETS.find((x) => x.id === 'ar-dm7-groups-of-3');
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...p?.data });
    const events = (buildTracks(s).exercise?.events ?? []).map((e) => e.payload as NotePayload);
    const accents = events.slice(0, 12).map((e) => e.accent === true);
    expect(accents).toEqual([true, false, false, true, false, false, true, false, false, true, false, false]);
    // Twelve sixteenths are three beats; the accents land on beats 1, then the fourth, seventh and tenth sixteenth.
  });

  it('the enclosure preset plays approach notes outside the chord before each chord tone', () => {
    const p = ARPEGGIO_PRESETS.find((x) => x.id === 'ar-cmaj7-enclosure');
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...p?.data });
    const plan = arpeggioPlanOf(tryParseChord('Cmaj7'), s);
    const pcs = new Set([0, 4, 7, 11]);
    const seq = plan?.sequence ?? [];
    for (let i = 2; i < seq.length; i += 3) expect(pcs.has(seq[i]?.pc ?? -1)).toBe(true);
    expect(seq.some((n) => !pcs.has(n.pc))).toBe(true);
  });
});
