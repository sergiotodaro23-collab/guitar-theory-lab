/**
 * A monophonic signal gives a pitch, not a place on the neck. This lists
 * every place the pitch can be played, and says which is most likely, but
 * only from context: the notes the board is showing, else the last place.
 */
import { DEFAULT_FRETS, STANDARD_TUNING, type FretPosition } from '../fretboard';

export interface LivePositions {
  readonly all: readonly FretPosition[];
  /** Most likely, or null when nothing in the context points to one. */
  readonly likely: FretPosition | null;
  readonly reason: 'context' | 'previous' | null;
}

export function positionsOf(midi: number, tuning: readonly number[] = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly FretPosition[] {
  const out: FretPosition[] = [];
  tuning.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= frets) out.push({ string, fret });
  });
  return out;
}

const distance = (a: FretPosition, b: FretPosition) => Math.abs(a.fret - b.fret) + Math.abs(a.string - b.string) * 0.5;

export function livePositions(midi: number, context: readonly FretPosition[], previous: FretPosition | null): LivePositions {
  const all = positionsOf(midi);
  const inContext = all.filter((p) => context.some((c) => c.string === p.string && c.fret === p.fret));
  if (inContext.length === 1) return { all, likely: inContext[0] ?? null, reason: 'context' };
  const pool = inContext.length > 1 ? inContext : all;
  if (previous && pool.length > 0) {
    const nearest = [...pool].sort((a, b) => distance(a, previous) - distance(b, previous))[0] ?? null;
    return { all, likely: nearest, reason: inContext.length > 1 ? 'context' : 'previous' };
  }
  return { all, likely: inContext[0] ?? null, reason: inContext.length > 0 ? 'context' : null };
}
