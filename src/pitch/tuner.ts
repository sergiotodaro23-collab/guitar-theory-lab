/** Tuner: configured tunings and the string a pitch is closest to. Pure. */
import { centsBetween, midiToFrequency } from './notes';

export interface Tuning {
  readonly id: string;
  readonly name: string;
  /** Open strings, low to high, MIDI. */
  readonly strings: readonly number[];
}

export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard (E A D G B E)', strings: [40, 45, 50, 55, 59, 64] },
  { id: 'half-down', name: 'Mezzo tono sotto (Eb Ab Db Gb Bb Eb)', strings: [39, 44, 49, 54, 58, 63] },
  { id: 'drop-d', name: 'Drop D (D A D G B E)', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'open-g', name: 'Open G (D G D G B D)', strings: [38, 43, 50, 55, 59, 62] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
];

export const STRING_NAMES = ['6ª', '5ª', '4ª', '3ª', '2ª', '1ª'];

export interface StringTarget {
  /** 0 = sixth (lowest) string. */
  readonly string: number;
  readonly midi: number;
  readonly frequency: number;
  readonly cents: number;
}

/** The open string nearest to the heard pitch, and how far off it is. */
export function nearestString(frequency: number, tuning: Tuning, a4: number): StringTarget | null {
  let best: StringTarget | null = null;
  tuning.strings.forEach((midi, string) => {
    const target = midiToFrequency(midi, a4);
    const cents = centsBetween(frequency, target);
    if (!best || Math.abs(cents) < Math.abs(best.cents)) best = { string, midi, frequency: target, cents };
  });
  return best;
}

/** In tune within ±5 cents, the usual tolerance for a guitar tuner. */
export const IN_TUNE_CENTS = 5;

export interface TunerReading {
  /** 'string' when an open string of the tuning is within a semitone; else chromatic. */
  readonly mode: 'string' | 'chromatic';
  readonly string: number | null;
  /** The note the needle refers to: the open string, or the nearest equal-tempered note. */
  readonly midi: number;
  readonly cents: number;
}

/**
 * What the tuner shows. Near an open string (within ±100 cents) it tunes that
 * string; elsewhere a "−200 cents from B" would mislead, so it reads the
 * heard note chromatically.
 */
export function tunerReading(frequency: number, tuning: Tuning, a4: number): TunerReading {
  const target = nearestString(frequency, tuning, a4);
  if (target && Math.abs(target.cents) <= 100) return { mode: 'string', string: target.string, midi: target.midi, cents: target.cents };
  const exact = 69 + 12 * Math.log2(frequency / a4);
  const midi = Math.round(exact);
  return { mode: 'chromatic', string: null, midi, cents: (exact - midi) * 100 };
}
