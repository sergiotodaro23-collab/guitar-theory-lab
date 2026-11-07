/**
 * Jam Session Engine: progressions as data, with pure edits, plus their
 * translation into timeline tracks. Harmonic Context Switch uses it too.
 */
import { mod, noteName, parseChord, parseDegree, parseNote, spellDegree, transposeNote, tryParseChord, type Chord } from '../theory';
import { ticksPerBar, ticksPerBeat, type ChordChangePayload, type CompPayload, type Meter, type Track } from '../timeline';
import { guideTones } from '../harmony';

export interface ChordDuration {
  readonly value: number;
  readonly unit: 'bars' | 'beats';
}

export interface ProgressionChord {
  readonly id: string;
  readonly symbol: string;
  readonly duration: ChordDuration;
}

export interface Progression {
  readonly name: string;
  readonly chords: readonly ProgressionChord[];
}

let idCounter = 0;
export const newChordId = (): string => {
  idCounter += 1;
  return `c${Date.now().toString(36)}${idCounter}`;
};

export const withChord = (symbol: string, duration: ChordDuration = { value: 1, unit: 'bars' }): ProgressionChord => ({ id: newChordId(), symbol, duration });

export function addChord(p: Progression, symbol: string, duration?: ChordDuration): Progression {
  return { ...p, chords: [...p.chords, withChord(symbol, duration)] };
}

export function removeChord(p: Progression, index: number): Progression {
  return { ...p, chords: p.chords.filter((_, i) => i !== index) };
}

export function duplicateChord(p: Progression, index: number): Progression {
  const chord = p.chords[index];
  if (!chord) return p;
  const chords = [...p.chords];
  chords.splice(index + 1, 0, { ...chord, id: newChordId() });
  return { ...p, chords };
}

export function moveChord(p: Progression, index: number, delta: number): Progression {
  const target = index + delta;
  const chord = p.chords[index];
  if (!chord || target < 0 || target >= p.chords.length) return p;
  const chords = p.chords.filter((_, i) => i !== index);
  chords.splice(target, 0, chord);
  return { ...p, chords };
}

export function updateChord(p: Progression, index: number, change: Partial<Omit<ProgressionChord, 'id'>>): Progression {
  return { ...p, chords: p.chords.map((chord, i) => (i === index ? { ...chord, ...change } : chord)) };
}

export function transposeSymbol(symbol: string, semitones: number): string {
  const chord = parseChord(symbol);
  const bass = chord.bass ? `/${noteName(transposeNote(chord.bass.note, semitones))}` : '';
  return `${noteName(transposeNote(chord.root, semitones))}${chord.suffix}${bass}`;
}

export function transposeProgression(p: Progression, semitones: number): Progression {
  if (mod(semitones, 12) === 0) return p;
  return { ...p, chords: p.chords.map((chord) => ({ ...chord, symbol: transposeSymbol(chord.symbol, semitones) })) };
}

export function parsedChords(p: Progression): readonly Chord[] {
  return p.chords.map((chord) => parseChord(chord.symbol));
}

export const durationTicks = (duration: ChordDuration, meter: Meter): number =>
  duration.unit === 'bars' ? duration.value * ticksPerBar(meter) : duration.value * ticksPerBeat(meter);

export interface ChordSpan {
  readonly index: number;
  readonly chord: Chord;
  readonly tick: number;
  readonly lengthTicks: number;
}

export function chordSpans(p: Progression, meter: Meter): readonly ChordSpan[] {
  let tick = 0;
  return p.chords.map((entry, index) => {
    const span = { index, chord: parseChord(entry.symbol), tick, lengthTicks: durationTicks(entry.duration, meter) };
    tick += span.lengthTicks;
    return span;
  });
}

export const progressionLength = (p: Progression, meter: Meter): number =>
  p.chords.reduce((sum, chord) => sum + durationTicks(chord.duration, meter), 0);

export function chordTrack(p: Progression, meter: Meter, loop: boolean): Omit<Track<ChordChangePayload>, 'originTick'> {
  return {
    id: 'chords',
    lengthTicks: progressionLength(p, meter),
    loop,
    events: chordSpans(p, meter).map((span) => ({ tick: span.tick, payload: { type: 'chord', chordIndex: span.index } })),
  };
}

export type CompPattern = 'sustain' | 'half' | 'quarter' | 'charleston' | 'offbeat' | 'eighths' | 'push' | 'stabs';

