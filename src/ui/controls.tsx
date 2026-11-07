import type { ReactNode } from 'react';

/**
 * A labelled control. With `group`, the label names a group of buttons
 * instead of wrapping them: a <label> around several buttons would lend its
 * text to the first one only.
 */
export function Field({ label, children, hint, group = false }: { readonly label: string; readonly children: ReactNode; readonly hint?: string | undefined; readonly group?: boolean }) {
  if (group) {
    return (
      <div className="field" role="group" aria-label={label}>
        <span className="field-label" aria-hidden="true">{label}</span>
        {children}
        {hint ? <span className="field-hint">{hint}</span> : null}
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
  readonly label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
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
