/** Difficulty of the current study (M6): saved with the preset, used by the library's filter. */
import { EXERCISE_LEVELS, LEVEL_HINT, type ExerciseLevel } from '../exercises';
import { useApp } from '../app/store';

export function LevelSelect({ className = 'select' }: { readonly className?: string }) {
  const level = useApp((s) => s.settings.studyLevel);
  const update = useApp((s) => s.update);
  return (
    <select
      className={className}
      aria-label="Livello dello studio"
      data-testid="study-level"
      title={level ? LEVEL_HINT[level] : 'Nessun livello: il preset non compare filtrando per difficoltà'}
      value={level}
      onChange={(e) => update({ studyLevel: e.target.value as ExerciseLevel | '' })}
    >
      <option value="">Livello: nessuno</option>
      {EXERCISE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
    </select>
  );
}
