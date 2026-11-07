import { describe, expect, it } from 'vitest';
import {
  PitchTracker, TUNINGS, tunerReading, centsBetween, detectPitch, livePositions, midiToFrequency, nearestString, noteOf, positionsOf,
} from '.';

const SR = 48000;
const FRAME = 2048;

/** A plucked-string-like tone: harmonics falling off, the fundamental not the loudest when `weakFundamental`. */
function tone(frequency: number, options: { weakFundamental?: boolean; noise?: number; amplitude?: number; phase?: number } = {}): Float32Array {
  const { weakFundamental = false, noise = 0, amplitude = 0.4, phase = 0 } = options;
  const frame = new Float32Array(FRAME);
  let seed = 7;
  for (let i = 0; i < FRAME; i += 1) {
    const t = i / SR;
    let v = 0;
    for (let h = 1; h <= 6; h += 1) {
      const gain = h === 1 && weakFundamental ? 0.3 : 1 / h;
      v += gain * Math.sin(2 * Math.PI * frequency * h * t + phase * h);
    }
    seed = (seed * 1664525 + 1013904223) >>> 0;
    frame[i] = amplitude * (v / 2) + noise * (seed / 2 ** 31 - 1);
  }
  return frame;
}

const cents = (f: number, g: number) => Math.abs(centsBetween(f, g));

describe('YIN pitch detection on synthetic signals', () => {
  it.each([
    ['low E, open sixth string', 82.41],
    ['A, open fifth', 110],
    ['G, open third', 196],
    ['high E, open first', 329.63],
    ['E6, fret 24 on the first string', 1318.51],
    ['drop D', 73.42],
  ])('%s (%f Hz) within 3 cents', (_name, frequency) => {
    const reading = detectPitch(tone(frequency), SR);
    expect(reading).not.toBeNull();
    expect(cents(reading?.frequency ?? 0, frequency)).toBeLessThan(3);
    expect(reading?.confidence ?? 0).toBeGreaterThan(0.9);
  });

  it('a weak fundamental (strong second harmonic) does not jump an octave up', () => {
    const reading = detectPitch(tone(110, { weakFundamental: true }), SR);
    expect(cents(reading?.frequency ?? 0, 110)).toBeLessThan(5);
  });

  it('survives moderate noise', () => {
    const reading = detectPitch(tone(146.83, { noise: 0.05 }), SR);
    expect(cents(reading?.frequency ?? 0, 146.83)).toBeLessThan(5);
  });

  it('silence and white noise give no pitch', () => {
    expect(detectPitch(new Float32Array(FRAME), SR)).toBeNull();
    expect(detectPitch(tone(0.0001, { amplitude: 0, noise: 0.3 }), SR)).toBeNull();
  });
});

describe('notes, cents and the tuner', () => {
  it('A4 = 440 Hz is A4 at 0 cents; with A4 = 442 it reads flat by about 8 cents', () => {
    expect(noteOf(440)).toMatchObject({ name: 'A', octave: 4, midi: 69, cents: 0 });
    expect(noteOf(440, 442).cents).toBe(-7.9); // 1200·log2(440/442) = −7.85
    expect(noteOf(82.41).name + noteOf(82.41).octave).toBe('E2');
  });

  it('cents: a semitone is 100, an octave 1200', () => {
    expect(centsBetween(midiToFrequency(70), midiToFrequency(69))).toBeCloseTo(100, 6);
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 6);
  });

  it('a slightly sharp A2 is the fifth string, +10 cents', () => {
    const heard = 110 * 2 ** (10 / 1200);
    const target = nearestString(heard, TUNINGS[0] as never, 440);
    expect(target).toMatchObject({ string: 1, midi: 45 });
    expect(target?.cents).toBeCloseTo(10, 5);
  });

  it('drop D: the sixth string is D2', () => {
    const dropD = TUNINGS.find((t) => t.id === 'drop-d');
    expect(nearestString(73.42, dropD as never, 440)).toMatchObject({ string: 0, midi: 38 });
  });
});

describe('tuner reading', () => {
  const standard = TUNINGS[0] as never;
  it('near an open string it tunes that string; an A3 (no open string) reads chromatically, not −200 cents from B', () => {
    expect(tunerReading(110 * 2 ** (-20 / 1200), standard, 440)).toMatchObject({ mode: 'string', string: 1, midi: 45 });
    const a3 = tunerReading(220, standard, 440);
    expect(a3).toMatchObject({ mode: 'chromatic', string: null, midi: 57 });
    expect(a3.cents).toBeCloseTo(0, 6);
  });

  it('a string a semitone flat (Eb tuned down) is still that string at −100', () => {
    const r = tunerReading(82.41 * 2 ** (-100 / 1200), standard, 440);
    expect(r.mode).toBe('string');
    expect(r.cents).toBeCloseTo(-100, 0);
  });
});

describe('stability', () => {
  it('a steady note becomes stable after three frames; a new note starts over', () => {
    const tracker = new PitchTracker();
    const r = (f: number) => ({ frequency: f, confidence: 0.95, rms: 0.2 });
    expect(tracker.push(r(110))?.stable).toBe(false);
    tracker.push(r(110.1));
    expect(tracker.push(r(109.9))?.stable).toBe(true);
    expect(tracker.push(r(146.8))?.stable).toBe(false);
    expect(tracker.push({ frequency: 110, confidence: 0.3, rms: 0.2 })).toBeNull();
  });
});

describe('positions of a heard pitch', () => {
  it('A3 (57) can be played in four places on a standard 24-fret neck', () => {
    expect(positionsOf(57)).toEqual([
      { string: 0, fret: 17 }, { string: 1, fret: 12 }, { string: 2, fret: 7 }, { string: 3, fret: 2 },
    ]);
  });

  it('context decides when it points to one place; otherwise the place nearest the last note; else none', () => {
    const context = [{ string: 2, fret: 7 }, { string: 2, fret: 9 }];
    expect(livePositions(57, context, null)).toMatchObject({ likely: { string: 2, fret: 7 }, reason: 'context' });
    expect(livePositions(57, [], { string: 1, fret: 10 })).toMatchObject({ likely: { string: 1, fret: 12 }, reason: 'previous' });
    expect(livePositions(57, [], null)).toMatchObject({ likely: null, reason: null });
  });
});
