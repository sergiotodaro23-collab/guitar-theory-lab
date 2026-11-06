import { ticksPerBeat, type Meter } from './model';

interface Segment {
  readonly time: number;
  readonly tick: number;
  readonly bpm: number;
  /** BPM counts this many ticks: a quarter in 4/4, an eighth in 6/8. */
  readonly perBeat: number;
}

/**
 * Converts ticks to audio-clock seconds across tempo and meter changes. Old
 * segments stay, so a position the listener is still hearing keeps its timing.
 */
export class TempoMap {
  private segments: Segment[];

  constructor(startTime: number, startTick: number, bpm: number, meter: Meter) {
    this.segments = [{ time: startTime, tick: startTick, bpm, perBeat: ticksPerBeat(meter) }];
  }

  private static secondsPerTick(segment: Pick<Segment, 'bpm' | 'perBeat'>): number {
    return 60 / segment.bpm / segment.perBeat;
  }

  private segmentForTick(tick: number): Segment {
    let found = this.segments[0] as Segment;
    for (const candidate of this.segments) {
      if (candidate.tick <= tick) found = candidate;
      else break;
    }
    return found;
  }

  timeAt(tick: number): number {
    const segment = this.segmentForTick(tick);
    return segment.time + (tick - segment.tick) * TempoMap.secondsPerTick(segment);
  }

  tickAt(time: number): number {
    let segment = this.segments[0] as Segment;
    for (const candidate of this.segments) {
      if (candidate.time <= time) segment = candidate;
      else break;
    }
    return segment.tick + (time - segment.time) / TempoMap.secondsPerTick(segment);
  }

  /**
   * Apply a change from a tick onward, to every later segment too, then
   * re-time those segments. Anything earlier keeps its time.
   */
  private change(fromTick: number, patch: Partial<Pick<Segment, 'bpm' | 'perBeat'>>): void {
    const base = this.segmentForTick(fromTick);
    if (!this.segments.some((segment) => segment.tick === fromTick)) {
      const split: Segment = { ...base, tick: fromTick, time: this.timeAt(fromTick) };
      this.segments = [...this.segments.filter((s) => s.tick < fromTick), split, ...this.segments.filter((s) => s.tick > fromTick)];
    }
    let previous: Segment | undefined;
    this.segments = this.segments.map((segment) => {
      let next = segment;
      if (segment.tick >= fromTick) {
        next = { ...segment, ...patch };
        if (previous) next = { ...next, time: previous.time + (next.tick - previous.tick) * TempoMap.secondsPerTick(previous) };
      }
      previous = next;
      return next;
    });
    if (this.segments.length > 32) this.segments = this.segments.slice(-32);
  }

  /** New tempo from a tick onward, a meter change already planned included. */
  setBpm(fromTick: number, bpm: number): void {
    this.change(fromTick, { bpm });
  }

  /** New beat length from a tick onward: from 4/4 to 6/8 the BPM starts counting eighths. */
  setMeter(fromTick: number, meter: Meter): void {
    this.change(fromTick, { perBeat: ticksPerBeat(meter) });
  }

  get bpm(): number {
    return (this.segments[this.segments.length - 1] as Segment).bpm;
  }
}
