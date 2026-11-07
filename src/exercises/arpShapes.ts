/**
 * Arpeggio shapes along the neck (P1-12c, D-27). Four layers, kept apart:
 * 1. theory — the chord's pitch classes (theory engine);
 * 2. pitches — which notes, in which order: N octaves from a chosen tone;
 * 3. positions — where each pitch is played (string and fret), under rules a
 *    hand can actually follow;
 * 4. fingering — which finger, and where the hand shifts.
 * A shape the hand cannot play is not returned: callers get null, never a
 * drawing that looks right and cannot be played. Pure: no DOM, no audio.
 */
import { DEFAULT_FRETS, STANDARD_TUNING, cagedWindow, pitchesInWindow, type CagedForm, type FingeredNote, type FretNote } from '../fretboard';
import { mod, type Chord } from '../theory';
import { arpeggioNotes, arpeggioSequence, type ArpDirection, type ArpeggioSpec } from './arpeggio';

export type ArpShape = 'window' | 'caged' | 'octaves' | 'sweep' | 'skip';
export const ARP_SHAPES: readonly ArpShape[] = ['window', 'caged', 'octaves', 'sweep', 'skip'];
/** On the way down: the same strings and frets in reverse, or another route. */
export type ArpReturn = 'same' | 'other';
export type ArpOctaves = 1 | 2 | 3;
export type SweepStrings = 3 | 4 | 5 | 6;

/** Highest fret a note may use, and the widest jump of a hand between two notes. */
const MAX_REACH = 6;
/** Frets a hand covers without moving: index to pinky with a one-fret stretch. */
export const HAND_SPAN = 4;
/** Cost of reusing a place the other half of the run already took. */
const AVOID = 2;
/** How far from the chosen fret a route may start: further away is another area of the neck. */
const START_REACH = 7;

export interface ArpLine {
  /** Played order, ascending unless stated otherwise, each note with its finger. */
  readonly notes: readonly FingeredNote[];
  /** Indices of the notes where the hand moves to a new position. */
  readonly shifts: readonly number[];
}

const noteAt = (string: number, fret: number, tuning: readonly number[]): FretNote => {
  const midi = (tuning[string] as number) + fret;
  return { string, fret, midi, pc: mod(midi, 12) };
};
const keyOf = (n: { readonly string: number; readonly fret: number }) => `${n.string}:${n.fret}`;

/** Every place a pitch can be played on the neck. */
function placesOf(midi: number, tuning: readonly number[], frets: number): readonly FretNote[] {
  const out: FretNote[] = [];
  tuning.forEach((open, string) => {
    const fret = midi - open;
    if (fret >= 0 && fret <= frets) out.push(noteAt(string, fret, tuning));
  });
  return out;
}

/** Index into the chord tones of the starting tone, clamped. */
const startTone = (chord: Chord, start: number) => chord.tones[Math.min(Math.max(0, start), chord.tones.length - 1)] ?? chord.tones[0];

/**
 * Layer 2: the chord tones from the lowest `start` tone at or above `fromMidi`,
 * up `octaves` octaves, ending on the same tone. Null when it leaves the neck.
 */
