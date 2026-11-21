/**
 * Routines: an exercise made of phases. Each phase has its own scale, shape,
 * direction and rhythm, so "C form going up, G form coming down" is plain data.
 * Shapes always come from the fretboard engine; nothing here invents a fingering.
 */
import {
  CAGED_FORMS,
  DEFAULT_FRETS,
  STANDARD_TUNING,
  cagedPosition,
  pitchesInWindow,
  rangePosition,
  spellPosition,
  shiftOctave,
  threeNpsPosition,
  type CagedForm,
  type FretNote,
  type SpelledFretNote,
} from '../fretboard';
import { SCALES, TONICS, buildScale, chromaticName, diatonicSeventh, mod, noteName, parseNote, pitchClass, spelledIntervalBetween, transposeBySpelled, tryParseChord, type Scale, type ScaleId, type SpelledInterval } from '../theory';
import { arpeggioSequence } from './arpeggio';
import { ticksPerBar, type Meter, type NotePayload, type Subdivision, type Track } from '../timeline';
import { isRhythmError, layoutRhythm, parseRhythm, uniformRhythm, type Articulation, type RhythmStep, type TimedNote } from './rhythm';
import { generateSequence, parseCustomPattern, type Direction, type ExerciseKind, type IntervalNumber, type PairMotion } from './generator';

export type PhaseKind = ExerciseKind | 'arpeggio';

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
  /** "arpeggio" (P1-10): the chord's tones inside the phase's shape, from the chord below. */
  readonly kind: PhaseKind;
  /** The chord of an arpeggio phase: a symbol the theory engine reads. */
  readonly chord: string;
  readonly interval: IntervalNumber;
  readonly pairMotion: PairMotion;
  readonly direction: Direction;
  readonly customText: string;
  readonly notesPerBeat: Subdivision;
  /** How many times the phase plays before the next one, 1–8. */
  readonly repeats: number;
  /**
   * How the phase moves when the exercise's key changes (M1). "follow" keeps
   * the interval between its tonic and the key, so A minor under C becomes
   * B minor under D; "fixed" stays where it is (an independent phase).
   */
  readonly link: PhaseLink;
  /**
   * Rhythm cycle in the text form of `parseRhythm` (M3), e.g. "8. 16".
   * Empty means `notesPerBeat` notes on every beat of the meter.
   */
  readonly rhythm: string;
  readonly articulation: Articulation;
  /** "bar": every repetition starts on a downbeat; "continuous": they follow each other on the cycle. */
  readonly repeatStart: RepeatStart;
  /** Empty bars after the phase, to move the hand or listen (0–4). */
  readonly barsAfter: number;
}

export type RepeatStart = 'continuous' | 'bar';
export const MAX_BARS_AFTER = 4;

