import { describe, expect, it } from 'vitest';
import { ARPEGGIO_PRESETS } from './arpeggioPresets';
import { EXERCISE_LEVELS } from '../exercises';
import { DEFAULT_SETTINGS, arpeggioPlanOf, engineArpeggioLine, sanitizeSettings } from './settings';
import { lineKey, samePitchPlaces } from '../exercises';
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

describe('Arpeggios Lab: expert vocabulary and editing (AR4, AR6)', () => {
  const load = (id: string) => sanitizeSettings({ ...DEFAULT_SETTINGS, ...ARPEGGIO_PRESETS.find((x) => x.id === id)?.data });

  it('Em7 over Cmaj7 plays only E G B D; Db7 over G7 only Db F Ab Cb', () => {
    const em = arpeggioPlanOf(tryParseChord('Cmaj7'), load('ar-em7-over-cmaj7'))?.sequence ?? [];
    expect(new Set(em.map((n) => n.pc))).toEqual(new Set([4, 7, 11, 2]));
    const db = arpeggioPlanOf(tryParseChord('G7'), load('ar-db7-over-g7'))?.sequence ?? [];
    expect(new Set(db.map((n) => n.pc))).toEqual(new Set([1, 5, 8, 11]));
  });

  it('a hand-written route is played exactly as written', () => {
    const plan = arpeggioPlanOf(tryParseChord('Cmaj7'), load('ar-cmaj7-route-by-hand'));
    expect(plan?.sequence.map((n) => [n.string, n.fret])).toEqual([[0, 8], [1, 7], [1, 10], [2, 9], [2, 10], [3, 9], [4, 8], [5, 7]]);
    expect(plan?.fingers?.length).toBe(8);
  });

  it('an edit moves one note and only on the line it was made on', () => {
    const s = load('ar-c-triad-position');
    const chord = tryParseChord('C');
    const base = engineArpeggioLine(chord, s);
    const target = base[1]!;
    const other = samePitchPlaces(target)[0]!;
    const edited = { ...s, arpEdits: [{ index: 1, to: { string: other.string, fret: other.fret } }], arpEditKey: lineKey(base) };
    const seq = arpeggioPlanOf(chord, edited)?.sequence ?? [];
    expect(seq[1]).toMatchObject({ string: other.string, fret: other.fret, midi: target.midi });
    expect(seq.filter((_, i) => i !== 1)).toEqual(base.filter((_, i) => i !== 1));
    // A stale edit (another shape) leaves the engine's line alone.
    expect(arpeggioPlanOf(chord, { ...edited, arpLow: 2 })?.sequence).toEqual(engineArpeggioLine(chord, { ...s, arpLow: 2 }));
  });

  it('saved edits and limits are sanitized', () => {
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, arpEdits: [{ index: 1, to: null }, { index: -2, to: null }, { index: 'x' }, { index: 3, to: { string: 2, fret: 5 } }], arpErgo: { maxStretch: 99, maxJump: 4, allowOpen: 'no' } });
    expect(s.arpEdits).toEqual([{ index: 1, to: null }, { index: 3, to: { string: 2, fret: 5 } }]);
    expect(s.arpErgo).toEqual({ maxStretch: 4, maxJump: 4, maxShifts: 4, allowOpen: true });
  });
});