export const COMP_PATTERNS: Readonly<Record<CompPattern, string>> = {
  sustain: 'Tenuto',
  half: 'Metà battuta',
  quarter: 'Ogni movimento',
  charleston: 'Charleston',
  offbeat: 'In levare',
  eighths: 'Ottavi',
  push: 'Anticipi',
  stabs: 'Colpi sincopati',
};

/** Offsets in beats inside a bar. */
function patternBeats(pattern: CompPattern, beatsPerBar: number): readonly number[] {
  const all = Array.from({ length: beatsPerBar }, (_, i) => i);
  switch (pattern) {
    case 'sustain': return [0];
    case 'half': return [0, Math.floor(beatsPerBar / 2)];
    case 'quarter': return all;
    case 'charleston': return beatsPerBar >= 2 ? [0, 1.5] : [0];
    case 'offbeat': return all.map((beat) => beat + 0.5);
    case 'eighths': return all.flatMap((beat) => [beat, beat + 0.5]);
    // Push: on the one and the and of two; the next chord arrives an eighth early (see compTrack).
    case 'push': return beatsPerBar >= 3 ? [0, 1.5] : [0];
    // Short sixteenth stabs on the e of one, the and of two, the a of three (funk and fusion comping).
    case 'stabs': return [0.25, 1.5, 2.75].filter((b) => b < beatsPerBar);
  }
}

/** Close voicing around a centre: guide tones first, bass underneath. */
export function voiceChord(chord: Chord, previous?: readonly number[]): readonly number[] {
  const bassPc = chord.bass?.pc ?? (chord.tones[0] as Chord['tones'][number]).pc;
  const bass = 40 + mod(bassPc - 4, 12); // E2..D#3, the slash bass when there is one
  const guides = guideTones(chord);
  const others = chord.tones.filter((tone) => tone.semitones !== 0 && !guides.some((g) => g.pc === tone.pc));
  const upper = [...guides, ...others].slice(0, 4);
  const center = previous && previous.length > 1 ? previous.slice(1).reduce((a, b) => a + b, 0) / (previous.length - 1) : 62;
  const voiced = upper.map((tone) => {
    const candidate = Math.round(center) - mod(Math.round(center) - tone.pc, 12);
    const options = [candidate, candidate + 12];
    return options.reduce((best, option) => (Math.abs(option - center) < Math.abs(best - center) ? option : best));
  });
  const clamped = voiced.map((midi) => (midi < bass + 7 ? midi + 12 : midi > 76 ? midi - 12 : midi));
  return [bass, ...[...new Set(clamped)].sort((a, b) => a - b)];
}

/** Patterns that play short: a stab is a sixteenth or so, not a held chord. */
const SHORT: ReadonlySet<CompPattern> = new Set(['stabs']);

/**
 * With `bassLine`, the bass player has the low notes: the comp leaves its bass
 * out. With "push" each chord after the first arrives an eighth before its
 * bar line and is held across it (an anticipation), as fusion, funk and latin
 * players do; the downbeat is not struck again.
 */
export function compTrack(p: Progression, meter: Meter, pattern: CompPattern, loop: boolean, bassLine = false): Omit<Track<CompPayload>, 'originTick'> {
  const beat = ticksPerBeat(meter);
  const bar = ticksPerBar(meter);
  const patternTicks = patternBeats(pattern, meter.beatsPerBar).map((b) => b * beat);
  const spans = chordSpans(p, meter);
  const voicings: (readonly number[])[] = [];
  spans.forEach((span, i) => voicings.push(voiceChord(span.chord, voicings[i - 1])));

  type Hit = { tick: number; chord: number; anticipated: boolean };
  const hits: Hit[] = [];
  spans.forEach((span, i) => {
    const end = span.tick + span.lengthTicks;
    const own = new Set<number>([span.tick]);
    for (let barStart = Math.floor(span.tick / bar) * bar; barStart < end; barStart += bar) {
      for (const offset of patternTicks) {
        const tick = barStart + offset;
        if (tick >= span.tick && tick < end) own.add(tick);
      }
    }
    for (const tick of own) hits.push({ tick, chord: i, anticipated: false });
  });
  if (pattern === 'push' && spans.length > 1) {
    const early = beat / 2;
    spans.forEach((span, i) => {
      if (i === 0) return;
      const at = span.tick - early;
      const previous = spans[i - 1];
      if (!previous || at <= previous.tick) return;
      // The anticipation replaces whatever the old chord had from there on, and the new chord's downbeat.
      for (let k = hits.length - 1; k >= 0; k -= 1) {
        const h = hits[k] as Hit;
        if ((h.chord === i - 1 && h.tick >= at) || (h.chord === i && h.tick === span.tick)) hits.splice(k, 1);
      }
      hits.push({ tick: at, chord: i, anticipated: true });
    });
  }
  hits.sort((a, b) => a.tick - b.tick);
  const total = progressionLength(p, meter);
  const events: Track<CompPayload>['events'][number][] = hits.map((hit, k) => {
    const next = hits[k + 1]?.tick ?? total;
    const voicing = voicings[hit.chord] as readonly number[];
    const held = Math.max(beat / 4, (next - hit.tick) * 0.92);
    return {
      tick: hit.tick,
      payload: {
        type: 'comp',
        midis: bassLine ? voicing.slice(1) : voicing,
        durationTicks: SHORT.has(pattern) ? Math.min(held, beat / 3) : held,
        velocity: hit.anticipated ? 0.82 : hit.tick % bar === 0 ? 0.8 : SHORT.has(pattern) ? 0.72 : 0.62,
      },
    };
  });
  return { id: 'comp', lengthTicks: total, loop, events };
}

