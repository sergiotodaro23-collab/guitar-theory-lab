import { describe, expect, it } from 'vitest';
import { parseChord } from '../theory';
import { PPQ, type Meter } from '../timeline';
import { ARP_SPAN, arpeggioNotes, arpeggioSequence, progressionArpeggioTrack, type ArpeggioSpec } from './arpeggio';

const FOUR: Meter = { beatsPerBar: 4, beatUnit: 4 };
const spec = (over: Partial<ArpeggioSpec> = {}): ArpeggioSpec => ({ direction: 'up', start: 0, customPattern: null, ...over });
const pcName = (pc: number) => ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'][pc];

describe('arpeggio in one position', () => {
  const cmaj7 = parseChord('Cmaj7');
  const notes = arpeggioNotes(cmaj7, 7);

  it('uses only chord tones inside a five-fret hand position, one per pitch', () => {
    expect(notes.length).toBeGreaterThanOrEqual(8);
    for (const n of notes) {
      expect([0, 4, 7, 11]).toContain(n.pc);
      expect(n.fret).toBeGreaterThanOrEqual(7);
      expect(n.fret).toBeLessThanOrEqual(7 + ARP_SPAN);
    }
    expect(new Set(notes.map((n) => n.midi)).size).toBe(notes.length);
  });

  it('climbs from the lowest root through C E G B', () => {
    const up = arpeggioSequence(cmaj7, notes, spec());
    // Lowest C in frets 7–11 is on string 6, fret 8.
    expect(up[0]).toMatchObject({ string: 0, fret: 8 });
    expect(up.slice(0, 5).map((n) => pcName(n.pc))).toEqual(['C', 'E', 'G', 'B', 'C']);
    expect(up.map((n) => n.midi)).toEqual([...up.map((n) => n.midi)].sort((a, b) => a - b));
  });

  it('starts from the third, fifth or seventh for the inversions', () => {
    expect(pcName(arpeggioSequence(cmaj7, notes, spec({ start: 1 }))[0]?.pc ?? -1)).toBe('E');
    expect(arpeggioSequence(cmaj7, notes, spec({ start: 1 })).slice(0, 4).map((n) => pcName(n.pc))).toEqual(['E', 'G', 'B', 'C']);
    expect(pcName(arpeggioSequence(cmaj7, notes, spec({ start: 2 }))[0]?.pc ?? -1)).toBe('G');
    expect(pcName(arpeggioSequence(cmaj7, notes, spec({ start: 3 }))[0]?.pc ?? -1)).toBe('B');
  });

  it('goes down, up and down, down and up', () => {
    const up = arpeggioSequence(cmaj7, notes, spec());
    expect(arpeggioSequence(cmaj7, notes, spec({ direction: 'down' }))).toEqual([...up].reverse());
    const updown = arpeggioSequence(cmaj7, notes, spec({ direction: 'updown' }));
    expect(updown).toHaveLength(up.length * 2 - 1);
    expect(updown[up.length - 1]).toEqual(up[up.length - 1]);
    const downup = arpeggioSequence(cmaj7, notes, spec({ direction: 'downup' }));
    expect(downup[0]).toEqual(up[up.length - 1]);
    expect(downup[downup.length - 1]).toEqual(up[up.length - 1]);
  });

  it('applies a step pattern over the chord tones', () => {
    const seq = arpeggioSequence(cmaj7, notes, spec({ customPattern: [1, 3, 2, 4] }));
    expect(seq.slice(0, 8).map((n) => pcName(n.pc))).toEqual(['C', 'G', 'E', 'B', 'E', 'B', 'G', 'C']);
  });

  it('arpeggiates triads and slash chords by their own tones', () => {
    const am = arpeggioSequence(parseChord('Am'), arpeggioNotes(parseChord('Am'), 5), spec());
    expect(am.slice(0, 4).map((n) => pcName(n.pc))).toEqual(['A', 'C', 'E', 'A']);
    const ce = parseChord('C/E');
    expect(arpeggioNotes(ce, 7).every((n) => [0, 4, 7].includes(n.pc))).toBe(true);
  });
});

describe('arpeggios over a progression', () => {
  const chords = ['Dm7', 'G7', 'Cmaj7'].map(parseChord);
  const bar = 4 * PPQ;
  const spans = chords.map((chord, i) => ({ chord, tick: i * bar, lengthTicks: bar }));
  const base = { spans, lengthTicks: 3 * bar, loop: true, meter: FOUR, low: 5, spec: spec(), notesPerBeat: 2 as const };

  it('fills every chord with its own tones, eighth notes on the grid', () => {
    for (const link of ['restart', 'connect'] as const) {
      const track = progressionArpeggioTrack({ ...base, link });
      expect(track.events).toHaveLength(24);
      track.events.forEach((e, i) => {
        expect(e.tick).toBe(i * 240);
        const chord = chords[Math.floor(e.tick / bar)];
        expect(chord?.tones.map((t) => t.pc)).toContain(e.payload.midi % 12);
      });
    }
  });

  it('connects chords by the nearest tone: never more than a whole step at a change', () => {
    const track = progressionArpeggioTrack({ ...base, link: 'connect' });
    for (const change of [8, 16]) {
      const before = track.events[change - 1]?.payload.midi ?? 0;
      const after = track.events[change]?.payload.midi ?? 99;
      expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
    }
    // Inside a chord the line moves one chord tone at a time.
    const steps = track.events.slice(1, 8).map((e, i) => Math.abs(e.payload.midi - (track.events[i]?.payload.midi ?? 0)));
    expect(steps.every((s) => s >= 1 && s <= 5)).toBe(true);
  });

  it('restarts each chord from its chosen tone', () => {
    const track = progressionArpeggioTrack({ ...base, link: 'restart', spec: spec({ start: 1 }) });
    // Third of each chord: F, B, E.
    expect([0, 8, 16].map((i) => pcName((track.events[i]?.payload.midi ?? 0) % 12))).toEqual(['F', 'B', 'E']);
  });

  it('target: every chord lands on its third on the downbeat, the nearest one', () => {
    const track = progressionArpeggioTrack({ ...base, link: 'target', target: 1 });
    // Third of Dm7 at the start (first chord starts from the chosen tone), then B on G7, E on Cmaj7.
    expect([8, 16].map((i) => pcName((track.events[i]?.payload.midi ?? 0) % 12))).toEqual(['B', 'E']);
    for (const change of [8, 16]) {
      const before = track.events[change - 1]?.payload.midi ?? 0;
      const after = track.events[change]?.payload.midi ?? 99;
      expect(Math.abs(after - before)).toBeLessThanOrEqual(7);
    }
  });

  it('a fixed route per chord plays that route from the downbeat', () => {
    const route = (c: (typeof chords)[number]) => arpeggioNotes(c, 5).slice(0, 3);
    const track = progressionArpeggioTrack({ ...base, link: 'connect', sequenceOf: route });
    expect(track.events[8]?.payload.midi).toBe(route(chords[1] as (typeof chords)[number])[0]?.midi);
  });
});

