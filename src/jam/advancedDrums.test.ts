import { describe, expect, it } from 'vitest';
import { PPQ } from '../timeline';
import {
  DEFAULT_KIT, chanceRoll, drumCycleBars, drumPosition, drumTrack, landingBar, nextValue, pattern, patternBars, resizePattern,
  sanitizeKit, STEP_LEVELS, stepChance, stepLevel, withStepValue, type DrumKit, type DrumPattern,
} from './drums';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const BAR = PPQ * 4;
const S = PPQ / 4;
const kitWith = (p: DrumPattern): DrumKit => ({ patterns: [p, p, p, p], fill: pattern({ tom: 'xxxx' }) });

describe('Advanced drum sequencer (J3)', () => {
  it('32 steps are two bars: growing a pattern copies its bar, the second bar can then differ', () => {
    const one = pattern({ kick: 'X.......X.......', snare: '....X.......X...' });
    const two = resizePattern(one, 32);
    expect(two.kick).toHaveLength(32);
    expect(patternBars(two)).toBe(2);
    expect(two.kick.slice(16)).toEqual(one.kick);
    // A different second bar: an extra kick on the and of four of bar 2.
    const varied = { ...two, kick: two.kick.map((v, i) => (i === 30 ? 1 : v)) } as DrumPattern;
    const track = drumTrack(kitWith(varied), 0, m44, 0);
    expect(track.lengthTicks).toBe(2 * BAR);
    expect(track.events.filter((e) => e.payload.voice === 'kick').map((e) => e.tick)).toEqual([0, 8 * S, BAR, BAR + 8 * S, BAR + 14 * S]);
    expect(resizePattern(two, 16).kick).toEqual(one.kick);
    expect(resizePattern(one, 64).snare.filter((v) => v > 0)).toHaveLength(8);
  });

  it('a level scales the step: an accent at 55% plays at 0.55', () => {
    const p = withStepValue(pattern({ snare: '....X' }), 'levels', 'snare', 4, 55);
    expect(stepLevel(p, 'snare', 4)).toBe(0.55);
    expect(stepLevel(p, 'snare', 0)).toBe(1);
    const hit = drumTrack(kitWith(p), 0, m44, 0).events.find((e) => e.payload.voice === 'snare');
    expect(hit?.payload.velocity).toBeCloseTo(0.55, 6);
    expect([100, 85, 70, 55, 40].map((v) => nextValue(STEP_LEVELS, v))).toEqual([85, 70, 55, 40, 100]);
  });

  it('a 50% step plays in about half of the bars, the same bars every time (fixed seed)', () => {
    const p = withStepValue(pattern({ hat: 'x.x.x.x.x.x.x.x.' }), 'chances', 'hat', 2, 50);
    const kit = kitWith(p);
    expect(drumCycleBars(kit, 0, 0)).toBe(8);
    const played = (seed: number) => drumTrack(kit, 0, m44, 0, seed).events.filter((e) => e.payload.voice === 'hat' && e.tick % BAR === 2 * S).map((e) => e.tick / BAR);
    const a = played(1);
    expect(a).toEqual(played(1));
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(6);
    // The other steps always play.
    expect(drumTrack(kit, 0, m44, 0).events.filter((e) => e.payload.voice === 'hat' && e.tick % BAR === 0)).toHaveLength(8);
    // Over many bars the roll is even: 50% within 5 points.
    const rolls = Array.from({ length: 2000 }, (_, bar) => chanceRoll(1, 'hat', bar, 2));
    expect(rolls.filter((r) => r < 0.5).length / rolls.length).toBeGreaterThan(0.45);
    expect(rolls.filter((r) => r < 0.5).length / rolls.length).toBeLessThan(0.55);
    expect(stepChance(p, 'hat', 2)).toBe(0.5);
  });

  it('with a fill every 4 bars, a two-bar pattern keeps its order and the step light names the right step', () => {
    const p = resizePattern(pattern({ kick: 'X' }), 32);
    const kit = kitWith(p);
    expect(drumCycleBars(kit, 0, 4)).toBe(4);
    expect(drumPosition(kit, 0, 4, 1, 5)).toEqual({ step: 21, fill: false });
    expect(drumPosition(kit, 0, 4, 3, 5)).toEqual({ step: 5, fill: true });
    // Fill every 2 with a four-bar pattern: the cycle is four bars, fills on bars 2 and 4.
    const four = kitWith(resizePattern(pattern({ kick: 'X' }), 64));
    expect(drumCycleBars(four, 0, 2)).toBe(4);
    const toms = drumTrack(four, 0, m44, 2).events.filter((e) => e.payload.voice === 'tom').map((e) => Math.floor(e.tick / BAR));
    expect([...new Set(toms)]).toEqual([1, 3]);
  });

  it('the landing crash after a fill always sounds, even on a downbeat set to play by chance', () => {
    const p = withStepValue(pattern({ kick: 'X' }), 'chances', 'kick', 0, 25);
    const landed = landingBar(p);
    expect(landed.crash[0]).toBe(2);
    expect(stepChance(landed, 'kick', 0)).toBe(1);
  });

  it('saved Advanced kits keep length, levels and chances; bad values fall back', () => {
    const p = withStepValue(withStepValue(resizePattern(pattern({ kick: 'X' }), 32), 'levels', 'kick', 0, 70), 'chances', 'kick', 0, 75);
    const kit = sanitizeKit(JSON.parse(JSON.stringify({ patterns: [p, p, p, p], fill: DEFAULT_KIT.fill })));
    expect(kit.patterns[0].kick).toHaveLength(32);
    expect(stepLevel(kit.patterns[0], 'kick', 0)).toBe(0.7);
    expect(stepChance(kit.patterns[0], 'kick', 0)).toBe(0.75);
    const bad = sanitizeKit({ patterns: [{ ...p, levels: { kick: [33] } }], fill: resizePattern(DEFAULT_KIT.fill, 32) });
    expect(bad.patterns[0].levels).toBeUndefined();
    // The fill stays one bar.
    expect(bad.fill.kick).toHaveLength(16);
  });
});
