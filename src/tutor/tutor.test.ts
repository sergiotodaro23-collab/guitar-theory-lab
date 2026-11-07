import { describe, expect, it } from 'vitest';
import { buildScale, parseChord } from '../theory';
import { BASE, EXPRESSIONS, PALETTE, SPRITE_HEIGHT, SPRITE_WIDTH } from './sprite';
import { tutorLine, type TutorInput } from './tutor';

const cMajor = buildScale('C', 'ionian');
const input = (over: Partial<TutorInput>): TutorInput => ({
  workspace: 'fretboard', scale: cMajor, chord: null, nextChord: null, playing: false, issues: 0, ...over,
});

describe('tutor rules', () => {
  it('Silent says nothing', () => {
    expect(tutorLine('silent', input({}))).toBeNull();
  });

  it('Contextual names the scale, spelled by the engine', () => {
    const line = tutorLine('contextual', input({}));
    expect(line?.context).toContain('C D E F G A B');
    expect(line?.tip).toBeNull();
  });

  it('names the chord tones and the guide tones of Cmaj7', () => {
    const line = tutorLine('contextual', input({ chord: parseChord('Cmaj7') }));
    expect(line?.context).toBe('Cmaj7: C E G B. Guide tones: E B.');
  });

  it('Dm7 to G7 in Harmony Lab: keeps the common tones D and F', () => {
    const line = tutorLine('tutor', input({ workspace: 'harmony', chord: parseChord('Dm7'), nextChord: parseChord('G7') }));
    expect(line?.tip).toBe('Verso G7: tieni D F, sono note comuni ai due accordi.');
  });

  it('with no common tone, points to the next guide tone (C to Db: no shared notes)', () => {
    const line = tutorLine('tutor', input({ workspace: 'jam', chord: parseChord('C'), nextChord: parseChord('Db') }));
    expect(line?.tip).toBe('Verso Db nessuna nota comune: muoviti per grado fino a F.');
  });

  it('expression follows the state: problems first, then playing', () => {
    expect(tutorLine('tutor', input({ issues: 1 }))?.expression).toBe('oops');
    expect(tutorLine('contextual', input({ playing: true }))?.expression).toBe('talk');
    expect(tutorLine('contextual', input({}))?.expression).toBe('idle');
  });

  it('same state, same words: deterministic', () => {
    const a = tutorLine('tutor', input({ chord: parseChord('A7') }));
    const b = tutorLine('tutor', input({ chord: parseChord('A7') }));
    expect(a).toEqual(b);
  });
});

describe('tutor sprite', () => {
  it('every row is full width and every pixel has a colour', () => {
    expect(BASE).toHaveLength(SPRITE_HEIGHT);
    for (const row of BASE) {
      expect(row).toHaveLength(SPRITE_WIDTH);
      for (const key of row) if (key !== '.') expect(PALETTE[key]).toBeDefined();
    }
    for (const pixels of Object.values(EXPRESSIONS)) {
      for (const [x, y, key] of pixels) {
        expect(x).toBeLessThan(SPRITE_WIDTH);
        expect(y).toBeLessThan(SPRITE_HEIGHT);
        expect(PALETTE[key]).toBeDefined();
      }
    }
  });
});
