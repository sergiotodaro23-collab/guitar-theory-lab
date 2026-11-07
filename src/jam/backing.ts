/**
 * Local backing tracks (P3-09, D-34): an audio file of the user's, played
 * in time with the jam. The file never leaves the browser. The math is here:
 * where in the file a tick of the timeline falls, and the loop that matches
 * the progression or the arrangement. Pure.
 */
import { ticksPerBeat, type Meter } from '../timeline';

export interface BackingSettings {
  readonly on: boolean;
  /** File name, for the panel; the audio itself lives in the browser's storage. */
  readonly name: string;
  /** The track's tempo: the jam plays at this BPM while the backing is on. */
  readonly bpm: number;
  /** Seconds into the file where bar 1 of the progression starts. */
  readonly offset: number;
  /** Loop the stretch of the file that matches the progression (or the song). */
  readonly loop: boolean;
  readonly volume: number;
}

export const DEFAULT_BACKING: BackingSettings = { on: false, name: '', bpm: 120, offset: 0, loop: true, volume: 0.8 };

/** Seconds of music from tick 0 to `tick`, at a steady tempo. */
export const secondsAt = (tick: number, bpm: number, meter: Meter): number => (tick / ticksPerBeat(meter)) * (60 / bpm);

/** Where to start reading the file when the transport starts at `tick`. */
export function fileOffsetAt(b: BackingSettings, tick: number, meter: Meter, loopTicks: number | null): number {
  const local = b.loop && loopTicks && loopTicks > 0 ? tick % loopTicks : tick;
  return Math.max(0, b.offset + secondsAt(local, b.bpm, meter));
}

/** The looped stretch of the file: from bar 1 for as long as the progression (or song) lasts. */
export function loopRegion(b: BackingSettings, loopTicks: number, meter: Meter): { readonly start: number; readonly end: number } {
  return { start: b.offset, end: b.offset + secondsAt(loopTicks, b.bpm, meter) };
}

/** Tap tempo over the track: the median gap of the last taps, as BPM. */
export function bpmFromTaps(times: readonly number[]): number | null {
  if (times.length < 3) return null;
  const gaps = times.slice(1).map((t, i) => t - (times[i] ?? 0)).filter((g) => g > 0.15 && g < 2).sort((a, b) => a - b);
  const gap = gaps[Math.floor(gaps.length / 2)];
  return gap ? Math.round(600 / gap) / 10 : null;
}

export function sanitizeBacking(raw: unknown): BackingSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_BACKING;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    on: r.on === true,
    name: typeof r.name === 'string' ? r.name.slice(0, 120) : '',
    bpm: num(r.bpm, 30, 300, DEFAULT_BACKING.bpm),
    offset: num(r.offset, 0, 600, 0),
    loop: r.loop !== false,
    volume: num(r.volume, 0, 1, DEFAULT_BACKING.volume),
  };
}
