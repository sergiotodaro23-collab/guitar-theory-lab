import { describe, expect, it } from 'vitest';
import { buildScale, compareScales, withBass, diatonicSeventh, chromaticName, parseChord, parseNote, pitchClass, SCALE_IDS, SCALES, TONICS, tryParseChord, transposeNote, noteName, diatonicIndex, midiToHz } from './index';

const names = (tonic: string, id: Parameters<typeof buildScale>[1]) => buildScale(tonic, id).tones.map((t) => t.name).join(' ');

describe('note spelling', () => {
  it('parses and computes pitch classes', () => {
    expect(pitchClass(parseNote('C'))).toBe(0);
    expect(pitchClass(parseNote('Bb'))).toBe(10);
    expect(pitchClass(parseNote('B#'))).toBe(0);
    expect(pitchClass(parseNote('Cb'))).toBe(11);
    expect(pitchClass(parseNote('F##'))).toBe(7);
  });
  it('rejects invalid notes', () => {
    expect(() => parseNote('H')).toThrow();
  });
  it('counts staff positions independently of accidentals', () => {
    expect(diatonicIndex(60, parseNote('C'))).toBe(diatonicIndex(61, parseNote('C#')));
    expect(diatonicIndex(59, parseNote('Cb'))).toBe(diatonicIndex(60, parseNote('C')));
  });
  it('transposes to readable spellings', () => {
    expect(noteName(transposeNote(parseNote('C'), 2))).toBe('D');
    expect(noteName(transposeNote(parseNote('Bb'), 2))).toBe('C');
    expect(noteName(transposeNote(parseNote('F#'), 1))).toBe('G');
    expect(noteName(transposeNote(parseNote('Eb'), 7))).toBe('Bb');
    expect(noteName(transposeNote(parseNote('Ab'), 1))).toBe('A');
    for (const tonic of TONICS) {
      for (let s = 0; s < 12; s += 1) {
        const result = transposeNote(parseNote(tonic), s);
        expect(pitchClass(result)).toBe((pitchClass(parseNote(tonic)) + s) % 12);
        expect(Math.abs(result.accidental)).toBeLessThan(2);
      }
    }
  });
  it('names pitch classes', () => {
    expect(chromaticName(1)).toBe('C#');
    expect(chromaticName(1, true)).toBe('Db');
  });
});

describe('tuning', () => {
  it('uses A440 equal temperament', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(40)).toBeCloseTo(82.407, 2); // Low E string.
    expect(midiToHz(64)).toBeCloseTo(329.628, 2); // High E string.
  });
});

describe('scales against published spellings', () => {
  it.each([
    ['C', 'ionian', 'C D E F G A B'],
    ['F#', 'ionian', 'F# G# A# B C# D# E#'],
    ['Db', 'ionian', 'Db Eb F Gb Ab Bb C'],
    ['D', 'dorian', 'D E F G A B C'],
    ['E', 'phrygian', 'E F G A B C D'],
    ['F', 'lydian', 'F G A B C D E'],
    ['G', 'mixolydian', 'G A B C D E F'],
    ['A', 'aeolian', 'A B C D E F G'],
    ['B', 'locrian', 'B C D E F G A'],
    ['A', 'harmonicMinor', 'A B C D E F G#'],
    ['G#', 'harmonicMinor', 'G# A# B C# D# E F##'],
    ['C', 'melodicMinor', 'C D Eb F G A B'],
    ['A', 'minorPentatonic', 'A C D E G'],
    ['G', 'majorPentatonic', 'G A B D E'],
    ['E', 'minorBlues', 'E G A Bb B D'],
    ['Eb', 'aeolian', 'Eb F Gb Ab Bb Cb Db'],
  ] as const)('%s %s', (tonic, id, expected) => {
    expect(names(tonic, id)).toBe(expected);
  });

  it('uses each letter once in every heptatonic scale on every tonic', () => {
    for (const tonic of TONICS) {
      for (const id of SCALE_IDS) {
        const scale = buildScale(tonic, id);
        if (scale.tones.length !== 7) continue;
        expect(new Set(scale.tones.map((t) => t.note.letter)).size).toBe(7);
      }
    }
  });

  it('modes share the pitch classes of their declared parent key', () => {
    for (const id of ['dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'] as const) {
      const scale = buildScale('E', id);
      const parentPc = (4 + SCALES[id].parentOffset + 24) % 12;
      const parent = buildScale(chromaticName(parentPc), 'ionian');
      expect(new Set(scale.tones.map((t) => t.pc))).toEqual(new Set(parent.tones.map((t) => t.pc)));
    }
  });
});

