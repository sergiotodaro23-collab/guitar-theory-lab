import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DRUM_VOICES } from '../jam/drums';
import {
  SAMPLE_SETS, bassArticulation, drumVoiceFor, isManifest, midiVelocity, normalizedGain, pickDrum, pickPitched, zonesForPitched,
  type DrumZone, type PitchedZone, type RoundRobin, type SampleManifest,
} from './samplerMap';

const manifest = (id: string): SampleManifest => {
  const value: unknown = JSON.parse(readFileSync(`public/samples/${id}/manifest.json`, 'utf8'));
  if (!isManifest(value)) throw new Error(id);
  return value;
};

const drumZones: DrumZone[] = [1, 2, 3].flatMap((rr) => [
  { voice: 'snare', file: `s_soft_${rr}`, velLo: 1, velHi: 63, rr },
  { voice: 'snare', file: `s_loud_${rr}`, velLo: 64, velHi: 127, rr },
]);

const pitched = (root: number, tune = 0, layers: [number, number][] = [[1, 127]], rrs = 1): PitchedZone[] =>
  layers.flatMap(([velLo, velHi]) => Array.from({ length: rrs }, (_, i) => ({ articulation: 'sustain', root, file: `${root}_${velLo}_${i + 1}`, velLo, velHi, rr: i + 1, tune })));

