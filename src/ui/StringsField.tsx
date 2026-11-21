/**
 * Strings an exercise uses (M4): a ready-made set (string skipping included)
 * or any combination ticked by hand. Shared by the single exercise and the
 * phases of the advanced editor.
 */
import { ALL_STRINGS, STRING_SETS, isSkipping, normalizeStrings, type StringNumber } from '../exercises';
import { Field, Select } from './controls';

const CUSTOM = '__custom';
const keyOf = (strings: readonly StringNumber[]) => strings.join('-');

export function StringsField({ strings, onChange, name }: {
  readonly strings: readonly StringNumber[];
  readonly onChange: (strings: readonly StringNumber[]) => void;
  readonly name: string;
}) {
  const current = keyOf(strings);
  const preset = STRING_SETS.some((s) => keyOf(s.strings) === current) ? current : CUSTOM;
  const toggle = (n: StringNumber) => {
    const used = strings.length === 0 ? ALL_STRINGS : strings;
    const next = used.includes(n) ? used.filter((x) => x !== n) : [...used, n];
    if (next.length > 0) onChange(normalizeStrings(next));
  };
  return (
    <>
      <Field label="Corde" hint={isSkipping(strings) ? 'Salto di corda: le corde in mezzo non suonano.' : undefined}>
        <Select
          label={`Corde ${name}`}
          value={preset}
          options={[...STRING_SETS.map((s) => ({ value: keyOf(s.strings), label: s.label })), { value: CUSTOM, label: 'Scelte a mano' }]}
          onChange={(value) => {
            const found = STRING_SETS.find((s) => keyOf(s.strings) === value);
            if (found) onChange(found.strings);
          }}
        />
      </Field>
      <div className="string-picks" role="group" aria-label={`Scegli le corde ${name}`}>
        {ALL_STRINGS.map((n) => {
          const on = strings.length === 0 || strings.includes(n);
          return (
            <button key={n} type="button" className={`string-pick ${on ? 'is-on' : ''}`} aria-pressed={on} aria-label={`Corda ${n}`} onClick={() => toggle(n)}>{n}</button>
          );
        })}
      </div>
    </>
  );
}
