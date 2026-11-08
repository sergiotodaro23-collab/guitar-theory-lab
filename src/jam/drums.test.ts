import { describe, expect, it } from 'vitest';
import { drumRecipe } from '../audio/drumSounds';
import { PPQ } from '../timeline';
import {
  DEFAULT_KIT, DRUM_STEPS, DRUM_VOICES, drumTrack, emptyPattern, nextDrumStep, sanitizeKit, sixteenthsPerBar, stepAt, steps,
} from './drums';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const m34 = { beatsPerBar: 3, beatUnit: 4 } as const;
const m68 = { beatsPerBar: 6, beatUnit: 8 } as const;
const m54 = { beatsPerBar: 5, beatUnit: 4 } as const;
const S = PPQ / 4;

describe('drum patterns', () => {
  it('reads a pattern string: x on, X accent', () => {
    expect(steps('X.x.')).toEqual([2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('pattern A is a rock beat: kick on 1, snare on 2 and 4, eighth hats', () => {
    const a = DEFAULT_KIT.patterns[0];
    expect(a.kick[0]).toBe(2);
    expect([4, 12].map((i) => a.snare[i])).toEqual([2, 2]);
    expect(a.hat.filter((v, i) => v > 0 && i % 2 === 0)).toHaveLength(8);
  });

  it('every default pattern keeps to the 16-step grid', () => {
    for (const p of [...DEFAULT_KIT.patterns, DEFAULT_KIT.fill]) for (const { voice } of DRUM_VOICES) expect(p[voice]).toHaveLength(DRUM_STEPS);
  });

  it('a step goes off → on → accent → ghost → off', () => {
    expect([0, 1, 2, 3].map((s) => nextDrumStep(s as 0 | 1 | 2 | 3))).toEqual([1, 2, 3, 0]);
  });
});

describe('drum track on the timeline', () => {
  it('a sixteenth is a step: 16 in 4/4, 12 in 3/4 and 6/8, 20 in 5/4', () => {
    expect([m44, m34, m68, m54].map(sixteenthsPerBar)).toEqual([16, 12, 12, 20]);
  });

  it('pattern A in 4/4: snare hits on beats 2 and 4, one bar long without a fill', () => {
    const track = drumTrack(DEFAULT_KIT, 0, m44, 0);
    expect(track.lengthTicks).toBe(PPQ * 4);
    expect(track.loop).toBe(true);
    expect(track.events.filter((e) => e.payload.voice === 'snare').map((e) => e.tick)).toEqual([PPQ, PPQ * 3]);
    expect(track.events.find((e) => e.payload.voice === 'kick' && e.tick === 0)?.payload.velocity).toBe(1);
  });

  it('fill every 4 bars: bars 1–3 the groove, bar 4 the fill', () => {
    const track = drumTrack(DEFAULT_KIT, 0, m44, 4);
    expect(track.lengthTicks).toBe(PPQ * 16);
    const toms = track.events.filter((e) => e.payload.voice === 'tom');
    expect(toms.length).toBeGreaterThan(0);
    expect(toms.every((e) => e.tick >= PPQ * 12)).toBe(true);
    expect(track.events.filter((e) => e.payload.voice === 'snare' && e.tick < PPQ * 12)).toHaveLength(6);
  });

  it('3/4 plays the first 12 steps; 5/4 starts the pattern again after step 16', () => {
    const p = { ...emptyPattern(), kick: steps('X...........x...') };
    const kit = { ...DEFAULT_KIT, patterns: [p, p, p, p] as const };
    expect(drumTrack(kit, 0, m34, 0).events.map((e) => e.tick)).toEqual([0]);
    expect(drumTrack(kit, 0, m54, 0).events.map((e) => e.tick)).toEqual([0, 12 * S, 16 * S]);
    expect(stepAt(17)).toBe(1);
  });

  it('events are sorted by tick, as the scheduler expects', () => {
    const ticks = drumTrack(DEFAULT_KIT, 1, m44, 2).events.map((e) => e.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
  });

  it('bad saved kits fall back piece by piece', () => {
    expect(sanitizeKit(null)).toBe(DEFAULT_KIT);
    const kit = sanitizeKit({ patterns: [{ kick: [2, 0] }], fill: 'x' });
    expect(kit.patterns[0].kick).toEqual(DEFAULT_KIT.patterns[0].kick);
    expect(kit.fill).toEqual(DEFAULT_KIT.fill);
  });

  it('every kit piece has a synthesised sound', () => {
    for (const { voice } of DRUM_VOICES) expect(drumRecipe(voice)).not.toBeNull();
    expect(drumRecipe('cowbell')).toBeNull();
  });
});
