/**
 * Steadies the raw readings: a median over the last frames, confidence
 * gating and a stability flag. Pure state machine fed one reading per frame.
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

export const MIN_CONFIDENCE = 0.8;
const HISTORY = 5;

export class PitchTracker {
  private recent: PitchReading[] = [];

  /** Feed a frame's reading (null for silence or no pitch); returns what to show, or null. */
  push(reading: PitchReading | null): TrackedPitch | null {
    if (!reading || reading.confidence < MIN_CONFIDENCE) {
      this.recent = [];
      return null;
    }
    // A jump of more than a semitone is a new note: start over.
    const last = this.recent.at(-1);
    if (last && Math.abs(frequencyToMidi(reading.frequency) - frequencyToMidi(last.frequency)) > 1) this.recent = [];
    this.recent.push(reading);
    if (this.recent.length > HISTORY) this.recent.shift();
    const sorted = [...this.recent].sort((a, b) => a.frequency - b.frequency);
    const median = sorted[Math.floor(sorted.length / 2)] as PitchReading;
    const spread = sorted.length > 1
      ? 1200 * Math.log2((sorted.at(-1) as PitchReading).frequency / (sorted[0] as PitchReading).frequency)
      : Infinity;
    return { frequency: median.frequency, confidence: reading.confidence, rms: reading.rms, stable: this.recent.length >= 3 && spread <= 16 };
  }

  reset(): void {
    this.recent = [];
  }
}
