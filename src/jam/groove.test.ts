import { describe, expect, it } from 'vitest';
import { PPQ, ticksPerBar, type Meter } from '../timeline';
import { bassPitch, bassTrack } from './bass';
import { DRUM_VOICES, drumTrack, hitVelocity, pattern, sanitizeKit, steps } from './drums';
import { GENRES, genreOf } from './genres';
import { chordSpans, compTrack, progressionLength, withChord, type Progression } from './progression';
import { parseChord } from '../theory';

/** Jam phase A (P3-06): dynamics, ghost notes, anticipations, the new Fusion, sync. */

const m44: Meter = { beatsPerBar: 4, beatUnit: 4 };
const m34: Meter = { beatsPerBar: 3, beatUnit: 4 };
const m68: Meter = { beatsPerBar: 6, beatUnit: 8 };
const BAR = 4 * PPQ;
const prog = (...symbols: string[]): Progression => ({ name: 't', chords: symbols.map((s) => withChord(s)) });
const iiVI = prog('Dm7', 'G7', 'Cmaj7');

describe('drum dynamics', () => {
  it('cymbals pulse: the beat louder than the eighth, the eighth louder than the sixteenth', () => {
    const [beat, eighth, sixteenth] = [0, 2, 1].map((i) => hitVelocity('hat', 1, i));
    expect(beat).toBeGreaterThan(eighth as number);
    expect(eighth).toBeGreaterThan(sixteenth as number);
    // Accents stay full, the kick is not shaped, a ghost is soft.
    expect(hitVelocity('hat', 2, 3)).toBe(1);
    expect(hitVelocity('kick', 1, 3)).toBe(hitVelocity('kick', 1, 0));
    expect(hitVelocity('snare', 3, 6)).toBeLessThan(0.4);
  });

  it('"g" writes a ghost note and the track plays it soft', () => {
    expect(steps('g.X.x')).toEqual([3, 0, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const kit = { patterns: [pattern({ snare: 'g...X' }), pattern({}), pattern({}), pattern({})] as const, fill: pattern({}) };
    const events = drumTrack(kit, 0, m44, 0).events;
    expect(events.map((e) => e.payload.velocity)).toEqual([0.3, 1]);
  });

  it('a kit saved before the ride existed keeps its grooves and gets an empty ride row', () => {
    const old = { patterns: [{ kick: Array(16).fill(1), snare: Array(16).fill(3) }], fill: {} };
    const kit = sanitizeKit(old);
    expect(kit.patterns[0].kick.every((v) => v === 1)).toBe(true);
    expect(kit.patterns[0].snare.every((v) => v === 3)).toBe(true);
    expect(kit.patterns[0].ride.every((v) => v === 0)).toBe(true);
  });
});

describe('comping', () => {
  it('push: each new chord arrives an eighth early and is not struck again on the downbeat', () => {
    const events = compTrack(iiVI, m44, 'push', true).events;
    const at = (tick: number) => events.find((e) => e.tick === tick);
    // G7 at the and of four of bar 1, held over the bar line.
    const g7 = at(BAR - PPQ / 2);
    expect(g7).toBeDefined();
    expect(g7?.payload.midis.map((m) => m % 12)).toEqual(expect.arrayContaining([5, 11]));
    expect((g7?.tick ?? 0) + (g7?.payload.durationTicks ?? 0)).toBeGreaterThan(BAR);
    expect(at(BAR)).toBeUndefined();
    expect(at(2 * BAR - PPQ / 2)?.payload.midis.map((m) => m % 12)).toEqual(expect.arrayContaining([4, 11]));
    // The first chord still starts on one.
    expect(at(0)).toBeDefined();
  });

  it('stabs are short and syncopated', () => {
    const events = compTrack(prog('E9'), m44, 'stabs', true).events;
    expect(events.map((e) => e.tick)).toEqual([0, PPQ / 4, PPQ * 1.5, PPQ * 2.75]);
    expect(events.slice(1).every((e) => e.payload.durationTicks <= PPQ / 3)).toBe(true);
  });
});

describe('bass anticipation', () => {
  it('the next root sounds on the last sixteenths and holds into the change, with no second attack', () => {
    const line = genreOf('fusion').bass[3];
    const events = bassTrack(iiVI, m44, line, true).events;
    const early = events.find((e) => e.tick === BAR - 2 * (PPQ / 4));
    expect(early?.payload.midi).toBe(bassPitch(parseChord('G7'), 'root'));
    expect((early?.tick ?? 0) + (early?.payload.durationTicks ?? 0)).toBeGreaterThan(BAR);
    expect(events.find((e) => e.tick === BAR)).toBeUndefined();
  });
});

describe('Fusion, rewritten', () => {
  const fusion = genreOf('fusion');
  it('has ghost notes in its grooves and a linear groove where kick, snare and hat never coincide', () => {
    expect(fusion.kit.patterns.filter((p) => p.snare.includes(3)).length).toBeGreaterThanOrEqual(3);
    const linear = fusion.kit.patterns[1];
    for (let i = 0; i < 16; i += 1) {
      const together = [linear.kick[i], linear.snare[i], linear.hat[i]].filter((v) => (v ?? 0) > 0).length;
      expect(together, `step ${i + 1}`).toBeLessThanOrEqual(1);
    }
    expect(fusion.comp).toBe('push');
    expect(fusion.bass.some((b) => b.notes.some((n) => n.tone === 'anticipate'))).toBe(true);
  });
  it('jazz keeps time on the ride with the hi-hat foot on two and four', () => {
    const jazz = genreOf('jazz').kit.patterns[0];
    expect(jazz.ride.filter((v) => v > 0).length).toBeGreaterThanOrEqual(6);
    expect([4, 12].map((i) => jazz.hat[i])).toEqual([1, 1]);
  });
});

describe('every genre stays in time in 4/4, 3/4 and 6/8', () => {
  for (const meter of [m44, m34, m68]) {
    it(`${meter.beatsPerBar}/${meter.beatUnit}`, () => {
      const p = prog('Am7', 'D7', 'Gmaj7', 'Cmaj7');
      const length = progressionLength(p, meter);
      const spans = chordSpans(p, meter);
      for (const genre of GENRES) {
        for (const [i, kitPattern] of genre.kit.patterns.entries()) {
          const drums = drumTrack(genre.kit, i, meter, 4);
          expect(drums.lengthTicks).toBe(4 * ticksPerBar(meter));
          expect(drums.events.every((e) => e.tick >= 0 && e.tick < drums.lengthTicks), genre.id).toBe(true);
          expect(DRUM_VOICES.every(({ voice }) => kitPattern[voice].length === 16)).toBe(true);
        }
        for (const line of genre.bass) {
          const bass = bassTrack(p, meter, line, true).events;
          expect(bass.every((e) => e.tick < length)).toBe(true);
          // Every change is heard: a root on the downbeat, or one already held over it.
          for (const span of spans) {
            const root = bassPitch(span.chord, 'root');
            const sounding = bass.some((e) => e.payload.midi === root && e.tick <= span.tick && e.tick + e.payload.durationTicks > span.tick - 1);
            expect(sounding, `${genre.id} ${line.name} ${span.chord.symbol}`).toBe(true);
          }
        }
        const comp = compTrack(p, meter, genre.comp, true).events;
        for (const span of spans) {
          expect(comp.some((e) => e.tick <= span.tick && e.tick + e.payload.durationTicks >= span.tick - 1 && e.tick >= span.tick - PPQ), `${genre.id} comp ${span.chord.symbol}`).toBe(true);
        }
      }
    });
  }
});

describe('balance', () => {
  it('each genre suggests its own fader levels', () => {
    expect(new Set(GENRES.map((g) => `${g.mix.drums}/${g.mix.bass}/${g.mix.comp}`)).size).toBeGreaterThan(4);
    for (const g of GENRES) for (const v of Object.values(g.mix)) expect(v).toBeGreaterThan(0.3);
    expect(genreOf('ambient').mix.drums).toBeLessThan(genreOf('metal').mix.drums);
  });
});