export function arpeggioPitches(chord: Chord, fromMidi: number, octaves: ArpOctaves, start = 0, tuning = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly number[] | null {
  const tone = startTone(chord, start);
  if (!tone) return null;
  const pcs = new Set(chord.tones.map((t) => t.pc));
  const first = fromMidi + mod(tone.pc - fromMidi, 12);
  const last = first + 12 * octaves;
  const top = (tuning[tuning.length - 1] as number) + frets;
  if (first < (tuning[0] as number) || last > top) return null;
  const out: number[] = [];
  for (let m = first; m <= last; m += 1) if (pcs.has(mod(m, 12))) out.push(m);
  return out;
}

export interface LineRules {
  /** Notes allowed on one string before moving on. */
  readonly maxPerString: number;
  /** How far the string may change between two notes: 1 for neighbours, 2 to skip one. */
  readonly stringStep: 1 | 2;
  /** The hand likes to start near this fret. */
  readonly preferFret: number;
  /** Places to avoid (the other half of an up-and-down run), with a cost, not a ban. */
  readonly avoid?: ReadonlySet<string>;
}

/**
 * Layer 3: where to play each pitch, by dynamic programming over every place
 * of every pitch. Hard rules: strings move one way only, by the allowed step;
 * no more than `maxPerString` notes on a string; no jump wider than six frets.
 * Costs: distance moved, leaving the hand position, open strings high up,
 * and places in `avoid`. Null when no route exists.
 */
export function placeLine(pitches: readonly number[], rules: LineRules, tuning = STANDARD_TUNING, frets = DEFAULT_FRETS): readonly FretNote[] | null {
  if (pitches.length === 0) return [];
  const ascending = (pitches[pitches.length - 1] ?? 0) >= (pitches[0] ?? 0);
  const dir = ascending ? 1 : -1;
  // The state carries the hand position (lowest and highest fretted fret
  // since the last shift), so a route that stays in position wins.
  type State = { note: FretNote; count: number; lo: number; hi: number; cost: number; prev: State | null };
  const hand = (lo: number, hi: number, fret: number): { lo: number; hi: number; shift: boolean } => {
    if (fret === 0) return { lo, hi, shift: false };
    const nlo = Math.min(lo, fret);
    const nhi = Math.max(hi, fret);
    return nhi - nlo > HAND_SPAN ? { lo: fret, hi: fret, shift: true } : { lo: nlo, hi: nhi, shift: false };
  };
  let layer: State[] = placesOf(pitches[0] as number, tuning, frets).map((note) => ({
    note, count: 1, prev: null,
    lo: note.fret === 0 ? Infinity : note.fret, hi: note.fret === 0 ? -Infinity : note.fret,
    cost: 0.15 * Math.abs(note.fret - rules.preferFret) + (rules.avoid?.has(keyOf(note)) ? AVOID : 0),
  }));
  // Open strings belong to the open position, not to a hand at the 8th fret.
  const openOk = rules.preferFret <= HAND_SPAN;
  if (!openOk) layer = layer.filter((s) => s.note.fret > 0);
  for (let i = 1; i < pitches.length; i += 1) {
    const next: State[] = [];
    for (const place of placesOf(pitches[i] as number, tuning, frets)) {
      if (place.fret === 0 && !openOk) continue;
      const best = new Map<string, State>();
      for (const s of layer) {
        const ds = (place.string - s.note.string) * dir;
        const same = ds === 0;
        if (!same && ds !== rules.stringStep) continue;
        const count = same ? s.count + 1 : 1;
        if (count > rules.maxPerString) continue;
        const reach = Math.abs(place.fret - s.note.fret);
        if (reach > MAX_REACH && place.fret !== 0 && s.note.fret !== 0) continue;
        if ((place.fret === 0 || s.note.fret === 0) && Math.max(place.fret, s.note.fret) > HAND_SPAN + 1) continue;
        const h = hand(s.lo, s.hi, place.fret);
        let cost = s.cost + 0.2 * reach + (h.shift ? 2.5 : 0);
        if (!same && s.count === 1 && rules.maxPerString > 1) cost += 0.3;
        if (rules.avoid?.has(keyOf(place))) cost += AVOID;
        const id = `${count}:${h.lo}:${h.hi}`;
        const held = best.get(id);
        if (!held || cost < held.cost) best.set(id, { note: place, count, lo: h.lo, hi: h.hi, cost, prev: s });
      }
      next.push(...best.values());
    }
    if (next.length === 0) return null;
    layer = next;
  }
  let end = layer[0] as State;
  for (const s of layer) if (s.cost < end.cost) end = s;
  const out: FretNote[] = [];
  for (let s: State | null = end; s; s = s.prev) out.push(s.note);
  return out.reverse();
}

/**
 * Layer 4: fingers along a line. The hand keeps a position while the fretted
 * notes fit in five frets; past that it shifts, and the next position starts
 * with the index finger. Open strings take no finger.
 */
export function fingerLine(line: readonly FretNote[]): ArpLine {
  const notes: FingeredNote[] = [];
  const shifts: number[] = [];
  let i = 0;
  while (i < line.length) {
    let lo = Infinity;
    let hi = -Infinity;
    let j = i;
    for (; j < line.length; j += 1) {
      const f = (line[j] as FretNote).fret;
      if (f === 0) continue;
      const nlo = Math.min(lo, f);
      const nhi = Math.max(hi, f);
      if (nhi - nlo > HAND_SPAN) break;
      lo = nlo;
      hi = nhi;
    }
    if (i > 0) shifts.push(i);
    const span = hi - lo;
    for (let k = i; k < j; k += 1) {
      const n = line[k] as FretNote;
      if (n.fret === 0) { notes.push({ ...n, finger: 0 }); continue; }
      const off = n.fret - lo;
      // Five frets: 1 on the first, 4 stretching to the fifth, 3 on the fourth.
      const finger = span >= HAND_SPAN ? [1, 2, 3, 3, 4][off] ?? 4 : Math.min(4, off + 1);
      notes.push({ ...n, finger });
    }
    i = j;
  }
  return { notes, shifts };
}

/** Octaves along the neck: two or three notes a string, shifting when needed. */
export function octaveLine(chord: Chord, fromFret: number, octaves: ArpOctaves, start = 0, tuning = STANDARD_TUNING): ArpLine | null {
  // The lowest start tone a hand near `fromFret` reaches on the low strings.
  const tone = startTone(chord, start);
  if (!tone) return null;
  const candidates = [0, 1, 2].flatMap((string) => {
    const open = tuning[string] as number;
    const fret = mod(tone.pc - open, 12);
    return [fret, fret + 12].filter((f) => f <= DEFAULT_FRETS && Math.abs(f - fromFret) <= START_REACH).map((f) => ({ string, fret: f, midi: open + f }));
  }).sort((a, b) => Math.abs(a.fret - fromFret) - Math.abs(b.fret - fromFret) || a.midi - b.midi);
  for (const c of candidates) {
    const pitches = arpeggioPitches(chord, c.midi, octaves, start, tuning);
    if (!pitches) continue;
    const line = placeLine(pitches, { maxPerString: 3, stringStep: 1, preferFret: c.fret }, tuning);
    if (line) return fingerLine(line);
  }
  return null;
}

/**
 * Sweep: one note a string over neighbouring strings, low to high, plus one
 * more chord tone on the top string for the turn. The whole shape stays
 * inside five frets, apart from the top note, which may reach one fret more.
 */
export function sweepLine(chord: Chord, fromFret: number, strings: SweepStrings, start = 0, tuning = STANDARD_TUNING): ArpLine | null {
  const tone = startTone(chord, start);
  if (!tone) return null;
  const pcs = new Set(chord.tones.map((t) => t.pc));
  const first = tuning.length - strings;
  const lo = Math.max(0, fromFret - 5);
  const hi = Math.min(DEFAULT_FRETS, fromFret + 6);
  const options = (string: number) => {
    const out: FretNote[] = [];
    for (let f = lo; f <= hi; f += 1) {
      const n = noteAt(string, f, tuning);
      if (pcs.has(n.pc)) out.push(n);
    }
    return out;
  };
  let best: { line: FretNote[]; cost: number } | null = null;
  const walk = (string: number, line: FretNote[]) => {
    if (string === tuning.length) {
      const fretted = line.map((n) => n.fret);
      const span = Math.max(...fretted) - Math.min(...fretted);
      if (span > HAND_SPAN) return;
      const covered = new Set(line.map((n) => n.pc)).size;
      const cost = span + 0.2 * Math.abs((line[0] as FretNote).fret - fromFret) + 2 * (pcs.size - Math.min(pcs.size, covered))
        + line.slice(1).reduce((sum, n, i) => sum + 0.15 * (n.midi - (line[i] as FretNote).midi), 0);
      if (!best || cost < best.cost) best = { line: [...line], cost };
      return;
    }
    for (const n of options(string)) {
      const prev = line[line.length - 1];
      if (line.length === 0 && n.pc !== tone.pc) continue;
      if (prev && (n.midi <= prev.midi || n.midi - prev.midi > 8)) continue;
      line.push(n);
      walk(string + 1, line);
      line.pop();
    }
  };
  walk(first, []);
  const found = best as { line: FretNote[]; cost: number } | null;
  if (!found) return null;
  const shape = found.line;
  const top = shape[shape.length - 1] as FretNote;
  const fretted = shape.map((n) => n.fret);
  const reach = Math.max(...fretted, Math.min(...fretted) + HAND_SPAN) + 1;
  for (let f = top.fret + 1; f <= Math.min(DEFAULT_FRETS, reach); f += 1) {
    const n = noteAt(top.string, f, tuning);
    if (pcs.has(n.pc)) {
      // The turn: the hand slides or stretches for one note, so it gets the pinky.
      const line = fingerLine(shape);
      return { notes: [...line.notes, { ...n, finger: 4 }], shifts: line.shifts };
    }
  }
  return fingerLine(shape);
}

/**
 * String skipping: two chord tones on each of three strings with one left
 * out between them (6-4-2 or 5-3-1), the whole shape in one hand position.
 * The set whose first note is the starting tone nearest `fromFret` wins.
 */
export function skipLine(chord: Chord, fromFret: number, start = 0, tuning = STANDARD_TUNING): ArpLine | null {
  const tone = startTone(chord, start);
  if (!tone) return null;
  const pcs = new Set(chord.tones.map((t) => t.pc));
  const lo = Math.max(1, fromFret - 5);
  const hi = Math.min(DEFAULT_FRETS, fromFret + 6);
  let best: { line: FretNote[]; cost: number } | null = null;
  for (const set of [[0, 2, 4], [1, 3, 5]]) {
    const options = set.map((string) => {
      const out: FretNote[] = [];
      for (let f = lo; f <= hi; f += 1) {
        const n = noteAt(string, f, tuning);
        if (pcs.has(n.pc)) out.push(n);
      }
      return out;
    });
    // String by string: one or two chord tones on each (two preferred).
    const walk = (k: number, line: FretNote[]) => {
      if (k === set.length) {
        const frets = line.map((n) => n.fret);
        const span = Math.max(...frets) - Math.min(...frets);
        if (span > HAND_SPAN) return;
        const covered = new Set(line.map((n) => n.pc)).size;
        const cost = span + 0.25 * Math.abs((line[0] as FretNote).fret - fromFret) + 2 * (pcs.size - Math.min(pcs.size, covered)) + 0.8 * (set.length * 2 - line.length);
        if (!best || cost < best.cost) best = { line: [...line], cost };
        return;
      }
      const opts = options[k] ?? [];
      const prev = line[line.length - 1];
      const fits = (n: FretNote, after: FretNote | undefined) => (!after || n.midi > after.midi) && (k > 0 || after !== undefined || n.pc === tone.pc);
      for (let i = 0; i < opts.length; i += 1) {
        const a = opts[i] as FretNote;
        if (!fits(a, prev) || (k === 0 && a.pc !== tone.pc)) continue;
        walk(k + 1, [...line, a]);
        for (let j = i + 1; j < opts.length; j += 1) walk(k + 1, [...line, a, opts[j] as FretNote]);
      }
    };
    walk(0, []);
  }
  const found = best as { line: FretNote[]; cost: number } | null;
  return found ? fingerLine(found.line) : null;
}

/** The way back down: the same places reversed, or a route that avoids them where it can. */
export function descentOf(up: ArpLine, other: boolean, rules: Omit<LineRules, 'avoid' | 'preferFret'>, tuning = STANDARD_TUNING): ArpLine {
  const reversed = [...up.notes].reverse();
  if (!other || reversed.length < 3) return { notes: reversed, shifts: fingerLine(reversed).shifts };
  const top = reversed[0] as FretNote;
  const avoid = new Set(up.notes.slice(0, -1).map(keyOf));
  const line = placeLine(reversed.map((n) => n.midi), { ...rules, preferFret: top.fret, avoid }, tuning);
  if (!line || line[0]?.string !== top.string || line[0]?.fret !== top.fret) return fingerLine(reversed);
  return fingerLine(line);
}

/** Chord tones inside a CAGED form built on the chord's root, one per pitch. */
export function cagedArpeggioNotes(chord: Chord, form: CagedForm, tuning = STANDARD_TUNING): readonly FretNote[] {
  const w = cagedWindow((chord.tones[0]?.pc ?? 0), form, tuning);
  return pitchesInWindow(chord.tones.map((t) => t.pc), w.low, w.high + 1, tuning);
}

/** The CAGED form of `chord` whose window lies nearest to a fret: to stay in one area of the neck. */
export function nearestCagedForm(chord: Chord, fret: number, forms: readonly CagedForm[] = ['C', 'A', 'G', 'E', 'D']): CagedForm {
  let best = forms[0] ?? 'E';
  let bestDistance = Infinity;
  for (const form of forms) {
    const w = cagedWindow((chord.tones[0]?.pc ?? 0), form);
    const distance = Math.abs((w.low + w.high) / 2 - fret);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = form;
    }
  }
  return best;
}