export interface ProgressionTemplate {
  readonly id: string;
  readonly name: string;
  readonly defaultKey: string;
  /** "degree suffix beats": degree relative to the key, major-scale numbering. */
  readonly steps: readonly (readonly [degree: string, suffix: string, beats: number])[];
}

const A_SECTION: ProgressionTemplate['steps'] = [
  ['1', 'maj7', 2], ['6', 'm7', 2], ['2', 'm7', 2], ['5', '7', 2],
  ['3', 'm7', 2], ['6', 'm7', 2], ['2', 'm7', 2], ['5', '7', 2],
  ['5', 'm7', 2], ['1', '7', 2], ['4', 'maj7', 2], ['b7', '7', 2],
  ['3', 'm7', 2], ['6', '7', 2], ['2', 'm7', 2], ['5', '7', 2],
];

export const PROGRESSION_TEMPLATES: readonly ProgressionTemplate[] = [
  { id: 'ii-v-i', name: 'ii–V–I maggiore', defaultKey: 'C', steps: [['2', 'm7', 4], ['5', '7', 4], ['1', 'maj7', 8]] },
  { id: 'ii-v-i-minor', name: 'iiø–V7–i minore', defaultKey: 'A', steps: [['2', 'm7b5', 4], ['5', '7b9', 4], ['1', 'm7', 8]] },
  {
    id: 'blues',
    name: 'Blues in dodici battute',
    defaultKey: 'A',
    steps: [
      ['1', '7', 4], ['4', '7', 4], ['1', '7', 8], ['4', '7', 8], ['1', '7', 8],
      ['5', '7', 4], ['4', '7', 4], ['1', '7', 4], ['5', '7', 4],
    ],
  },
  { id: 'i-vi-ii-v', name: 'I–vi–ii–V', defaultKey: 'C', steps: [['1', 'maj7', 4], ['6', 'm7', 4], ['2', 'm7', 4], ['5', '7', 4]] },
  { id: 'modal', name: 'Vamp modale dorico', defaultKey: 'D', steps: [['1', 'm7', 8], ['4', '7', 8]] },
  {
    id: 'rhythm',
    name: 'Rhythm changes semplificati',
    defaultKey: 'Bb',
    steps: [...A_SECTION, ['3', '7', 8], ['6', '7', 8], ['2', '7', 8], ['5', '7', 8]],
  },
];

export function instantiateTemplate(template: ProgressionTemplate, key: string): Progression {
  const tonic = parseNote(key);
  return {
    name: template.name,
    chords: template.steps.map(([degree, suffix, beats]) => {
      const root = spellDegree(tonic, parseDegree(degree));
      const respelled = Math.abs(root.accidental) >= 2 ? transposeNote(root, 0) : root;
      const duration: ChordDuration = beats % 4 === 0 ? { value: beats / 4, unit: 'bars' } : { value: beats, unit: 'beats' };
      return withChord(`${noteName(respelled)}${suffix}`, duration);
    }),
  };
}

export function isValidProgression(p: Progression): boolean {
  return p.chords.length > 0 && p.chords.every((c) => tryParseChord(c.symbol) !== null && c.duration.value > 0);
}
