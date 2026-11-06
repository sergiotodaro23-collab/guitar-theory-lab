/**
 * Routines: an exercise made of phases. Each phase has its own scale, shape,
 * direction and rhythm, so "C form going up, G form coming down" is plain data.
 * Shapes always come from the fretboard engine; nothing here invents a fingering.
 */
import {
  CAGED_FORMS,
  DEFAULT_FRETS,
  cagedPosition,
  rangePosition,
  shiftOctave,
  threeNpsPosition,
  type CagedForm,
  type FretNote,
  type SpelledFretNote,
} from '../fretboard';
import { SCALES, TONICS, buildScale, mod, type Scale, type ScaleId } from '../theory';
import { ticksPerBar, ticksPerBeat, type Meter, type NotePayload, type Subdivision, type Track } from '../timeline';
import { generateSequence, parseCustomPattern, type Direction, type ExerciseKind, type IntervalNumber, type PairMotion } from './generator';

export type PhasePosition =
  | { readonly kind: 'caged'; readonly form: CagedForm }
  | { readonly kind: '3nps'; readonly start: number }
  | { readonly kind: 'range'; readonly low: number; readonly high: number };

export interface RoutinePhase {
  readonly id: string;
  readonly tonic: string;
  readonly scaleId: ScaleId;
  readonly position: PhasePosition;
  /** 1 plays the same shape twelve frets higher. */
  readonly octave: 0 | 1;
  readonly kind: ExerciseKind;
  readonly interval: IntervalNumber;
  readonly pairMotion: PairMotion;
  readonly direction: Direction;
  readonly customText: string;
  readonly notesPerBeat: Subdivision;
  /** How many times the phase plays before the next one, 1–8. */
  readonly repeats: number;
}

export interface Routine {
  readonly name: string;
  readonly phases: readonly RoutinePhase[];
}

export const MAX_PHASES = 12;
export const MAX_REPEATS = 8;

export interface PhaseIssue {
  readonly level: 'error' | 'warning';
  readonly message: string;
  /** A musically correct alternative the user can apply with one click. */
  readonly fix?: { readonly label: string; readonly change: Partial<RoutinePhase> };
}

export interface ResolvedPhase {
  readonly phase: RoutinePhase;
  readonly scale: Scale;
  readonly label: string;
  readonly notes: readonly FretNote[];
  readonly sequence: readonly SpelledFretNote[];
  readonly lowFret: number;
  readonly highFret: number;
  readonly issues: readonly PhaseIssue[];
}

const DIRECTION_LABEL: Readonly<Record<Direction, string>> = { up: 'sale', down: 'scende', updown: 'sale e scende' };

export const describeDirection = (direction: Direction): string => DIRECTION_LABEL[direction];

export function positionLabel(position: PhasePosition, scale?: Scale): string {
  if (position.kind === 'caged') return `CAGED forma ${position.form}`;
  if (position.kind === '3nps') return `3NPS dal grado ${scale?.tones[mod(position.start, 7)]?.degree ?? position.start + 1}`;
  return `Tasti ${position.low}–${position.high}`;
}

