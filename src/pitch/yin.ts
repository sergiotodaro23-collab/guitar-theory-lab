/**
 * Monophonic pitch detection with YIN (de Cheveigné & Kawahara, 2002): the
 * cumulative mean normalised difference function, an absolute threshold and
 * parabolic interpolation. Pure: a frame of samples in, a pitch out. It gives
 * a frequency, not a string and fret; see positions.ts for that question.
 */

export interface PitchReading {
  /** Hz. */
  readonly frequency: number;
  /** 0–1: how periodic the frame is (1 − the YIN dip). */
  readonly confidence: number;
  /** Root mean square level of the frame, 0–1. */
  readonly rms: number;
}

export interface YinOptions {
  readonly minFrequency?: number;
  readonly maxFrequency?: number;
  /** Dip below which a lag counts as a period. 0.1–0.2 is typical. */
  readonly threshold?: number;
  /** Frames quieter than this are silence, not pitch. */
  readonly minRms?: number;
}

/** Guitar range with margin: drop tunings below low E (82 Hz) up to past fret 24 on the high E (1319 Hz). */
export const GUITAR_MIN_HZ = 60;
export const GUITAR_MAX_HZ = 1500;

export function rmsOf(frame: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 1) sum += (frame[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, frame.length));
}

export function detectPitch(frame: Float32Array, sampleRate: number, options: YinOptions = {}): PitchReading | null {
  const { minFrequency = GUITAR_MIN_HZ, maxFrequency = GUITAR_MAX_HZ, threshold = 0.15, minRms = 0.01 } = options;
  const rms = rmsOf(frame);
  if (rms < minRms) return null;
  const maxLag = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(frame.length / 2));
  const minLag = Math.max(2, Math.floor(sampleRate / maxFrequency));
  const window = frame.length - maxLag;
  if (maxLag <= minLag || window <= 0) return null;

  // Difference function d(τ) and its cumulative mean normalisation d'(τ).
  const cmnd = new Float32Array(maxLag + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < window; i += 1) {
      const delta = (frame[i] ?? 0) - (frame[i + lag] ?? 0);
      sum += delta * delta;
    }
    running += sum;
    cmnd[lag] = running > 0 ? (sum * lag) / running : 1;
  }

  // First dip under the threshold, followed down to its local minimum.
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if ((cmnd[lag] ?? 1) < threshold) {
      while (lag + 1 <= maxLag && (cmnd[lag + 1] ?? 1) < (cmnd[lag] ?? 1)) lag += 1;
      best = lag;
      break;
    }
  }
  if (best < 0) return null;

  // Parabolic interpolation around the minimum for sub-sample precision.
  const a = cmnd[best - 1] ?? cmnd[best] ?? 1;
  const b = cmnd[best] ?? 1;
  const c = cmnd[best + 1] ?? b;
  const denominator = a - 2 * b + c;
  const shift = denominator !== 0 ? (a - c) / (2 * denominator) : 0;
  const period = best + Math.max(-1, Math.min(1, shift));
  const frequency = sampleRate / period;
  if (frequency < minFrequency || frequency > maxFrequency) return null;
  return { frequency, confidence: Math.max(0, Math.min(1, 1 - b)), rms };
}
