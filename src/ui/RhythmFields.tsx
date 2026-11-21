/**
 * Rhythm of an exercise (M3): a ready-made cycle or one typed in the short
 * notation of `parseRhythm`, and the articulation. Shared by the single
 * exercise and by every phase of the advanced editor.
 */
import { ARTICULATION_LABEL, RHYTHM_PRESETS, isRhythmError, parseRhythm, type Articulation } from '../exercises';
import { Field, Segmented, Select } from './controls';

const FROM_BEAT = '';
const CUSTOM = '__custom';

export function RhythmFields({ rhythm, articulation, onChange, name }: {
  readonly rhythm: string;
  readonly articulation: Articulation;
  readonly onChange: (change: { readonly rhythm?: string; readonly articulation?: Articulation }) => void;
  /** Suffix for accessible names, e.g. "della fase 2". */
  readonly name: string;
}) {
  const trimmed = rhythm.trim();
  const preset = trimmed === '' ? FROM_BEAT : RHYTHM_PRESETS.some((p) => p.text === trimmed) ? trimmed : CUSTOM;
  const parsed = trimmed === '' ? null : parseRhythm(trimmed);
  const error = parsed && isRhythmError(parsed) ? parsed.error : undefined;
  return (
    <>
      <div className="row">
        <Field label="Ritmo">
          <Select
            label={`Ritmo ${name}`}
            value={preset}
            options={[
              { value: FROM_BEAT, label: 'Note per movimento' },
              ...RHYTHM_PRESETS.map((p) => ({ value: p.text, label: p.label })),
              { value: CUSTOM, label: 'Personalizzato' },
            ]}
            onChange={(value) => onChange({ rhythm: value === CUSTOM ? (trimmed || '8 16 16') : value })}
          />
        </Field>
        <Field label="Valori" hint={error ?? 'Es. «8. 16», «8t 8t 8t», «4 r8 8», «_8» lega'}>
          <input
            className={`text-input ${error ? 'is-invalid' : ''}`}
            aria-label={`Valori ritmici ${name}`}
            aria-invalid={Boolean(error)}
            value={rhythm}
            placeholder="dalle note per movimento"
            onChange={(e) => onChange({ rhythm: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Durata delle note">
        <Segmented<Articulation>
          label={`Durata delle note ${name}`}
          value={articulation}
          options={(['legato', 'normal', 'staccato'] as const).map((a) => ({ value: a, label: ARTICULATION_LABEL[a] }))}
          onChange={(value) => onChange({ articulation: value })}
        />
      </Field>
    </>
  );
}
