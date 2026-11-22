/**
 * Voice leading of the comping (J5). Each chord is voiced by its upper tones
 * (guide tones first, then the colour tones, at most four) over its bass, and
 * the whole progression is voiced at once: among every close and drop-2
 * position in the register, the path with the least total motion wins, the
 * loop back to the first chord included. Common tones are held, the other
 * voices move by the nearest step, and the register cannot drift because
 * leaving the centre costs a little. Pure, no DOM.
 */
import { mod, type Chord } from '../theory';
import { guideTones } from '../harmony';

/** Upper voices live between F3 and E5: under the melody, over the bass. */
export const COMP_LOW = 53;
export const COMP_HIGH = 76;
const CENTRE = 64;
/** Cost of one semitone of distance between the voicing's centre and E4, against one semitone of motion. */
const DRIFT = 0.15;

/** The bass note of the comping voicing: E2–D#3, the slash bass when there is one. */
export const compBass = (chord: Chord): number => 40 + mod((chord.bass?.pc ?? (chord.tones[0] as Chord['tones'][number]).pc) - 4, 12);

/** Pitch classes above the bass: guide tones first, then the others; the root only when nothing else is left. */
export function upperTones(chord: Chord): readonly number[] {
  const guides = guideTones(chord).map((t) => t.pc);
  const others = chord.tones.filter((t) => t.semitones !== 0).map((t) => t.pc);
  const pcs = [...new Set([...guides, ...others])].slice(0, 4);
  const root = chord.tones[0]?.pc ?? 0;
  return pcs.length >= 3 ? pcs : [...new Set([...pcs, root])];
}

/** Every close and drop-2 position of these pitch classes inside the comping register, sorted low to high. */
export function positions(pcs: readonly number[]): readonly (readonly number[])[] {
  const out: number[][] = [];
  const seen = new Set<string>();
  const add = (v: number[]) => {
    const sorted = [...v].sort((a, b) => a - b);
    if (sorted[0] === undefined || (sorted[0] as number) < COMP_LOW || (sorted.at(-1) as number) > COMP_HIGH) return;
    const key = sorted.join(',');
    if (!seen.has(key)) { seen.add(key); out.push(sorted); }
  };
  const ordered = [...pcs].sort((a, b) => a - b);
  for (let lowest = COMP_LOW; lowest <= COMP_HIGH; lowest += 1) {
    const start = ordered.indexOf(mod(lowest, 12));
    if (start < 0) continue;
    // Close position: each next tone the nearest one above.
    const close: number[] = [lowest];
    for (let k = 1; k < ordered.length; k += 1) {
      const pc = ordered[(start + k) % ordered.length] as number;
      const prev = close[k - 1] as number;
      close.push(prev + mod(pc - prev, 12) || prev + 12);
    }
    add(close);
    // Drop 2: the second voice from the top an octave down (four voices only), the guitarist's and pianist's spread.
    if (close.length === 4) add([close[0] as number, close[1] as number, (close[2] as number) - 12, close[3] as number]);
  }
  return out;
}

/** Motion between two voicings: voices matched low to high, extra voices matched to the nearest. */
export function motion(a: readonly number[], b: readonly number[]): number {
  if (a.length === b.length) return a.reduce((sum, x, i) => sum + Math.abs(x - (b[i] as number)), 0);
  const [few, many] = a.length < b.length ? [a, b] : [b, a];
  return many.reduce((sum, x) => sum + Math.min(...few.map((y) => Math.abs(x - y))), 0);
}

/** The largest single-voice leap between two voicings. */
export function largestLeap(a: readonly number[], b: readonly number[]): number {
  const [few, many] = a.length <= b.length ? [a, b] : [b, a];
  return Math.max(...many.map((x) => Math.min(...few.map((y) => Math.abs(x - y)))));
}

const drift = (v: readonly number[]): number => DRIFT * Math.abs(v.reduce((s, x) => s + x, 0) / v.length - CENTRE);

/**
 * Upper voices for each chord, the progression voiced as one line. With
 * `loop`, the move from the last chord back to the first counts too. `fixed`
 * entries (a voicing chosen elsewhere) are kept and the others lead to them.
 */
export function voiceLead(chords: readonly Chord[], loop: boolean, fixed?: readonly (readonly number[] | null)[]): readonly (readonly number[])[] {
  if (chords.length === 0) return [];
  const options = chords.map((chord, i) => {
    const own = fixed?.[i];
    if (own) return [own];
    const found = positions(upperTones(chord));
    return found.length ? found : [[...upperTones(chord)].map((pc) => CENTRE - 6 + mod(pc - (CENTRE - 6), 12)).sort((a, b) => a - b)];
  });
  // Viterbi over the positions; for a loop, once per start position so the wrap-around is costed.
  const starts = loop && chords.length > 1 ? options[0]?.map((_, i) => i) ?? [0] : [null];
  let best: { cost: number; path: number[] } | null = null;
  for (const start of starts) {
    let cost = (options[0] as number[][]).map((v, i) => (start === null || i === start ? drift(v) : Infinity));
    const back: number[][] = [];
    for (let c = 1; c < options.length; c += 1) {
      const prev = options[c - 1] as number[][];
      const here = options[c] as number[][];
      const step = here.map((v) => {
        let min = Infinity;
        let arg = 0;
        prev.forEach((p, j) => {
          const total = (cost[j] as number) + motion(p, v);
          if (total < min) { min = total; arg = j; }
        });
        return { cost: min + drift(v), arg };
      });
      cost = step.map((s) => s.cost);
      back.push(step.map((s) => s.arg));
    }
    const last = options.at(-1) as number[][];
    const first = (options[0] as number[][])[start ?? 0] as number[];
    const finals = cost.map((c, i) => c + (start !== null ? motion(last[i] as number[], first) : 0));
    const end = finals.reduce((bi, c, i) => (c < (finals[bi] as number) ? i : bi), 0);
    if (!best || (finals[end] as number) < best.cost) {
      const path = [end];
      for (let c = back.length - 1; c >= 0; c -= 1) path.unshift((back[c] as number[])[path[0] as number] as number);
      best = { cost: finals[end] as number, path };
    }
  }
  return (best as { path: number[] }).path.map((index, c) => (options[c] as number[][])[index] as number[]);
}