export type PhaseLink = 'follow' | 'fixed';
export const PHASE_LINKS: readonly PhaseLink[] = ['follow', 'fixed'];

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
export function resolvePhase(phase: RoutinePhase, tuning: readonly number[] = STANDARD_TUNING): ResolvedPhase {
  const scale = buildScale(phase.tonic, phase.scaleId);
  const issues: PhaseIssue[] = [];
  let notes: readonly FretNote[] = [];
  const pos = phase.position;

  if (pos.kind === 'caged') {
    notes = cagedPosition(scale, pos.form, DEFAULT_FRETS, tuning).notes;
  } else if (pos.kind === '3nps') {
    if (scale.tones.length !== 7) {
      issues.push({
        level: 'error',
        message: `${scale.definition.name} ha ${scale.tones.length} note: le forme 3NPS richiedono una scala di sette note.`,
        fix: { label: 'Usa la forma CAGED E', change: { position: { kind: 'caged', form: 'E' } } },
      });
    } else {
      const found = threeNpsPosition(scale, pos.start, DEFAULT_FRETS, tuning);
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
      notes = rangePosition(scale, pos.low, pos.high, tuning).notes;
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

  // An arpeggio phase: the chord's tones inside the shape's frets (D-35).
  if (phase.kind === 'arpeggio' && notes.length > 0) {
    const chord = tryParseChord(phase.chord);
    if (!chord) {
      const tonic = diatonicSeventh(scale, 0);
      issues.push({
        level: 'error',
        message: `Accordo non riconosciuto: "${phase.chord}". Prova Cmaj7, Dm7, G7, Am7b5.`,
        ...(tonic ? { fix: { label: `Usa ${tonic.symbol}`, change: { chord: tonic.symbol } } } : {}),
      });
      notes = [];
    } else {
      const outside = chord.tones.filter((t) => !scale.tones.some((x) => x.pc === t.pc));
      if (outside.length > 0) {
        issues.push({ level: 'warning', message: `${outside.map((t) => t.name).join(', ')} non è nella scala della fase: la forma resta quella della scala, l’arpeggio la esce.` });
      }
      const frets = notes.map((n) => n.fret);
      notes = pitchesInWindow(chord.tones.map((t) => t.pc), Math.min(...frets), Math.max(...frets), tuning);
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

  const arpChord = phase.kind === 'arpeggio' ? tryParseChord(phase.chord) : null;
  const sequence = notes.length === 0 || (phase.kind === 'custom' && !customPattern)
    ? []
    : arpChord
      // Spelled by the scale; chord tones outside it keep the chord's own spelling.
      ? spellPosition(arpeggioSequence(arpChord, notes, { direction: phase.direction, start: 0, customPattern: null }), {
        ...scale, tones: [...scale.tones, ...arpChord.tones.filter((t) => !scale.tones.some((x) => x.pc === t.pc)).map((t) => ({ degree: t.degree, name: t.name, note: t.note, pc: t.pc }))],
      })
      : generateSequence(notes, scale, {
        kind: phase.kind === 'arpeggio' ? 'scale' : phase.kind,
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
    label: (phase.kind === 'arpeggio' && arpChord ? `Arpeggio ${arpChord.symbol}, ` : '') + positionLabel(pos, scale) + (phase.octave === 1 ? ', ottava alta' : ''),
    notes,
    sequence,
    lowFret: frets.length ? Math.min(...frets) : 0,
    highFret: frets.length ? Math.max(...frets) : 0,
    issues,
  };
}

/** The rhythm cycle a phase plays: its own text if valid, otherwise its notes per beat in the meter. */
export function phaseRhythm(phase: RoutinePhase, meter: Meter): readonly RhythmStep[] {
  if (phase.rhythm.trim()) {
    const parsed = parseRhythm(phase.rhythm);
    if (!isRhythmError(parsed)) return parsed;
  }
  return uniformRhythm(meter, phase.notesPerBeat);
}

export interface PlacedNote extends TimedNote {
  readonly note: SpelledFretNote;
}

export interface RoutinePlan {
  readonly phases: readonly (ResolvedPhase & { readonly startTick: number; readonly lengthTicks: number; readonly timed: readonly PlacedNote[] })[];
  readonly lengthTicks: number;
}

const ceilTo = (ticks: number, unit: number) => (ticks === 0 ? 0 : Math.ceil(ticks / unit) * unit);

/**
 * Lay phases end to end on the rhythm of each (M3). Repetitions either run
 * on along the cycle or restart on a downbeat; then the phase rests to the
 * bar line and for its separation bars, so every phase starts on a downbeat
 * and the hand has time to move.
 */
export function planRoutine(routine: Routine, meter: Meter, tuning: readonly number[] = STANDARD_TUNING): RoutinePlan {
  const bar = ticksPerBar(meter);
  let start = 0;
  const phases = routine.phases.map((phase) => {
    const resolved = resolvePhase(phase, tuning);
    const steps = phaseRhythm(phase, meter);
    const sequence = resolved.sequence;
    const timed: PlacedNote[] = [];
    let played = 0;
    if (sequence.length > 0) {
      const runs = phase.repeatStart === 'bar' ? phase.repeats : 1;
      const perRun = phase.repeatStart === 'bar' ? sequence.length : sequence.length * phase.repeats;
      const layout = layoutRhythm(perRun, steps, phase.articulation);
      const runLength = phase.repeatStart === 'bar' ? ceilTo(layout.lengthTicks, bar) : layout.lengthTicks;
      for (let run = 0; run < runs; run += 1) {
        for (const n of layout.notes) {
          timed.push({ ...n, index: timed.length, tick: start + run * runLength + n.tick, note: sequence[n.index % sequence.length] as SpelledFretNote });
        }
      }
      played = runLength * (runs - 1) + layout.lengthTicks;
    }
    const lengthTicks = played === 0 ? 0 : ceilTo(played, bar) + phase.barsAfter * bar;
    const placed = { ...resolved, startTick: start, lengthTicks, timed };
    start += lengthTicks;
    return placed;
  });
  return { phases, lengthTicks: start };
}

export function routineTrack(routine: Routine, meter: Meter, tuning: readonly number[] = STANDARD_TUNING): Omit<Track<NotePayload>, 'originTick'> | null {
  const plan = planRoutine(routine, meter, tuning);
  if (plan.lengthTicks === 0) return null;
  const events: { tick: number; payload: NotePayload }[] = [];
  plan.phases.forEach((resolved, phaseIndex) => {
    for (const { tick, durationTicks, note } of resolved.timed) {
      events.push({
        tick,
        payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks, index: events.length, phase: phaseIndex },
      });
    }
  });
  return { id: 'exercise', lengthTicks: plan.lengthTicks, loop: true, events };
}

/** A note name moved by a spelled interval; always one of TONICS (the readable spellings). */
function transposeNameBy(name: string, interval: SpelledInterval, preferFlat: boolean): string {
  const moved = noteName(transposeBySpelled(parseNote(name), interval, preferFlat));
  if (TONICS.includes(moved)) return moved;
  return chromaticName(pitchClass(parseNote(moved)), preferFlat);
}

/** The interval that `semitones` means without a key to read it from: C→D is a second, C→Eb a minor third. */
function plainInterval(semitones: number): SpelledInterval {
  const shift = mod(semitones, 12);
  return spelledIntervalBetween(parseNote('C'), parseNote(chromaticName(shift, [1, 3, 8, 10].includes(shift))));
}

const CHORD_SYMBOL = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;

function transposeChordBy(symbol: string, interval: SpelledInterval, preferFlat: boolean): string {
  const match = CHORD_SYMBOL.exec(symbol.trim());
  if (!match || !match[1]) return symbol;
  const bass = match[3] ? `/${transposeNameBy(match[3], interval, preferFlat)}` : '';
  return `${transposeNameBy(match[1], interval, preferFlat)}${match[2] ?? ''}${bass}`;
}

/** A chord symbol with its root (and slash bass) moved by `semitones`; the quality is untouched. Unreadable symbols stay as they are. */
export function transposeChordSymbol(symbol: string, semitones: number): string {
  return transposeChordBy(symbol, plainInterval(semitones), symbol.includes('b'));
}

const LAST_FRET = 24;

function transposePhaseBy(phase: RoutinePhase, interval: SpelledInterval, preferFlat: (name: string) => boolean): RoutinePhase {
  let position = phase.position;
  if (position.kind === 'range') {
    // The nearest way round the octave: up to a tritone up, otherwise down.
    const nearest = interval.semitones > 6 ? interval.semitones - 12 : interval.semitones;
    const { low, high } = position;
    const move = [nearest, nearest - 12, nearest + 12].find((d) => low + d >= 0 && high + d <= LAST_FRET);
    if (move !== undefined) position = { kind: 'range', low: low + move, high: high + move };
  }
  return {
    ...phase,
    tonic: transposeNameBy(phase.tonic, interval, preferFlat(phase.tonic)),
    chord: phase.chord ? transposeChordBy(phase.chord, interval, preferFlat(phase.chord)) : phase.chord,
    position,
  };
}

/**
 * The whole routine in another key, by semitones: every following phase keeps
 * its scale, shape, direction and rhythm, and moves by the same interval.
 * Prefer `transposeRoutineBetween` when the two keys are known, because only
 * the keys tell C→Db from C→C#.
 */
export function transposeRoutine(routine: Routine, semitones: number): Routine {
  if (mod(semitones, 12) === 0) return routine;
  const interval = plainInterval(semitones);
  return movePhases(routine, interval, (name) => name.includes('b'));
}

/**
 * Relational transposition (M1): the exercise was written under `fromKey` and
 * now reads under `toKey`. Each phase that follows the key keeps the interval,
 * letters included, between its tonic and the key: with C as reference, A
 * natural minor up and A melodic minor down become, under D, B natural minor
 * and B melodic minor; Ab melodic minor becomes Bb melodic minor. Scales are
 * never swapped (a minor phase is not replaced by the relative of the new
 * key), and fixed phases do not move. CAGED forms and 3NPS starts are relative
 * to the scale and follow by themselves; a fret window moves the nearest way
 * that still fits the neck.
 */
export function transposeRoutineBetween(routine: Routine, fromKey: string, toKey: string): Routine {
  const from = parseNote(fromKey);
  const to = parseNote(toKey);
  const interval = spelledIntervalBetween(from, to);
  if (interval.semitones === 0 && interval.letters === 0) return routine;
  // For enharmonic fallbacks the new key decides sharps or flats (Db brings flats, C# sharps); a natural key keeps the note's own.
  return movePhases(routine, interval, (name) => (to.accidental === 0 ? name.includes('b') : to.accidental < 0));
}

function movePhases(routine: Routine, interval: SpelledInterval, preferFlat: (name: string) => boolean): Routine {
  return { ...routine, phases: routine.phases.map((phase) => (phase.link === 'fixed' ? phase : transposePhaseBy(phase, interval, preferFlat))) };
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
    chord: 'Cmaj7',
    link: 'follow',
    rhythm: '',
    articulation: 'legato',
    repeatStart: 'continuous',
    barsAfter: 0,
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
      kind: oneOf(p.kind, ['scale', 'interval', 'custom', 'arpeggio'] as const, d.kind),
      chord: typeof p.chord === 'string' ? p.chord.slice(0, 24) : d.chord,
      interval: oneOf(p.interval, [2, 3, 4, 5, 6, 7, 8] as const, d.interval),
      pairMotion: oneOf(p.pairMotion, ['ascending', 'descending', 'alternating'] as const, d.pairMotion),
      direction: oneOf(p.direction, ['up', 'down', 'updown'] as const, d.direction),
      customText: typeof p.customText === 'string' ? p.customText.slice(0, 200) : d.customText,
      notesPerBeat: oneOf(p.notesPerBeat, [1, 2, 3, 4] as const, d.notesPerBeat),
      repeats: clampInt(p.repeats, 1, MAX_REPEATS, 1),
      link: oneOf(p.link, PHASE_LINKS, d.link),
      rhythm: typeof p.rhythm === 'string' && !isRhythmError(parseRhythm(p.rhythm)) ? p.rhythm.slice(0, 200) : d.rhythm,
      articulation: oneOf(p.articulation, ['legato', 'normal', 'staccato'] as const, d.articulation),
      repeatStart: oneOf(p.repeatStart, ['continuous', 'bar'] as const, d.repeatStart),
      barsAfter: clampInt(p.barsAfter, 0, MAX_BARS_AFTER, 0),
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
    name: 'ii–V–I in Do arpeggiato, forma E: un accordo per fase',
    phases: [
      defaultPhase('t6a', { kind: 'arpeggio', chord: 'Dm7', tonic: 'D', scaleId: 'dorian', position: { kind: 'caged', form: 'E' }, direction: 'up' }),
      defaultPhase('t6b', { kind: 'arpeggio', chord: 'G7', tonic: 'G', scaleId: 'mixolydian', position: { kind: 'caged', form: 'E' }, direction: 'down' }),
      defaultPhase('t6c', { kind: 'arpeggio', chord: 'Cmaj7', position: { kind: 'caged', form: 'E' }, direction: 'updown', repeats: 2 }),
    ],
  },
  {
    name: 'Terze in Do attraverso le cinque forme',
    phases: CAGED_FORMS.map((form, i) =>
      defaultPhase(`t5${i}`, { position: { kind: 'caged', form }, kind: 'interval', interval: 3, direction: i % 2 === 0 ? 'up' : 'down' })),
  },
  {
    // M1: written with C as the key. Changing the key keeps the relation (a major sixth down to A), never the relative minor.
    name: 'Rispetto alla tonalità: La minore naturale su, La minore melodica giù',
    phases: [
      defaultPhase('t7a', { tonic: 'A', scaleId: 'aeolian', position: { kind: 'caged', form: 'E' }, direction: 'up' }),
      defaultPhase('t7b', { tonic: 'A', scaleId: 'melodicMinor', position: { kind: 'caged', form: 'E' }, direction: 'down' }),
    ],
  },
];
