import { describe, expect, it } from 'vitest';
import {
  PPQ, TempoMap, TimelineScheduler, barBeatAt, loopBoundariesInRange, metronomeInRange, swingTick, trackEventAt, trackEventsInRange,
  unswingTick, ticksPerBar, withMeterChange, nextBarLine, type ChordChangePayload, type Clock, type TimeConfig, type TimelineSink, type TimerDriver, type Track,
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
  it('follows meter segments for bar lines, clicks and swing', () => {
    const changed = withMeterChange({ ...config, swing: 0.3 }, 100, { beatsPerBar: 6, beatUnit: 8 });
    const bar = ticksPerBar(config.meter);
    expect(changed.segments?.map((seg) => seg.tick)).toEqual([0, bar]);
    expect(nextBarLine(changed, 100)).toBe(bar);
    expect(nextBarLine(changed, bar + 1)).toBe(bar + 1440);
    // Clicks: 4/4 quarters up to the change, 6/8 eighths after it.
    const ticks = metronomeInRange(bar - PPQ, bar + 480, changed).map((e) => `${e.kind}@${e.tick}`);
    expect(ticks).toEqual([`beat@${bar - PPQ}`, `bar@${bar}`, `beat@${bar + 240}`]);
    // Swing works on the eighth after the change and leaves the bar line alone.
    expect(swingTick(bar, changed)).toBe(bar);
    expect(swingTick(bar + 120, changed)).toBeCloseTo(bar + 156, 9);
    expect(unswingTick(swingTick(bar + 200, changed), changed)).toBeCloseTo(bar + 200, 9);
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

  describe('meter change during playback', () => {
    const THREE_FOUR = { beatsPerBar: 3, beatUnit: 4 } as const;
    const SIX_EIGHT = { beatsPerBar: 6, beatUnit: 8 } as const;
    const BAR = ticksPerBar(config.meter);

    it('keeps playing and starts the new meter on the next bar line, with no gap or double', () => {
      const { scheduler, timer, hits, clock } = rig(120);
      const start = clock.time + 0.06;
      scheduler.play();
      timer.advance(0.7); // inside the first bar of 4/4
      scheduler.setMeter(THREE_FOUR);
      expect(scheduler.transportState).toBe('playing');
      expect(scheduler.pendingMeterChange).toBe(BAR);
      timer.advance(5);
      const beats = beatTicks(hits);
      uniqueSorted(beats.map((h) => h.tick));
      // Quarter notes stay half a second apart straight through the change.
      beats.forEach((hit, i) => {
        expect(hit.tick).toBe(i * PPQ);
        expect(hit.time).toBeCloseTo(start + i * 0.5, 9);
      });
      // Bar lines: 0 in 4/4, then every three beats from the change.
      expect(beats.filter((h) => h.kind === 'bar').map((h) => h.tick).slice(0, 4)).toEqual([0, BAR, BAR + 3 * PPQ, BAR + 6 * PPQ]);
      expect(scheduler.pendingMeterChange).toBeNull();
    });

    it('counts eighths after a change to 6/8, at the same BPM', () => {
      const { scheduler, timer, hits, clock } = rig(120);
      const start = clock.time + 0.06;
      scheduler.play();
      timer.advance(0.3);
      scheduler.setMeter(SIX_EIGHT);
      timer.advance(6);
      const after = beatTicks(hits).filter((h) => h.tick >= BAR);
      // BPM counts the eighth: 240 ticks, still 0.5 s apart; first one exactly at the bar line, 2 s in.
      expect(after[0]).toMatchObject({ tick: BAR, kind: 'bar' });
      expect(after[0]?.time).toBeCloseTo(start + 2, 9);
      after.slice(0, 13).forEach((hit, i) => {
        expect(hit.tick).toBe(BAR + i * 240);
        expect(hit.time).toBeCloseTo(start + 2 + i * 0.5, 9);
        expect(hit.kind).toBe(i % 6 === 0 ? 'bar' : 'beat');
      });
    });

    it('reads bars and beats across the change, numbering bars on', () => {
      const { scheduler, timer, clock } = rig(120);
      scheduler.play();
      timer.advance(0.2);
      scheduler.setMeter(THREE_FOUR);
      timer.advance(4);
      const cfg = scheduler.timeConfig;
      expect(barBeatAt(BAR - PPQ, cfg)).toEqual({ bar: 0, beat: 3, subdivision: 0 });
      expect(barBeatAt(BAR, cfg)).toEqual({ bar: 1, beat: 0, subdivision: 0 });
      expect(barBeatAt(BAR + 3 * PPQ + PPQ, cfg)).toEqual({ bar: 2, beat: 1, subdivision: 0 });
      // The UI's reading of the audio clock agrees with the schedule after the change.
      const tick = BAR + 4 * PPQ;
      expect(scheduler.positionAt(scheduler.timeOf(tick))).toBeCloseTo(tick, 6);
      expect(clock.time).toBeGreaterThan(scheduler.timeOf(tick));
    });

    it('drops a change reverted before it starts', () => {
      const { scheduler, timer, hits } = rig(120);
      scheduler.play();
      timer.advance(0.3);
      scheduler.setMeter(THREE_FOUR);
      scheduler.setMeter(config.meter);
      expect(scheduler.pendingMeterChange).toBeNull();
      timer.advance(5);
      const bars = beatTicks(hits).filter((h) => h.kind === 'bar').map((h) => h.tick);
      expect(bars.slice(0, 3)).toEqual([0, BAR, 2 * BAR]);
    });

    it('keeps a waiting meter change when the BPM changes first', () => {
      const { scheduler, timer, hits } = rig(120);
      scheduler.play();
      timer.advance(0.3);
      scheduler.setMeter(SIX_EIGHT);
      scheduler.setBpm(60);
      timer.advance(10);
      const after = beatTicks(hits).filter((h) => h.tick >= BAR);
      expect(after[1]?.tick).toBe(BAR + 240);
      // 60 BPM on the eighth: one second per eighth.
      expect((after[1]?.time ?? 0) - (after[0]?.time ?? 0)).toBeCloseTo(1, 9);
    });

    it('restarts an exercise and a progression end on the new downbeat', () => {
      const { scheduler, timer, hits } = rig(120);
      scheduler.replaceTrack(chordTrack(2));
      scheduler.setEnd(2 * 3 * PPQ, () => scheduler.stop(), 'chords');
      scheduler.play();
      timer.advance(0.3);
      scheduler.setMeter(THREE_FOUR);
      // The engine rebuilds tracks for the new meter: two bars of 3/4.
      const threeFourChords: Omit<Track<ChordChangePayload>, 'originTick'> = {
        id: 'chords', lengthTicks: 6 * PPQ, loop: false,
        events: [0, 1].map((i) => ({ tick: i * 3 * PPQ, payload: { type: 'chord' as const, chordIndex: i } })),
      };
      scheduler.swapTrackAtNextBar(threeFourChords);
      timer.advance(8);
      const chords = hits.filter((h) => h.kind === 'chords').map((h) => h.tick);
      expect(chords).toEqual([0, BAR, BAR + 3 * PPQ]);
      // Two bars of 3/4 after the change, then the end callback stops the transport.
      expect(scheduler.transportState).toBe('stopped');
    });

    it('applies a change made while paused at the next bar after the pause point', () => {
      const { scheduler, timer, hits } = rig(120);
      scheduler.play();
      timer.advance(2.3); // into bar 2
      scheduler.pause();
      scheduler.setMeter(THREE_FOUR);
      expect(scheduler.pendingMeterChange).toBe(2 * BAR);
      scheduler.play();
      timer.advance(5);
      const bars = beatTicks(hits).filter((h) => h.kind === 'bar').map((h) => h.tick);
      expect(bars).toContain(2 * BAR);
      expect(bars).toContain(2 * BAR + 3 * PPQ);
      uniqueSorted(beatTicks(hits).map((h) => h.tick));
    });

    it('forgets past meters on stop and starts in the last one chosen', () => {
      const { scheduler, timer } = rig(120);
      scheduler.play();
      timer.advance(0.3);
      scheduler.setMeter(THREE_FOUR);
      timer.advance(3);
      scheduler.stop();
      expect(scheduler.timeConfig.segments).toBeUndefined();
      expect(scheduler.timeConfig.meter).toEqual(THREE_FOUR);
      expect(barBeatAt(3 * PPQ, scheduler.timeConfig)).toEqual({ bar: 1, beat: 0, subdivision: 0 });
    });
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
