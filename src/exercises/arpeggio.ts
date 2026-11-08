/**
 * Arpeggios, in three separate layers:
 * - theory: the chord's tones, from the theory engine;
 * - pattern: direction, starting tone (inversion) and step patterns;
 * - fingering: the concrete notes inside a five-fret hand position.
 * Pure: no DOM, no audio.
 */
import { STANDARD_TUNING, pitchesInWindow, type FretNote } from '../fretboard';
import type { Chord } from '../theory';
import { ticksPerBeat, type Meter, type NotePayload, type Subdivision, type Track } from '../timeline';

export type ArpDirection = 'up' | 'down' | 'updown' | 'downup';
/**
 * On a progression: each chord starts its pattern again, picks up from the
 * nearest note, or lands on a chosen chord tone on the downbeat ("target").
 */
export type ArpLink = 'restart' | 'connect' | 'target';

/** Hand position: the window covers this many frets above its lowest one. */
export const ARP_SPAN = 4;

export interface ArpeggioSpec {
  readonly direction: ArpDirection;
  /** Index into the chord's tones of the first note: 0 root, 1 third, 2 fifth, 3 seventh. */
  readonly start: number;
  /** Steps over the chord tones, 1-based, repeated from each note: "1 2 3 2". Null plays straight. */
  readonly customPattern: readonly number[] | null;
}

const byPitch = (a: FretNote, b: FretNote) => a.midi - b.midi;

/** The chord tones a hand reaches in the window starting at `low`. */
export function arpeggioNotes(chord: Chord, low: number, tuning: readonly number[] = STANDARD_TUNING): readonly FretNote[] {
  return [...pitchesInWindow(chord.tones.map((t) => t.pc), low, low + ARP_SPAN, tuning)].sort(byPitch);
}

function startIndex(chord: Chord, sorted: readonly FretNote[], start: number): number {
  const tone = chord.tones[Math.min(Math.max(0, start), chord.tones.length - 1)];
  const index = sorted.findIndex((n) => n.pc === tone?.pc);
  return index < 0 ? 0 : index;
}

function directed<T>(groups: readonly (readonly T[])[], direction: ArpDirection): readonly T[] {
  const up = groups;
  const down = [...groups].reverse().map((g) => [...g].reverse());
  switch (direction) {
    case 'up': return up.flat();
    case 'down': return down.flat();
    case 'updown': return [...up, ...down.slice(1)].flat();
    case 'downup': return [...down, ...up.slice(1)].flat();
  }
}

/**
 * Note order for one chord in one position. The run starts on the lowest
 * occurrence of the chosen tone, so starting from the third gives the first
 * inversion of the arpeggio.
 */
export function arpeggioSequence(chord: Chord, notes: readonly FretNote[], spec: ArpeggioSpec): readonly FretNote[] {
  const sorted = [...notes].sort(byPitch);
  const run = sorted.slice(startIndex(chord, sorted, spec.start));
  if (run.length === 0) return [];
  if (!spec.customPattern) return directed(run.map((n) => [n]), spec.direction);
  const pattern = spec.customPattern;
  const reach = Math.max(...pattern) - 1;
  const groups: (readonly FretNote[])[] = [];
  for (let i = 0; i + reach < run.length; i += 1) groups.push(pattern.map((step) => run[i + step - 1] as FretNote));
  return directed(groups, spec.direction);
}

export interface ArpChordSpan {
  readonly chord: Chord;
  readonly tick: number;
  readonly lengthTicks: number;
}

export interface ProgressionArpeggioOptions {
  readonly spans: readonly ArpChordSpan[];
  readonly lengthTicks: number;
  readonly loop: boolean;
  readonly meter: Meter;
  readonly low: number;
  readonly spec: ArpeggioSpec;
  readonly notesPerBeat: Subdivision;
  readonly link: ArpLink;
  /** The chord's notes to move through; defaults to the hand position at `low`. */
  readonly notesOf?: (chord: Chord) => readonly FretNote[];
  /** A fixed route for each chord (octaves, sweep, skip): played from the top of the chord, as "restart". */
  readonly sequenceOf?: (chord: Chord) => readonly FretNote[];
  /** With "target": the tone each chord lands on (0 root, 1 third, 2 fifth, 3 seventh). */
  readonly target?: number;
}

