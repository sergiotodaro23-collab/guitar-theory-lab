/**
 * Live Monitor 2.0, where the hand is (P3-10, D-31). A pitch has several
 * places on the neck; which one is played is a guess. Three kinds of
 * evidence, never certainty:
 * - continuity: the hand stays where the last notes were (strongest);
 * - the shape on the board: a weak hint, a weight and never a filter;
 * - nothing else: a note with no recent context gets no full position.
 * Pure: positions and times in, probabilities out.
 */
import type { FretPosition } from '../fretboard';
import { positionsOf } from './positions';

export interface PlaceEstimate {
  readonly position: FretPosition;
  /** 0–1, summing to 1 over the candidates. */
  readonly probability: number;
}

export interface HandEstimate {
  readonly all: readonly PlaceEstimate[];
  /** The place shown as estimated, or null when no place is likely enough. */
  readonly likely: FretPosition | null;
  readonly reason: 'hand' | 'shape' | null;
}

export interface HandOptions {
  /** A place must reach this probability to be shown as the estimate. */
  readonly threshold: number;
  /** Bonus of a place inside the board's shape, in log-odds: a hint, not a rule. */
  readonly shapeWeight: number;
  /** How quickly a far place loses likelihood, in frets. */
  readonly reach: number;
  /** After this long without notes the hand is free again: no context. */
  readonly forgetSeconds: number;
  /** Cost of each string away from the previous note, in log-odds: lines move string by string. */
  readonly stringWeight: number;
}

export const HAND_DEFAULTS: HandOptions = { threshold: 0.6, shapeWeight: 0.8, reach: 2.5, forgetSeconds: 2.5, stringWeight: 0.3 };

const key = (p: FretPosition) => `${p.string}:${p.fret}`;

export class HandEstimator {
  private recent: { position: FretPosition; time: number; weight: number }[] = [];
  private lastMidi: number | null = null;

  constructor(private readonly options: HandOptions = HAND_DEFAULTS) {}

  /** Where the hand is: a weighted mean fret of the last notes, newest heaviest. */
  center(now: number): number | null {
    this.forget(now);
    if (this.recent.length === 0) return null;
    let sum = 0;
    let total = 0;
    this.recent.forEach((r, i) => {
      const w = r.weight * (i + 1);
      sum += r.position.fret * w;
      total += w;
    });
    return total > 0 ? sum / total : null;
  }

  /**
   * One detected note (call it once per new note, not per frame). `shape` is
   * what the board shows; it nudges, never decides.
   */
  estimate(midi: number, now: number, shape: readonly FretPosition[] = [], tuning?: readonly number[]): HandEstimate {
    const candidates = positionsOf(midi, tuning);
    const center = this.center(now);
    const previous = center !== null ? this.recent.at(-1)?.position ?? null : null;
    const inShape = new Set(shape.map(key));
    const scores = candidates.map((p) => {
      let score = inShape.has(key(p)) ? this.options.shapeWeight : 0;
      if (center !== null) {
        // Inside the hand's span nothing is lost; beyond it, a Gaussian fall-off.
        const beyond = Math.max(0, Math.abs(p.fret - center) - 1.5);
        score -= (beyond * beyond) / (2 * this.options.reach * this.options.reach);
      }
      if (previous) score -= this.options.stringWeight * Math.abs(p.string - previous.string);
      return score;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const all = candidates.map((position, i) => ({ position, probability: (exps[i] ?? 0) / sum }));
    const best = all.reduce<PlaceEstimate | null>((b, e) => (!b || e.probability > b.probability ? e : b), null);
    // One place on the neck is a fact. Otherwise, with no recent notes, whatever the shape says,
    // a single note has no hand to follow.
    const only = candidates.length === 1;
    const confident = best !== null && (only || (center !== null && best.probability >= this.options.threshold));
    // Remember where the hand probably is: the sure place, or the probability-weighted fret of a guess.
    if (best) {
      const expected = all.reduce((f, e) => f + e.position.fret * e.probability, 0);
      this.remember(confident ? best.position : { string: best.position.string, fret: expected }, now, confident ? 1 : 0.4);
    }
    this.lastMidi = midi;
    return {
      all,
      likely: confident && best ? best.position : null,
      reason: confident && best ? (inShape.has(key(best.position)) ? 'shape' : 'hand') : null,
    };
  }

  /** The last note's pitch, to tell a new note from the same one held. */
  get previousMidi(): number | null {
    return this.lastMidi;
  }

  reset(): void {
    this.recent = [];
    this.lastMidi = null;
  }

  private remember(position: FretPosition, time: number, weight: number): void {
    // A sure note far from where the hand was means the hand moved: the old notes no longer say where it is.
    const center = this.center(time);
    if (weight >= 1 && center !== null && Math.abs(position.fret - center) > 5) this.recent = [];
    this.recent.push({ position, time, weight });
    if (this.recent.length > 4) this.recent.shift();
  }

  private forget(now: number): void {
    const last = this.recent.at(-1);
    if (last && now - last.time > this.options.forgetSeconds) this.recent = [];
  }
}
