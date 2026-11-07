/**
 * Live Monitor sensitivity (P3-11, D-31): three documented trade-offs
 * between steadiness and speed, and an offline analyser that runs the same
 * chain (frames → YIN → tracker → notes) over a buffer, so the modes can be
 * measured on synthetic signals. Pure: no DOM, no audio.
 */
import { frequencyToMidi } from './notes';
import { PitchTracker, type TrackerOptions } from './tracker';
import { detectPitch } from './yin';

export type Sensitivity = 'precise' | 'balanced' | 'fast';
export const SENSITIVITIES: readonly Sensitivity[] = ['precise', 'balanced', 'fast'];

export interface SensitivityParams {
  readonly label: string;
  readonly help: string;
  /** Samples analysed per frame (the most recent ones). */
  readonly frame: number;
  /** Milliseconds between frames. */
  readonly hopMs: number;
  /** YIN dip threshold: higher accepts noisier periods. */
  readonly yinThreshold: number;
  readonly tracker: TrackerOptions;
}

/**
 * Frames under 1536 samples at 48 kHz cannot hold two periods of the low E
 * (82 Hz), so even Fast keeps 1536. Precise doubles the frame and the median.
 */
export const SENSITIVITY: Readonly<Record<Sensitivity, SensitivityParams>> = {
  precise: {
    label: 'Precisa', help: 'Note tenute e accordatura: frame lunghi, mediana ampia, soglia alta. Ignora i passaggi veloci.',
    frame: 4096, hopMs: 40, yinThreshold: 0.12,
    tracker: { history: 7, minConfidence: 0.86, stableFrames: 4, onsetRatio: 0, holdFrames: 1, stableCents: 45 },
  },
  balanced: {
    label: 'Bilanciata', help: 'Il compromesso di partenza: una nota ferma si legge in 120–200 ms.',
    frame: 2048, hopMs: 40, yinThreshold: 0.15,
    tracker: { history: 5, minConfidence: 0.8, stableFrames: 3, onsetRatio: 0, holdFrames: 0, stableCents: 16 },
  },
  fast: {
    label: 'Rapida', help: 'Legati, hammer-on, pull-off: frame corti, attacchi riconosciuti, mediana breve. Più sensibile ai rumori.',
    frame: 1536, hopMs: 15, yinThreshold: 0.18,
    tracker: { history: 3, minConfidence: 0.72, stableFrames: 2, onsetRatio: 1.5, holdFrames: 1, stableCents: 40 },
  },
};

export interface DetectedNote {
  /** Seconds from the start of the buffer, at the frame where the note became stable. */
  readonly time: number;
  readonly midi: number;
}

/**
 * Notes as the Live Monitor would report them: a new note each time the
 * stable pitch changes to another semitone, or the tracker restarts on an attack.
 */
export function analyseOffline(samples: Float32Array, sampleRate: number, mode: Sensitivity, minRms = 0.01): readonly DetectedNote[] {
  const p = SENSITIVITY[mode];
  const tracker = new PitchTracker(p.tracker);
  const hop = Math.max(1, Math.round((p.hopMs / 1000) * sampleRate));
  const notes: DetectedNote[] = [];
  let current: number | null = null;
  let wasStable = false;
  for (let end = p.frame; end <= samples.length; end += hop) {
    const frame = samples.subarray(end - p.frame, end);
    const reading = detectPitch(frame, sampleRate, { threshold: p.yinThreshold, minRms });
    const tracked = tracker.push(reading);
    if (!tracked) {
      current = null;
      wasStable = false;
      continue;
    }
    const midi = Math.round(frequencyToMidi(tracked.frequency));
    // A restart of the median (new attack) shows up as a stable reading after an unstable one.
    const restarted = tracked.stable && !wasStable;
    if (tracked.stable && (midi !== current || restarted)) {
      if (midi !== current || restarted) notes.push({ time: end / sampleRate, midi });
      current = midi;
    }
    wasStable = tracked.stable;
  }
  return notes;
}
