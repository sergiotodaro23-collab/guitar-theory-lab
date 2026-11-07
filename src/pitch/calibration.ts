/**
 * Live Monitor calibration (P3-12, D-31): turn short recordings into input
 * settings, and keep them as a profile per guitar, pickup, interface and
 * channel. Every value says whether it was measured or set by hand. A
 * monophonic signal never tells the string or the fret for certain: no value
 * here promises that. Pure: numbers in, numbers out.
 */
import type { Sensitivity } from './sensitivity';

export type ProfileChannel = 'mix' | 'left' | 'right';

export interface LiveProfile {
  readonly id: string;
  readonly name: string;
  readonly guitar: string;
  readonly pickup: string;
  readonly device: string;
  readonly channel: ProfileChannel;
  readonly inputGain: number;
  /** Background noise RMS, and the level under which a frame is silence. */
  readonly noiseRms: number;
  readonly minRms: number;
  /** Readings under this confidence are not shown. */
  readonly minConfidence: number;
  readonly sensitivity: Sensitivity;
  /** Round trip from a sound to its detection, to compensate timing feedback. */
  readonly latencyMs: number;
  /** What came from a measurement; the rest was set by hand or is the default. */
  readonly measured: { readonly noise: boolean; readonly notes: boolean; readonly response: boolean; readonly latency: boolean };
}

export const DEFAULT_PROFILE: Omit<LiveProfile, 'id' | 'name'> = {
  guitar: '', pickup: '', device: '', channel: 'mix', inputGain: 1, noiseRms: 0, minRms: 0.01, minConfidence: 0.8,
  sensitivity: 'balanced', latencyMs: 0, measured: { noise: false, notes: false, response: false, latency: false },
};

export const MAX_PROFILES = 10;

const median = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
};
const percentile = (values: readonly number[], p: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))] as number;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, step: number) => Math.round(v / step) * step;

/** Step 1, silence: the noise floor, and a silence gate three times above it. */
export function measureNoise(levels: readonly number[]): { readonly noiseRms: number; readonly minRms: number } {
  const noiseRms = median(levels);
  return { noiseRms, minRms: clamp(noiseRms * 3, 0.004, 0.05) };
}

/**
 * Step 2, held notes: the typical level and confidence. The gain brings the
 * level near 0.2 RMS (headroom for picking hard); the confidence gate sits a
 * little under what a clean held note reaches most of the time.
 */
export function measureNotes(readings: readonly { readonly rms: number; readonly confidence: number }[]): {
  readonly level: number; readonly confidence: number; readonly gainFactor: number; readonly minConfidence: number;
} | null {
  if (readings.length < 5) return null;
  const level = median(readings.map((r) => r.rms));
  const confidence = percentile(readings.map((r) => r.confidence), 0.1);
  return {
    level,
    confidence,
    gainFactor: level > 0 ? clamp(round(0.2 / level, 0.05), 0.25, 8) : 1,
    minConfidence: clamp(round(confidence - 0.05, 0.01), 0.6, 0.9),
  };
}

/**
 * Onsets in a recording: 5 ms energy frames, an onset where the energy jumps
 * to four times the quietest of the last 50 ms and above the silence gate.
 */
export function detectOnsets(samples: Float32Array, sampleRate: number, minRms = 0.01): readonly number[] {
  const hop = Math.max(1, Math.round(sampleRate * 0.005));
  const energies: number[] = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let sum = 0;
    for (let k = i; k < i + hop; k += 1) sum += (samples[k] ?? 0) ** 2;
    energies.push(Math.sqrt(sum / hop));
  }
  const onsets: number[] = [];
  let lastOnset = -Infinity;
  for (let i = 1; i < energies.length; i += 1) {
    const e = energies[i] as number;
    const floor = Math.min(...energies.slice(Math.max(0, i - 10), i));
    const t = (i * hop) / sampleRate;
    if (e > minRms && e >= 4 * Math.max(floor, 1e-5) && t - lastOnset > 0.08) {
      onsets.push(t);
      lastOnset = t;
    }
  }
  return onsets;
}

/** Step 3, a short passage: Fast if it hears clearly more notes than Balanced on the same take. */
export function suggestSensitivity(balancedNotes: number, fastNotes: number): Sensitivity {
  return fastNotes >= Math.max(balancedNotes + 2, balancedNotes * 1.3) ? 'fast' : 'balanced';
}

/**
 * Step 4, latency: the player (or a cable from output to input) answers
 * clicks played at known times; the median delay of the onsets that follow
 * each click within 400 ms. Null with fewer than three answers.
 */
export function measureLatency(clickTimes: readonly number[], onsetTimes: readonly number[]): number | null {
  const deltas = clickTimes.flatMap((click) => {
    const onset = onsetTimes.find((t) => t >= click && t - click <= 0.4);
    return onset === undefined ? [] : [onset - click];
  });
  return deltas.length >= 3 ? Math.round(median(deltas) * 1000) : null;
}

const text = (v: unknown, max = 40) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback);

export function sanitizeProfiles(raw: unknown): readonly LiveProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_PROFILES).flatMap((item): LiveProfile[] => {
    if (typeof item !== 'object' || item === null) return [];
    const r = item as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string' || r.name.trim() === '') return [];
    const m = (typeof r.measured === 'object' && r.measured !== null ? r.measured : {}) as Record<string, unknown>;
    const d = DEFAULT_PROFILE;
    return [{
      id: r.id.slice(0, 40), name: text(r.name), guitar: text(r.guitar), pickup: text(r.pickup), device: text(r.device, 80),
      channel: r.channel === 'left' || r.channel === 'right' ? r.channel : 'mix',
      inputGain: num(r.inputGain, 0, 4, d.inputGain), noiseRms: num(r.noiseRms, 0, 1, d.noiseRms), minRms: num(r.minRms, 0.004, 0.05, d.minRms),
      minConfidence: num(r.minConfidence, 0.5, 0.95, d.minConfidence),
      sensitivity: r.sensitivity === 'precise' || r.sensitivity === 'fast' ? r.sensitivity : 'balanced',
      latencyMs: num(r.latencyMs, 0, 500, d.latencyMs),
      measured: { noise: m.noise === true, notes: m.notes === true, response: m.response === true, latency: m.latency === true },
    }];
  });
}
