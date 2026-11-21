import { describe, expect, it } from 'vitest';
import { STRING_SETS, VOICING_TYPES, chooseTones, climbVoicings, leadVoicings, stringSetVoicings, stringVoicingKey, voiceMotion, type StringVoicing } from './stringVoicings';
import { TONICS, buildScale, parseChord } from '../theory';
import { progressionSymbols } from '../harmony/progressions';

const keys = (vs: readonly StringVoicing[]) => vs.map(stringVoicingKey);
const byInversion = (vs: readonly StringVoicing[], inversion: number) => keys(vs.filter((v) => v.inversion === inversion));

describe('string-set voicings (HA3): shapes from the method books', () => {
  const cmaj7 = parseChord('Cmaj7');

  it('Drop 2 of Cmaj7 on strings 1–4', () => {
    const vs = stringSetVoicings(cmaj7, 'drop2', '1-2-3-4');
    // Root position C G B E, and the second inversion G C E B.
    expect(byInversion(vs, 0)).toContain('x-x-10-12-12-12');
    expect(byInversion(vs, 2)).toContain('x-x-5-5-5-7');
    expect(vs.find((v) => stringVoicingKey(v) === 'x-x-10-12-12-12')?.degrees).toEqual(['1', '5', '7', '3']);
    expect(new Set(vs.map((v) => v.inversion))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('Drop 2 of Cmaj7 on strings 2–5', () => {
    const vs = stringSetVoicings(cmaj7, 'drop2', '2-3-4-5');
    expect(byInversion(vs, 0)).toContain('x-3-5-4-5-x');
    expect(byInversion(vs, 3)).toContain('x-2-2-0-1-x');
  });

  it('Drop 3 of Cmaj7, root on the sixth string', () => {
    const vs = stringSetVoicings(cmaj7, 'drop3', '2-3-4-6');
    expect(byInversion(vs, 0)).toContain('8-x-9-9-8-x');
    expect(vs.find((v) => stringVoicingKey(v) === '8-x-9-9-8-x')?.degrees).toEqual(['1', '7', '3', '5']);
  });

  it('Drop 2&4 of Cmaj7 spreads the two dropped voices at the bottom', () => {
    const vs = stringSetVoicings(cmaj7, 'drop24', '2-3-5-6');
    const root = vs.find((v) => v.inversion === 0);
    expect(root?.degrees).toEqual(['1', '5', '3', '7']);
    expect(root ? stringVoicingKey(root) : '').toBe('8-10-x-9-12-x');
  });

  it('C major triad on strings 1-2-3 through every inversion, climbing the neck', () => {
    const vs = stringSetVoicings(parseChord('C'), 'close', '1-2-3');
    expect(keys(vs).slice(0, 4)).toEqual(['x-x-x-0-1-0', 'x-x-x-5-5-3', 'x-x-x-9-8-8', 'x-x-x-12-13-12']);
    expect(vs.slice(0, 4).map((v) => v.inversion)).toEqual([2, 0, 1, 2]);
  });

  it('triads on every three-string group, all inversions present', () => {
    for (const s of ['1-2-3', '2-3-4', '3-4-5', '4-5-6']) {
      for (const symbol of ['C', 'Cm', 'Cdim', 'Caug', 'Csus4']) {
        const vs = stringSetVoicings(parseChord(symbol), 'close', s);
        expect(new Set(vs.map((v) => v.inversion)), `${symbol} on ${s}`).toEqual(new Set([0, 1, 2]));
      }
    }
  });

  it('shells: R-3-7 and R-7-3', () => {
    expect(keys(stringSetVoicings(parseChord('C7'), 'shell', '3-4-5'))).toContain('x-3-2-3-x-x');
    expect(keys(stringSetVoicings(parseChord('G7'), 'shell', '3-4-6'))).toContain('3-x-3-4-x-x');
    expect(stringSetVoicings(parseChord('G7'), 'shell', '3-4-6')[0]?.omitted).toEqual(['5']);
  });

  it('quartal: fourths of D dorian over Dm7 include D-G-C-F', () => {
    const vs = stringSetVoicings(parseChord('Dm7'), 'quartal', '1-2-3-4', { scale: buildScale('D', 'dorian') });
    expect(vs.some((v) => v.degrees.join(' ') === '1 11 b7 b3')).toBe(true);
    for (const v of vs) {
      const midis = v.notes.map((n) => n.midi);
      for (let i = 1; i < midis.length; i += 1) expect([5, 6]).toContain((midis[i] as number) - (midis[i - 1] as number));
    }
  });

  it('every voicing is playable: one note per string of the set, span inside the hand, difficulty 1–5', () => {
    for (const type of VOICING_TYPES) {
      for (const s of STRING_SETS[type]) {
        for (const symbol of ['Cmaj7', 'Am7', 'G7', 'Bm7b5', 'F#dim7', 'EbmMaj7', 'C13']) {
          const scale = buildScale('C', 'ionian');
          for (const v of stringSetVoicings(parseChord(symbol), type, s, { scale })) {
            expect(v.notes).toHaveLength(s.numbers.length);
            expect(new Set(v.notes.map((n) => n.string)).size).toBe(s.numbers.length);
            expect(v.span).toBeLessThanOrEqual(4);
            expect(v.difficulty).toBeGreaterThanOrEqual(1);
            expect(v.difficulty).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });
});

describe('tones a voicing keeps and leaves out', () => {
  it('a 13th chord in four voices keeps 3, b7, 9, 13 and drops 5 and root', () => {
    const choice = chooseTones(parseChord('C13'), 4);
    expect(choice.tones.map((t) => t.degree)).toEqual(['3', 'b7', '9', '13']);
    expect(choice.omitted).toEqual(['5', '1']);
  });

  it('a ninth chord drops the fifth; a triad in four voices doubles its root', () => {
    expect(chooseTones(parseChord('C9'), 4).tones.map((t) => t.degree)).toEqual(['1', '3', 'b7', '9']);
    expect(chooseTones(parseChord('C'), 4).tones.map((t) => t.degree)).toEqual(['1', '3', '5', '1']);
  });

  it('the player can leave out the root, never the guide tones', () => {
    const rootless = chooseTones(parseChord('Cmaj9'), 4, ['1']);
    expect(rootless.tones.map((t) => t.degree)).toEqual(['3', '5', '7', '9']);
    expect(chooseTones(parseChord('Cmaj7'), 4, ['3']).tones.map((t) => t.degree)).toContain('3');
    expect(chooseTones(parseChord('C7#5'), 3).tones.map((t) => t.degree)).toEqual(['3', '#5', 'b7']);
  });

  it('a rootless Drop 2 of Cmaj9 has the 3rd or a tension in the bass', () => {
    const vs = stringSetVoicings(parseChord('Cmaj9'), 'drop2', '2-3-4-5', { omit: ['1'] });
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) expect(v.degrees).not.toContain('1');
    expect(vs.some((v) => v.inversion === null)).toBe(true);
  });
});

describe('voice leading (HA4)', () => {
  it('ii–V–I in Drop 2 on strings 1–4: no voice moves more than a whole step, in every key', () => {
    for (const key of TONICS) {
      const chords = progressionSymbols('ii-V-I', key).map(parseChord);
      const path = leadVoicings(chords.map((c) => stringSetVoicings(c, 'drop2', '1-2-3-4')));
      expect(path.every((v) => v !== null), key).toBe(true);
      for (let i = 1; i < path.length; i += 1) {
        const moves = voiceMotion(path[i - 1] as StringVoicing, path[i] as StringVoicing).map(Math.abs);
        expect(Math.max(...moves), `${key} ${i}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('the ii–V–I in C keeps the common tones (F of Dm7 → F of G7; G of G7 → G of Cmaj7)', () => {
    const chords = ['Dm7', 'G7', 'Cmaj7'].map(parseChord);
    const path = leadVoicings(chords.map((c) => stringSetVoicings(c, 'drop2', '2-3-4-5'))) as StringVoicing[];
    const pcs = path.map((v) => new Set(v.notes.map((n) => n.pc)));
    expect(pcs[0]?.has(5) && pcs[1]?.has(5)).toBe(true);
    expect(voiceMotion(path[0] as StringVoicing, path[1] as StringVoicing).filter((m) => m === 0).length).toBeGreaterThanOrEqual(2);
  });

  it('near a fret: the first voicing sits close to it', () => {
    const c = parseChord('Cmaj7');
    const low = leadVoicings([stringSetVoicings(c, 'drop2', '1-2-3-4')], 3)[0];
    const high = leadVoicings([stringSetVoicings(c, 'drop2', '1-2-3-4')], 14)[0];
    expect(Math.min(...(low?.notes.map((n) => n.fret) ?? []))).toBeLessThan(8);
    expect(Math.min(...(high?.notes.map((n) => n.fret) ?? []))).toBeGreaterThan(9);
  });

  it('climb: the same chord repeated walks up through its inversions', () => {
    const c = parseChord('C');
    const options = stringSetVoicings(c, 'close', '2-3-4');
    const path = climbVoicings([options, options, options, options]);
    const basses = path.map((v) => v?.notes[0]?.midi ?? 0);
    for (let i = 1; i < basses.length; i += 1) expect(basses[i]).toBeGreaterThan(basses[i - 1] as number);
    expect(new Set(path.slice(0, 3).map((v) => v?.inversion))).toEqual(new Set([0, 1, 2]));
  });
});