/** The note of `notes` nearest to a pitch; on a tie, the one in the direction of travel. */
function nearest(notes: readonly FretNote[], midi: number, direction: number): number {
  let best = 0;
  let bestCost = Infinity;
  notes.forEach((note, i) => {
    const distance = note.midi - midi;
    const cost = Math.abs(distance) + (Math.sign(distance) === direction ? 0 : 0.1);
    if (cost < bestCost) {
      bestCost = cost;
      best = i;
    }
  });
  return best;
}

/** The nearest note that is the chord's `tone` (by index): the target of a chord change. */
function nearestTone(chord: Chord, notes: readonly FretNote[], midi: number, tone: number, direction: number): number {
  const pc = chord.tones[Math.min(Math.max(0, tone), chord.tones.length - 1)]?.pc;
  const candidates = notes.map((n, i) => ({ n, i })).filter(({ n }) => n.pc === pc);
  if (candidates.length === 0) return nearest(notes, midi, direction);
  const best = nearest(candidates.map((c) => c.n), midi, direction);
  return candidates[best]?.i ?? 0;
}

/**
 * Arpeggios over a progression, on the shared grid. With "connect" the line
 * never jumps at a chord change: it moves to the new chord's nearest tone,
 * keeps its direction and turns at the edges of the hand position.
 */
export function progressionArpeggioTrack(o: ProgressionArpeggioOptions): Omit<Track<NotePayload>, 'originTick'> {
  const step = ticksPerBeat(o.meter) / o.notesPerBeat;
  const events: { tick: number; payload: NotePayload }[] = [];
  const push = (tick: number, note: FretNote) =>
    events.push({ tick, payload: { type: 'note', midi: note.midi, string: note.string, fret: note.fret, durationTicks: step, index: events.length } });

  let previous: FretNote | null = null;
  let direction = o.spec.direction === 'down' || o.spec.direction === 'downup' ? -1 : 1;

  for (const span of o.spans) {
    const notes = o.notesOf ? o.notesOf(span.chord) : arpeggioNotes(span.chord, o.low);
    const count = Math.floor(span.lengthTicks / step);
    if (o.sequenceOf) {
      const sequence = o.sequenceOf(span.chord);
      for (let i = 0; i < count && sequence.length > 0; i += 1) push(span.tick + i * step, sequence[i % sequence.length] as FretNote);
      previous = sequence[(count - 1) % Math.max(1, sequence.length)] ?? previous;
      continue;
    }
    if (notes.length === 0) continue;

    if (o.link === 'restart') {
      const sequence = arpeggioSequence(span.chord, notes, o.spec);
      for (let i = 0; i < count && sequence.length > 0; i += 1) push(span.tick + i * step, sequence[i % sequence.length] as FretNote);
      previous = sequence[(count - 1) % Math.max(1, sequence.length)] ?? previous;
      continue;
    }

    let index = previous === null
      ? (direction > 0 ? startIndex(span.chord, notes, o.spec.start) : notes.length - 1)
      : o.link === 'target'
        ? nearestTone(span.chord, notes, previous.midi, o.target ?? 0, direction)
        : nearest(notes, previous.midi, direction);
    for (let i = 0; i < count; i += 1) {
      if (i > 0) {
        if (index + direction < 0 || index + direction >= notes.length) direction = -direction;
        index = Math.min(notes.length - 1, Math.max(0, index + direction));
      }
      const note = notes[index] as FretNote;
      push(span.tick + i * step, note);
      previous = note;
    }
  }
  return { id: 'exercise', lengthTicks: o.lengthTicks, loop: o.loop, events };
}
