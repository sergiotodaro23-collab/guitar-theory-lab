import { describe, expect, it } from 'vitest';
import { PPQ, type DrumPayload } from '../timeline';
import { DEFAULT_KIT, drumTrack } from './drums';
import { bassTrack } from './bass';
import { genreOf } from './genres';
import { HUMANIZE_MAX_MS, hash01, humanize, ticksPerMs, unroll } from './humanize';
import { withChord } from './progression';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const BAR = PPQ * 4;

describe('humanization (J6)', () => {
  const grid = drumTrack(DEFAULT_KIT, 0, m44, 0);

  it('amount 0 leaves the grid as it is', () => {
    expect(humanize(grid, m44, 120, 0)).toBe(grid);
  });

  it('the same seed gives the same performance; another seed another one', () => {
    const a = humanize(grid, m44, 120, 1, 7);
    expect(humanize(grid, m44, 120, 1, 7)).toEqual(a);
    expect(humanize(grid, m44, 120, 1, 8).events).not.toEqual(a.events);
  });

  it('a one-bar groove is unrolled to four bars so the feel does not repeat every bar', () => {
    const felt = humanize(grid, m44, 120, 1);
    expect(felt.lengthTicks).toBe(4 * BAR);
    expect(felt.events).toHaveLength(grid.events.length * 4);
    const hatsIn = (bar: number) => felt.events.filter((e) => (e.payload as DrumPayload).voice === 'hat' && e.tick >= bar * BAR && e.tick < (bar + 1) * BAR).map((e) => e.tick - bar * BAR);
    expect(hatsIn(1)).not.toEqual(hatsIn(2));
    expect(unroll({ ...grid, loop: false }, 4 * BAR).lengthTicks).toBe(BAR);
  });

  it('at 120 BPM no note moves more than 12 ms (11.5 ticks); the downbeat never moves; the kick within 6 ms', () => {
    expect(ticksPerMs(120)).toBe(0.96);
    const felt = humanize(grid, m44, 120, 1);
    const straight = unroll(grid, 4 * BAR).events;
    const max = HUMANIZE_MAX_MS * ticksPerMs(120);
    felt.events.forEach((e, i) => expect(Math.abs(e.tick - (straight[i]?.tick ?? 0))).toBeLessThanOrEqual(Math.ceil(max)));
    for (const bar of [0, 1, 2, 3]) expect(felt.events.filter((e) => e.tick === bar * BAR).map((e) => (e.payload as DrumPayload).voice)).toEqual(expect.arrayContaining(['kick', 'hat']));
    const kicks = felt.events.filter((e) => (e.payload as DrumPayload).voice === 'kick');
    const gridKicks = straight.filter((e) => (e.payload as DrumPayload).voice === 'kick');
    kicks.forEach((k, i) => expect(Math.abs(k.tick - (gridKicks[i]?.tick ?? 0))).toBeLessThanOrEqual(Math.ceil(max / 2)));
  });

  it('velocity moves at most ±12 %, half that on the downbeat; events stay sorted and inside the track', () => {
    const felt = humanize(grid, m44, 120, 1);
    const straight = unroll(grid, 4 * BAR).events;
    const byKey = new Map(straight.map((e) => [`${e.tick}:${(e.payload as DrumPayload).voice}`, e.payload.velocity]));
    let moved = 0;
    for (const e of felt.events) {
      const voice = (e.payload as DrumPayload).voice;
      const original = [...byKey.entries()].find(([k]) => k.endsWith(`:${voice}`) && Math.abs(Number(k.split(':')[0]) - e.tick) <= 12)?.[1] ?? 0;
      const ratio = e.payload.velocity / original;
      expect(Math.abs(ratio - 1)).toBeLessThanOrEqual(e.tick % BAR === 0 ? 0.0601 : 0.1201);
      if (ratio !== 1) moved += 1;
    }
    expect(moved).toBeGreaterThan(felt.events.length / 2);
    const ticks = felt.events.map((e) => e.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    expect(ticks.every((t) => t >= 0 && t < felt.lengthTicks)).toBe(true);
  });

  it('the feel is in milliseconds: at 60 BPM the same note moves half as many ticks as at 120', () => {
    expect(ticksPerMs(60) * 2).toBe(ticksPerMs(120));
    const at = (bpm: number) => humanize(grid, m44, bpm, 1).events.find((e) => (e.payload as DrumPayload).voice === 'snare')?.tick ?? 0;
    expect(Math.abs(at(60) - PPQ)).toBeLessThanOrEqual(Math.ceil(HUMANIZE_MAX_MS * ticksPerMs(60)));
  });

  it('the bass keeps its pitches; only time and velocity change', () => {
    const p = { name: 't', chords: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'].map((c) => withChord(c)) };
    const line = bassTrack(p, m44, genreOf('jazz').bass[0] as never, true);
    const felt = humanize(line, m44, 140, 1);
    expect(felt.events.map((e) => e.payload.midi)).toEqual(line.events.map((e) => e.payload.midi));
    expect(hash01(1, 'x', 5)).toBe(hash01(1, 'x', 5));
  });
});
