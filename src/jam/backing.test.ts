import { describe, expect, it } from 'vitest';
import { PPQ } from '../timeline';
import { DEFAULT_BACKING, bpmFromTaps, fileOffsetAt, loopRegion, sanitizeBacking, secondsAt } from './backing';

const m44 = { beatsPerBar: 4, beatUnit: 4 } as const;
const m68 = { beatsPerBar: 6, beatUnit: 8 } as const;
const b = { ...DEFAULT_BACKING, on: true, bpm: 120, offset: 0.5 };

describe('backing track timing (P3-09)', () => {
  it('a bar of 4/4 at 120 BPM is two seconds; in 6/8 the BPM counts eighths', () => {
    expect(secondsAt(4 * PPQ, 120, m44)).toBe(2);
    expect(secondsAt(6 * (PPQ / 2), 120, m68)).toBe(3);
  });
  it('starting at bar 3 reads the file four seconds after bar 1', () => {
    expect(fileOffsetAt(b, 2 * 4 * PPQ, m44, null)).toBe(4.5);
  });
  it('with a four-bar loop, bar 6 reads like bar 2', () => {
    expect(fileOffsetAt(b, 5 * 4 * PPQ, m44, 16 * PPQ)).toBe(fileOffsetAt(b, 4 * PPQ, m44, 16 * PPQ));
    expect(loopRegion(b, 16 * PPQ, m44)).toEqual({ start: 0.5, end: 8.5 });
  });
  it('tap tempo: the median gap of the taps', () => {
    expect(bpmFromTaps([0, 0.5, 1.0, 1.52, 2.0])).toBe(120);
    expect(bpmFromTaps([0, 1])).toBeNull();
  });
  it('saved settings are cleaned', () => {
    expect(sanitizeBacking({ on: true, bpm: 999, offset: -3, volume: 2, name: 7 })).toEqual({ on: true, name: '', bpm: 300, offset: 0, loop: true, volume: 1 });
  });
});
