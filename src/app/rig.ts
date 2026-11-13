/**
 * Guitar Rig (D-42): the settings of the amp head, cabinet and pedals, and
 * the pure DSP maths the audio graph uses (parameter mappings, waveshaper
 * curves, synthesised impulse responses). No Web Audio and no DOM here.
 *
 * Chain on the guitar's listening branch:
 *   comp → fuzz → drive → amp (preamp or NAM model, then tone stack) → cabinet IR → eq → chorus → delay → reverb
 */

import { DEFAULT_POST, DEFAULT_PRE, PEDAL_IDS, defaultChain, sanitizeChain, type PedalChain, type PedalId } from './pedalChain';

export type { PedalChain, PedalId } from './pedalChain';
export { defaultChain, wiredOrder, movePedal, addPedal, removePedal, availablePedals, inChain, isDefaultChain, sameChain, sanitizeChain } from './pedalChain';
/** The factory zones, as the rack lists them: the default chain's pedals in each. */
export const PRE_PEDALS: readonly PedalId[] = DEFAULT_PRE;
export const POST_PEDALS: readonly PedalId[] = DEFAULT_POST;
export const PEDALS: readonly PedalId[] = PEDAL_IDS;

export type AmpKnob = 'gain' | 'bass' | 'mid' | 'treble' | 'presence' | 'out';
export const AMP_KNOB_IDS: readonly AmpKnob[] = ['gain', 'bass', 'mid', 'treble', 'presence', 'out'];

/** Built-in cabinets are synthesised; 'file' is an impulse response loaded by the user (kept in memory only). */
export type CabModel = '1x12' | '4x12' | 'file';
/**
 * The amp head's engine: the built-in DSP preamp, or a Neural Amp Modeler
 * capture loaded by the user (D-51). 'nam' is a request: the model runs only
 * once the engine has loaded it, and until then the built-in preamp plays.
 * The model file itself is never saved with the settings.
 */
export type AmpModel = 'internal' | 'nam';

export interface PedalSpec {
  readonly name: string;
  /** Knob ids, labels and defaults (0–100). */
  readonly knobs: readonly (readonly [string, string, number])[];
  /** Paint colour of the enclosure, and dark lettering when the paint is light. */
  readonly color: string;
  readonly darkInk?: boolean;
}

export const PEDAL_SPECS: Readonly<Record<PedalId, PedalSpec>> = {
  comp: { name: 'Compressor', color: '#2f6fb0', knobs: [['sustain', 'Sustain', 50], ['level', 'Level', 40]] },
  fuzz: { name: 'Fuzz', color: '#b8452c', knobs: [['fuzz', 'Fuzz', 60], ['tone', 'Tone', 50], ['level', 'Level', 40]] },
  drive: { name: 'Overdrive', color: '#3f8f4a', knobs: [['drive', 'Drive', 45], ['tone', 'Tone', 55], ['level', 'Level', 50]] },
  eq: { name: 'EQ', color: '#d9d2c4', darkInk: true, knobs: [['low', 'Low', 50], ['mid', 'Mid', 50], ['high', 'High', 50]] },
  chorus: { name: 'Chorus', color: '#5aa6c8', knobs: [['rate', 'Rate', 35], ['depth', 'Depth', 45], ['mix', 'Mix', 50]] },
  delay: { name: 'Delay', color: '#c9c3b2', darkInk: true, knobs: [['time', 'Time', 40], ['feedback', 'Feedback', 35], ['mix', 'Mix', 30]] },
  reverb: { name: 'Reverb', color: '#7a5aa8', knobs: [['decay', 'Decay', 40], ['mix', 'Mix', 30]] },
};

export interface PedalState {
  readonly on: boolean;
  readonly knobs: Readonly<Record<string, number>>;
}

export interface RigSettings {
  /** Order and membership of the pedals (pedalChain.ts). Parameters and on/off stay in `pedals` when a pedal leaves the chain. */
  readonly chain: PedalChain;
  readonly amp: {
    readonly model: AmpModel;
    readonly power: boolean;
    /** Amp and cabinet bypassed: the pedals still work. */
    readonly bypass: boolean;
    readonly knobs: Readonly<Record<AmpKnob, number>>;
    /** NAM only: the capture already includes its cabinet, so the rig's cabinet is skipped while the model plays. */
    readonly namCab: boolean;
  };
  readonly cab: { readonly on: boolean; readonly model: CabModel; readonly fileName: string };
  readonly pedals: Readonly<Record<PedalId, PedalState>>;
}

