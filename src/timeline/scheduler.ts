/**
 * Look-ahead scheduler. A coarse timer only wakes it up: every time comes from
 * the injected clock, which in the browser is AudioContext.currentTime. The UI
 * has no timers of its own and asks positionNow() on each frame.
 */
import {
  loopBoundariesInRange,
  meterSegments,
  metronomeInRange,
  nextBarLine,
  nextBeatLine,
  segmentAt,
  swingTick,
  trackEventsInRange,
  ticksPerBeat,
  unswingTick,
  withMeterChange,
  type LoopBoundary,
  type MetronomeEvent,
  type ScheduledTrackEvent,
  type TimeConfig,
  type Track,
} from './model';
import { TempoMap } from './tempoMap';

export interface Clock {
  now(): number;
}

export interface TimerDriver {
  start(callback: () => void, intervalMs: number): () => void;
}

export interface TimelineSink {
  metronome(event: MetronomeEvent, time: number): void;
  trackEvent(event: ScheduledTrackEvent, time: number): void;
  loopBoundary?(event: LoopBoundary, time: number): void;
  /** Silence everything scheduled at or after this time. */
  cancelAfter(time: number): void;
}

export type TransportState = 'stopped' | 'playing' | 'paused';

export interface SchedulerOptions {
  readonly lookAheadSeconds?: number;
  readonly intervalMs?: number;
  readonly startDelaySeconds?: number;
}

export interface ManualChange {
  readonly tick: number;
  readonly chordIndex: number;
}

export class TimelineScheduler {
  private readonly lookAhead: number;
  private readonly intervalMs: number;
  private readonly startDelay: number;
  private state: TransportState = 'stopped';
  private tempo: TempoMap | null = null;
  /** Straight tick up to which events have been handed to the sink. */
  private cursor = 0;
  private pausedTick = 0;
  private stopTimer: (() => void) | null = null;
  private tracks = new Map<string, Track>();
  /** Track versions waiting for their originTick. */
  private pendingTracks: Track[] = [];
  /** The version a pending swap replaced: the listener may still be hearing it. */
  private previousTracks = new Map<string, Track>();
  private oneShots: ScheduledTrackEvent[] = [];
  private bpmValue: number;
  /** End position relative to a track's origin, so it follows the track when it restarts. */
  private end: { readonly ticks: number; readonly trackId: string | null } | null = null;
  private onEnd: (() => void) | null = null;

  constructor(
    private readonly clock: Clock,
    private readonly timer: TimerDriver,
    private readonly sink: TimelineSink,
    private config: TimeConfig,
    bpm: number,
    options: SchedulerOptions = {},
  ) {
    this.lookAhead = options.lookAheadSeconds ?? 0.12;
    this.intervalMs = options.intervalMs ?? 25;
    this.startDelay = options.startDelaySeconds ?? 0.06;
    this.bpmValue = bpm;
  }

  get transportState(): TransportState {
    return this.state;
  }

  get bpm(): number {
    return this.bpmValue;
  }

  get timeConfig(): TimeConfig {
    return this.config;
  }

  /** Time-consistent read used by audio and UI alike. */
  positionAt(time: number): number {
    if (this.state === 'paused') return this.pausedTick;
    if (this.state === 'stopped' || !this.tempo) return 0;
    return Math.max(0, unswingTick(this.tempo.tickAt(time), this.config));
  }

  positionNow(): number {
    return this.positionAt(this.clock.now());
  }

  /** Audio-clock time of a straight tick, swing included. */
  timeOf(tick: number): number {
    if (!this.tempo) return 0;
    return this.tempo.timeAt(swingTick(tick, this.config));
  }

  play(): void {
    if (this.state === 'playing') return;
    const from = this.state === 'paused' ? this.pausedTick : 0;
    const now = this.clock.now();
    this.tempo = this.buildTempo(now + this.startDelay, from);
    this.cursor = from;
    this.state = 'playing';
    this.stopTimer = this.timer.start(() => this.pump(), this.intervalMs);
    this.pump();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    const now = this.clock.now();
    this.pausedTick = this.positionAt(now);
    this.state = 'paused';
    this.halt();
    this.sink.cancelAfter(now);
  }

