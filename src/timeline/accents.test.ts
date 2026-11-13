import { describe, expect, it } from 'vitest';
import { clickRecipe, CLICK_SOUNDS } from '../audio/clickSounds';
import { ACCENT_STEPS, accentLevel, clicksPerBar, meterAccents, metronomeInRange, nextAccent, PPQ, sanitizeAccents, type TimeConfig } from '.';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const m34 = { beatsPerBar: 3, beatUnit: 4 } as const;
const m68 = { beatsPerBar: 6, beatUnit: 8 } as const;
const m128 = { beatsPerBar: 12, beatUnit: 8 } as const;

describe('accents from the meter', () => {
  it('4/4 in quarters: accent on 1, normal on 2 3 4, the rest of the 16 silent', () => {
    expect(meterAccents(m44, 1)).toEqual([3, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('4/4 in sixteenths fills all 16 steps: beats normal, off-beats soft', () => {
    expect(meterAccents(m44, 4)).toEqual([3, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1]);
    expect(clicksPerBar(m44, 4)).toBe(ACCENT_STEPS);
  });

  it('3/4 in eighths: one-and two-and three-and', () => {
    expect(meterAccents(m34, 2).slice(0, 6)).toEqual([3, 1, 2, 1, 2, 1]);
  });

  it('6/8 is felt in two: pulse on 1 and 4, not on every eighth', () => {
    expect(meterAccents(m68, 1).slice(0, 6)).toEqual([3, 1, 1, 2, 1, 1]);
    expect(meterAccents(m128, 1).slice(0, 12)).toEqual([3, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1]);
  });
});

describe('custom pattern', () => {
  const cfg: TimeConfig = { meter: m44, subdivision: 2, swing: 0 };
  const events = metronomeInRange(0, PPQ * 8, cfg);

  it('metronome events carry their step in the bar and the bar meter', () => {
    expect(events.slice(0, 9).map((e) => e.step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
    expect(events[0]?.meter).toEqual(m44);
  });

  it('a pattern overrides the meter; without one the meter decides', () => {
    const offbeats = [1, 3, 1, 3, 1, 3, 1, 3, 0, 0, 0, 0, 0, 0, 0, 0] as const;
    expect(events.slice(0, 8).map((e) => accentLevel(offbeats, e, 2))).toEqual([1, 3, 1, 3, 1, 3, 1, 3]);
    expect(events.slice(0, 4).map((e) => accentLevel(null, e, 2))).toEqual([3, 1, 2, 1]);
  });

  it('12/8 in sixteenths has 48 clicks: past step 16 the meter takes over', () => {
    const long = metronomeInRange(0, PPQ * 6, { meter: m128, subdivision: 4, swing: 0 });
    const silent = Array.from({ length: 16 }, () => 0 as const);
    const levels = long.map((e) => accentLevel(silent, e, 4));
    expect(levels.slice(0, 16).every((l) => l === 0)).toBe(true);
    expect(levels[24]).toBe(2); // step 24 = seventh eighth, the third dotted-quarter pulse
  });

  it('a press cycles up and wraps to silent; bad saved data falls back to the meter', () => {
    expect([0, 1, 2, 3].map((l) => nextAccent(l as 0 | 1 | 2 | 3))).toEqual([1, 2, 3, 0]);
    expect(sanitizeAccents([1, 2])).toBeNull();
    expect(sanitizeAccents(Array.from({ length: 16 }, () => 4))).toBeNull();
    expect(sanitizeAccents(Array.from({ length: 16 }, () => 2))).toHaveLength(16);
  });
});

describe('click timbres', () => {
  it('five timbres; silent steps make no sound; accents are louder and higher than normal clicks', () => {
    expect(CLICK_SOUNDS).toHaveLength(5);
    expect(new Set(CLICK_SOUNDS.map((c) => c.value)).size).toBe(5);
    // The soft tick is one pure sine: no bright partials.
    expect(clickRecipe('soft', 2)?.oscillators).toEqual([{ type: 'sine', frequency: 620 }]);
    for (const { value } of CLICK_SOUNDS) {
      expect(clickRecipe(value, 0)).toBeNull();
      const accent = clickRecipe(value, 3);
      const normal = clickRecipe(value, 2);
      const soft = clickRecipe(value, 1);
      expect(accent?.level).toBeGreaterThan(normal?.level ?? 1);
      expect(normal?.level).toBeGreaterThan(soft?.level ?? 1);
      expect(accent?.oscillators[0]?.frequency).toBeGreaterThan(normal?.oscillators[0]?.frequency ?? Infinity);
    }
  });
});
