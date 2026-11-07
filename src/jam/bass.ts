/**
 * Jam bass lines, generated from the progression: a pattern says where notes
 * fall in a 4/4 bar (sixteenth steps) and which chord tone each plays; the
 * chord under it decides the pitch. The last note before a chord change can
 * approach the next root by a semitone. Pure, no DOM.
 */
import { mod, type Chord } from '../theory';
import { PPQ, ticksPerBar, type BassPayload, type Meter, type Track, type TrackEvent } from '../timeline';
import { chordSpans, progressionLength, type Progression } from './progression';

export type BassTone = 'root' | 'third' | 'fifth' | 'sixth' | 'seventh' | 'octave' | 'approach';

export interface BassNote {
  /** Sixteenth of a 4/4 bar, 0–15. */
  readonly step: number;
  /** In sixteenths. */
  readonly length: number;
  readonly tone: BassTone;
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
export function bassPitch(chord: Chord, tone: Exclude<BassTone, 'approach'>): number {
  const root = lowNote(chord.tones.find((t) => t.semitones === 0)?.pc ?? chord.tones[0]?.pc ?? 0);
  switch (tone) {
    case 'root': return chord.bass ? lowNote(chord.bass.pc) : root;
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
  spans.forEach((span, i) => {
    const end = span.tick + span.lengthTicks;
    const next = spans[i + 1]?.chord ?? (loop ? spans[0]?.chord : undefined) ?? null;
    const hits: { tick: number; length: number; tone: BassTone }[] = [];
    for (let barStart = Math.floor(span.tick / bar) * bar; barStart < end; barStart += bar) {
      for (const note of notesInBar(pattern, bar / sixteenth)) {
        const tick = barStart + note.step * sixteenth;
        if (tick >= span.tick && tick < end) hits.push({ tick, length: note.length * sixteenth, tone: note.tone });
      }
    }
    // A chord that starts between pattern notes still gets its root on the change.
    if (!hits.some((h) => h.tick === span.tick)) hits.push({ tick: span.tick, length: sixteenth * 4, tone: 'root' });
    hits.sort((a, b) => a.tick - b.tick);
    // On the change itself the bass states the new root, whatever the pattern says there.
    const first = hits[0];
    if (first && first.tick === span.tick) hits[0] = { ...first, tone: 'root' };
    hits.forEach((hit, k) => {
      const following = hits[k + 1]?.tick ?? end;
      const last = k === hits.length - 1;
      const midi = hit.tone === 'approach'
        ? (last && next && previous !== null ? approachPitch(next, previous) : bassPitch(span.chord, last ? 'fifth' : 'octave'))
        : bassPitch(span.chord, hit.tone);
      events.push({
        tick: hit.tick,
        payload: { type: 'bass', midi, durationTicks: Math.max(sixteenth, Math.min(hit.length, following - hit.tick) * 0.92), velocity: hit.tick % bar === 0 ? 0.9 : 0.75 },
      });
      previous = midi;
    });
  });
  return { id: 'bass', lengthTicks: progressionLength(p, meter), loop, events };
}