/** Turn one phase into a shape and a note order, collecting every problem found. */
export function resolvePhase(phase: RoutinePhase): ResolvedPhase {
  const scale = buildScale(phase.tonic, phase.scaleId);
  const issues: PhaseIssue[] = [];
  let notes: readonly FretNote[] = [];
  const pos = phase.position;

  if (pos.kind === 'caged') {
    notes = cagedPosition(scale, pos.form).notes;
  } else if (pos.kind === '3nps') {
    if (scale.tones.length !== 7) {
      issues.push({
        level: 'error',
        message: `${scale.definition.name} ha ${scale.tones.length} note: le forme 3NPS richiedono una scala di sette note.`,
        fix: { label: 'Usa la forma CAGED E', change: { position: { kind: 'caged', form: 'E' } } },
      });
    } else {
      const found = threeNpsPosition(scale, pos.start);
      if (found) notes = found.notes;
      else issues.push({ level: 'error', message: 'Questa forma 3NPS non entra nei 24 tasti.' });
    }
  } else {
    if (pos.low > pos.high || pos.low < 0 || pos.high > DEFAULT_FRETS) {
      issues.push({
        level: 'error',
        message: `Il range deve stare tra 0 e ${DEFAULT_FRETS}, dal tasto più basso al più alto.`,
        fix: { label: 'Usa i tasti 5–8', change: { position: { kind: 'range', low: 5, high: 8 } } },
      });
    } else {
      notes = rangePosition(scale, pos.low, pos.high).notes;
      if (pos.high - pos.low > 5) {
        issues.push({ level: 'warning', message: 'Range più largo di una posizione: la mano dovrà spostarsi lungo il manico.' });
      }
    }
  }

  if (phase.octave === 1 && notes.length > 0) {
    const shifted = shiftOctave(notes);
    if (shifted) notes = shifted;
    else {
      issues.push({
        level: 'error',
        message: 'Un’ottava sopra, questa forma supera il 24° tasto.',
        fix: { label: 'Torna all’ottava bassa', change: { octave: 0 } },
      });
      notes = [];
    }
  }

  const customPattern = parseCustomPattern(phase.customText);
  if (phase.kind === 'custom' && !customPattern) {
    issues.push({
      level: 'error',
      message: 'Sequenza non valida: scrivi numeri da 1 a 24 separati da spazi.',
      fix: { label: 'Usa la sequenza 1 2 3 5', change: { customText: '1 2 3 5' } },
    });
  }

  const sequence = notes.length === 0 || (phase.kind === 'custom' && !customPattern)
    ? []
    : generateSequence(notes, scale, {
      kind: phase.kind,
      interval: phase.interval,
      direction: phase.direction,
      pairMotion: phase.pairMotion,
      customPattern: customPattern ?? [1],
    });

  if (notes.length > 0 && sequence.length === 0 && issues.every((i) => i.level !== 'error')) {
    issues.push({
      level: 'error',
      message: 'Con questa forma l’esercizio non produce note: la posizione è troppo stretta per l’intervallo o la sequenza.',
      fix: { label: 'Suona la scala', change: { kind: 'scale' } },
    });
  }

  const frets = notes.map((n) => n.fret);
  return {
    phase,
    scale,
    label: positionLabel(pos, scale) + (phase.octave === 1 ? ', ottava alta' : ''),
    notes,
    sequence,
    lowFret: frets.length ? Math.min(...frets) : 0,
    highFret: frets.length ? Math.max(...frets) : 0,
    issues,
  };
}

export interface RoutinePlan {
  readonly phases: readonly (ResolvedPhase & { readonly startTick: number; readonly lengthTicks: number })[];
  readonly lengthTicks: number;
}

/**
 * Lay phases end to end. Each phase repeats as asked, then rests to the bar
 * line, so every phase starts on a downbeat and the hand has a beat to move.
 */
export function planRoutine(routine: Routine, meter: Meter): RoutinePlan {
  const bar = ticksPerBar(meter);
  let start = 0;
  const phases = routine.phases.map((phase) => {
    const resolved = resolvePhase(phase);
    const step = ticksPerBeat(meter) / phase.notesPerBeat;
    const played = resolved.sequence.length * step * phase.repeats;
    const lengthTicks = played === 0 ? 0 : Math.ceil(played / bar) * bar;
    const placed = { ...resolved, startTick: start, lengthTicks };
    start += lengthTicks;
    return placed;
  });
  return { phases, lengthTicks: start };
}

export function routineTrack(routine: Routine, meter: Meter): Omit<Track<NotePayload>, 'originTick'> | null {
  const plan = planRoutine(routine, meter);
  if (plan.lengthTicks === 0) return null;
  const events: { tick: number; payload: NotePayload }[] = [];
  plan.phases.forEach((resolved, phaseIndex) => {
    const step = ticksPerBeat(meter) / resolved.phase.notesPerBeat;
    let tick = resolved.startTick;
    for (let round = 0; round < resolved.phase.repeats; round += 1) {
      for (const note of resolved.sequence) {
        events.push({
          tick,
          payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks: step, index: events.length, phase: phaseIndex },
        });
        tick += step;
      }
    }
  });
  return { id: 'exercise', lengthTicks: plan.lengthTicks, loop: true, events };
}