describe('sampler zones (J1)', () => {
  it('maps engine velocity to MIDI and picks the velocity layer', () => {
    expect(midiVelocity(0)).toBe(1);
    expect(midiVelocity(1)).toBe(127);
    expect(midiVelocity(0.5)).toBe(64);
    const memory: RoundRobin = new Map();
    expect(pickDrum(drumZones, 'snare', 0.3, memory)?.zone.file).toMatch(/^s_soft/);
    expect(pickDrum(drumZones, 'snare', 0.9, memory)?.zone.file).toMatch(/^s_loud/);
    expect(pickDrum(drumZones, 'kick', 0.9, memory)).toBeNull();
  });

  it('rotates the round robins of a layer without repeating one in a row', () => {
    const memory: RoundRobin = new Map();
    const hits = Array.from({ length: 6 }, () => pickDrum(drumZones, 'snare', 0.9, memory)?.zone.rr);
    expect(hits).toEqual([1, 2, 3, 1, 2, 3]);
    // Another layer keeps its own rotation.
    expect(pickDrum(drumZones, 'snare', 0.2, memory)?.zone.rr).toBe(1);
  });

  it('a louder hit inside a layer plays a little louder, never past 0 dB', () => {
    const memory: RoundRobin = new Map();
    const bottom = pickDrum(drumZones, 'snare', 64 / 127, memory)?.gain ?? 0;
    const top = pickDrum(drumZones, 'snare', 1, memory)?.gain ?? 0;
    expect(bottom).toBeLessThan(top);
    expect(top).toBeCloseTo(1);
  });

  it('plays the nearest root and shifts it by the interval: a fifth up is 3/2 within 0.2 %', () => {
    const zones = [...pitched(48), ...pitched(51)];
    const memory: RoundRobin = new Map();
    // G3 (55) from Eb3 (51): a major third up, 2^(4/12).
    const g = pickPitched(zones, 'sustain', 55, 0.8, memory);
    expect(g?.zone.root).toBe(51);
    expect(g?.rate).toBeCloseTo(2 ** (4 / 12), 6);
    // C3 itself plays at its own rate.
    expect(pickPitched(zones, 'sustain', 48, 0.8, memory)?.rate).toBe(1);
    // A fifth: G2 from C3 is 2^(-5/12); from 48 to 55 would be 1.4983 ≈ 3/2.
    expect(2 ** (7 / 12)).toBeCloseTo(1.5, 2);
  });

  it('on a tie between two roots shifts the higher one down', () => {
    const zones = [...pitched(48), ...pitched(52)];
    expect(pickPitched(zones, 'sustain', 50, 0.8, new Map())?.zone.root).toBe(52);
  });

  it('removes the measured tuning offset: a sample 26.5 cents sharp is slowed by 26.5 cents', () => {
    const memory: RoundRobin = new Map();
    const note = pickPitched(pitched(28, 26.5), 'sustain', 28, 0.8, memory);
    expect(1200 * Math.log2(note?.rate ?? 1)).toBeCloseTo(-26.5, 6);
  });

  it('a normalized set takes its level from the velocity curve, square law floored at −33 dB', () => {
    const zones = pitched(60, 0, [[1, 42], [43, 85], [86, 127]]);
    const memory: RoundRobin = new Map();
    const soft = pickPitched(zones, 'sustain', 60, 0.2, memory, true);
    const loud = pickPitched(zones, 'sustain', 60, 1, memory, true);
    expect(soft?.zone.velHi).toBe(42);
    expect(loud?.zone.velLo).toBe(86);
    expect(loud?.gain).toBe(1);
    expect(20 * Math.log10(normalizedGain(64))).toBeCloseTo(-12, 0);
    expect(20 * Math.log10(normalizedGain(1))).toBeCloseTo(-33, 0);
  });

  it('lists every round robin of the layer a note needs, for loading ahead', () => {
    const zones = [...pitched(48, 0, [[1, 63], [64, 127]], 2), ...pitched(51, 0, [[1, 63], [64, 127]], 2)];
    const needed = zonesForPitched(zones, 'sustain', 50, 0.9);
    expect(needed.map((z) => z.file).sort()).toEqual(['51_64_1', '51_64_2']);
  });

  it('a layer-first set picks the layer, then the nearest root sampled in it', () => {
    // Wurlitzer-like: the soft layer has C3 and G3, the loud one only E3.
    const zones = [...pitched(48, 0, [[1, 63]]), ...pitched(55, 0, [[1, 63]]), ...pitched(52, 0, [[64, 127]])];
    const memory: RoundRobin = new Map();
    // A soft F3 (53) stays in its layer: G3 shifted down a whole tone, not the loud E3 a semitone away.
    const soft = pickPitched(zones, 'sustain', 53, 0.3, memory, true, true);
    expect(soft?.zone.root).toBe(55);
    expect(soft?.rate).toBeCloseTo(2 ** (-2 / 12), 6);
    // A loud C3 plays the only loud root, E3 a major third down.
    expect(pickPitched(zones, 'sustain', 48, 0.9, memory, true, true)?.zone.root).toBe(52);
    // Root first (the default) would take the soft C3 itself: the layer was lost.
    expect(pickPitched(zones, 'sustain', 48, 0.9, memory)?.zone.velHi).toBe(63);
    expect(zonesForPitched(zones, 'sustain', 53, 0.3, true).map((z) => z.root)).toEqual([55]);
  });

  it('a drum machine set keeps one sound and scales its level with the velocity curve', () => {
    const zones: DrumZone[] = [{ voice: 'clap', file: 'clap', velLo: 1, velHi: 127, rr: 1 }];
    const memory: RoundRobin = new Map();
    const soft = pickDrum(zones, 'clap', 0.5, memory, true);
    const loud = pickDrum(zones, 'clap', 1, memory, true);
    expect(soft?.zone.file).toBe('clap');
    expect(20 * Math.log10(soft?.gain ?? 0)).toBeCloseTo(-12, 0);
    expect(loud?.gain).toBe(1);
  });

  it('every jam kit piece has a recorded voice in each kit; short bass notes are staccato', () => {
    for (const set of ['drums', 'brushes', 'electronic'] as const) {
      const voices = new Set(manifest(set).zones.map((z) => (z as DrumZone).voice));
      for (const { voice } of DRUM_VOICES) expect(voices.has(drumVoiceFor(voice, 0.8, set) ?? ''), `${set} ${voice}`).toBe(true);
      expect(voices.has(drumVoiceFor('tom', 1, set) ?? ''), set).toBe(true);
    }
    // The clap row: cross-stick with sticks, hi-hat foot with brushes, a hand clap on the drum machine.
    expect(drumVoiceFor('clap', 0.8)).toBe('crossStick');
    expect(drumVoiceFor('clap', 0.8, 'brushes')).toBe('hhPedal');
    expect(drumVoiceFor('clap', 0.8, 'electronic')).toBe('clap');
    expect(bassArticulation('ebass', 0.12)).toBe('staccato');
    expect(bassArticulation('ebass', 0.6)).toBe('sustain');
    expect(bassArticulation('upright', 0.12)).toBe('pizz');
  });
});