export interface ShapeChoice {
  readonly shape: ArpShape;
  /** Window shape: lowest fret. Routes: where the hand starts. Progression CAGED: area of the neck. */
  readonly low: number;
  readonly form: CagedForm;
  readonly octaves: ArpOctaves;
  readonly strings: SweepStrings;
  readonly ret: ArpReturn;
}

export interface ArpPlan {
  /** Notes to draw. */
  readonly notes: readonly FretNote[];
  /** Played order (direction, return route and step pattern applied). */
  readonly sequence: readonly FretNote[];
  /** Engine fingering for drawn notes; null lets the board finger a single position. */
  readonly fingers: readonly FingeredNote[] | null;
  /** Hand shifts on the way up and on the way down. */
  readonly shifts: number;
  /** False when the shape cannot be played from here: nothing is drawn or played. */
  readonly playable: boolean;
  /** A route: draw only its notes, not every chord tone in its frets. */
  readonly route: boolean;
}

const lineRules = (shape: ArpShape): Omit<LineRules, 'avoid' | 'preferFret'> =>
  shape === 'skip' ? { maxPerString: 2, stringStep: 2 } : { maxPerString: 3, stringStep: 1 };

/** The route a shape takes on one chord, or null. */
export function shapeLine(chord: Chord, c: ShapeChoice, start: number): ArpLine | null {
  switch (c.shape) {
    case 'octaves': return octaveLine(chord, c.low, c.octaves, start);
    case 'sweep': return sweepLine(chord, c.low, c.strings, start);
    case 'skip': return skipLine(chord, c.low, start);
    default: return null;
  }
}

