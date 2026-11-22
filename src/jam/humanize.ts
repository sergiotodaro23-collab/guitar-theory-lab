/**
 * Deterministic humanization (J6): the band's notes move a few milliseconds
 * off the grid and vary a little in velocity, the way players do, but the
 * same seed always gives the same performance. Pure, no DOM, no Math.random.
 *
 * - The bar's downbeat never moves in time (the "one" stays the anchor) and
 *   varies half as much in velocity.
 * - The kick and the bass are tighter than cymbals and chords: half the
 *   timing range.
 * - The offset is in milliseconds, so the feel is the same at any tempo;
 *   at most ±12 ms and ±12 % velocity at full amount.
 * - A short loop is unrolled to at least four bars, so the variations do not
 *   repeat every bar.
 */
import { PPQ, ticksPerBar, type Meter, type Track, type TrackEvent, type TrackPayload } from '../timeline';

export const HUMANIZE_MAX_MS = 12;
export const HUMANIZE_MAX_VELOCITY = 0.12;
const MIN_BARS = 4;

type Spec<P extends TrackPayload> = Omit<Track<P>, 'originTick'>;

/** 0–1 from a seed, a text key and two integers: a small integer hash (FNV-1a and a finaliser). */
export function hash01(seed: number, key: string, a: number, b = 0): number {
  let h = 0x811c9dc5 ^ seed;
  const mix = (n: number) => { h = Math.imul(h ^ n, 0x01000193); };
  for (let i = 0; i < key.length; i += 1) mix(key.charCodeAt(i));
  mix(a & 0xffff); mix(a >>> 16); mix(b & 0xffff); mix(b >>> 16);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/** Ticks in one millisecond at this tempo. */
export const ticksPerMs = (bpm: number): number => (bpm * PPQ) / 60000;

/** A looping track repeated until it lasts at least `minTicks`. */
export function unroll<P extends TrackPayload>(track: Spec<P>, minTicks: number): Spec<P> {
  if (!track.loop || track.lengthTicks <= 0 || track.lengthTicks >= minTicks) return track;
  const times = Math.ceil(minTicks / track.lengthTicks);
  const events = Array.from({ length: times }, (_, k) => track.events.map((e) => ({ ...e, tick: e.tick + k * track.lengthTicks }))).flat();
  return { ...track, lengthTicks: track.lengthTicks * times, events };
}

const identity = (p: TrackPayload): string =>
  p.type === 'drum' ? p.voice : p.type === 'bass' ? `b${p.midi}` : p.type === 'comp' ? `c${p.midis.join('.')}` : p.type;

/** Timing range of a part, as a share of the maximum: kick and bass stay tight. */
const timingShare = (p: TrackPayload): number => (p.type === 'bass' || (p.type === 'drum' && p.voice === 'kick') ? 0.5 : 1);

/**
 * The track as a player would play it: `amount` 0 returns it unchanged, 1 is
 * the widest feel. Events stay inside the track and in tick order.
 */
export function humanize<P extends TrackPayload>(track: Spec<P>, meter: Meter, bpm: number, amount: number, seed = 1): Spec<P> {
  if (amount <= 0) return track;
  const bar = ticksPerBar(meter);
  const long = unroll(track, bar * MIN_BARS);
  const range = HUMANIZE_MAX_MS * Math.min(1, amount) * ticksPerMs(bpm);
  const events = long.events.map((e): TrackEvent<P> => {
    const p = e.payload as TrackPayload;
    if (!('velocity' in p)) return e;
    const key = `${long.id}:${identity(p)}`;
    const downbeat = e.tick % bar === 0;
    const shift = downbeat ? 0 : Math.round((hash01(seed, key, e.tick, 1) * 2 - 1) * range * timingShare(p));
    const tick = Math.min(long.lengthTicks - 1, Math.max(0, e.tick + shift));
    const spread = HUMANIZE_MAX_VELOCITY * Math.min(1, amount) * (downbeat ? 0.5 : 1);
    const velocity = Math.min(1, Math.max(0.02, p.velocity * (1 + (hash01(seed, key, e.tick, 2) * 2 - 1) * spread)));
    return { tick, payload: { ...p, velocity } as P };
  });
  // A stable sort: events that land on the same tick keep their order.
  return { ...long, events: events.map((e, i) => ({ e, i })).sort((x, y) => x.e.tick - y.e.tick || x.i - y.i).map(({ e }) => e) };
}