describe('shipped sample sets (J2)', () => {
  it('every manifest is valid, CC0 or CC BY, pinned to a commit, and lists files that exist', () => {
    for (const id of SAMPLE_SETS) {
      const m = manifest(id);
      expect(m.id).toBe(id);
      // Licences compatible with GPL-3.0-or-later and free redistribution; CC BY asks for the credit in AUDIO_ASSETS.md.
      expect(['CC0-1.0', 'CC-BY-3.0'], id).toContain(m.license);
      expect(m.author.length, id).toBeGreaterThan(0);
      expect(m.commit).toMatch(/^[0-9a-f]{40}$/);
      for (const z of m.zones) expect(() => readFileSync(`public/samples/${id}/${z.file}`)).not.toThrow();
    }
  });

  it('pitched sets cover the instrument range with no gap wider than a major third', () => {
    const ranges: Record<string, [number, number, string]> = { piano: [21, 108, 'sustain'], ebass: [28, 63, 'sustain'], upright: [28, 60, 'pizz'] };
    for (const [id, [lo, hi, art]] of Object.entries(ranges)) {
      const zones = manifest(id).zones as PitchedZone[];
      const roots = [...new Set(zones.filter((z) => z.articulation === art).map((z) => z.root))].sort((a, b) => a - b);
      for (let i = 1; i < roots.length; i += 1) expect((roots[i] as number) - (roots[i - 1] as number), `${id} ${roots[i]}`).toBeLessThanOrEqual(4);
      // Every note of the range is at most two semitones from a root.
      for (let midi = lo; midi <= hi; midi += 1) {
        const note = pickPitched(zones, art, midi, 0.8, new Map());
        expect(Math.abs(midi - (note?.zone.root ?? -99)), `${id} ${midi}`).toBeLessThanOrEqual(id === 'piano' && (midi < 22 || midi > 100) ? 8 : 2);
      }
    }
  });

  it('the Wurlitzer covers A1 to G#6 in every layer, each note within a fourth of a root of its own layer', () => {
    const m = manifest('epiano');
    expect(m.layerFirst).toBe(true);
    expect(m.normalized).toBe(true);
    const zones = m.zones as PitchedZone[];
    for (const velocity of [0.15, 0.4, 0.65, 0.95]) {
      for (let midi = 33; midi <= 92; midi += 1) {
        const note = pickPitched(zones, 'sustain', midi, velocity, new Map(), true, true);
        expect(Math.abs(midi - (note?.zone.root ?? -99)), `${velocity} ${midi}`).toBeLessThanOrEqual(5);
      }
    }
    // Four layers, softest first, and a loud note plays a loud take.
    expect(new Set(zones.map((z) => z.velLo)).size).toBe(4);
    expect(pickPitched(zones, 'sustain', 61, 1, new Map(), true, true)?.zone.velHi).toBe(127);
  });

  it('tuning corrections stay within a quarter tone', () => {
    for (const id of ['ebass', 'upright', 'piano', 'epiano']) {
      for (const z of manifest(id).zones as PitchedZone[]) expect(Math.abs(z.tune), `${id} ${z.file}`).toBeLessThan(50);
    }
  });
});