  /** A tempo map starting at `from`, carrying any meter change still ahead of it. */
  private buildTempo(time: number, from: number): TempoMap {
    const tempo = new TempoMap(time, swingTick(from, this.config), this.bpmValue, segmentAt(this.config, from).meter);
    for (const segment of meterSegments(this.config)) {
      if (segment.tick > from) tempo.setMeter(segment.tick, segment.meter);
    }
    return tempo;
  }

  stop(): void {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    // A fresh start counts bars from the meter chosen last.
    this.config = { meter: this.config.meter, subdivision: this.config.subdivision, swing: this.config.swing };
    this.pausedTick = 0;
    this.cursor = 0;
    this.tempo = null;
    this.halt();
    this.sink.cancelAfter(this.clock.now());
    this.pendingTracks = [];
    this.previousTracks.clear();
    this.oneShots = [];
    for (const [id, track] of this.tracks) {
      this.tracks.set(id, { ...track, originTick: 0 });
    }
  }

  private halt(): void {
    this.stopTimer?.();
    this.stopTimer = null;
  }

  /** Takes effect on what is not scheduled yet, so nothing plays twice or goes missing. */
  setBpm(bpm: number): void {
    this.bpmValue = bpm;
    if (this.state === 'playing' && this.tempo) {
      this.tempo.setBpm(swingTick(this.cursor, this.config), bpm);
    }
  }

  setSubdivision(subdivision: TimeConfig['subdivision']): void {
    this.config = { ...this.config, subdivision };
  }

  /**
   * Swing can change during playback: the map is rebuilt at the cursor so the next
   * event carries on from the same time.
   */
  setSwing(swing: number): void {
    if (swing === this.config.swing) return;
    if (this.state === 'playing' && this.tempo) {
      const time = this.tempo.timeAt(swingTick(this.cursor, this.config));
      this.config = { ...this.config, swing };
      this.tempo = this.buildTempo(time, this.cursor);
    } else {
      this.config = { ...this.config, swing };
    }
  }

  /**
   * Stopped: the new meter is simply the meter. Playing or paused: it starts at
   * the next bar line, and what is already scheduled keeps the old one.
   */
  setMeter(meter: TimeConfig['meter']): void {
    if (this.state === 'stopped') {
      this.config = { ...this.config, meter };
      return;
    }
    const at = this.state === 'paused' ? this.pausedTick : this.cursor;
    this.config = withMeterChange(this.config, at, meter);
    if (this.state === 'playing' && this.tempo) {
      // Rebuild from the cursor so a change replaced before it starts leaves no trace.
      const time = this.tempo.timeAt(swingTick(this.cursor, this.config));
      this.tempo = this.buildTempo(time, this.cursor);
    }
  }

  /** Where the meter changes next, or null when no change is waiting. */
  get pendingMeterChange(): number | null {
    const at = this.state === 'paused' ? this.pausedTick : this.cursor;
    return meterSegments(this.config).find((segment) => segment.tick > at)?.tick ?? null;
  }

  /** Replace now, keeping the phase of the old version. For harmony edits during playback. */
  replaceTrack(track: Omit<Track, 'originTick'>): void {
    const previous = this.tracks.get(track.id);
    this.tracks.set(track.id, { ...track, originTick: previous?.originTick ?? 0 });
    this.pendingTracks = this.pendingTracks.filter((pending) => pending.id !== track.id);
  }

  /**
   * Swap at the next bar line and restart from there. For exercises, so a new
   * pattern never begins halfway through a bar.
   */
  swapTrackAtNextBar(track: Omit<Track, 'originTick'>): void {
    this.pendingTracks = this.pendingTracks.filter((pending) => pending.id !== track.id);
    if (this.state !== 'playing' && this.state !== 'paused') {
      this.tracks.set(track.id, { ...track, originTick: 0 });
      return;
    }
    const origin = nextBarLine(this.config, this.state === 'paused' ? this.pausedTick : this.cursor);
    if (origin === this.cursor && !this.tracks.has(track.id)) {
      this.tracks.set(track.id, { ...track, originTick: origin });
      return;
    }
    this.pendingTracks.push({ ...track, originTick: origin });
  }

  removeTrack(id: string): void {
    this.tracks.delete(id);
    this.pendingTracks = this.pendingTracks.filter((pending) => pending.id !== id);
  }

  getTrack(id: string): Track | undefined {
    return this.tracks.get(id);
  }