describe('chords against published spellings', () => {
  it.each([
    ['Cmaj7', 'C E G B'],
    ['Dm9', 'D F A C E'],
    ['G13', 'G B D F A E'],
    ['Bm7b5', 'B D F A'],
    ['Bdim7', 'B D F Ab'],
    ['F#7', 'F# A# C# E'],
    ['Ebmaj7', 'Eb G Bb D'],
    ['Abm7', 'Ab Cb Eb Gb'],
    ['C7alt', 'C E Bb Db D# Ab'],
    ['G7b9', 'G B D F Ab'],
    ['Csus4', 'C F G'],
    ['Caug', 'C E G#'],
    ['Am6', 'A C E F#'],
    ['Fmaj7#11', 'F A C E B'],
    ['AmMaj7', 'A C E G#'],
  ])('%s', (symbol, expected) => {
    expect(parseChord(symbol).tones.map((t) => t.name).join(' ')).toBe(expected);
  });

  it('normalises aliases', () => {
    expect(parseChord('C-7').symbol).toBe('Cm7');
    expect(parseChord('CM7').symbol).toBe('Cmaj7');
    expect(parseChord('Bø').symbol).toBe('Bm7b5');
    expect(parseChord('C°7').symbol).toBe('Cdim7');
    expect(parseChord('Am(maj7)').symbol).toBe('AmMaj7');
  });
  it('rejects unknown qualities without throwing in the safe parser', () => {
    expect(tryParseChord('Cblah')).toBeNull();
    expect(tryParseChord('H7')).toBeNull();
    expect(tryParseChord('G7')?.family).toBe('dominant');
  });
});

describe('scale comparison', () => {
  it('finds no difference between a major key and its relative minor', () => {
    const c = compareScales(buildScale('C', 'ionian'), buildScale('A', 'aeolian'));
    expect(c.common).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(c.onlyFirst).toEqual([]);
    expect(c.onlySecond).toEqual([]);
  });
  it('shows the b3 and b7 that turn C ionian into C dorian, spelled in each scale', () => {
    const c = compareScales(buildScale('C', 'ionian'), buildScale('C', 'dorian'));
    expect(c.onlyFirst).toEqual(['E', 'B']);
    expect(c.onlySecond).toEqual(['Eb', 'Bb']);
    expect(c.common).toEqual(['C', 'D', 'F', 'G', 'A']);
  });
  it('finds the blue note of A minor blues against A minor pentatonic', () => {
    const c = compareScales(buildScale('A', 'minorBlues'), buildScale('A', 'minorPentatonic'));
    expect(c.onlyFirst).toEqual(['Eb']);
    expect(c.onlySecond).toEqual([]);
  });
});

describe('slash chords and inversions', () => {
  it('reads the bass after the slash and names the inversion', () => {
    expect(parseChord('C/E').bass).toMatchObject({ name: 'E', degree: '3', inversion: 1 });
    expect(parseChord('C/G').bass).toMatchObject({ name: 'G', degree: '5', inversion: 2 });
    expect(parseChord('G7/F').bass).toMatchObject({ name: 'F', degree: 'b7', inversion: 3 });
    expect(parseChord('Am7/G').symbol).toBe('Am7/G');
    expect(parseChord('Am7/G').tones.map((t) => t.name)).toEqual(['A', 'C', 'E', 'G']);
  });
  it('keeps a foreign bass outside the chord tones', () => {
    const d = parseChord('D/C');
    expect(d.bass).toMatchObject({ name: 'C', degree: null, inversion: null });
    expect(d.tones.map((t) => t.name)).toEqual(['D', 'F#', 'A']);
  });
  it('spells a chord-tone bass as the chord does', () => {
    expect(withBass(parseChord('Cm'), 'D#').symbol).toBe('Cm/Eb');
    expect(withBass(parseChord('C/E'), null).symbol).toBe('C');
    expect(withBass(parseChord('C'), 'C').bass).toBeNull();
  });
  it('does not confuse the 6/9 quality with a slash chord', () => {
    expect(parseChord('C6/9').bass).toBeNull();
    expect(parseChord('C6/9').symbol).toBe('C69');
  });
  it('rejects a slash with a non-note', () => {
    expect(tryParseChord('C/H')).toBeNull();
  });
});

describe('diatonic sevenths', () => {
  const sevenths = (tonic: string, id: Parameters<typeof buildScale>[1]) =>
    [0, 1, 2, 3, 4, 5, 6].map((i) => diatonicSeventh(buildScale(tonic, id), i)?.symbol);
  it('harmonises the major scale', () => {
    expect(sevenths('C', 'ionian')).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
    expect(sevenths('Eb', 'ionian')).toEqual(['Ebmaj7', 'Fm7', 'Gm7', 'Abmaj7', 'Bb7', 'Cm7', 'Dm7b5']);
  });
  it('harmonises the harmonic minor scale', () => {
    expect(sevenths('A', 'harmonicMinor')).toEqual(['AmMaj7', 'Bm7b5', 'Cmaj7#5', 'Dm7', 'E7', 'Fmaj7', 'G#dim7']);
  });
  it('returns null for pentatonics', () => {
    expect(diatonicSeventh(buildScale('A', 'minorPentatonic'), 0)).toBeNull();
  });
});