/** Put a route in playing order: up, down, or both with the chosen way back. */
export function routeSequence(up: ArpLine, direction: ArpDirection, ret: ArpReturn, shape: ArpShape): { readonly sequence: readonly FingeredNote[]; readonly down: ArpLine } {
  // A sweep comes back over the same strings: that is the technique.
  const down = descentOf(up, ret === 'other' && shape !== 'sweep', lineRules(shape));
  switch (direction) {
    case 'up': return { sequence: up.notes, down };
    case 'down': return { sequence: down.notes, down };
    case 'updown': return { sequence: [...up.notes, ...down.notes.slice(1)], down };
    case 'downup': return { sequence: [...down.notes, ...up.notes.slice(1)], down };
  }
}

/** Everything Arpeggios Lab needs for one chord: what to draw, what to play, and the fingers. */
export function arpeggioPlan(chord: Chord, c: ShapeChoice, spec: ArpeggioSpec): ArpPlan {
  if (c.shape === 'window' || c.shape === 'caged') {
    const notes = c.shape === 'caged' ? cagedArpeggioNotes(chord, c.form) : arpeggioNotes(chord, c.low);
    return { notes, sequence: arpeggioSequence(chord, notes, spec), fingers: null, shifts: 0, playable: notes.length > 0, route: false };
  }
  const up = shapeLine(chord, c, spec.start);
  if (!up) return { notes: [], sequence: [], fingers: null, shifts: 0, playable: false, route: true };
  const { sequence, down } = routeSequence(up, spec.direction, c.ret, c.shape);
  const usesDown = spec.direction !== 'up' && !spec.customPattern;
  const drawn = new Map<string, FingeredNote>();
  for (const n of [...up.notes, ...(usesDown ? down.notes : [])]) if (!drawn.has(keyOf(n))) drawn.set(keyOf(n), n);
  const notes = [...drawn.values()];
  return {
    notes,
    // A step pattern runs over the route's pitches in their order up the neck.
    sequence: spec.customPattern ? arpeggioSequence(chord, up.notes, spec) : sequence,
    fingers: notes,
    shifts: spec.direction === 'up' || spec.customPattern ? up.shifts.length : spec.direction === 'down' ? down.shifts.length : up.shifts.length + down.shifts.length,
    playable: true,
    route: true,
  };
}
