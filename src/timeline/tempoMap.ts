import { PPQ, type Meter } from './model';

interface Segment {
  readonly time: number;
  readonly tick: number;
  readonly bpm: number;
}

/**
 * Converts ticks to audio-clock seconds across tempo changes. Old segments stay,
 * so a position the listener is still hearing keeps its original tempo.
 */
export class TempoMap {
  private segments: Segment[];

  constructor(startTime: number, startTick: number, bpm: number, private readonly meter: Meter) {
    this.segments = [{ time: startTime, tick: startTick, bpm }];
  }

  private secondsPerTick(bpm: number): number {
    return 60 / bpm / ((PPQ * 4) / this.meter.beatUnit);
  }

  timeAt(tick: number): number {
    let segment = this.segments[0] as Segment;
    for (const candidate of this.segments) {
      if (candidate.tick <= tick) segment = candidate;
      else break;
    }
    return segment.time + (tick - segment.tick) * this.secondsPerTick(segment.bpm);
  }

  tickAt(time: number): number {
    let segment = this.segments[0] as Segment;
    for (const candidate of this.segments) {
      if (candidate.time <= time) segment = candidate;
      else break;
    }
    return segment.tick + (time - segment.time) / this.secondsPerTick(segment.bpm);
  }

  /** New tempo from a tick onward. Anything earlier keeps its time. */
  setBpm(fromTick: number, bpm: number): void {
    const time = this.timeAt(fromTick);
    this.segments = this.segments.filter((segment) => segment.tick < fromTick);
    this.segments.push({ time, tick: fromTick, bpm });
    if (this.segments.length > 32) this.segments = this.segments.slice(-32);
  }

  get bpm(): number {
    return (this.segments[this.segments.length - 1] as Segment).bpm;
  }
}
