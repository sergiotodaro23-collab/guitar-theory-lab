import { describe, expect, it } from 'vitest';
import {
  PPQ, TempoMap, TimelineScheduler, barBeatAt, loopBoundariesInRange, metronomeInRange, swingTick, trackEventAt, trackEventsInRange,
  unswingTick, ticksPerBar, type ChordChangePayload, type Clock, type TimeConfig, type TimelineSink, type TimerDriver, type Track,
} from './index';

const config: TimeConfig = { meter: { beatsPerBar: 4, beatUnit: 4 }, subdivision: 1, swing: 0 };

class FakeClock implements Clock {
  time = 100;
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
        if (this.clock.time - entry.last >= entry.ms / 1000 - 1e-9) {
          entry.last = this.clock.time;
          entry.fn();
        }
      }
    }
  }
}

interface Hit { tick: number; time: number; kind: string }

function rig(bpm = 120, cfg: TimeConfig = config) {
  const clock = new FakeClock();
  const timer = new FakeTimer(clock);
  const hits: Hit[] = [];
  const cancels: number[] = [];
  const sink: TimelineSink = {
    metronome: (e, time) => hits.push({ tick: e.tick, time, kind: e.kind }),
    trackEvent: (e, time) => hits.push({ tick: e.tick, time, kind: e.trackId }),
    loopBoundary: (e, time) => hits.push({ tick: e.tick, time, kind: `loop:${e.trackId}` }),
    cancelAfter: (time) => cancels.push(time),
  };
  const scheduler = new TimelineScheduler(clock, timer, sink, cfg, bpm);
  return { clock, timer, hits, cancels, scheduler };
}

const chordTrack = (lengthBars: number, id = 'chords'): Track<ChordChangePayload> => ({
  id, lengthTicks: lengthBars * ticksPerBar(config.meter), loop: true, originTick: 0,
  events: Array.from({ length: lengthBars }, (_, i) => ({ tick: i * ticksPerBar(config.meter), payload: { type: 'chord' as const, chordIndex: i } })),
});

const uniqueSorted = (ticks: number[]) => {
  expect(new Set(ticks).size).toBe(ticks.length);
  expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
};

describe('time model', () => {
  it('computes bars and beats', () => {
    expect(barBeatAt(PPQ * 5, config)).toEqual({ bar: 1, beat: 1, subdivision: 0 });
    const sixEight: TimeConfig = { meter: { beatsPerBar: 6, beatUnit: 8 }, subdivision: 1, swing: 0 };
    expect(ticksPerBar(sixEight.meter)).toBe(PPQ * 3);
    expect(barBeatAt(PPQ * 3 + PPQ / 2, sixEight)).toEqual({ bar: 1, beat: 1, subdivision: 0 });
  });
  it('generates the metronome grid with half-open ranges', () => {
    const cfg: TimeConfig = { ...config, subdivision: 2 };
    expect(metronomeInRange(0, PPQ * 4, cfg).map((e) => e.kind)).toEqual(
      ['bar', 'subdivision', 'beat', 'subdivision', 'beat', 'subdivision', 'beat', 'subdivision'],
    );
    expect(metronomeInRange(PPQ * 4, PPQ * 4 + 1, cfg)[0]?.kind).toBe('bar');
  });
  it('supports triplet subdivisions without losing ticks', () => {
    const cfg: TimeConfig = { ...config, subdivision: 3 };
    const events = metronomeInRange(0, PPQ, cfg);
    expect(events.map((e) => e.tick)).toEqual([0, 160, 320]);
  });
  it('swing moves the off-beat later and keeps downbeats', () => {
    const cfg: TimeConfig = { ...config, subdivision: 2, swing: 1 / 3 };
    expect(swingTick(PPQ, cfg)).toBe(PPQ);
    expect(swingTick(PPQ / 2, cfg)).toBeCloseTo(PPQ * (2 / 3));
    for (const tick of [0, 100, 239, 240, 300, 479, 480, 700]) {
      expect(unswingTick(swingTick(tick, cfg), cfg)).toBeCloseTo(tick);
    }
    for (let t = 1; t < PPQ * 2; t += 7) expect(swingTick(t, cfg)).toBeGreaterThan(swingTick(t - 1, cfg));
  });
  it('wraps tracks independently of each other', () => {
    const track = chordTrack(2);
    const barTicks = ticksPerBar(config.meter);
    const events = trackEventsInRange(track, 0, barTicks * 5);
    expect(events.map((e) => e.payload.chordIndex)).toEqual([0, 1, 0, 1, 0]);
    expect(events.map((e) => e.repetition)).toEqual([0, 0, 1, 1, 2]);
    expect(trackEventAt(track, barTicks * 3 + 5)?.payload.chordIndex).toBe(1);
  });
  it('reports loop boundaries once and never at the start', () => {
    const track = chordTrack(2);
    const len = track.lengthTicks;
    expect(loopBoundariesInRange(track, 0, len * 3).map((b) => b.tick)).toEqual([len, len * 2]);
    expect(loopBoundariesInRange(track, len, len + 1).map((b) => b.repetition)).toEqual([1]);
    expect(loopBoundariesInRange(track, len + 1, len * 2)).toEqual([]);
  });
  it('one-shot tracks end', () => {
    const track = { ...chordTrack(2), loop: false };
    expect(trackEventsInRange(track, 0, track.lengthTicks * 3)).toHaveLength(2);
    expect(trackEventAt(track, track.lengthTicks + 1)).toBeNull();
  });
  it('tempo map stays continuous over changes', () => {
    const map = new TempoMap(10, 0, 120, config.meter);
    expect(map.timeAt(PPQ)).toBeCloseTo(10.5);
    map.setBpm(PPQ, 60);
    expect(map.timeAt(PPQ)).toBeCloseTo(10.5);
    expect(map.timeAt(PPQ * 2)).toBeCloseTo(11.5);
    expect(map.tickAt(11)).toBeCloseTo(PPQ * 1.5);
    expect(map.tickAt(10.25)).toBeCloseTo(PPQ / 2);
  });
});