const AMP_DEFAULTS: Record<AmpKnob, number> = { gain: 55, bass: 50, mid: 60, treble: 58, presence: 45, out: 62 };

export const DEFAULT_RIG: RigSettings = {
  chain: defaultChain(),
  amp: { model: 'internal', power: true, bypass: false, knobs: AMP_DEFAULTS, namCab: false },
  cab: { on: true, model: '4x12', fileName: '' },
  pedals: Object.fromEntries(PEDALS.map((id) => [id, { on: false, knobs: Object.fromEntries(PEDAL_SPECS[id].knobs.map(([k, , v]) => [k, v])) }])) as Record<PedalId, PedalState>,
};

const pct = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null ? v as Record<string, unknown> : {});

/**
 * Repairs anything missing or out of range; a saved 'file' cabinet comes back as 4x12 (the file is not kept).
 * The choice of the NAM engine is kept, the model is not: after a reload the built-in preamp plays until a file is loaded again.
 */
export function sanitizeRig(raw: unknown): RigSettings {
  const r = obj(raw);
  const amp = obj(r.amp);
  const knobs = obj(amp.knobs);
  const cab = obj(r.cab);
  const pedals = obj(r.pedals);
  return {
    chain: sanitizeChain(r.chain),
    amp: {
      model: amp.model === 'nam' ? 'nam' : 'internal',
      power: bool(amp.power, true),
      bypass: bool(amp.bypass, false),
      knobs: Object.fromEntries(AMP_KNOB_IDS.map((k) => [k, pct(knobs[k], AMP_DEFAULTS[k])])) as Record<AmpKnob, number>,
      namCab: bool(amp.namCab, false),
    },
    cab: { on: bool(cab.on, true), model: cab.model === '1x12' ? '1x12' : '4x12', fileName: '' },
    pedals: Object.fromEntries(PEDALS.map((id) => {
      const p = obj(pedals[id]);
      const k = obj(p.knobs);
      return [id, { on: bool(p.on, false), knobs: Object.fromEntries(PEDAL_SPECS[id].knobs.map(([key, , v]) => [key, pct(k[key], v)])) }];
    })) as Record<PedalId, PedalState>,
  };
}

/* ---------------- parameter mappings (knob 0–100 → physical unit) ---------------- */

export const dbToGain = (db: number): number => 10 ** (db / 20);
const lin = (v: number, a: number, b: number) => a + ((b - a) * Math.max(0, Math.min(100, v))) / 100;
const log = (v: number, a: number, b: number) => a * (b / a) ** (Math.max(0, Math.min(100, v)) / 100);

/** Amp: preamp drive factor 1–40, tone stack ±12 dB around noon, presence ±9 dB, output −30…0 dB (0 = silent). */
export const ampDrive = (gain: number): number => lin(gain, 1, 40);
export const toneDb = (v: number): number => lin(v, -12, 12);
export const presenceDb = (v: number): number => lin(v, -9, 9);
export const ampOutGain = (v: number): number => (v <= 0 ? 0 : dbToGain(lin(v, -30, 0)));

/** Compressor: Sustain lowers the threshold (−10 → −50 dB), Level is make-up gain (0 → +18 dB). */
export const compThreshold = (v: number): number => lin(v, -10, -50);
export const compMakeup = (v: number): number => dbToGain(lin(v, 0, 18));

/** Overdrive: drive factor 1–60, tone low-pass 800 Hz–8 kHz (log), level −20…+6 dB. */
export const odDrive = (v: number): number => lin(v, 1, 60);
export const odTone = (v: number): number => log(v, 800, 8000);
export const odLevel = (v: number): number => dbToGain(lin(v, -20, 6));

/** Fuzz: clipping factor 20–300 (close to a square wave at the top), tone low-pass 500 Hz–6 kHz (log), level −30…0 dB. */
export const fuzzDrive = (v: number): number => lin(v, 20, 300);
export const fuzzTone = (v: number): number => log(v, 500, 6000);
export const fuzzLevel = (v: number): number => dbToGain(lin(v, -30, 0));

/** EQ: three bands, ±12 dB around noon (low shelf 150 Hz, mid bell 800 Hz, high shelf 3.5 kHz). */
export const eqDb = (v: number): number => lin(v, -12, 12);
export const EQ_BANDS = { low: 150, mid: 800, high: 3500 } as const;

