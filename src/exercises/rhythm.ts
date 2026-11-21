/**
 * Rhythm of an exercise (M3): how the notes of a sequence fall in time.
 *
 * The sequence says which notes, the rhythm says when and how long. A
 * pattern is a cycle of steps (note values, rests, ties) that repeats until
 * the sequence is used up, so five notes of a pentatonic in eighths cross the
 * bar line exactly as written: where they land depends on the meter and the
 * values, never on the number of notes. Everything is in ticks of the shared
 * timeline (PPQ 480 to the quarter), so tuplets that do not divide it are
 * rejected rather than rounded.
 */
import { PPQ, ticksPerBeat, type Meter, type Subdivision } from '../timeline';

/** Written value: 1 whole, 2 half, 4 quarter, 8 eighth, 16 sixteenth, 32 thirty-second. */
export type NoteBase = 1 | 2 | 4 | 8 | 16 | 32;
/** Tuplet: 3 in the time of 2, 5 and 6 in the time of 4. */
export type Tuplet = 1 | 3 | 5 | 6;

export interface RhythmValue {
  readonly base: NoteBase;
  readonly dotted: boolean;
  readonly tuplet: Tuplet;
}

export type StepKind = 'note' | 'rest' | 'tie';

/** One step of the cycle. A tie lengthens the note before it and uses no note of the sequence. */
export interface RhythmStep {
  readonly kind: StepKind;
  readonly value: RhythmValue;
}

/** How long each note sounds, as a share of its written value. */
export type Articulation = 'legato' | 'normal' | 'staccato';
export const ARTICULATION_GATE: Readonly<Record<Articulation, number>> = { legato: 1, normal: 0.9, staccato: 0.5 };
export const ARTICULATION_LABEL: Readonly<Record<Articulation, string>> = { legato: 'Legato', normal: 'Normale', staccato: 'Staccato' };

const TUPLET_IN_TIME_OF: Readonly<Record<Tuplet, number>> = { 1: 1, 3: 2, 5: 4, 6: 4 };

/** Ticks of a value, or null when the tuplet does not fall on the grid. */
export function valueTicks(value: RhythmValue): number | null {
  const plain = (PPQ * 4) / value.base;
  const dotted = value.dotted ? plain * 1.5 : plain;
  const ticks = (dotted * TUPLET_IN_TIME_OF[value.tuplet]) / value.tuplet;
  return Number.isInteger(ticks) && ticks > 0 ? ticks : null;
}

const BASES: readonly NoteBase[] = [1, 2, 4, 8, 16, 32];

/**
 * Text form, one token per step, separated by spaces:
 * `8` eighth, `8.` dotted eighth, `8t` eighth triplet, `16q` quintuplet
 * sixteenth, `16s` sextuplet sixteenth, `r8` eighth rest, `_8` tie.
 * Example: `8. 16` (dotted eighth and sixteenth), `8t 8t 8t`, `4 r8 8`.
 */
export function parseRhythm(text: string): readonly RhythmStep[] | { readonly error: string } {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { error: 'Scrivi almeno un valore, per esempio «8» per le crome.' };
  if (tokens.length > 32) return { error: 'Al massimo 32 valori per ciclo.' };
  const steps: RhythmStep[] = [];
  for (const token of tokens) {
    const match = /^(r|_)?(1|2|4|8|16|32)(\.)?(t|q|s)?$/.exec(token);
    if (!match) return { error: `«${token}» non è un valore: usa 1, 2, 4, 8, 16, 32 con «.», «t», «q», «s», «r» o «_».` };
    const kind: StepKind = match[1] === 'r' ? 'rest' : match[1] === '_' ? 'tie' : 'note';
    const base = Number(match[2]) as NoteBase;
    const tuplet: Tuplet = match[4] === 't' ? 3 : match[4] === 'q' ? 5 : match[4] === 's' ? 6 : 1;
    const value: RhythmValue = { base, dotted: match[3] === '.', tuplet };
    if (valueTicks(value) === null) return { error: `«${token}» non cade sulla griglia del tempo.` };
    if (kind === 'tie' && steps.length === 0) return { error: 'Una legatura non può aprire il ciclo: lega a una nota.' };
    steps.push({ kind, value });
  }
  if (!steps.some((s) => s.kind === 'note')) return { error: 'Il ciclo deve contenere almeno una nota.' };
  return steps;
}

