import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, detectOnsets, measureLatency, measureNoise, measureNotes, sanitizeProfiles, suggestSensitivity } from './calibration';

describe('calibration from synthetic takes', () => {
  it('noise floor and silence gate', () => {
    expect(measureNoise([0.002, 0.003, 0.0025, 0.01, 0.002])).toEqual({ noiseRms: 0.0025, minRms: 0.0075 });
    // A dead-quiet input still keeps a sensible gate; a noisy one is capped.
    expect(measureNoise([0, 0, 0]).minRms).toBe(0.004);
    expect(measureNoise([0.1, 0.1, 0.1]).minRms).toBe(0.05);
  });

  it('held notes: gain towards 0.2 RMS, confidence gate under the usual reading', () => {
    const quiet = Array.from({ length: 20 }, (_, i) => ({ rms: 0.05, confidence: 0.9 + (i % 5) * 0.02 }));
    const r = measureNotes(quiet);
    expect(r?.gainFactor).toBe(4);
    expect(r?.minConfidence).toBeCloseTo(0.85);
    expect(measureNotes(quiet.slice(0, 3))).toBeNull();
  });

  it('onsets of four picked notes in a synthetic take', () => {
    const sr = 48000;
    const samples = new Float32Array(sr * 2);
    for (const start of [0.1, 0.6, 1.1, 1.6]) {
      for (let i = 0; i < sr * 0.3; i += 1) samples[Math.round(start * sr) + i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr) * Math.exp(-i / sr / 0.1);
    }
    const onsets = detectOnsets(samples, sr);
    expect(onsets).toHaveLength(4);
    onsets.forEach((t, i) => expect(Math.abs(t - [0.1, 0.6, 1.1, 1.6][i]!)).toBeLessThan(0.01));
  });

  it('latency is the median delay of the answers to the clicks', () => {
    expect(measureLatency([1, 2, 3, 4], [1.031, 2.029, 3.035, 4.5, 9])).toBe(31);
    expect(measureLatency([1, 2, 3], [1.03])).toBeNull();
  });

  it('a passage suggests Fast only when Fast hears clearly more', () => {
    expect(suggestSensitivity(10, 16)).toBe('fast');
    expect(suggestSensitivity(10, 11)).toBe('balanced');
  });

  it('profiles survive a round trip and junk is dropped', () => {
    const p = { ...DEFAULT_PROFILE, id: 'a', name: 'Strat al ponte', inputGain: 99, measured: { noise: true, notes: false, response: false, latency: true } };
    const [clean] = sanitizeProfiles([p, null, { id: 'x', name: '' }]);
    expect(clean).toMatchObject({ name: 'Strat al ponte', inputGain: 4, measured: { noise: true, latency: true } });
    expect(sanitizeProfiles([p, null])).toHaveLength(1);
  });
});