/** Chorus: rate 0.1–5 Hz (log), depth 0–6 ms of modulation around a 12 ms delay, mix 0–1. */
export const chorusRate = (v: number): number => log(v, 0.1, 5);
export const chorusDepth = (v: number): number => lin(v, 0, 0.006);
export const CHORUS_BASE_DELAY = 0.012;

/** Delay: 60–1000 ms, feedback 0–0.85 (never runaway), mix 0–1. */
export const delayTime = (v: number): number => lin(v, 0.06, 1);
export const delayFeedback = (v: number): number => lin(v, 0, 0.85);

/** Reverb: decay 0.5–5 s. */
export const reverbDecay = (v: number): number => lin(v, 0.5, 5);

export const mix01 = (v: number): number => lin(v, 0, 1);

/* ---------------- curves and impulse responses ---------------- */

/**
 * Soft clipper for a WaveShaperNode: tanh(k·x) normalised to ±1. Odd,
 * monotonic and bounded, so any drive keeps the level in range.
 */
export function softClipCurve(drive: number, points = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  const k = Math.max(1, drive);
  const norm = Math.tanh(k);
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = Math.tanh(k * x) / norm;
  }
  return curve;
}

/**
 * Fuzz clipper: a hard, asymmetric clip. The positive half saturates at +1,
 * the negative half at −0.75, like a mis-biased transistor stage: the
 * asymmetry adds even harmonics, the hard knee the buzz. Monotonic and
 * bounded, and zero stays zero (no DC step when the pedal switches in).
 */
export const FUZZ_FLOOR = -0.75;
export function fuzzCurve(drive: number, points = 2048): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(points);
  const k = Math.max(1, drive);
  for (let i = 0; i < points; i += 1) {
    const x = (i / (points - 1)) * 2 - 1;
    curve[i] = x >= 0 ? 1 - Math.exp(-k * x) : FUZZ_FLOOR * (1 - Math.exp(k * x));
  }
  return curve;
}

/** Small deterministic PRNG (mulberry32): the same impulse response on every load. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One-pole low-pass and high-pass in place (simple, stable, enough to shape a short IR). */
function onePole(data: Float32Array, sampleRate: number, cutoff: number, highpass: boolean): void {
  const a = Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let low = 0;
  for (let i = 0; i < data.length; i += 1) {
    const x = data[i] ?? 0;
    low = (1 - a) * x + a * low;
    data[i] = highpass ? x - low : low;
  }
}

function normalise<T extends Float32Array>(data: T): T {
  let energy = 0;
  for (const v of data) energy += v * v;
  const k = energy > 0 ? 1 / Math.sqrt(energy) : 0;
  for (let i = 0; i < data.length; i += 1) data[i] = (data[i] ?? 0) * k;
  return data;
}

/**
 * A synthesised guitar cabinet: a short decaying burst band-limited like a
 * speaker (1x12 brighter and lighter, 4x12 darker and fuller). Unit energy,
 * so switching cabinet does not jump in level. Not a measured cabinet.
 */
export function cabinetImpulse(model: '1x12' | '4x12', sampleRate: number): Float32Array<ArrayBuffer> {
  const seconds = model === '4x12' ? 0.04 : 0.028;
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const random = rng(model === '4x12' ? 412 : 112);
  const data = new Float32Array(n);
  const tau = (model === '4x12' ? 0.006 : 0.004) * sampleRate;
  for (let i = 0; i < n; i += 1) data[i] = (random() * 2 - 1) * Math.exp(-i / tau);
  data[0] = (data[0] ?? 0) + 1;
  const low = model === '4x12' ? 3600 : 5200;
  onePole(data, sampleRate, low, false);
  onePole(data, sampleRate, low, false);
  onePole(data, sampleRate, model === '4x12' ? 70 : 100, true);
  return normalise(data);
}

/** A stereo room tail: decaying noise, -60 dB at `decay` seconds, slightly darker as it fades. */
export function reverbImpulse(decay: number, sampleRate: number): [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] {
  const n = Math.max(1, Math.round(decay * sampleRate));
  const channels: [Float32Array<ArrayBuffer>, Float32Array<ArrayBuffer>] = [new Float32Array(n), new Float32Array(n)];
  channels.forEach((data, c) => {
    const random = rng(7 + c);
    for (let i = 0; i < n; i += 1) data[i] = (random() * 2 - 1) * 10 ** ((-3 * i) / n);
    onePole(data, sampleRate, 6000, false);
    // Unit energy per channel keeps the wet level independent of the decay.
    normalise(data);
    for (let i = 0; i < n; i += 1) data[i] = (data[i] ?? 0) * 0.5;
  });
  return channels;
}

