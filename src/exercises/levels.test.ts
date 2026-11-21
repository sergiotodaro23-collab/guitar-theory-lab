import { describe, expect, it } from 'vitest';
import { EXERCISE_LEVELS, LEVEL_HINT, parseLevel } from './levels';

describe('exercise levels (M6)', () => {
  it('has four levels in order of difficulty, each with a hint', () => {
    expect(EXERCISE_LEVELS).toEqual(['Principiante', 'Intermedio', 'Avanzato', 'Esperto']);
    for (const level of EXERCISE_LEVELS) expect(LEVEL_HINT[level].length).toBeGreaterThan(10);
  });

  it('reads the old three-level names without loss and rejects anything else', () => {
    expect(parseLevel('Base')).toBe('Principiante');
    expect(parseLevel('Intermedio')).toBe('Intermedio');
    expect(parseLevel('Avanzato')).toBe('Avanzato');
    expect(parseLevel('Esperto')).toBe('Esperto');
    expect(parseLevel('expert')).toBeNull();
    expect(parseLevel(3)).toBeNull();
    expect(parseLevel(undefined)).toBeNull();
  });
});
