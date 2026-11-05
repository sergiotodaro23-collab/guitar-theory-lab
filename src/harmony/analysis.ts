import { mod, parseChord, type Chord } from '../theory';
import { classifyTone, guideTones, type ClassifyOptions, type ToneFunction } from './function';

export interface ChordFunctionEntry {
  readonly chordIndex: number;
  readonly symbol: string;
  readonly fn: ToneFunction;
}

/** The same note read against every chord of a progression. */
export function functionsAcross(pc: number, chords: readonly Chord[], options: ClassifyOptions = {}): readonly ChordFunctionEntry[] {
  return chords.map((chord, chordIndex) => ({
    chordIndex,
    symbol: chord.symbol,
    fn: classifyTone(pc, chord, options),
  }));
}

export interface CommonTone {
  readonly pc: number;
  readonly from: string;
  readonly to: string;
}

export function commonTones(a: Chord, b: Chord): readonly CommonTone[] {
  const result: CommonTone[] = [];
  for (const tone of a.tones) {
    const match = b.tones.find((other) => other.pc === tone.pc);
    if (match) result.push({ pc: tone.pc, from: tone.degree, to: match.degree });
  }
  return result;
}

export interface Resolution {
  readonly fromPc: number;
  readonly toPc: number;
  /** Signed semitones along the shortest path. */
  readonly motion: number;
  readonly fromDegree: string;
  readonly toDegree: string;
  readonly kind: 'guide-tone' | 'tension' | 'chord-tone';
}

const shortestMotion = (from: number, to: number): number => {
  const up = mod(to - from, 12);
  return up > 6 ? up - 12 : up;
};

/**
 * Where a note wants to move over the next chord: the nearest chord tone, with
 * guide tones winning ties. A note the next chord contains has nowhere to go, it
 * just changes function; motion over a whole tone is not a resolution. Both null.
 */
export function resolveTone(pc: number, current: Chord, next: Chord, options: ClassifyOptions = {}): Resolution | null {
  const fn = classifyTone(pc, current, options);
  if (next.tones.some((tone) => tone.pc === mod(pc, 12))) return null;
  const nextGuides = new Set(guideTones(next).map((tone) => tone.pc));
  const candidates = next.tones
    .map((tone) => ({ tone, motion: shortestMotion(pc, tone.pc) }))
    .filter(({ motion }) => Math.abs(motion) <= 2)
    .sort((a, b) => {
      const dist = Math.abs(a.motion) - Math.abs(b.motion);
      if (dist !== 0) return dist;
      const guide = Number(nextGuides.has(b.tone.pc)) - Number(nextGuides.has(a.tone.pc));
      if (guide !== 0) return guide;
      return a.motion - b.motion;
    });
  const best = candidates[0];
  if (!best) return null;
  return {
    fromPc: mod(pc, 12),
    toPc: best.tone.pc,
    motion: best.motion,
    fromDegree: fn.degree,
    toDegree: best.tone.degree,
    kind: fn.isGuideTone ? 'guide-tone' : fn.role === 'chord-tone' ? 'chord-tone' : 'tension',
  };
}

/** Guide-tone voice leading between two chords, including tones that stay put. */
export function guideToneMotion(current: Chord, next: Chord): readonly Resolution[] {
  const targets = guideTones(next);
  return guideTones(current).flatMap((tone) => {
    const stay = targets.find((t) => t.pc === tone.pc);
    if (stay) {
      return [{ fromPc: tone.pc, toPc: tone.pc, motion: 0, fromDegree: tone.degree, toDegree: stay.degree, kind: 'guide-tone' as const }];
    }
    const nearest = [...targets].sort((a, b) => Math.abs(shortestMotion(tone.pc, a.pc)) - Math.abs(shortestMotion(tone.pc, b.pc)))[0];
    if (!nearest) return [];
    return [{
      fromPc: tone.pc,
      toPc: nearest.pc,
      motion: shortestMotion(tone.pc, nearest.pc),
      fromDegree: tone.degree,
      toDegree: nearest.degree,
      kind: 'guide-tone' as const,
    }];
  });
}

/**
 * One target per chord, each as close as possible to the previous one.
 * Works on MIDI pitches inside the region the player is using.
 */
export function targetingPath(chords: readonly Chord[], available: readonly number[], startMidi?: number): readonly number[] {
  if (available.length === 0 || chords.length === 0) return [];
  const sorted = [...available].sort((a, b) => a - b);
  let previous = startMidi ?? (sorted[Math.floor(sorted.length / 2)] as number);
  return chords.flatMap((chord) => {
    const guides = new Set(guideTones(chord).map((t) => t.pc));
    const pcs = new Set(chord.tones.map((t) => t.pc));
    const options = sorted.filter((midi) => pcs.has(mod(midi, 12)));
    if (options.length === 0) return [];
    const scored = options
      .map((midi) => ({ midi, cost: Math.abs(midi - previous) - (guides.has(mod(midi, 12)) ? 0.5 : 0) }))
      .sort((a, b) => a.cost - b.cost);
    previous = (scored[0] as { midi: number }).midi;
    return [previous];
  });
}

export { parseChord };