/** Energy of a signal above `cutoff` Hz relative to the total (a naive DFT, for tests and checks). */
export function highBandShare(data: Float32Array, sampleRate: number, cutoff: number): number {
  const n = Math.min(data.length, 1024);
  let high = 0;
  let total = 0;
  for (let k = 1; k < n / 2; k += 1) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i += 1) {
      const angle = (-2 * Math.PI * k * i) / n;
      re += (data[i] ?? 0) * Math.cos(angle);
      im += (data[i] ?? 0) * Math.sin(angle);
    }
    const power = re * re + im * im;
    total += power;
    if ((k * sampleRate) / n >= cutoff) high += power;
  }
  return total > 0 ? high / total : 0;
}

/* ---------------- sound presets ---------------- */

export interface RigPreset {
  readonly id: string;
  readonly name: string;
  readonly rig: RigSettings;
}

type AmpKnobs = Readonly<Record<AmpKnob, number>>;
function sound(id: string, name: string, amp: AmpKnobs, cab: '1x12' | '4x12', pedals: Partial<Record<PedalId, Readonly<Record<string, number>>>>): RigPreset {
  return {
    id, name,
    rig: {
      chain: defaultChain(),
      amp: { model: 'internal', power: true, bypass: false, knobs: amp, namCab: false },
      cab: { on: true, model: cab, fileName: '' },
      pedals: Object.fromEntries(PEDALS.map((p) => [p, { on: p in pedals, knobs: { ...DEFAULT_RIG.pedals[p].knobs, ...pedals[p] } }])) as Record<PedalId, PedalState>,
    },
  };
}

/**
 * Starting sounds for the internal DSP rig, named for what they are for. They
 * are settings of this rig, not models of any maker's amplifier.
 */
export const RIG_PRESETS: readonly RigPreset[] = [
  sound('blues-clean', 'Pulito blues', { gain: 28, bass: 55, mid: 45, treble: 62, presence: 55, out: 68 }, '1x12', { comp: { sustain: 35, level: 30 }, reverb: { decay: 30, mix: 22 } }),
  sound('jazz-clean', 'Pulito jazz con chorus leggero', { gain: 18, bass: 60, mid: 55, treble: 38, presence: 30, out: 70 }, '1x12', { chorus: { rate: 25, depth: 30, mix: 25 }, reverb: { decay: 25, mix: 15 } }),
  sound('rock', 'Distorsione rock', { gain: 72, bass: 58, mid: 55, treble: 60, presence: 55, out: 58 }, '4x12', { drive: { drive: 40, tone: 55, level: 55 } }),
  sound('fusion', 'Distorsione fusion', { gain: 62, bass: 48, mid: 70, treble: 52, presence: 45, out: 60 }, '4x12', { comp: { sustain: 55, level: 35 }, drive: { drive: 55, tone: 48, level: 52 }, delay: { time: 38, feedback: 25, mix: 18 }, reverb: { decay: 35, mix: 15 } }),
  sound('punk', 'Distorsione punk', { gain: 85, bass: 50, mid: 40, treble: 70, presence: 68, out: 55 }, '4x12', {}),
  sound('fuzz', 'Fuzz', { gain: 40, bass: 55, mid: 50, treble: 50, presence: 40, out: 58 }, '4x12', { fuzz: { fuzz: 75, tone: 45, level: 38 } }),
  sound('ambient', 'Ambient con delay', { gain: 22, bass: 50, mid: 50, treble: 58, presence: 50, out: 66 }, '1x12', { comp: { sustain: 45, level: 30 }, chorus: { rate: 20, depth: 40, mix: 30 }, delay: { time: 55, feedback: 55, mix: 45 }, reverb: { decay: 75, mix: 45 } }),
];

/** The preset whose settings the rig has right now (a user file cabinet never matches), or null once anything was moved. */
export function matchingRigPreset(rig: RigSettings): RigPreset | null {
  const key = JSON.stringify(sanitizeRig(rig));
  return RIG_PRESETS.find((p) => JSON.stringify(sanitizeRig(p.rig)) === key) ?? null;
}
