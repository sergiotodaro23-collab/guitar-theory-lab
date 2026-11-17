import { describe, expect, it } from 'vitest';
import { ARP_SHAPES, ROUTINE_TEMPLATES } from '../exercises';
import { chordSpans } from '../jam';
import { tryParseChord } from '../theory';
import { DEFAULT_SETTINGS, arpeggioPlanOf, boardContext, meterOf, type Settings } from './settings';
import { buildTracks } from './tracks';

/**
 * A2 · what the board highlights is what the sequencer plays. Both read the
 * same plan (arpeggioPlanOf) and the same routine (boardContext / routineTrack);
 * this test keeps it so across shapes, custom patterns, strings, return modes,
 * chords and progressions, and the phases of every routine template.
 */
const key = (n: { string: number; fret: number }) => `${n.string}:${n.fret}`;

/** Every played note of the arpeggio track must be one the board draws for its chord. */
function arpeggioMismatches(s: Settings): string[] {
  const out: string[] = [];
  const spans = s.arpSource === 'progression' ? chordSpans(s.progression, meterOf(s)) : [];
  for (const e of buildTracks(s).exercise?.events ?? []) {
    const p = e.payload as { midi: number; string: number; fret: number };
    const chord = s.arpSource === 'chord' ? tryParseChord(s.arpSymbol) : spans.find((sp) => e.tick >= sp.tick && e.tick < sp.tick + sp.lengthTicks)?.chord ?? null;
    const shown = new Set((arpeggioPlanOf(chord, s)?.notes ?? []).map(key));
    if (!shown.has(key(p))) out.push(`${chord?.symbol ?? '?'} ${key(p)}`);
  }
  return out;
}

/** Every played note of a routine must be one the board draws for its phase. */
function routineMismatches(s: Settings): string[] {
  const out: string[] = [];
  for (const e of buildTracks(s).exercise?.events ?? []) {
    const p = e.payload as { midi: number; string: number; fret: number; phase?: number };
    const shown = new Set(boardContext(s, p.phase ?? null).notes.map(key));
    if (!shown.has(key(p))) out.push(`phase ${p.phase ?? '-'} ${key(p)}`);
  }
  return out;
}

describe('A2 · arpeggios: the notes shown are the notes played', () => {
  it('every shape, custom pattern, string set and return mode, on chords and progressions', () => {
    const cases: Settings[] = [];
    for (const source of ['chord', 'progression'] as const) for (const shape of ARP_SHAPES) for (const custom of [false, true]) for (const start of [0, 2]) for (const ret of ['same', 'other'] as const) {
      cases.push({ ...DEFAULT_SETTINGS, mode: 'arpeggio', arpSource: source, arpShape: shape, arpCustomOn: custom, arpCustomText: custom ? '1 5 3 7 5' : '1 3 2 4', arpStart: start, arpReturn: ret, arpSymbol: 'Dm7', arpLow: 5 });
    }
    for (const s of cases) expect(arpeggioMismatches(s), `${s.arpSource}/${s.arpShape}/custom=${s.arpCustomOn}/start=${s.arpStart}/${s.arpReturn}`).toEqual([]);
  });

  it('every routine template: the phases the board shows are the notes the sequencer plays', () => {
    for (const routine of ROUTINE_TEMPLATES) {
      const s: Settings = { ...DEFAULT_SETTINGS, mode: 'fretboard', exerciseOn: true, exerciseMode: 'routine', routine };
      expect(routineMismatches(s), routine.name).toEqual([]);
    }
  });
});
