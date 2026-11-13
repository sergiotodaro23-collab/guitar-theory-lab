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

describe('fuzz and EQ (Studio V6)', () => {
  it('the chain puts fuzz before the overdrive and the EQ after the cabinet', async () => {
    const { RIG_CHAIN } = await import('./rig');
    expect(RIG_CHAIN).toEqual(['comp', 'fuzz', 'drive', 'amp', 'cab', 'eq', 'chorus', 'delay', 'reverb']);
  });
  it('the fuzz clipper is bounded, monotonic, asymmetric, keeps zero at zero and squares the wave far harder than the soft clipper', async () => {
    const { FUZZ_FLOOR, fuzzCurve, fuzzDrive } = await import('./rig');
    const curve = fuzzCurve(fuzzDrive(60));
    const at = (x: number) => curve[Math.round(((x + 1) / 2) * (curve.length - 1))] ?? 0;
    for (let i = 1; i < curve.length; i += 1) expect(curve[i] ?? 0).toBeGreaterThanOrEqual(curve[i - 1] ?? 0);
    expect(Math.max(...curve)).toBeLessThanOrEqual(1);
    expect(Math.min(...curve)).toBeGreaterThanOrEqual(FUZZ_FLOOR);
    // Odd-length-free check of the origin: the two samples around zero straddle it closely.
    expect(Math.abs(at(0))).toBeLessThan(0.1);
    // A quiet input is already almost fully clipped on both sides, at different heights.
    expect(at(0.05)).toBeGreaterThan(0.99);
    expect(at(-0.05)).toBeLessThan(FUZZ_FLOOR * 0.99);
    expect(at(1)).toBeCloseTo(1, 3);
    expect(at(-1)).toBeCloseTo(FUZZ_FLOOR, 3);
    // The overdrive's soft clipper at its default leaves the same quiet input far from the rail.
    const soft = softClipCurve(28);
    expect(soft[Math.round(((0.05 + 1) / 2) * (soft.length - 1))] ?? 0).toBeLessThan(0.95);
  });
  it('fuzz and EQ knobs map to their ranges; the EQ is flat at noon', async () => {
    const { eqDb, fuzzDrive, fuzzLevel, fuzzTone } = await import('./rig');
    expect(eqDb(50)).toBe(0);
    expect(eqDb(0)).toBe(-12);
    expect(eqDb(100)).toBe(12);
    expect(fuzzDrive(0)).toBe(20);
    expect(fuzzDrive(100)).toBe(300);
    expect(fuzzTone(0)).toBeCloseTo(500);
    expect(fuzzTone(100)).toBeCloseTo(6000);
    expect(fuzzLevel(100)).toBeCloseTo(1);
    expect(fuzzLevel(0)).toBeCloseTo(dbToGain(-30));
  });
  it('a session saved before fuzz and EQ existed gains them switched off, with the other pedals untouched', () => {
    const old = { ...DEFAULT_RIG, pedals: { delay: { on: true, knobs: { time: 70, feedback: 20, mix: 40 } } } };
    const r = sanitizeRig(old);
    expect(r.pedals.fuzz).toEqual({ on: false, knobs: { fuzz: 60, tone: 50, level: 40 } });
    expect(r.pedals.eq).toEqual({ on: false, knobs: { low: 50, mid: 50, high: 50 } });
    expect(r.pedals.delay).toEqual({ on: true, knobs: { time: 70, feedback: 20, mix: 40 } });
  });
});

describe('rig sound presets', () => {
  it('seven starting sounds, each valid as saved settings and recognised when loaded', async () => {
    const { RIG_PRESETS, matchingRigPreset } = await import('./rig');
    expect(RIG_PRESETS.map((p) => p.id)).toEqual(['blues-clean', 'jazz-clean', 'rock', 'fusion', 'punk', 'fuzz', 'ambient']);
    expect(new Set(RIG_PRESETS.map((p) => p.name)).size).toBe(RIG_PRESETS.length);
    for (const preset of RIG_PRESETS) {
      expect(sanitizeRig(preset.rig), preset.id).toEqual(preset.rig);
      expect(matchingRigPreset(preset.rig)?.id).toBe(preset.id);
      expect(preset.rig.amp.power && !preset.rig.amp.bypass, preset.id).toBe(true);
    }
    // Moving any control leaves the preset; the default rig is none of them.
    const rock = RIG_PRESETS.find((p) => p.id === 'rock');
    if (!rock) throw new Error('no rock preset');
    expect(matchingRigPreset({ ...rock.rig, amp: { ...rock.rig.amp, knobs: { ...rock.rig.amp.knobs, gain: 71 } } })).toBeNull();
    expect(matchingRigPreset(DEFAULT_RIG)).toBeNull();
  });
  it('each sound is what its name says', async () => {
    const { RIG_PRESETS } = await import('./rig');
    const by = Object.fromEntries(RIG_PRESETS.map((p) => [p.id, p.rig]));
    const on = (id: string) => PEDALS.filter((p) => by[id]?.pedals[p].on);
    expect(on('fuzz')).toEqual(['fuzz']);
    expect(on('punk')).toEqual([]);
    expect(on('jazz-clean')).toEqual(['chorus', 'reverb']);
    expect(by['jazz-clean']?.pedals.chorus.knobs.mix).toBeLessThanOrEqual(30);
    expect(on('ambient')).toEqual(['comp', 'chorus', 'delay', 'reverb']);
    expect(by.ambient?.pedals.delay.knobs.mix).toBeGreaterThanOrEqual(40);
    // Clean sounds keep the preamp low, distorted ones push it, in the order blues < fusion < rock < punk.
    const gain = (id: string) => by[id]?.amp.knobs.gain ?? 0;
    expect(gain('jazz-clean')).toBeLessThan(gain('blues-clean'));
    expect(gain('blues-clean')).toBeLessThan(40);
    expect(gain('fusion')).toBeLessThan(gain('rock'));
    expect(gain('rock')).toBeLessThan(gain('punk'));
  });
});
