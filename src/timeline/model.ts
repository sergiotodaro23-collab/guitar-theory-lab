/**
 * Shared musical timeline: the single time model used by the metronome, the
 * exercises, Harmonic Context Switch and the jam. Everything here is pure.
 *
 * Time is counted in ticks from the moment playback started. Ticks never loop:
 * each track wraps on its own, so an 8-note exercise can run over a 12-bar
 * progression and both stay on the same grid.
 */
export const PPQ = 480;

export interface Meter {
  readonly beatsPerBar: number;
  /** Note value of a beat: 4 quarter, 8 eighth. BPM counts this value. */
  readonly beatUnit: 4 | 8;
}

/** Clicks or notes per beat. */
export type Subdivision = 1 | 2 | 3 | 4;

/** A stretch of the timeline in one meter, from `tick` (a bar line) onward. */
export interface MeterSegment {
  readonly tick: number;
  /** Bar number at `tick`, so bars keep counting across a change. */
  readonly bar: number;
  readonly meter: Meter;
}

export interface TimeConfig {
  /** The meter in force now, i.e. of the last segment. */
  readonly meter: Meter;
  readonly subdivision: Subdivision;
  /** 0 is straight; 0.33 approximates triplet swing on the eighth. */
  readonly swing: number;
  /**
   * Meter changes during playback, oldest first. Absent means `meter` from
   * tick 0. Ticks never restart, so audio already scheduled stays valid.
   */
  readonly segments?: readonly MeterSegment[];
}

export const ticksPerBeat = (meter: Meter): number => (PPQ * 4) / meter.beatUnit;
export const ticksPerBar = (meter: Meter): number => ticksPerBeat(meter) * meter.beatsPerBar;

export function meterSegments(config: TimeConfig): readonly MeterSegment[] {
  return config.segments && config.segments.length > 0 ? config.segments : [{ tick: 0, bar: 0, meter: config.meter }];
}

/** The segment a tick falls in; ticks before the first segment use the first. */
export function segmentAt(config: TimeConfig, tick: number): MeterSegment {
  const segments = meterSegments(config);
  let found = segments[0] as MeterSegment;
  for (const segment of segments) {
    if (segment.tick <= tick) found = segment;
    else break;
  }
  return found;
}

function nextSegmentAfter(config: TimeConfig, tick: number): MeterSegment | undefined {
  return meterSegments(config).find((segment) => segment.tick > tick);
}

/** First bar line at or after a tick, in whatever meter is in force there. */
export function nextBarLine(config: TimeConfig, tick: number): number {
  const segment = segmentAt(config, tick);
  const bar = ticksPerBar(segment.meter);
  const line = segment.tick + Math.ceil((tick - segment.tick) / bar) * bar;
  const next = nextSegmentAfter(config, tick);
  return next && next.tick < line ? next.tick : line;
}

/** First beat at or after a tick. */
export function nextBeatLine(config: TimeConfig, tick: number): number {
  const segment = segmentAt(config, tick);
  const beat = ticksPerBeat(segment.meter);
  const line = segment.tick + Math.ceil((tick - segment.tick) / beat) * beat;
  const next = nextSegmentAfter(config, tick);
  return next && next.tick < line ? next.tick : line;
}

/**
 * The same config with a new meter from the next bar line after `tick`. A
 * change not yet reached is replaced, so the last choice wins.
 */
export function withMeterChange(config: TimeConfig, tick: number, meter: Meter): TimeConfig {
  const kept = meterSegments(config).filter((segment) => segment.tick <= tick);
  const base = { ...config, segments: kept, meter: (kept[kept.length - 1] as MeterSegment).meter };
  const origin = nextBarLine(base, tick);
  const current = segmentAt(base, origin);
  if (current.meter.beatsPerBar === meter.beatsPerBar && current.meter.beatUnit === meter.beatUnit) return base;
  const bar = barBeatAt(origin, base).bar;
  const segments = [...kept.filter((segment) => segment.tick < origin), { tick: origin, bar, meter }];
  // Older segments only matter while their audio may still be heard.
  return { ...config, meter, segments: segments.slice(-4) };
}

export interface BarBeat {
  readonly bar: number;
  readonly beat: number;
  readonly subdivision: number;
}

export function barBeatAt(tick: number, config: TimeConfig): BarBeat {
  const segment = segmentAt(config, tick);
  const local = tick - segment.tick;
  const perBeat = ticksPerBeat(segment.meter);
  const beats = Math.floor(local / perBeat);
  const perSub = perBeat / config.subdivision;
  return {
    bar: segment.bar + Math.floor(beats / segment.meter.beatsPerBar),
    beat: beats % segment.meter.beatsPerBar,
    subdivision: Math.floor((local - beats * perBeat) / perSub),
  };
}

/**
 * Swing delays what falls in the second half of each beat. The curve is piecewise
 * linear and monotonic, so note order never changes.
 */
function beatStart(config: TimeConfig, tick: number): { start: number; beat: number } {
  const segment = segmentAt(config, tick);
  const beat = ticksPerBeat(segment.meter);
  return { start: segment.tick + Math.floor((tick - segment.tick) / beat) * beat, beat };
}

export function swingTick(tick: number, config: TimeConfig): number {
  if (config.swing <= 0) return tick;
  const { start, beat } = beatStart(config, tick);
  const t = tick - start;
  const half = beat / 2;
  const swung = t < half ? t * (1 + config.swing) : half * (1 + config.swing) + (t - half) * (1 - config.swing);
  return start + swung;
}

