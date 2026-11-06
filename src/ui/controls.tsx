import { useId, type ReactNode } from 'react';

/**
 * A labelled form row. With a single native control (select, input) it is a
 * <label> wrapping the control. With `group` (a Segmented or a row of buttons)
 * it is a role="group" named by its visible label: a <label> around several
 * controls would only label the first one.
 */
export function Field({ label, children, hint, group = false }: {
  readonly label: string;
  readonly children: ReactNode;
  readonly hint?: string | undefined;
  readonly group?: boolean;
}) {
  const id = useId();
  if (group) {
    const labelId = `${id}-label`;
    const hintId = `${id}-hint`;
    return (
      <div className="field" role="group" aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined}>
        <span id={labelId} className="field-label">{label}</span>
        {children}
        {hint ? <span id={hintId} className="field-hint">{hint}</span> : null}
      </div>
    );
  }
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export interface Option<T extends string | number> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
}

export function Select<T extends string | number>({ value, options, onChange, label, testId }: {
  readonly value: T;
  readonly options: readonly Option<T>[];
  readonly onChange: (value: T) => void;
  readonly label?: string;
  readonly testId?: string;
}) {
  return (
    <select
      className="select"
      aria-label={label}
      data-testid={testId}
      value={String(value)}
      onChange={(event) => {
        const picked = options.find((o) => String(o.value) === event.target.value);
        if (picked) onChange(picked.value);
      }}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)} disabled={option.disabled}>{option.label}</option>
      ))}
    </select>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  readonly value: T;
  readonly options: readonly Option<T>[];
  readonly onChange: (value: T) => void;
  /** Names the group. Omit it inside a `<Field group>`, which already names it. */
  readonly label?: string;
}) {
  return (
    <div className="segmented" role={label ? 'group' : undefined} aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={String(option.value)}
          className="segment"
          aria-pressed={option.value === value}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }: { readonly checked: boolean; readonly onChange: (value: boolean) => void; readonly children: ReactNode }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-box" aria-hidden="true" />
      <span>{children}</span>
    </label>
  );
}

export function Panel({ title, children, className }: { readonly title: string; readonly children: ReactNode; readonly className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`} aria-label={title}>
      <h2 className="panel-title">{title}</h2>
      {children}
    </section>
  );
}

export function Volume({ label, value, onChange }: { readonly label: string; readonly value: number; readonly onChange: (value: number) => void }) {
  return (
    <Field label={label}>
      <input className="range" type="range" min={0} max={1} step={0.01} value={value} aria-label={`Volume ${label}`} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  );
}