  /** Track version the listener hears at a tick, including one waiting to start. */
  trackAt(id: string, tick: number): Track | undefined {
    const current = this.tracks.get(id);
    if (current && current.originTick > tick) return this.previousTracks.get(id) ?? current;
    return current;
  }

  /**
   * Stop automatically: non-looping progressions. With a track id the end is
   * counted from that track's start, so it moves when the track restarts at a
   * new meter. Null runs forever.
   */
  setEnd(ticks: number | null, onEnd: (() => void) | null, trackId: string | null = null): void {
    this.end = ticks === null ? null : { ticks, trackId };
    this.onEnd = onEnd;
  }

  private endTick(): number | null {
    if (!this.end) return null;
    if (this.end.trackId === null) return this.end.ticks;
    const pending = this.pendingTracks.find((track) => track.id === this.end?.trackId);
    const origin = pending?.originTick ?? this.tracks.get(this.end.trackId)?.originTick ?? 0;
    return origin + this.end.ticks;
  }

  /** Earliest grid tick for a manual chord change that has not been scheduled yet. */
  nextQuantizedTick(unit: 'beat' | 'bar'): number {
    return unit === 'bar' ? nextBarLine(this.config, this.cursor) : nextBeatLine(this.config, this.cursor);
  }

  private pump(): void {
    if (this.state !== 'playing' || !this.tempo) return;
    const horizon = this.clock.now() + this.lookAhead;

    // Advance one grid step at a time so a pending swap or meter change lands exactly at its tick.
    while (this.state === 'playing' && this.timeOf(this.cursor) < horizon) {
      const segment = segmentAt(this.config, this.cursor);
      const stepTicks = ticksPerBeat(segment.meter) / this.config.subdivision;
      let to = segment.tick + (Math.floor((this.cursor - segment.tick) / stepTicks) + 1) * stepTicks;
      const change = meterSegments(this.config).find((s) => s.tick > this.cursor);
      if (change && change.tick < to) to = change.tick;
      this.promotePending(this.cursor);
      this.emitRange(this.cursor, to);
      this.cursor = to;
      const endTick = this.endTick();
      if (endTick !== null && this.cursor >= endTick) {
        const callback = this.onEnd;
        const endTime = this.timeOf(endTick);
        const remaining = Math.max(0, endTime - this.clock.now());
        this.halt();
        if (callback) scheduleOnce(this.timer, remaining, callback);
        return;
      }
    }
  }

  private promotePending(tick: number): void {
    const ready = this.pendingTracks.filter((pending) => pending.originTick <= tick);
    if (ready.length === 0) return;
    for (const track of ready) {
      const previous = this.tracks.get(track.id);
      if (previous) this.previousTracks.set(track.id, previous);
      this.tracks.set(track.id, track);
    }
    this.pendingTracks = this.pendingTracks.filter((pending) => pending.originTick > tick);
  }

  /** One event on the shared grid, for manual chord changes. */
  /**
   * Queue a single event. A one-shot still waiting under the same id is
   * dropped: the last choice wins, so two quick picks never sound together.
   */
  scheduleOneShot(trackId: string, tick: number, payload: ScheduledTrackEvent['payload']): void {
    this.oneShots = this.oneShots.filter((event) => event.trackId !== trackId);
    this.oneShots.push({ tick, trackId, payload, repetition: 0 });
  }

  private emitRange(from: number, to: number): void {
    const due = this.oneShots.filter((event) => event.tick < to);
    this.oneShots = this.oneShots.filter((event) => event.tick >= to);
    for (const event of due) this.sink.trackEvent(event, this.timeOf(Math.max(event.tick, from)));
    for (const event of metronomeInRange(from, to, this.config)) {
      this.sink.metronome(event, this.timeOf(event.tick));
    }
    for (const track of this.tracks.values()) {
      for (const event of trackEventsInRange(track, from, to)) {
        this.sink.trackEvent(event, this.timeOf(event.tick));
      }
      if (this.sink.loopBoundary) {
        for (const boundary of loopBoundariesInRange(track, from, to)) {
          this.sink.loopBoundary(boundary, this.timeOf(boundary.tick));
        }
      }
    }
  }
}

function scheduleOnce(timer: TimerDriver, delaySeconds: number, callback: () => void): void {
  const cancel = timer.start(() => {
    cancel();
    callback();
  }, delaySeconds * 1000);
}
