/**
 * Difficulty of a study (M6, D-61): four levels, carried by the study's own
 * data so a saved preset keeps it. Presets saved with the old three-level
 * scale are read without loss: «Base» is today's «Principiante».
 */
export type ExerciseLevel = 'Principiante' | 'Intermedio' | 'Avanzato' | 'Esperto';
export const EXERCISE_LEVELS: readonly ExerciseLevel[] = ['Principiante', 'Intermedio', 'Avanzato', 'Esperto'];

/** What each level asks of the player, shown next to the choice. */
export const LEVEL_HINT: Readonly<Record<ExerciseLevel, string>> = {
  Principiante: 'una posizione, note per movimento regolari, tempo lento',
  Intermedio: 'intervalli e sequenze, più posizioni, ritmi puntati',
  Avanzato: 'percorsi a fasi, scale minori e modi, gruppi irregolari',
  Esperto: 'cambi di accordo, voice leading, tempi veloci e salti di corda',
};

const LEGACY: Readonly<Record<string, ExerciseLevel>> = { Base: 'Principiante' };

/** A level from stored data: the four current names, the old «Base», or none. */
export function parseLevel(raw: unknown): ExerciseLevel | null {
  if (typeof raw !== 'string') return null;
  if ((EXERCISE_LEVELS as readonly string[]).includes(raw)) return raw as ExerciseLevel;
  return LEGACY[raw] ?? null;
}