let idCounter = 0;
/** Ids only need to be unique inside one routine; time keeps them so across reloads. */
export function newPhaseId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter.toString(36)}`;
}

export function defaultPhase(id: string, base?: Partial<RoutinePhase>): RoutinePhase {
  return {
    id,
    tonic: 'C',
    scaleId: 'ionian',
    position: { kind: 'caged', form: 'E' },
    octave: 0,
    kind: 'scale',
    interval: 3,
    pairMotion: 'ascending',
    direction: 'up',
    customText: '1 2 3 5',
    notesPerBeat: 2,
    repeats: 1,
    ...base,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const oneOf = <T,>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const clampInt = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;

function sanitizePosition(raw: unknown): PhasePosition {
  if (isObject(raw)) {
    if (raw.kind === 'caged') return { kind: 'caged', form: oneOf(raw.form, CAGED_FORMS, 'E') };
    if (raw.kind === '3nps') return { kind: '3nps', start: clampInt(raw.start, 0, 6, 0) };
    if (raw.kind === 'range') {
      return { kind: 'range', low: clampInt(raw.low, 0, DEFAULT_FRETS, 5), high: clampInt(raw.high, 0, DEFAULT_FRETS, 8) };
    }
  }
  return { kind: 'caged', form: 'E' };
}

/** Accept only what the engine understands; drop phases that are not objects. */
export function sanitizeRoutine(raw: unknown, fallback: Routine): Routine {
  if (!isObject(raw) || !Array.isArray(raw.phases)) return fallback;
  const d = defaultPhase('');
  const seen = new Set<string>();
  const phases = raw.phases.filter(isObject).slice(0, MAX_PHASES).map((p, i): RoutinePhase => {
    let id = typeof p.id === 'string' && p.id ? p.id : `p${i}`;
    if (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    return {
      id,
      tonic: oneOf(p.tonic, TONICS, d.tonic),
      scaleId: oneOf(p.scaleId, Object.keys(SCALES) as ScaleId[], d.scaleId),
      position: sanitizePosition(p.position),
      octave: p.octave === 1 ? 1 : 0,
      kind: oneOf(p.kind, ['scale', 'interval', 'custom'] as const, d.kind),
      interval: oneOf(p.interval, [2, 3, 4, 5, 6, 7, 8] as const, d.interval),
      pairMotion: oneOf(p.pairMotion, ['ascending', 'descending', 'alternating'] as const, d.pairMotion),
      direction: oneOf(p.direction, ['up', 'down', 'updown'] as const, d.direction),
      customText: typeof p.customText === 'string' ? p.customText.slice(0, 200) : d.customText,
      notesPerBeat: oneOf(p.notesPerBeat, [1, 2, 3, 4] as const, d.notesPerBeat),
      repeats: clampInt(p.repeats, 1, MAX_REPEATS, 1),
    };
  });
  if (phases.length === 0) return fallback;
  return { name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : fallback.name, phases };
}

/** Ready-made routines that show what phases are for. */
export const ROUTINE_TEMPLATES: readonly Routine[] = [
  {
    name: 'Do maggiore: forma C su, forma G giù',
    phases: [
      defaultPhase('t1a', { position: { kind: 'caged', form: 'C' }, direction: 'up' }),
      defaultPhase('t1b', { position: { kind: 'caged', form: 'G' }, direction: 'down' }),
    ],
  },
  {
    name: 'La minore melodica classica: melodica su, naturale giù',
    phases: [
      defaultPhase('t2a', { tonic: 'A', scaleId: 'melodicMinor', position: { kind: 'caged', form: 'E' }, direction: 'up' }),
      defaultPhase('t2b', { tonic: 'A', scaleId: 'aeolian', position: { kind: 'caged', form: 'E' }, direction: 'down' }),
    ],
  },
  {
    name: 'Sol maggiore 3NPS: su dal grado 1, giù dal grado 3',
    phases: [
      defaultPhase('t3a', { tonic: 'G', position: { kind: '3nps', start: 0 }, direction: 'up', notesPerBeat: 3 }),
      defaultPhase('t3b', { tonic: 'G', position: { kind: '3nps', start: 2 }, direction: 'down', notesPerBeat: 3 }),
    ],
  },
  {
    name: 'Do maggiore su, La minore relativa giù',
    phases: [
      defaultPhase('t4a', { position: { kind: 'caged', form: 'E' }, direction: 'up' }),
      defaultPhase('t4b', { tonic: 'A', scaleId: 'aeolian', position: { kind: 'caged', form: 'E' }, direction: 'down' }),
    ],
  },
  {
    name: 'Terze in Do attraverso le cinque forme',
    phases: CAGED_FORMS.map((form, i) =>
      defaultPhase(`t5${i}`, { position: { kind: 'caged', form }, kind: 'interval', interval: 3, direction: i % 2 === 0 ? 'up' : 'down' })),
  },
];
