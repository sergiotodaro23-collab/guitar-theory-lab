/**
 * Jam bass lines, generated from the progression: a pattern says where notes
 * fall in a 4/4 bar (sixteenth steps) and which chord tone each plays; the
 * chord under it decides the pitch. The last note before a chord change can
 * approach the next root by a semitone. Notes carry an articulation (ghost,
 * staccato, slide) and a dynamic shaped by where they fall in the bar (J4).
 * Pure, no DOM.
 */
import { mod, type Chord } from '../theory';
import { PPQ, ticksPerBar, type BassPayload, type Meter, type Track, type TrackEvent } from '../timeline';
import { chordSpans, progressionLength, type Progression } from './progression';

/**
 * `approach`: a half step into the next root. `anticipate`: the next chord's
 * root an eighth or a sixteenth early, held into the change (fusion, latin).
 */
export type BassTone = 'root' | 'second' | 'third' | 'fifth' | 'sixth' | 'seventh' | 'octave' | 'approach' | 'anticipate';

/**
 * `ghost`: a muted, barely pitched note between the main ones (funk's dead
 * notes). `staccato`: cut to half its length. `slide`: reached by sliding up
 * or down the string from the note before.
 */
export type BassArticulation = 'normal' | 'ghost' | 'staccato' | 'slide';

export interface BassNote {
  /** Sixteenth of a 4/4 bar, 0–15. */
  readonly step: number;
  /** In sixteenths. */
  readonly length: number;
  readonly tone: BassTone;
  readonly articulation?: BassArticulation;
}

export interface BassPattern {
  readonly name: string;
  readonly notes: readonly BassNote[];
}

/** Lowest bass register: the root sits between E1 (MIDI 28) and D#2 (39), like the open E string. */
export const BASS_LOW = 28;
const lowNote = (pc: number): number => BASS_LOW + mod(pc - 4, 12);

const semitonesOf = (chord: Chord, degrees: readonly string[]): number | null =>
  chord.tones.find((t) => degrees.includes(t.degree))?.semitones ?? null;

/** Pitch of a chord tone above the chord's low root. A slash chord's root tone is its bass note. */
export function bassPitch(chord: Chord, tone: Exclude<BassTone, 'approach' | 'anticipate'>): number {
  const root = lowNote(chord.tones.find((t) => t.semitones === 0)?.pc ?? chord.tones[0]?.pc ?? 0);
  switch (tone) {
    case 'root': return chord.bass ? lowNote(chord.bass.pc) : root;
    // The passing step between root and third: a whole tone, a half step when the chord alters the ninth (b9, #9: Phrygian, altered).
    case 'second': return root + (chord.tones.some((t) => t.degree === 'b9' || t.degree === '#9') ? 1 : 2);
    case 'third': return root + (semitonesOf(chord, ['3', 'b3']) ?? semitonesOf(chord, ['4', '2']) ?? 4);
    case 'fifth': return root + (semitonesOf(chord, ['5', 'b5', '#5']) ?? 7);
    case 'sixth': return root + 9;
    case 'seventh': return root + (semitonesOf(chord, ['7', 'b7', 'bb7']) ?? 12);
    case 'octave': return root + 12;
  }
}

/**
 * A semitone away from the root the next chord will play, on the side nearer
 * the note just played; below on a tie. Chromatic approach, the walking-bass
 * staple: it always resolves by a half step.
 */
export function approachPitch(nextChord: Chord, previous: number): number {
  const target = bassPitch(nextChord, 'root');
  return Math.abs(target + 1 - previous) < Math.abs(target - 1 - previous) ? target + 1 : target - 1;
}

/**
 * How hard a note is played: the bar's downbeat strongest, then the other
 * beats, then the off-beats; an anticipation is pushed almost like a
 * downbeat; a ghost is barely there. `position` is the sixteenth in the bar.
 */
export function bassVelocity(position: number, tone: BassTone, articulation: BassArticulation = 'normal'): number {
  if (articulation === 'ghost') return 0.35;
  if (position === 0) return 0.9;
  if (tone === 'anticipate') return 0.88;
  if (position % 4 === 0) return 0.8;
  return position % 2 === 0 ? 0.74 : 0.7;
}

