import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { arpeggioPitches, arpeggioPlan, cagedArpeggioNotes, descentOf, fingerLine, nearestCagedForm, octaveLine, placeLine, skipLine, sweepLine, type ArpLine } from './arpShapes';

const name = (pc: number) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'][pc];
const names = (line: ArpLine) => line.notes.map((n) => name(n.pc));

/** A line a hand can follow: strings one way, no jump over six frets, ascending pitch. */
function playable(line: ArpLine, step: 1 | 2 = 1) {
  line.notes.forEach((n, i) => {
    const p = line.notes[i - 1];
    if (!p) return;
    expect(n.midi).toBeGreaterThan(p.midi);
    expect([0, step]).toContain(n.string - p.string);
    expect(Math.abs(n.fret - p.fret)).toBeLessThanOrEqual(6);
  });
  for (const n of line.notes) expect(n.finger).toBeGreaterThanOrEqual(n.fret === 0 ? 0 : 1);
}

describe('arpeggio pitches (theory → notes)', () => {
  it('two octaves of C from C3: C E G C E G C', () => {
    const p = arpeggioPitches(parseChord('C'), 48, 2);
    expect(p).toEqual([48, 52, 55, 60, 64, 67, 72]);
  });
  it('from the third: E G B C … for Cmaj7, ending on E', () => {
    const p = arpeggioPitches(parseChord('Cmaj7'), 48, 1, 1) ?? [];
    expect(p.map((m) => name(m % 12))).toEqual(['E', 'G', 'B', 'C', 'E']);
  });
  it('refuses three octaves that would leave a 24-fret neck', () => {
    // G on the low E at fret 15 is G3 (55): three octaves end on G6 (91), past E6 + 24 frets (88).
    expect(arpeggioPitches(parseChord('G'), 55, 3)).toBeNull();
    expect(arpeggioPitches(parseChord('G'), 43, 3)).not.toBeNull();
  });
});

describe('positions along the neck', () => {
  it('two octaves of C major from the 8th fret, sixth string', () => {
    const line = octaveLine(parseChord('C'), 8, 2);
    expect(line).not.toBeNull();
    if (!line) return;
    expect(line.notes[0]).toMatchObject({ string: 0, fret: 8 });
    expect(names(line)).toEqual(['C', 'E', 'G', 'C', 'E', 'G', 'C']);
    playable(line);
  });

  it('three octaves of Cmaj7 exist, use the whole neck and shift position', () => {
    const line = octaveLine(parseChord('Cmaj7'), 8, 3);
    expect(line).not.toBeNull();
    if (!line) return;
    expect(line.notes).toHaveLength(13);
    expect((line.notes.at(-1)?.midi ?? 0) - (line.notes[0]?.midi ?? 0)).toBe(36);
    playable(line);
    expect(line.shifts.length).toBeGreaterThan(0);
    expect(Math.max(...line.notes.map((n) => n.fret))).toBeLessThanOrEqual(24);
  });

  it('one octave of Am7 in one position needs no shift and fingers 1–4', () => {
    const line = octaveLine(parseChord('Am7'), 5, 1);
    expect(line?.shifts).toEqual([]);
    for (const n of line?.notes ?? []) expect(n.finger).toBeGreaterThanOrEqual(1);
    expect(names(line as ArpLine)).toEqual(['A', 'C', 'E', 'G', 'A']);
  });

  it('never more than three notes on a string, never a skipped string', () => {
    for (const symbol of ['Dm7', 'G7', 'Cmaj7', 'Bm7b5', 'Cdim7', 'Csus4', 'C6', 'Cadd9', 'C7alt']) {
      const line = octaveLine(parseChord(symbol), 5, 2);
      expect(line, symbol).not.toBeNull();
      if (!line) continue;
      const perString = new Map<number, number>();
      for (const n of line.notes) perString.set(n.string, (perString.get(n.string) ?? 0) + 1);
      expect(Math.max(...perString.values()), symbol).toBeLessThanOrEqual(3);
      playable(line);
    }
  });

  it('three octaves of G from the 15th fret: out of reach, so null', () => {
    expect(octaveLine(parseChord('G'), 15, 3)).toBeNull();
    expect(octaveLine(parseChord('G'), 3, 3)).not.toBeNull();
  });

  it('returns null rather than an unplayable route', () => {
    // Eleven notes on one string in one direction: impossible under the rules.
    expect(placeLine([40, 52, 64, 76, 88], { maxPerString: 1, stringStep: 2, preferFret: 0 })).toBeNull();
  });
});

describe('fingering', () => {
  it('index on the lowest fret, pinky stretching to the fifth', () => {
    const f = fingerLine([
      { string: 0, fret: 8, midi: 48, pc: 0 }, { string: 0, fret: 12, midi: 52, pc: 4 },
      { string: 1, fret: 10, midi: 55, pc: 7 },
    ]);
    expect(f.notes.map((n) => n.finger)).toEqual([1, 4, 3]);
    expect(f.shifts).toEqual([]);
  });
  it('a wider reach starts a new position with the index finger', () => {
    const f = fingerLine([
      { string: 0, fret: 3, midi: 43, pc: 7 }, { string: 0, fret: 7, midi: 47, pc: 11 },
      { string: 0, fret: 10, midi: 50, pc: 2 },
    ]);
    expect(f.shifts).toEqual([2]);
    expect(f.notes[2]?.finger).toBe(1);
  });
});

