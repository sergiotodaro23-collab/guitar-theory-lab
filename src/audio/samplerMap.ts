/**
 * Sampled instruments (J1, D-60): which recorded zone plays a note, at what
 * rate and gain. Pure: the manifests come from `public/samples/<set>/`, built
 * by `tools/samples/build_samples.py`; the sink loads the audio and plays it.
 *
 * - A zone covers a velocity range (1–127) and carries a round-robin number.
 *   Consecutive hits on the same key rotate through the round robins, never
 *   repeating one while another is available (no "machine gun").
 * - Pitched sets: the nearest recorded root plays, shifted by playbackRate.
 *   `tune` is the zone's measured offset in cents; the rate removes it.
 * - A `normalized` set (VCSL piano, Wurlitzer, drum machine) has every layer at
 *   the same loudness: the layer gives the timbre and a velocity curve gives the
 *   level. Otherwise the recorded dynamics are the level, with a small trim
 *   inside a layer.
 * - A `layerFirst` set (Wurlitzer) was sampled on different keys in each layer:
 *   the velocity layer is chosen first, then the nearest root inside it.
 */

export interface DrumZone {
  readonly voice: string;
  readonly file: string;
  readonly velLo: number;
  readonly velHi: number;
  readonly rr: number;
}

export interface PitchedZone {
  readonly articulation: string;
  readonly root: number;
  readonly file: string;
  readonly velLo: number;
  readonly velHi: number;
  readonly rr: number;
  /** Measured cents above the root. */
  readonly tune: number;
}

export interface SampleManifest {
  readonly id: string;
  readonly name: string;
  readonly kind: 'drums' | 'pitched';
  readonly normalized?: boolean;
  readonly layerFirst?: boolean;
  readonly source: string;
  readonly license: string;
  readonly author: string;
  readonly commit: string;
  readonly zones: readonly (DrumZone | PitchedZone)[];
}

export type SampleSetId = 'drums' | 'brushes' | 'electronic' | 'piano' | 'epiano' | 'ebass' | 'upright';
export const SAMPLE_SETS: readonly SampleSetId[] = ['drums', 'brushes', 'electronic', 'piano', 'epiano', 'ebass', 'upright'];

/** Velocity 0–1 of the engines to MIDI 1–127. */
export const midiVelocity = (velocity: number): number => Math.min(127, Math.max(1, Math.round(velocity * 127)));

/** Jam kit pieces (src/jam/drums.ts) on a recorded kit. */
export function drumVoiceFor(voice: string, velocity: number, set: SampleSetId = 'drums'): string | null {
  switch (voice) {
    case 'kick': return 'kick';
    case 'snare': return 'snare';
    // A drum machine has no cross-stick or hi-hat foot: its rim shot and closed hat stand in.
    case 'cross': return set === 'electronic' ? 'rimshot' : 'crossStick';
    case 'hat': return 'hhClosed';
    case 'pedal': return set === 'electronic' ? 'hhClosed' : 'hhPedal';
    case 'crash': return 'crash';
    case 'open': return 'hhOpen';
    case 'ride': return 'ride';
    // A drum machine has a hand clap; a drummer plays the clave on the rim (cross-stick).
    case 'clap': return set === 'electronic' ? 'clap' : 'crossStick';
    // One tom line in the patterns: accents on the floor tom, the rest on the rack tom.
    case 'tom': return velocity >= 0.85 ? 'tomLow' : 'tomHigh';
    default: return null;
  }
}

/** The velocity layer holding `vel`; outside every range, the nearest one. */
function layer<Z extends { velLo: number; velHi: number }>(zones: readonly Z[], vel: number): readonly Z[] {
  const inside = zones.filter((z) => vel >= z.velLo && vel <= z.velHi);
  if (inside.length) return inside;
  let best = Infinity;
  for (const z of zones) best = Math.min(best, Math.max(z.velLo - vel, vel - z.velHi));
  return zones.filter((z) => Math.max(z.velLo - vel, vel - z.velHi) === best);
}

/**
 * Round-robin memory: the last round robin played for each key. Owned by the
 * caller, so the choice stays a pure function of its inputs.
 */
export type RoundRobin = Map<string, number>;

function rotate<Z extends { rr: number; file: string }>(candidates: readonly Z[], key: string, memory: RoundRobin): Z | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => a.rr - b.rr || a.file.localeCompare(b.file));
  const last = memory.get(key);
  const next = sorted.find((z) => last === undefined || z.rr > last) ?? (sorted[0] as Z);
  memory.set(key, next.rr);
  return next;
}

/** Position of `vel` inside its layer, 0 at the bottom, 1 at the top. */
const positionIn = (zone: { velLo: number; velHi: number }, vel: number): number =>
  zone.velHi === zone.velLo ? 1 : Math.min(1, Math.max(0, (vel - zone.velLo) / (zone.velHi - zone.velLo)));

