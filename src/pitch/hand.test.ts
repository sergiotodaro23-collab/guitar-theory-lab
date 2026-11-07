import { describe, expect, it } from 'vitest';
import { cagedPosition } from '../fretboard';
import { buildScale } from '../theory';
import { HandEstimator } from './hand';

const STD = [40, 45, 50, 55, 59, 64];
const midiAt = (string: number, fret: number) => (STD[string] ?? 0) + fret;
// C major, E form: frets 7–10.
const shape = cagedPosition(buildScale('C', 'ionian'), 'E').notes;

describe('where the hand is (Live Monitor 2.0)', () => {
  it('a single note with no context gets no full position, even inside the shape', () => {
    const hand = new HandEstimator();
    const e = hand.estimate(midiAt(3, 9), 0, shape);
    expect(e.likely).toBeNull();
    expect(e.all.length).toBeGreaterThan(1);
    expect(e.all.reduce((s, p) => s + p.probability, 0)).toBeCloseTo(1);
  });

  it('inside the shape, with context, the shape and the hand agree', () => {
    const hand = new HandEstimator();
    hand.estimate(midiAt(3, 7), 0, shape);
    const e = hand.estimate(midiAt(3, 9), 0.2, shape);
    expect(e.likely).toEqual({ string: 3, fret: 9 });
  });

  it('playing outside the shape, the estimate follows the hand within two notes', () => {
    const hand = new HandEstimator();
    hand.estimate(midiAt(3, 7), 0, shape);
    hand.estimate(midiAt(3, 9), 0.2, shape);
    // The player leaves the shape for the top of the neck: C6 has one place only (high E, fret 20).
    const first = hand.estimate(84, 0.5, shape);
    expect(first.likely).toEqual({ string: 5, fret: 20 });
    // E5: high E 12 (near the old shape), B string 17 and G string 21 (both under the hand). The
    // estimate moves with the hand; between the two places under it, it may honestly stay undecided.
    const second = hand.estimate(76, 0.7, shape);
    const near = second.all.filter((p) => Math.abs(p.position.fret - 20) <= 4).reduce((sum, p) => sum + p.probability, 0);
    expect(near).toBeGreaterThan(0.9);
    expect(second.all.find((p) => p.position.fret === 12)?.probability ?? 1).toBeLessThan(0.1);
    if (second.likely) expect(Math.abs(second.likely.fret - 20)).toBeLessThanOrEqual(4);
  });

  it('the shape is a weight, not a filter: near the hand a place outside it wins', () => {
    const hand = new HandEstimator();
    // C6 and D6 have one place each: the hand is at frets 20–22 of the high E.
    hand.estimate(84, 0, shape);
    hand.estimate(86, 0.2, shape);
    // B4 (71) is in the shape at the 7th fret of the high E, and under the hand on the D string at 21.
    const e = hand.estimate(71, 0.4, shape);
    expect(e.all.some((p) => p.position.string === 5 && p.position.fret === 7)).toBe(true);
    expect(e.likely).toEqual({ string: 2, fret: 21 });
  });

  it('after a pause the context is forgotten', () => {
    const hand = new HandEstimator();
    hand.estimate(midiAt(3, 7), 0, shape);
    hand.estimate(midiAt(3, 9), 0.2, shape);
    expect(hand.estimate(midiAt(3, 7), 5, shape).likely).toBeNull();
  });
});
