import { describe, expect, it } from 'vitest';
import { TimelineScheduler, type Clock, type TimeConfig, type TimelineSink, type TimerDriver } from './index';

class FakeClock implements Clock {
  time = 10;
  now() { return this.time; }
}

class FakeTimer implements TimerDriver {
  callbacks = new Set<{ fn: () => void; ms: number; last: number }>();
  constructor(private clock: FakeClock) {}
  start(callback: () => void, intervalMs: number) {
    const entry = { fn: callback, ms: intervalMs, last: this.clock.time };
    this.callbacks.add(entry);
    return () => { this.callbacks.delete(entry); };
  }
  advance(seconds: number, step = 0.025) {
    const end = this.clock.time + seconds;
    while (this.clock.time < end - 1e-9) {
      this.clock.time += step;
      for (const entry of [...this.callbacks]) {
        if (this.clock.time - entry.last >= entry.ms / 1000 - 1e-9) { entry.last = this.clock.time; entry.fn(); }
      }
    }
  }
}

function rig(cfg: TimeConfig, bpm: number) {
  const clock = new FakeClock();
  const timer = new FakeTimer(clock);
  const counts: { beat: number; of: number; time: number }[] = [];
  const clicks: { tick: number; time: number }[] = [];
  const sink: TimelineSink = {
    metronome: (e, time) => clicks.push({ tick: e.tick, time }),
    trackEvent: () => undefined,
    cancelAfter: () => undefined,
    countIn: (beat, of, _perBar, time) => counts.push({ beat, of, time }),
  };
  return { clock, timer, counts, clicks, scheduler: new TimelineScheduler(clock, timer, sink, cfg, bpm, { startDelaySeconds: 0.05 }) };
}

const FOUR: TimeConfig = { meter: { beatsPerBar: 4, beatUnit: 4 }, subdivision: 1, swing: 0 };
const SIX_EIGHT: TimeConfig = { meter: { beatsPerBar: 6, beatUnit: 8 }, subdivision: 1, swing: 0 };

describe('count-in (M3)', () => {
  it('one bar of 4/4 at 120 BPM: four beats half a second apart, then bar 1 exactly one beat after the last', () => {
    const { scheduler, counts, clicks, timer } = rig(FOUR, 120);
    scheduler.play(1);
    expect(counts.map((c) => c.beat)).toEqual([0, 1, 2, 3]);
    const start = 10.05;
    counts.forEach((c, i) => expect(c.time).toBeCloseTo(start + i * 0.5, 9));
    timer.advance(3);
    // The first click of the song is on the beat after the count-in, at tick 0.
    expect(clicks[0]?.tick).toBe(0);
    expect(clicks[0]?.time).toBeCloseTo(start + 4 * 0.5, 9);
    expect(clicks[1]?.time).toBeCloseTo(start + 5 * 0.5, 9);
  });

  it('6/8 counts its six eighths; two bars of 3/4 count six beats', () => {
    const six = rig(SIX_EIGHT, 180);
    six.scheduler.play(1);
    expect(six.counts.length).toBe(6);
    expect((six.counts[1]?.time ?? 0) - (six.counts[0]?.time ?? 0)).toBeCloseTo(60 / 180, 9);
    const three = rig({ ...FOUR, meter: { beatsPerBar: 3, beatUnit: 4 } }, 90);
    three.scheduler.play(2);
    expect(three.counts.map((c) => c.of)).toEqual([6, 6, 6, 6, 6, 6]);
  });

  it('the position stays at 0 during the count-in, and the beats left count down', () => {
    const { scheduler, clock, timer } = rig(FOUR, 120);
    scheduler.play(1);
    expect(scheduler.positionNow()).toBe(0);
    expect(scheduler.countInLeftAt(clock.now() + 0.06)).toBe(4);
    timer.advance(1.1);
    expect(scheduler.countInLeftAt(clock.now())).toBe(2);
    expect(scheduler.positionNow()).toBe(0);
    timer.advance(1);
    expect(scheduler.countInLeftAt(clock.now())).toBe(0);
    expect(scheduler.positionNow()).toBeGreaterThan(0);
  });

  it('no count-in on resume from pause, and none when asked for zero bars', () => {
    const { scheduler, counts, timer } = rig(FOUR, 120);
    scheduler.play(0);
    expect(counts).toEqual([]);
    timer.advance(1);
    scheduler.pause();
    scheduler.play(1);
    expect(counts).toEqual([]);
    scheduler.stop();
    scheduler.play(1);
    expect(counts.length).toBe(4);
  });
});
