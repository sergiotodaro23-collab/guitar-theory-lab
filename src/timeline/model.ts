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

export interface TimeConfig {
  readonly meter: Meter;
  readonly subdivision: Subdivision;
  /** 0 is straight; 0.33 approximates triplet swing on the eighth. */
  readonly swing: number;
}

export const ticksPerBeat = (meter: Meter): number => (PPQ * 4) / meter.beatUnit;
export const ticksPerBar = (meter: Meter): number => ticksPerBeat(meter) * meter.beatsPerBar;

export interface BarBeat {
  readonly bar: number;
  readonly beat: number;
  readonly subdivision: number;
}

export function barBeatAt(tick: number, config: TimeConfig): BarBeat {
  const perBeat = ticksPerBeat(config.meter);
  const beats = Math.floor(tick / perBeat);
  const perSub = perBeat / config.subdivision;
  return {
    bar: Math.floor(beats / config.meter.beatsPerBar),
    beat: beats % config.meter.beatsPerBar,
    subdivision: Math.floor((tick % perBeat) / perSub),
  };
}

/**
 * Swing delays what falls in the second half of each beat. The curve is piecewise
 * linear and monotonic, so note order never changes.
 */
export function swingTick(tick: number, config: TimeConfig): number {
  if (config.swing <= 0) return tick;
  const beat = ticksPerBeat(config.meter);
  const start = Math.floor(tick / beat) * beat;
  const t = tick - start;
  const half = beat / 2;
  const swung = t < half ? t * (1 + config.swing) : half * (1 + config.swing) + (t - half) * (1 - config.swing);
  return start + swung;
}

/** Inverse of swingTick: which straight tick is sounding at a swung position. */
export function unswingTick(tick: number, config: TimeConfig): number {
  if (config.swing <= 0) return tick;
  const beat = ticksPerBeat(config.meter);
  const start = Math.floor(tick / beat) * beat;
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
  const beat = ticksPerBeat(config.meter);
  const step = beat / config.subdivision;
  const bar = ticksPerBar(config.meter);
  const result: MetronomeEvent[] = [];
  for (let n = Math.ceil(from / step); n * step < to; n += 1) {
    const tick = n * step;
    const kind = tick % bar === 0 ? 'bar' : tick % beat === 0 ? 'beat' : 'subdivision';
    result.push({ kind, tick });
  }
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