describe('sweep and string skipping', () => {
  it('A major across five strings at the 12th fret: one note a string, a turn on top', () => {
    const line = sweepLine(parseChord('A'), 12, 5);
    expect(line).not.toBeNull();
    if (!line) return;
    expect(line.notes[0]).toMatchObject({ string: 1, fret: 12 });
    expect(line.notes.slice(0, 5).map((n) => n.string)).toEqual([1, 2, 3, 4, 5]);
    expect(line.notes.at(-1)?.string).toBe(5);
    expect(new Set(line.notes.map((n) => n.pc))).toEqual(new Set([9, 1, 4]));
    const body = line.notes.slice(0, 5).map((n) => n.fret);
    expect(Math.max(...body) - Math.min(...body)).toBeLessThanOrEqual(4);
    playable({ ...line, notes: line.notes.slice(0, 5) });
  });

  it('three-string sweeps fit too; six strings of Em from the open position', () => {
    expect(sweepLine(parseChord('Dm'), 10, 3)?.notes.slice(0, 3).map((n) => n.string)).toEqual([3, 4, 5]);
    expect(sweepLine(parseChord('Em'), 0, 6)?.notes[0]).toMatchObject({ string: 0, fret: 0 });
  });

  it('string skipping keeps every other string', () => {
    const line = skipLine(parseChord('Cmaj7'), 8);
    expect(line).not.toBeNull();
    if (!line) return;
    playable(line, 2);
    expect(line.notes).toHaveLength(6);
    expect(line.shifts).toEqual([]);
    expect(new Set(line.notes.map((n) => n.pc))).toEqual(new Set([0, 4, 7, 11]));
    expect(new Set(line.notes.map((n) => n.string).filter((s, i, all) => all.indexOf(s) === i).map((s) => s % 2)).size).toBe(1);
  });
});

describe('the way back', () => {
  it('a different route down: same pitches, at least one different place', () => {
    const up = octaveLine(parseChord('Cmaj7'), 8, 2) as ArpLine;
    const down = descentOf(up, true, { maxPerString: 3, stringStep: 1 });
    expect(down.notes.map((n) => n.midi)).toEqual([...up.notes].reverse().map((n) => n.midi));
    const upPlaces = new Set(up.notes.map((n) => `${n.string}:${n.fret}`));
    expect(down.notes.some((n) => !upPlaces.has(`${n.string}:${n.fret}`))).toBe(true);
    expect(down.notes[0]).toMatchObject({ string: up.notes.at(-1)?.string, fret: up.notes.at(-1)?.fret });
    const same = descentOf(up, false, { maxPerString: 3, stringStep: 1 });
    expect(same.notes).toEqual([...up.notes].reverse());
  });
});

describe('CAGED forms of a chord', () => {
  it('C in the E form sits around the 8th fret, root on the sixth string', () => {
    const notes = cagedArpeggioNotes(parseChord('C'), 'E');
    expect(notes.every((n) => n.fret >= 7 && n.fret <= 11)).toBe(true);
    expect(notes.some((n) => n.string === 0 && n.fret === 8)).toBe(true);
    expect(notes.every((n) => [0, 4, 7].includes(n.pc))).toBe(true);
  });
  it('stays in the same area of the neck across chords', () => {
    expect(nearestCagedForm(parseChord('C'), 8)).toBe('E');
    expect(nearestCagedForm(parseChord('G'), 3)).toBe('E');
    expect(nearestCagedForm(parseChord('A'), 5)).toBe('E');
  });
});

describe('the plan Arpeggios Lab plays', () => {
  const spec = { direction: 'updown' as const, start: 0, customPattern: null };
  const choice = { shape: 'octaves' as const, low: 8, form: 'E' as const, octaves: 2 as const, strings: 5 as const, ret: 'same' as const };
  it('up and down two octaves: 13 notes, turning on the top C', () => {
    const plan = arpeggioPlan(parseChord('C'), choice, spec);
    expect(plan.playable).toBe(true);
    expect(plan.sequence).toHaveLength(13);
    expect(plan.sequence[6]?.midi).toBe(72);
    expect(plan.sequence.at(-1)?.midi).toBe(48);
    expect(plan.route).toBe(true);
    expect(plan.fingers?.length).toBe(plan.notes.length);
  });
  it('an unplayable shape plays and draws nothing', () => {
    const plan = arpeggioPlan(parseChord('G'), { ...choice, low: 15, octaves: 3 }, spec);
    expect(plan).toMatchObject({ playable: false, notes: [], sequence: [] });
  });
  it('a CAGED shape keeps the window behaviour', () => {
    const plan = arpeggioPlan(parseChord('C'), { ...choice, shape: 'caged' }, { ...spec, direction: 'up' });
    expect(plan.route).toBe(false);
    expect(plan.sequence[0]).toMatchObject({ string: 0, fret: 8 });
  });
});
