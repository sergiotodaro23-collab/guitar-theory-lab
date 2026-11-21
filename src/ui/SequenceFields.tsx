/**
 * Steps of a sequence exercise (M5): a ready-made pattern or one typed by
 * hand, and how each group runs. Shared by the single exercise and every
 * phase of the advanced editor.
 */
import { SEQUENCE_PATTERNS, parseCustomPattern, type PairMotion } from '../exercises';
import { Field, Segmented, Select } from './controls';

const CUSTOM = '__custom';

export function SequenceFields({ text, motion, onChange, name, testId }: {
  readonly text: string;
  readonly motion: PairMotion;
  readonly onChange: (change: { readonly customText?: string; readonly groupMotion?: PairMotion }) => void;
  /** Suffix for accessible names, e.g. "della fase 2"; '' for the single exercise. */
  readonly name: string;
  readonly testId?: string;
}) {
  const valid = parseCustomPattern(text, { chromatic: true }) !== null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const preset = SEQUENCE_PATTERNS.some((p) => p.text === trimmed) ? trimmed : CUSTOM;
  const suffix = name ? ` ${name}` : '';
  return (
    <>
      <div className="row">
        <Field label="Modello">
          <Select
            label={`Modello di sequenza${suffix}`}
            value={preset}
            options={[...SEQUENCE_PATTERNS.map((p) => ({ value: p.text, label: p.label })), { value: CUSTOM, label: 'Personalizzata' }]}
            onChange={(value) => { if (value !== CUSTOM) onChange({ customText: value }); }}
          />
        </Field>
        <Field
          label="Passi della scala"
          hint={valid ? 'Riparte da ogni nota: 1 3 2 4 fa Do Mi Re Fa, Re Fa Mi Sol… «3c» è la nota cromatica sotto il terzo grado.' : 'Scrivi numeri da 1 a 24 separati da spazi, per esempio 1 3 2 4; «c» dopo un numero per la nota cromatica sotto.'}
        >
          <input
            className={`text-input ${valid ? '' : 'is-invalid'}`}
            aria-label={`Passi della sequenza${suffix}`}
            data-testid={testId}
            aria-invalid={!valid}
            value={text}
            onChange={(e) => onChange({ customText: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Ogni gruppo">
        <Segmented<PairMotion>
          label={`Direzione di ogni gruppo${suffix}`}
          value={motion}
          options={[
            { value: 'ascending', label: 'Come scritto' },
            { value: 'descending', label: 'Rovesciato' },
            { value: 'alternating', label: 'Alterna' },
          ]}
          onChange={(groupMotion) => onChange({ groupMotion })}
        />
      </Field>
    </>
  );
}