/** The longest slide a bassist plays from the note before; farther, the slide starts two frets below. */
const SLIDE_RANGE = 7;
export const slideStart = (midi: number, previous: number | null): number =>
  previous !== null && previous !== midi && Math.abs(previous - midi) <= SLIDE_RANGE ? previous : midi - 2;

const notesInBar = (pattern: BassPattern, sixteenths: number): readonly BassNote[] => {
  // Bars longer than 16 sixteenths start the pattern again; shorter ones cut it.
  const out: BassNote[] = [];
  for (let offset = 0; offset < sixteenths; offset += 16) {
    for (const note of pattern.notes) if (offset + note.step < sixteenths) out.push({ ...note, step: offset + note.step });
  }
  return out;
};

export function bassTrack(p: Progression, meter: Meter, pattern: BassPattern, loop: boolean): Omit<Track<BassPayload>, 'originTick'> {
  const bar = ticksPerBar(meter);
  const sixteenth = PPQ / 4;
  const spans = chordSpans(p, meter);
  const events: TrackEvent<BassPayload>[] = [];
  let previous: number | null = null;
  let anticipated = false;
  spans.forEach((span, i) => {
    const end = span.tick + span.lengthTicks;
    const next = spans[i + 1]?.chord ?? (loop ? spans[0]?.chord : undefined) ?? null;
    const hits: { tick: number; length: number; tone: BassTone; articulation: BassArticulation }[] = [];
    for (let barStart = Math.floor(span.tick / bar) * bar; barStart < end; barStart += bar) {
      for (const note of notesInBar(pattern, bar / sixteenth)) {
        const tick = barStart + note.step * sixteenth;
        if (tick >= span.tick && tick < end) hits.push({ tick, length: note.length * sixteenth, tone: note.tone, articulation: note.articulation ?? 'normal' });
      }
    }
    // A chord that starts between pattern notes still gets its root on the change.
    if (!hits.some((h) => h.tick === span.tick)) hits.push({ tick: span.tick, length: sixteenth * 4, tone: 'root', articulation: 'normal' });
    hits.sort((a, b) => a.tick - b.tick);
    // On the change itself the bass states the new root (or its octave), whatever the pattern says there, and never as a ghost.
    const first = hits[0];
    if (first && first.tick === span.tick) {
      hits[0] = { ...first, tone: first.tone === 'octave' ? 'octave' : 'root', articulation: first.articulation === 'ghost' ? 'normal' : first.articulation };
    }
    // The root already sounded early and is still held: no second attack on the downbeat.
    if (anticipated && hits.length > 1 && hits[0]?.tick === span.tick) hits.shift();
    anticipated = false;
    hits.forEach((hit, k) => {
      const following = hits[k + 1]?.tick ?? end;
      const last = k === hits.length - 1;
      const midi = hit.tone === 'approach'
        ? (last && next && previous !== null ? approachPitch(next, previous) : bassPitch(span.chord, last ? 'fifth' : 'octave'))
        : hit.tone === 'anticipate'
          ? (last && next ? bassPitch(next, 'root') : bassPitch(span.chord, 'root'))
          : bassPitch(span.chord, hit.tone);
      const written = Math.min(hit.length, following - hit.tick);
      // An anticipation is held over the bar line into the chord it belongs to.
      const held = hit.tone === 'anticipate' && last && next ? hit.length * 0.96 : Math.max(sixteenth, written * 0.92);
      const short = hit.articulation === 'ghost' || hit.articulation === 'staccato';
      events.push({
        tick: hit.tick,
        payload: {
          type: 'bass', midi,
          durationTicks: short ? Math.max(sixteenth / 2, Math.min(written * 0.5, sixteenth)) : held,
          velocity: bassVelocity((hit.tick % bar) / sixteenth, hit.tone, hit.articulation),
          ...(hit.articulation !== 'normal' ? { articulation: hit.articulation } : {}),
          ...(hit.articulation === 'slide' ? { slideFrom: slideStart(midi, previous) } : {}),
        },
      });
      previous = midi;
      if (last && hit.tone === 'anticipate' && next) anticipated = true;
    });
  });
  return { id: 'bass', lengthTicks: progressionLength(p, meter), loop, events };
}