/** Level inside a recorded layer: −4.4 dB at its bottom to 0 dB at its top. */
const recordedGain = (zone: { velLo: number; velHi: number }, vel: number): number => 0.6 + 0.4 * positionIn(zone, vel);

/** Level of a normalized set: the square-law curve of General MIDI (−12 dB at half velocity), floored at −33 dB. */
export const normalizedGain = (vel: number): number => Math.max(0.15, vel / 127) ** 2;

export interface DrumHit {
  readonly zone: DrumZone;
  readonly gain: number;
}

export function pickDrum(zones: readonly DrumZone[], voice: string, velocity: number, memory: RoundRobin, normalized = false): DrumHit | null {
  const vel = midiVelocity(velocity);
  const own = zones.filter((z) => z.voice === voice);
  if (!own.length) return null;
  const candidates = layer(own, vel);
  const first = candidates[0] as DrumZone;
  const zone = rotate(candidates, `${voice}:${first.velLo}`, memory);
  return zone ? { zone, gain: normalized ? normalizedGain(vel) : recordedGain(zone, vel) } : null;
}

export interface PitchedNote {
  readonly zone: PitchedZone;
  /** Playback rate that brings the root to the note, tuning offset removed. */
  readonly rate: number;
  readonly gain: number;
}

/** The recorded root nearest to `midi`; on a tie the higher one, since shifting a recording down sounds more natural than up. */
function nearestRoot(zones: readonly PitchedZone[], midi: number): number {
  let root = (zones[0] as PitchedZone).root;
  for (const z of zones) {
    const d = Math.abs(z.root - midi);
    const best = Math.abs(root - midi);
    if (d < best || (d === best && z.root > root)) root = z.root;
  }
  return root;
}

/**
 * The zone that plays `midi`: the nearest recorded root, then the velocity
 * layer, then the next round robin. With `layerFirst` (sets whose layers were
 * sampled on different keys) the layer comes first, then the nearest root in it.
 */
export function pickPitched(zones: readonly PitchedZone[], articulation: string, midi: number, velocity: number, memory: RoundRobin, normalized = false, layerFirst = false): PitchedNote | null {
  const own = zones.filter((z) => z.articulation === articulation);
  if (!own.length) return null;
  const vel = midiVelocity(velocity);
  let candidates: readonly PitchedZone[];
  if (layerFirst) {
    const inLayer = layer(own, vel);
    const root = nearestRoot(inLayer, midi);
    candidates = inLayer.filter((z) => z.root === root);
  } else {
    const root = nearestRoot(own, midi);
    candidates = layer(own.filter((z) => z.root === root), vel);
  }
  const first = candidates[0] as PitchedZone;
  const zone = rotate(candidates, `${articulation}:${first.root}:${first.velLo}`, memory);
  if (!zone) return null;
  const rate = 2 ** ((midi - zone.root - zone.tune / 100) / 12);
  return { zone, rate, gain: normalized ? normalizedGain(vel) : recordedGain(zone, vel) };
}

/** Every zone a note may use: all the round robins of its layer, so the rotation never waits on a download. */
export function zonesForDrum(zones: readonly DrumZone[], voice: string, velocity: number): readonly DrumZone[] {
  const own = zones.filter((z) => z.voice === voice);
  return own.length ? layer(own, midiVelocity(velocity)) : [];
}

export function zonesForPitched(zones: readonly PitchedZone[], articulation: string, midi: number, velocity: number, layerFirst = false): readonly PitchedZone[] {
  const probe = pickPitched(zones, articulation, midi, velocity, new Map(), false, layerFirst);
  if (!probe) return [];
  const { root, velLo } = probe.zone;
  return zones.filter((z) => z.articulation === articulation && z.root === root && z.velLo === velLo);
}

/**
 * The electric bass picks its recorded articulation from the written length
 * and the note's articulation (J4): short, ghost and staccato notes are the
 * staccato zones. The double bass has only pizzicato.
 */
export const bassArticulation = (set: SampleSetId, seconds: number, played?: 'ghost' | 'staccato' | 'slide'): string =>
  set === 'upright' ? 'pizz' : seconds < 0.22 || played === 'ghost' || played === 'staccato' ? 'staccato' : 'sustain';

/** A slide reaches its note in this long at most: quick, the way a finger moves along the string. */
export const SLIDE_SECONDS = 0.08;
/** Playback rate a slide starts from: the rate of the note shifted by the interval from `from`. */
export const slideRate = (rate: number, midi: number, from: number): number => rate * 2 ** ((from - midi) / 12);

export function isManifest(value: unknown): value is SampleManifest {
  if (!value || typeof value !== 'object') return false;
  const m = value as Partial<SampleManifest>;
  return typeof m.id === 'string' && (m.kind === 'drums' || m.kind === 'pitched') && Array.isArray(m.zones) && m.zones.every((z) => typeof (z as { file?: unknown }).file === 'string');
}
