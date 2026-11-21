/**
 * Custom relations between phases (M2, D-62): a phase can be anchored to
 * another phase of the same routine at a spelled interval, so its tonic is
 * always that interval above the other's. "Relative minor of phase 1" is a
 * major sixth above it; "dominant of phase 2" a fifth. Anchors chain (3 on 2
 * on 1), follow every edit of the phase they hang on and every key change,
 * and never loop: a cycle or a missing phase is reported and leaves the
 * tonics as they are. Pure.
 */
import { noteName, parseNote, transposeBySpelled, type SpelledInterval } from '../theory';
import type { PhaseIssue, Routine, RoutinePhase } from './routine';

export type AnchorIntervalId = 'P1' | 'm2' | 'M2' | 'm3' | 'M3' | 'P4' | 'A4' | 'd5' | 'P5' | 'm6' | 'M6' | 'm7' | 'M7';

export interface AnchorInterval {
  readonly id: AnchorIntervalId;
  readonly interval: SpelledInterval;
  /** Italian label, upwards; the same pitch class is the inversion below. */
  readonly label: string;
}

export const ANCHOR_INTERVALS: readonly AnchorInterval[] = [
  { id: 'P1', interval: { letters: 0, semitones: 0 }, label: 'Unisono (stessa tonica)' },
  { id: 'm2', interval: { letters: 1, semitones: 1 }, label: 'Seconda minore sopra' },
  { id: 'M2', interval: { letters: 1, semitones: 2 }, label: 'Seconda maggiore sopra' },
  { id: 'm3', interval: { letters: 2, semitones: 3 }, label: 'Terza minore sopra (relativa maggiore di una minore)' },
  { id: 'M3', interval: { letters: 2, semitones: 4 }, label: 'Terza maggiore sopra' },
  { id: 'P4', interval: { letters: 3, semitones: 5 }, label: 'Quarta giusta sopra (sottodominante)' },
  { id: 'A4', interval: { letters: 3, semitones: 6 }, label: 'Quarta aumentata sopra' },
  { id: 'd5', interval: { letters: 4, semitones: 6 }, label: 'Quinta diminuita sopra' },
  { id: 'P5', interval: { letters: 4, semitones: 7 }, label: 'Quinta giusta sopra (dominante)' },
  { id: 'm6', interval: { letters: 5, semitones: 8 }, label: 'Sesta minore sopra' },
  { id: 'M6', interval: { letters: 5, semitones: 9 }, label: 'Sesta maggiore sopra (relativa minore di una maggiore)' },
  { id: 'm7', interval: { letters: 6, semitones: 10 }, label: 'Settima minore sopra' },
  { id: 'M7', interval: { letters: 6, semitones: 11 }, label: 'Settima maggiore sopra' },
];

export const ANCHOR_INTERVAL_IDS: readonly AnchorIntervalId[] = ANCHOR_INTERVALS.map((a) => a.id);

const intervalOf = (id: AnchorIntervalId): SpelledInterval => (ANCHOR_INTERVALS.find((a) => a.id === id) as AnchorInterval).interval;

/** The tonic `id` above `tonic`, spelled by letter (Eb + M6 = C, F# + M6 = D#). */
export function anchoredTonic(tonic: string, id: AnchorIntervalId): string {
  const from = parseNote(tonic);
  return noteName(transposeBySpelled(from, intervalOf(id), from.accidental < 0));
}

export interface AnchorResult {
  readonly routine: Routine;
  /** Per phase id: why its anchor could not apply. */
  readonly issues: ReadonlyMap<string, PhaseIssue>;
}

/**
 * Recompute the tonic of every anchored phase from the phase it hangs on,
 * in dependency order. Phases that are not anchored are returned unchanged.
 */
export function applyAnchors(routine: Routine): AnchorResult {
  const byId = new Map(routine.phases.map((p) => [p.id, p]));
  const resolved = new Map<string, RoutinePhase>();
  const issues = new Map<string, PhaseIssue>();
  const resolve = (phase: RoutinePhase, path: readonly string[]): RoutinePhase => {
    const done = resolved.get(phase.id);
    if (done) return done;
    if (phase.link !== 'anchor') {
      resolved.set(phase.id, phase);
      return phase;
    }
    const target = byId.get(phase.anchorTo);
    let result = phase;
    if (!target || target.id === phase.id) {
      issues.set(phase.id, { level: 'warning', message: 'La fase di riferimento non esiste più: la tonica resta quella scritta.', fix: { label: 'Rendi la fase indipendente', change: { link: 'fixed' } } });
    } else if (path.includes(target.id)) {
      issues.set(phase.id, { level: 'error', message: 'Relazione circolare: questa fase dipende da sé stessa attraverso altre fasi.', fix: { label: 'Rendi la fase indipendente', change: { link: 'fixed' } } });
    } else {
      const base = resolve(target, [...path, phase.id]);
      result = { ...phase, tonic: anchoredTonic(base.tonic, phase.anchorInterval) };
    }
    resolved.set(phase.id, result);
    return result;
  };
  const phases = routine.phases.map((p) => resolve(p, [p.id]));
  const changed = phases.some((p, i) => p !== routine.phases[i]);
  return { routine: changed ? { ...routine, phases } : routine, issues };
}

/** Phases a phase may hang on: every other phase, in order, with its number. */
export const anchorTargets = (routine: Routine, phaseId: string): readonly { readonly id: string; readonly label: string }[] =>
  routine.phases.flatMap((p, i) => (p.id === phaseId ? [] : [{ id: p.id, label: `Fase ${i + 1} (${p.tonic})` }]));
