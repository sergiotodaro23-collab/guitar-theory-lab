/**
 * Steadies the raw readings: a median over the last frames, confidence
 * gating, onset handling and a stability flag. Pure state machine fed one
 * reading per frame; its settings come from the sensitivity mode (D-31).
 */
import { frequencyToMidi } from './notes';
import type { PitchReading } from './yin';

export interface TrackedPitch {
  readonly frequency: number;
  readonly confidence: number;
  readonly rms: number;
  /** The last frames agree within ±8 cents. */
  readonly stable: boolean;
}

/** Balanced mode's gate, kept as the reference value shown in the panel. */
export const MIN_CONFIDENCE = 0.8;

export interface TrackerOptions {
  /** Frames in the median. */
  readonly history: number;
  readonly minConfidence: number;
  /** Frames that must agree before a note counts as stable. */
  readonly stableFrames: number;
  /** A level jump (ratio of RMS to the previous frame) that marks a new attack, even on the same pitch. 0 disables. */
  readonly onsetRatio: number;
  /** Frames of silence or doubt tolerated inside a note before it ends (bridges a weak frame). */
  readonly holdFrames: number;
  /** Largest spread, in cents, of the frames in the median for the note to count as stable (vibrato room). */
  readonly stableCents: number;
}

/** The level a frame without a reading stands for: at the edge of YIN's silence gate. */
const SILENCE_RMS = 0.01;

export const BALANCED_TRACKER: TrackerOptions = { history: 5, minConfidence: MIN_CONFIDENCE, stableFrames: 3, onsetRatio: 0, holdFrames: 0, stableCents: 16 };

export class PitchTracker {
  private recent: PitchReading[] = [];
  private lastRms = 0;
  private misses = 0;

  constructor(private options: TrackerOptions = BALANCED_TRACKER) {}

  configure(options: TrackerOptions): void {
    this.options = options;
    this.reset();
  }

  /** Feed a frame's reading (null for silence or no pitch); returns what to show, or null. */
  push(reading: PitchReading | null): TrackedPitch | null {
    const o = this.options;
    if (!reading || reading.confidence < o.minConfidence) {
      // Silence (no reading) counts as the quietest level, so the next attack stands out against it.
      this.lastRms = reading?.rms ?? SILENCE_RMS;
      this.misses += 1;
      if (this.misses > o.holdFrames) this.recent = [];
      return this.misses > o.holdFrames || this.recent.length === 0 ? null : this.current(reading?.rms ?? 0);
    }
    this.misses = 0;
    // A jump of more than a semitone is a new note; so is a fresh attack on the same pitch.
    const last = this.recent.at(-1);
    const attack = o.onsetRatio > 0 && this.lastRms > 0 && reading.rms / this.lastRms >= o.onsetRatio;
    if ((last && Math.abs(frequencyToMidi(reading.frequency) - frequencyToMidi(last.frequency)) > 1) || attack) this.recent = [];
    this.lastRms = reading.rms;
    this.recent.push(reading);
    if (this.recent.length > o.history) this.recent.shift();
    return this.current(reading.rms, reading.confidence);
  }

  private current(rms: number, confidence?: number): TrackedPitch {
    const sorted = [...this.recent].sort((a, b) => a.frequency - b.frequency);
    const median = sorted[Math.floor(sorted.length / 2)] as PitchReading;
    const spread = sorted.length > 1
      ? 1200 * Math.log2((sorted.at(-1) as PitchReading).frequency / (sorted[0] as PitchReading).frequency)
      : Infinity;
    return {
      frequency: median.frequency,
      confidence: confidence ?? median.confidence,
      rms,
      stable: this.recent.length >= this.options.stableFrames && (this.options.stableFrames <= 1 || spread <= this.options.stableCents),
    };
  }

  reset(): void {
    this.recent = [];
    this.lastRms = 0;
    this.misses = 0;
  }
}
