import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RIG, PEDALS, ampOutGain, cabinetImpulse, chorusDepth, chorusRate, compThreshold, dbToGain, delayFeedback, delayTime,
  highBandShare, odTone, reverbDecay, reverbImpulse, sanitizeRig, softClipCurve, toneDb,
} from './rig';

describe('rig settings', () => {
  it('defaults: amp on, 4x12 cabinet, every pedal off', () => {
    expect(DEFAULT_RIG.amp.power).toBe(true);
    expect(DEFAULT_RIG.cab).toEqual({ on: true, model: '4x12', fileName: '' });
    for (const id of PEDALS) expect(DEFAULT_RIG.pedals[id].on).toBe(false);
  });
  it('repairs broken input and never restores a file cabinet', () => {
    const r = sanitizeRig({ amp: { knobs: { gain: 300, bass: 'x' }, power: false }, cab: { model: 'file', on: false }, pedals: { delay: { on: true, knobs: { time: -4 } } } });
    expect(r.amp.knobs.gain).toBe(100);
    expect(r.amp.knobs.bass).toBe(50);
    expect(r.amp.power).toBe(false);
    expect(r.cab.model).toBe('4x12');
    expect(r.cab.on).toBe(false);
    expect(r.pedals.delay).toEqual({ on: true, knobs: { time: 0, feedback: 35, mix: 30 } });
    expect(sanitizeRig(null)).toEqual(DEFAULT_RIG);
  });
});

describe('parameter mappings', () => {
  it('tone controls are flat at noon and ±12 dB at the ends', () => {
    expect(toneDb(50)).toBe(0);
    expect(toneDb(0)).toBe(-12);
    expect(toneDb(100)).toBe(12);
  });
  it('output: silent at zero, unity at full', () => {
    expect(ampOutGain(0)).toBe(0);
    expect(ampOutGain(100)).toBeCloseTo(1, 6);
    expect(ampOutGain(50)).toBeCloseTo(dbToGain(-15), 6);
  });
  it('time-based effects stay in safe ranges', () => {
    expect(delayTime(0)).toBeCloseTo(0.06);
    expect(delayTime(100)).toBeCloseTo(1);
    expect(delayFeedback(100)).toBeLessThan(0.9);
    expect(chorusRate(0)).toBeCloseTo(0.1);
    expect(chorusRate(100)).toBeCloseTo(5);
    expect(chorusDepth(100)).toBeCloseTo(0.006);
    expect(reverbDecay(100)).toBe(5);
    expect(odTone(0)).toBeCloseTo(800);
    expect(odTone(100)).toBeCloseTo(8000);
    expect(compThreshold(100)).toBe(-50);
  });
});

describe('soft clipper', () => {
  const curve = softClipCurve(20, 1025);
  it('is odd, bounded and monotonic', () => {
    expect(curve[512]).toBeCloseTo(0, 6);
    expect(curve[0]).toBeCloseTo(-1, 6);
    expect(curve[1024]).toBeCloseTo(1, 6);
    for (let i = 1; i < curve.length; i += 1) expect(curve[i] ?? 0).toBeGreaterThanOrEqual(curve[i - 1] ?? 0);
    for (let i = 0; i < 512; i += 1) expect(curve[i] ?? 0).toBeCloseTo(-(curve[1024 - i] ?? 0), 6);
  });
  it('more drive means more compression of small signals into large ones', () => {
    const soft = softClipCurve(2, 1025);
    expect(curve[600] ?? 0).toBeGreaterThan(soft[600] ?? 0);
  });
});

describe('impulse responses', () => {
  it('cabinets have unit energy and cut the highs like a speaker; the 4x12 is darker', () => {
    const sr = 48000;
    const big = cabinetImpulse('4x12', sr);
    const small = cabinetImpulse('1x12', sr);
    for (const ir of [big, small]) expect(ir.reduce((a, v) => a + v * v, 0)).toBeCloseTo(1, 5);
    expect(highBandShare(big, sr, 6000)).toBeLessThan(0.1);
    expect(highBandShare(big, sr, 6000)).toBeLessThan(highBandShare(small, sr, 6000));
    // Deterministic: the same response on every load.
    expect(cabinetImpulse('4x12', sr)).toEqual(big);
  });
  it('reverb tails last the decay time and fade by 60 dB', () => {
    const [left, right] = reverbImpulse(2, 8000);
    expect(left.length).toBe(16000);
    expect(right.length).toBe(16000);
    const rms = (a: Float32Array, from: number, to: number) => Math.sqrt(a.slice(from, to).reduce((s, v) => s + v * v, 0) / (to - from));
    expect(rms(left, 0, 800) / rms(left, 15000, 16000)).toBeGreaterThan(300);
    expect(left).not.toEqual(right);
  });
});