describe('scheduler', () => {
  const beatTicks = (hits: Hit[]) => hits.filter((h) => h.kind === 'bar' || h.kind === 'beat');

  it('schedules ahead of time at exact beat times', () => {
    const { scheduler, timer, hits, clock } = rig(120);
    const start = clock.time + 0.06;
    scheduler.play();
    timer.advance(2);
    const beats = beatTicks(hits);
    expect(beats.length).toBeGreaterThanOrEqual(4);
    beats.forEach((hit, i) => {
      expect(hit.tick).toBe(i * PPQ);
      expect(hit.time).toBeCloseTo(start + i * 0.5, 9);
    });
    // Everything scheduled lies within the look-ahead window.
    expect((beats[beats.length - 1] as Hit).time).toBeLessThanOrEqual(clock.time + 0.12 + 0.5);
  });

  it('drifts by zero over ten minutes at the audio clock', () => {
    const { scheduler, timer, hits, clock } = rig(137);
    const start = clock.time + 0.06;
    scheduler.play();
    timer.advance(600, 0.05);
    const beats = beatTicks(hits);
    const last = beats[beats.length - 1] as Hit;
    expect(last.time).toBeCloseTo(start + (last.tick / PPQ) * (60 / 137), 6);
    uniqueSorted(beats.map((h) => h.tick));
  });

  it('survives a late timer by catching up with no holes', () => {
    const { scheduler, timer, hits } = rig(120);
    scheduler.play();
    timer.advance(3, 0.8); // a throttled background tab
    const ticks = beatTicks(hits).map((h) => h.tick);
    uniqueSorted(ticks);
    ticks.forEach((tick, i) => expect(tick).toBe(i * PPQ));
  });

  it('pause then resume continues from the same tick with no duplicates', () => {
    const { scheduler, timer, hits, clock, cancels } = rig(120);
    scheduler.play();
    timer.advance(1.3);
    scheduler.pause();
    const pausedAt = scheduler.positionNow();
    expect(scheduler.transportState).toBe('paused');
    expect(cancels).toEqual([clock.time]);
    const countAtPause = hits.length;
    timer.advance(5);
    expect(hits.length).toBe(countAtPause);
    expect(scheduler.positionNow()).toBe(pausedAt);
    // Events the sink cancelled are the ones after the pause: remove them as audio would.
    const kept = hits.filter((h) => h.time < clock.time);
    hits.length = 0;
    hits.push(...kept);
    scheduler.play();
    timer.advance(1.5);
    const ticks = beatTicks(hits).map((h) => h.tick);
    uniqueSorted(ticks);
    ticks.forEach((tick, i) => expect(tick).toBe(i * PPQ));
    expect(scheduler.positionNow()).toBeGreaterThan(pausedAt);
  });

  it('stop resets to the start and is idempotent', () => {
    const { scheduler, timer, hits } = rig(120);
    scheduler.stop();
    scheduler.play();
    timer.advance(1);
    scheduler.stop();
    scheduler.stop();
    expect(scheduler.positionNow()).toBe(0);
    hits.length = 0;
    scheduler.play();
    timer.advance(0.2);
    expect(hits[0]).toMatchObject({ tick: 0, kind: 'bar' });
  });

  it('a double play does not double the events', () => {
    const { scheduler, timer, hits } = rig(120);
    scheduler.play();
    scheduler.play();
    timer.advance(1);
    uniqueSorted(beatTicks(hits).map((h) => h.tick));
    expect(timer.callbacks.size).toBe(1);
  });

  it('BPM change keeps time continuous and spaces later beats at the new tempo', () => {
    const { scheduler, timer, hits } = rig(120);
    scheduler.play();
    timer.advance(1.1);
    scheduler.setBpm(60);
    timer.advance(4);
    const beats = beatTicks(hits);
    uniqueSorted(beats.map((h) => h.tick));
    const gaps = beats.slice(1).map((hit, i) => Number((hit.time - (beats[i] as Hit).time).toFixed(6)));
    const switchIndex = gaps.findIndex((gap) => gap === 1);
    expect(switchIndex).toBeGreaterThan(0);
    expect(gaps.slice(0, switchIndex).every((gap) => gap === 0.5)).toBe(true);
    expect(gaps.slice(switchIndex).every((gap) => gap === 1)).toBe(true);
    expect(beats.map((h) => h.tick)).toEqual(beats.map((_, i) => i * PPQ));
  });

  it('positionAt agrees with the scheduled times, including across a tempo change', () => {
    const { scheduler, timer, hits } = rig(100);
    scheduler.play();
    timer.advance(2);
    scheduler.setBpm(180);
    timer.advance(2);
    for (const hit of beatTicks(hits)) {
      expect(scheduler.positionAt(hit.time)).toBeCloseTo(hit.tick, 6);
    }
  });

  it('swing moves the sounding off-beat and the UI reads back the same tick', () => {
    const cfg: TimeConfig = { ...config, subdivision: 2, swing: 1 / 3 };
    const { scheduler, timer, hits, clock } = rig(120, cfg);
    const start = clock.time + 0.06;
    scheduler.play();
    timer.advance(1);
    const off = hits.find((h) => h.kind === 'subdivision') as Hit;
    expect(off.tick).toBe(PPQ / 2);
    expect(off.time).toBeCloseTo(start + 0.5 * (2 / 3), 9);
    expect(scheduler.positionAt(off.time)).toBeCloseTo(PPQ / 2, 6);
  });

  it('loops a track with its boundary on the exact grid', () => {
    const { scheduler, timer, hits } = rig(240);
    scheduler.replaceTrack(chordTrack(2));
    scheduler.play();
    timer.advance(6);
    const chords = hits.filter((h) => h.kind === 'chords');
    const loops = hits.filter((h) => h.kind === 'loop:chords');
    const len = 2 * ticksPerBar(config.meter);
    expect(chords.map((h) => h.tick).slice(0, 4)).toEqual([0, len / 2, len, len * 1.5]);
    expect(loops[0]?.tick).toBe(len);
    const atLoop = hits.find((h) => h.tick === len && h.kind === 'bar') as Hit;
    expect(loops[0]?.time).toBe(atLoop.time);
  });

  it('a track with a different length stays on the same grid', () => {
    const { scheduler, timer, hits } = rig(240);
    scheduler.replaceTrack(chordTrack(2));
    scheduler.replaceTrack({ id: 'ex', lengthTicks: PPQ * 3, loop: true, events: [{ tick: 0, payload: { type: 'chord', chordIndex: 0 } }] });
    scheduler.play();
    timer.advance(6);
    const ex = hits.filter((h) => h.kind === 'ex').map((h) => h.tick);
    ex.forEach((tick, i) => expect(tick).toBe(i * PPQ * 3));
  });

  it('replacing a track during playback neither repeats nor drops the grid', () => {
    const { scheduler, timer, hits } = rig(240);
    scheduler.replaceTrack(chordTrack(4));
    scheduler.play();
    timer.advance(1.5);
    scheduler.replaceTrack(chordTrack(2));
    timer.advance(3);
    const ticks = hits.filter((h) => h.kind === 'chords').map((h) => h.tick);
    uniqueSorted(ticks);
    const bar = ticksPerBar(config.meter);
    ticks.forEach((tick, i) => expect(tick).toBe(i * bar));
  });

  it('swaps an exercise at the next bar line, keeping the old one until then', () => {
    const { scheduler, timer, hits } = rig(240);
    const oldEx = (id: number) => ({ id: 'ex', lengthTicks: PPQ, loop: true, events: [{ tick: 0, payload: { type: 'chord' as const, chordIndex: id } }] });
    scheduler.replaceTrack(oldEx(1));
    scheduler.play();
    timer.advance(0.6);
    scheduler.swapTrackAtNextBar(oldEx(2));
    timer.advance(2);
    const bar = ticksPerBar(config.meter);
    expect(hits.filter((h) => h.kind === 'ex').every((h) => h.tick % PPQ === 0)).toBe(true);
    const track = scheduler.getTrack('ex');
    expect(track?.originTick).toBe(bar);
    expect(scheduler.trackAt('ex', bar - 1)?.events[0]?.payload).toMatchObject({ chordIndex: 1 });
    expect(scheduler.trackAt('ex', bar)?.events[0]?.payload).toMatchObject({ chordIndex: 2 });
  });

  it('runs a non-looping progression to its end and fires the callback once', () => {
    const { scheduler, timer } = rig(240);
    let ended = 0;
    scheduler.setEnd(ticksPerBar(config.meter), () => { ended += 1; scheduler.stop(); });
    scheduler.play();
    timer.advance(3);
    expect(ended).toBe(1);
    expect(scheduler.transportState).toBe('stopped');
  });

  it('changing the meter stops playback instead of breaking the bar grid', () => {
    const { scheduler, timer } = rig(120);
    scheduler.play();
    timer.advance(0.5);
    scheduler.setMeter({ beatsPerBar: 3, beatUnit: 4 });
    expect(scheduler.transportState).toBe('stopped');
    expect(scheduler.timeConfig.meter.beatsPerBar).toBe(3);
  });

  it('plays a one-shot exactly once, cancelled by stop', () => {
    const { scheduler, timer, hits } = rig(120);
    scheduler.play();
    timer.advance(0.5);
    const tick = scheduler.nextQuantizedTick('beat');
    scheduler.scheduleOneShot('manual', tick, { type: 'chord', chordIndex: 3 });
    timer.advance(2);
    expect(hits.filter((h) => h.kind === 'manual').map((h) => h.tick)).toEqual([tick]);
    scheduler.scheduleOneShot('manual', 99999, { type: 'chord', chordIndex: 1 });
    scheduler.stop();
    hits.length = 0;
    scheduler.play();
    timer.advance(1);
    expect(hits.filter((h) => h.kind === 'manual')).toEqual([]);
  });

  it('quantizes manual changes to material not yet scheduled', () => {
    const { scheduler, timer } = rig(120);
    scheduler.play();
    timer.advance(1.1);
    const tick = scheduler.nextQuantizedTick('beat');
    expect(tick % PPQ).toBe(0);
    expect(scheduler.timeOf(tick)).toBeGreaterThanOrEqual(100 + 1.1);
    expect(scheduler.nextQuantizedTick('bar') % (PPQ * 4)).toBe(0);
  });
});