export function formatRhythm(steps: readonly RhythmStep[]): string {
  return steps.map(({ kind, value }) => `${kind === 'rest' ? 'r' : kind === 'tie' ? '_' : ''}${value.base}${value.dotted ? '.' : ''}${value.tuplet === 3 ? 't' : value.tuplet === 5 ? 'q' : value.tuplet === 6 ? 's' : ''}`).join(' ');
}

export const isRhythmError = (r: ReturnType<typeof parseRhythm>): r is { readonly error: string } => 'error' in r;

/** The rhythm the old "notes per beat" setting meant, in the meter's own beat. */
export function uniformRhythm(meter: Meter, notesPerBeat: Subdivision): readonly RhythmStep[] {
  const beat = ticksPerBeat(meter);
  const ticks = beat / notesPerBeat;
  for (const base of BASES) {
    for (const tuplet of [1, 3] as const) {
      const value: RhythmValue = { base, dotted: false, tuplet };
      if (valueTicks(value) === ticks) return [{ kind: 'note', value }];
    }
    const dotted: RhythmValue = { base, dotted: true, tuplet: 1 };
    if (valueTicks(dotted) === ticks) return [{ kind: 'note', value: dotted }];
  }
  throw new Error(`Nessun valore per ${notesPerBeat} note su ${meter.beatUnit}`);
}

/** Ready-made cycles shown in the editor; any other can be typed. */
export const RHYTHM_PRESETS: readonly { readonly text: string; readonly label: string }[] = [
  { text: '4', label: 'Semiminime' },
  { text: '8', label: 'Crome' },
  { text: '8t 8t 8t', label: 'Terzine di crome' },
  { text: '16', label: 'Semicrome' },
  { text: '16s 16s 16s 16s 16s 16s', label: 'Sestine' },
  { text: '16q 16q 16q 16q 16q', label: 'Quintine' },
  { text: '8. 16', label: 'Croma puntata e semicroma' },
  { text: '8 16 16', label: 'Croma e due semicrome' },
  { text: '16 16 8', label: 'Due semicrome e croma' },
  { text: '4 r4', label: 'Semiminima e pausa' },
  { text: 'r8 8', label: 'Controtempo' },
  { text: '4. 8', label: 'Semiminima puntata e croma' },
];

export interface TimedNote {
  /** Index in the sequence. */
  readonly index: number;
  /** Ticks from the start of the run. */
  readonly tick: number;
  /** Written length, ties included. */
  readonly writtenTicks: number;
  /** Sounding length after the articulation. */
  readonly durationTicks: number;
}

export interface RhythmLayout {
  readonly notes: readonly TimedNote[];
  /** Ticks from the start to the end of the last step played. */
  readonly lengthTicks: number;
}

/**
 * Place `count` notes on the cycle, starting at tick 0. Rests and ties use
 * time but no notes; the cycle continues across repetitions of the sequence,
 * so a three-note cycle over a five-note sequence keeps its own phase. The
 * run stops after the last note (and any ties that belong to it).
 */
export function layoutRhythm(count: number, steps: readonly RhythmStep[], articulation: Articulation = 'normal'): RhythmLayout {
  const gate = ARTICULATION_GATE[articulation];
  const notes: { index: number; tick: number; writtenTicks: number }[] = [];
  if (count <= 0 || !steps.some((s) => s.kind === 'note')) return { notes: [], lengthTicks: 0 };
  let tick = 0;
  let step = 0;
  let end = 0;
  while (true) {
    const current = steps[step % steps.length] as RhythmStep;
    const ticks = valueTicks(current.value) ?? 0;
    if (current.kind === 'note') {
      if (notes.length === count) break;
      notes.push({ index: notes.length, tick, writtenTicks: ticks });
      end = tick + ticks;
    } else if (current.kind === 'tie') {
      const last = notes[notes.length - 1];
      if (last && last.tick + last.writtenTicks === tick) {
        last.writtenTicks += ticks;
        end = tick + ticks;
      }
    } else if (notes.length === count) break;
    tick += ticks;
    step += 1;
  }
  return {
    notes: notes.map((n) => ({ ...n, durationTicks: Math.max(1, Math.round(n.writtenTicks * gate)) })),
    lengthTicks: end,
  };
}
