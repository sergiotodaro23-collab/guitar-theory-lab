import { describe, expect, it } from 'vitest';
import { expectedAt, judge, trimHistory } from './feedback';

describe('live feedback with latency (D-37)', () => {
  const history = [{ time: 0, midi: 60 }, { time: 250, midi: 62 }, { time: 500, midi: 64 }];
  it('compares with the note asked for when the sound left the guitar', () => {
    // Detected at 270 ms with 40 ms of latency: the player was still on C.
    expect(expectedAt(history, 270 - 40)).toBe(60);
    expect(expectedAt(history, 270)).toBe(62);
    expect(expectedAt(history, -5)).toBeNull();
  });
  it('judges right note, right note in another octave, or another note', () => {
    expect(judge(62, 62)).toBe('giusto');
    expect(judge(74, 62)).toBe('ottava');
    expect(judge(63, 62)).toBe('diverso');
  });
  it('trims old changes but keeps the one still in force', () => {
    expect(trimHistory(history, 2300)).toEqual([{ time: 0, midi: 60 }, { time: 250, midi: 62 }, { time: 500, midi: 64 }].slice(1));
  });
});
