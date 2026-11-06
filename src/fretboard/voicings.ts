/**
 * Playable chord voicings: one note or a mute per string, inside a four-fret
 * hand position, with the requested bass at the bottom. A search over the
 * neck, not a table of shapes, so every chord the parser knows gets voicings.
 */
import { mod, type Chord } from '../theory';
import { DEFAULT_FRETS, STANDARD_TUNING, type FretNote } from './positions';

export interface Voicing {
  /** One entry per string, low E first: a fret number or null for a muted string. */
  readonly frets: readonly (number | null)[];
  readonly notes: readonly FretNote[];
  /** Lowest fretted note, or 0 for an all-open shape: where the hand sits. */
  readonly baseFret: number;
  /** Chord degrees from the lowest sounding note up. */
  readonly degrees: readonly string[];
}

/** Hand span: four frets, index to pinky. */
const SPAN = 3;
/** Open strings ring alongside shapes up to here. */
const OPEN_STRINGS_UP_TO = 3;

/**
 * Tones a voicing cannot leave out. Triads and seventh chords need every
 * tone; bigger chords may drop the fifth, and then the root, as guitarists do.
 */
function requiredPcs(chord: Chord): ReadonlySet<number> {
  let tones = chord.tones;
  if (tones.length >= 5) tones = tones.filter((t) => t.degree !== '5');
  if (tones.length >= 5) tones = tones.filter((t) => t.degree !== '1');
  if (tones.length >= 5) tones = tones.filter((t) => t.degree !== '9');
  return new Set(tones.map((t) => t.pc));
}

/** Guide tones plus the bass: the floor when the full set does not fit a hand. */
function minimalPcs(chord: Chord): ReadonlySet<number> {
  const guide = chord.tones.filter((t) => /^(b?3|4|2|b?7|bb7|6)$/.test(t.degree));
  return new Set(guide.map((t) => t.pc));
}

export const voicingKey = (v: Voicing): string => v.frets.map((f) => (f === null ? 'x' : String(f))).join('-');

function candidates(start: number, frets: number, tuning: readonly number[], allowed: ReadonlySet<number>): (number | null)[][] {
  const end = Math.min(frets, start + SPAN);
  return tuning.map((open) => {
    const options: (number | null)[] = [null];
    if (start <= OPEN_STRINGS_UP_TO && allowed.has(mod(open, 12))) options.push(0);
    for (let fret = Math.max(1, start); fret <= end; fret += 1) {
      if (allowed.has(mod(open + fret, 12))) options.push(fret);
    }
    return options;
  });
}

function score(frets: readonly (number | null)[]): number {
  const sounded = frets.filter((f) => f !== null).length;
  const fretted = frets.filter((f): f is number => f !== null && f > 0);
  const first = frets.findIndex((f) => f !== null);
  const last = frets.length - 1 - [...frets].reverse().findIndex((f) => f !== null);
  const innerMutes = frets.slice(first, last + 1).filter((f) => f === null).length;
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  // Open strings ringing against a hand past the fourth fret are unusual and hard to hear clean.
  const highOpen = fretted.some((f) => f > 4) ? frets.filter((f) => f === 0).length : 0;
  // More strings, fewer gaps, a compact hand.
  return (6 - sounded) * 1.2 + innerMutes * 2.5 + span * 0.6 + highOpen * 1.5;
}

export interface VoicingOptions {
  readonly frets?: number;
  readonly tuning?: readonly number[];
  /** Best shapes kept per hand position; Infinity keeps all. */
  readonly perPosition?: number;
}

function search(chord: Chord, required: ReadonlySet<number>, options: VoicingOptions): Voicing[] {
  const frets = options.frets ?? DEFAULT_FRETS;
  const tuning = options.tuning ?? STANDARD_TUNING;
  const perPosition = options.perPosition ?? 1;
  const bassPc = chord.bass?.pc ?? (chord.tones[0]?.pc ?? 0);
  const allowed = new Set([...chord.tones.map((t) => t.pc), bassPc]);
  const found = new Map<string, { voicing: Voicing; score: number }>();

  for (let start = 0; start <= frets - SPAN; start += 1) {
    const perString = candidates(start, frets, tuning, allowed);
    const inWindow: { voicing: Voicing; score: number }[] = [];
    const pick: (number | null)[] = [];

    const walk = (string: number) => {
      if (string === tuning.length) {
        evaluate();
        return;
      }
      for (const option of perString[string] ?? [null]) {
        pick[string] = option;
        walk(string + 1);
      }
    };

    const evaluate = () => {
      const sounded = pick.flatMap((fret, string) => (fret === null ? [] : [{ string, fret: fret as number }]));
      if (sounded.length < 3) return;
      const notes = sounded.map(({ string, fret }) => {
        const midi = (tuning[string] as number) + fret;
        return { string, fret, midi, pc: mod(midi, 12) };
      });
      const lowest = notes.reduce((a, b) => (b.midi < a.midi ? b : a));
      if (lowest.pc !== bassPc) return;
      // A slash bass that is not a chord tone sounds only in the bass.
      if (chord.bass && chord.bass.degree === null && notes.some((n) => n !== lowest && n.pc === bassPc && !chord.tones.some((t) => t.pc === bassPc))) return;
      const pcs = new Set(notes.map((n) => n.pc));
      for (const pc of required) if (!pcs.has(pc)) return;

      const first = sounded[0]?.string ?? 0;
      const last = sounded[sounded.length - 1]?.string ?? 0;
      const gaps = last - first + 1 - sounded.length;
      if (gaps > 1) return;

      const fretted = sounded.filter((s) => s.fret > 0).map((s) => s.fret);
      if (fretted.length > 0) {
        const low = Math.min(...fretted);
        if (Math.max(...fretted) - low > SPAN) return;
        // Four fingers: past four fretted notes the index must barre the lowest fret.
        const aboveBarre = fretted.filter((f) => f > low).length;
        const barre = fretted.filter((f) => f === low).length;
        if (fretted.length > 4 && (barre < 2 || aboveBarre > 3)) return;
        // The shape must start in this window, or the next window finds it again.
        if (low !== Math.max(1, start)) return;
      } else if (start !== 0 || gaps > 0) {
        // All-open shapes belong to the first window, and only with no skipped string.
        return;
      }

      const frets_ = tuning.map((_, string) => pick[string] ?? null);
      const sorted = [...notes].sort((a, b) => a.midi - b.midi);
      const voicing: Voicing = {
        frets: frets_,
        notes,
        baseFret: fretted.length ? Math.min(...fretted) : 0,
        degrees: sorted.map((n) => chord.tones.find((t) => t.pc === n.pc)?.degree ?? chord.bass?.name ?? '?'),
      };
      inWindow.push({ voicing, score: score(frets_) });
    };

    walk(0);
    inWindow.sort((a, b) => a.score - b.score);
    for (const entry of inWindow.slice(0, perPosition)) {
      const k = voicingKey(entry.voicing);
      if (!found.has(k)) found.set(k, entry);
    }
  }
  return [...found.values()].sort((a, b) => a.voicing.baseFret - b.voicing.baseFret || a.score - b.score).map((e) => e.voicing);
}

/**
 * Voicings ordered along the neck. Chords too dense for one hand fall back to
 * guide tones plus the bass, so even C7alt gets something playable.
 */
export function chordVoicings(chord: Chord, options: VoicingOptions = {}): readonly Voicing[] {
  const full = search(chord, requiredPcs(chord), options);
  if (full.length > 0) return full;
  return search(chord, minimalPcs(chord), options);
}