/** Inverse of swingTick: which straight tick is sounding at a swung position. */
export function unswingTick(tick: number, config: TimeConfig): number {
  if (config.swing <= 0) return tick;
  // Segment boundaries are bar lines, where swing moves nothing.
  const { start, beat } = beatStart(config, tick);
  const t = tick - start;
  const half = beat / 2;
  const pivot = half * (1 + config.swing);
  const straight = t < pivot ? t / (1 + config.swing) : half + (t - pivot) / (1 - config.swing);
  return start + straight;
}

export interface NotePayload {
  readonly type: 'note';
  readonly midi: number;
  readonly string: number;
  readonly fret: number;
  readonly durationTicks: number;
  /** Position in the exercise, for the progressive highlight. */
  readonly index: number;
  /** Phase of a multi-phase routine, so the board can show that phase's shape. */
  readonly phase?: number;
}

export interface ChordChangePayload {
  readonly type: 'chord';
  readonly chordIndex: number;
}

export interface CompPayload {
  readonly type: 'comp';
  readonly midis: readonly number[];
  readonly durationTicks: number;
  readonly velocity: number;
}

export type TrackPayload = NotePayload | ChordChangePayload | CompPayload;

export interface TrackEvent<P extends TrackPayload = TrackPayload> {
  /** Offset inside the track. */
  readonly tick: number;
  readonly payload: P;
}

export interface Track<P extends TrackPayload = TrackPayload> {
  readonly id: string;
  readonly lengthTicks: number;
  readonly loop: boolean;
  /** Absolute tick where the first repetition starts. */
  readonly originTick: number;
  /** Sorted by tick. */
  readonly events: readonly TrackEvent<P>[];
}

export interface MetronomeEvent {
  readonly kind: 'bar' | 'beat' | 'subdivision';
  readonly tick: number;
  /** Click index within its bar, from 0 on the downbeat. */
  readonly step: number;
  /** Meter of the bar the click belongs to (the old one until a change's bar line). */
  readonly meter: Meter;
}

export interface ScheduledTrackEvent<P extends TrackPayload = TrackPayload> {
  readonly tick: number;
  readonly trackId: string;
  readonly payload: P;
  readonly repetition: number;
}

export interface LoopBoundary {
  readonly tick: number;
  readonly trackId: string;
  readonly repetition: number;
}

/** Metronome grid events in [from, to). Derived from the meter, never stored. */
export function metronomeInRange(from: number, to: number, config: TimeConfig): readonly MetronomeEvent[] {
  const segments = meterSegments(config);
  const result: MetronomeEvent[] = [];
  segments.forEach((segment, i) => {
    const end = Math.min(to, segments[i + 1]?.tick ?? Infinity);
    const start = Math.max(from, i === 0 ? -Infinity : segment.tick);
    if (start >= end) return;
    const beat = ticksPerBeat(segment.meter);
    const step = beat / config.subdivision;
    const bar = ticksPerBar(segment.meter);
    for (let n = Math.ceil((start - segment.tick) / step); segment.tick + n * step < end; n += 1) {
      const local = n * step;
      const kind = local % bar === 0 ? 'bar' : local % beat === 0 ? 'beat' : 'subdivision';
      result.push({ kind, tick: segment.tick + local, step: Math.round((local % bar) / step), meter: segment.meter });
    }
  });
  return result;
}

export function trackEventsInRange<P extends TrackPayload>(track: Track<P>, from: number, to: number): readonly ScheduledTrackEvent<P>[] {
  if (track.lengthTicks <= 0 || to <= track.originTick) return [];
  const result: ScheduledTrackEvent<P>[] = [];
  const start = Math.max(from, track.originTick);
  const firstRep = Math.floor((start - track.originTick) / track.lengthTicks);
  const lastRep = track.loop ? Math.floor((to - 1 - track.originTick) / track.lengthTicks) : 0;
  for (let rep = firstRep; rep <= lastRep; rep += 1) {
    const base = track.originTick + rep * track.lengthTicks;
    for (const event of track.events) {
      if (event.tick >= track.lengthTicks) continue;
      const tick = base + event.tick;
      if (tick >= from && tick < to) {
        result.push({ tick, trackId: track.id, payload: event.payload, repetition: rep });
      }
    }
  }
  return result;
}

export function loopBoundariesInRange(track: Track, from: number, to: number): readonly LoopBoundary[] {
  if (!track.loop || track.lengthTicks <= 0) return [];
  const result: LoopBoundary[] = [];
  const firstRep = Math.max(1, Math.ceil((from - track.originTick) / track.lengthTicks));
  for (let rep = firstRep; ; rep += 1) {
    const tick = track.originTick + rep * track.lengthTicks;
    if (tick >= to) break;
    if (tick >= from) result.push({ tick, trackId: track.id, repetition: rep });
  }
  return result;
}

/** The event in force at a tick: what the UI shows. Null before the first event or after a one-shot track ends. */
export function trackEventAt<P extends TrackPayload>(track: Track<P>, tick: number): ScheduledTrackEvent<P> | null {
  if (track.lengthTicks <= 0 || tick < track.originTick || track.events.length === 0) return null;
  const elapsed = tick - track.originTick;
  const rep = Math.floor(elapsed / track.lengthTicks);
  if (!track.loop && rep > 0) return null;
  const local = elapsed - rep * track.lengthTicks;
  let low = 0;
  let high = track.events.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((track.events[mid] as TrackEvent<P>).tick <= local) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  if (found < 0) return null;
  const event = track.events[found] as TrackEvent<P>;
  return { tick: track.originTick + rep * track.lengthTicks + event.tick, trackId: track.id, payload: event.payload, repetition: rep };
}
