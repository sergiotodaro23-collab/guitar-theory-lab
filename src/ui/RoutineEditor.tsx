/**
 * Advanced exercise editor: a wide dialog over the workbench. It edits a draft
 * routine; nothing reaches the app until "Applica".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { meterOf } from '../app/settings';
import { useApp } from '../app/store';
import {
  INTERVAL_NAMES,
  MAX_PHASES,
  MAX_REPEATS,
  ROUTINE_TEMPLATES,
  defaultPhase,
  describeDirection,
  newPhaseId,
  planRoutine,
  type IntervalNumber,
  type PhasePosition,
  type Routine,
  type RoutinePhase,
} from '../exercises';
import { CAGED_FORMS, DEFAULT_FRETS } from '../fretboard';
import { SCALES, SCALE_IDS, TONICS, type ScaleId } from '../theory';
import { ticksPerBar } from '../timeline';
import { Fretboard } from '../viz/Fretboard';
import { buildMarkerLayer } from '../viz/markers';
import { Field, Segmented, Select } from './controls';

const FRET_OPTIONS = Array.from({ length: DEFAULT_FRETS + 1 }, (_, f) => ({ value: f, label: String(f) }));

function move<T>(list: readonly T[], from: number, to: number): readonly T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

function PositionFields({ position, onChange }: { readonly position: PhasePosition; readonly onChange: (p: PhasePosition) => void }) {
  return (
    <>
      <Field label="Forma" group>
        <Segmented
          value={position.kind}
          options={[
            { value: 'caged', label: 'CAGED' },
            { value: '3nps', label: '3NPS' },
            { value: 'range', label: 'Range di tasti' },
          ]}
          onChange={(kind) => onChange(kind === 'caged' ? { kind, form: 'E' } : kind === '3nps' ? { kind, start: 0 } : { kind, low: 5, high: 8 })}
        />
      </Field>
      {position.kind === 'caged' ? (
        <Field label="Forma CAGED" group>
          <Segmented value={position.form} options={CAGED_FORMS.map((f) => ({ value: f, label: f }))} onChange={(form) => onChange({ kind: 'caged', form })} />
        </Field>
      ) : null}
      {position.kind === '3nps' ? (
        <Field label="Pattern 3NPS (grado di partenza sulla sesta corda)" group>
          <Segmented
            value={position.start}
            options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n + 1) }))}
            onChange={(start) => onChange({ kind: '3nps', start })}
          />
        </Field>
      ) : null}
      {position.kind === 'range' ? (
        <div className="row">
          <Field label="Dal tasto">
            <Select label="Dal tasto" value={position.low} options={FRET_OPTIONS} onChange={(low) => onChange({ ...position, low })} />
          </Field>
          <Field label="Al tasto">
            <Select label="Al tasto" value={position.high} options={FRET_OPTIONS} onChange={(high) => onChange({ ...position, high })} />
          </Field>
        </div>
      ) : null}
    </>
  );
}

interface BlockProps {
  readonly phase: RoutinePhase;
  readonly index: number;
  readonly count: number;
  readonly selected: boolean;
  readonly summary: string;
  readonly issues: ReturnType<typeof planRoutine>['phases'][number]['issues'];
  readonly onSelect: () => void;
  readonly onChange: (change: Partial<RoutinePhase>) => void;
  readonly onMove: (delta: number) => void;
  readonly onDuplicate: () => void;
  readonly onRemove: () => void;
}

function PhaseBlock({ phase, index, count, selected, summary, issues, onSelect, onChange, onMove, onDuplicate, onRemove }: BlockProps) {
  const n = index + 1;
  return (
    <li className={`phase-block ${selected ? 'is-selected' : ''}`} data-testid="phase-block" onFocusCapture={onSelect} onClick={onSelect}>
      <div className="phase-head">
        <h3 className="phase-title">Fase {n}</h3>
        <span className="phase-summary">{summary}</span>
        <div className="phase-tools">
          <button type="button" className="icon-btn" aria-label={`Sposta la fase ${n} in alto`} disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="icon-btn" aria-label={`Sposta la fase ${n} in basso`} disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="icon-btn" aria-label={`Duplica la fase ${n}`} disabled={count >= MAX_PHASES} onClick={onDuplicate}>⧉</button>
          <button type="button" className="icon-btn" aria-label={`Elimina la fase ${n}`} disabled={count <= 1} onClick={onRemove}>✕</button>
        </div>
      </div>

      <div className="phase-grid">
        <fieldset className="block-group">
          <legend>Scala</legend>
          <div className="row">
            <Field label="Tonica">
              <Select label={`Tonica della fase ${n}`} value={phase.tonic} options={TONICS.map((t) => ({ value: t, label: t }))} onChange={(tonic) => onChange({ tonic })} />
            </Field>
            <Field label="Scala">
              <Select<ScaleId> label={`Scala della fase ${n}`} value={phase.scaleId} options={SCALE_IDS.map((id) => ({ value: id, label: SCALES[id].name }))} onChange={(scaleId) => onChange({ scaleId })} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="block-group">
          <legend>Posizione</legend>
          <PositionFields position={phase.position} onChange={(position) => onChange({ position })} />
          <Field label="Ottava" group>
            <Segmented value={phase.octave} options={[{ value: 0 as const, label: 'Bassa' }, { value: 1 as const, label: 'Alta (+12)' }]} onChange={(octave) => onChange({ octave })} />
          </Field>
        </fieldset>

        <fieldset className="block-group">
          <legend>Sequenza</legend>
          <Field label="Tipo" group>
            <Segmented
              value={phase.kind}
              options={[{ value: 'scale', label: 'Scala' }, { value: 'interval', label: 'Intervalli' }, { value: 'custom', label: 'Pattern' }]}
              onChange={(kind) => onChange({ kind })}
            />
          </Field>
          {phase.kind === 'interval' ? (
            <div className="row">
              <Field label="Intervallo">
                <Select<IntervalNumber> label={`Intervallo della fase ${n}`} value={phase.interval} options={([2, 3, 4, 5, 6, 7, 8] as const).map((i) => ({ value: i, label: INTERVAL_NAMES[i] }))} onChange={(interval) => onChange({ interval })} />
              </Field>
              <Field label="Ogni coppia">
                <Select
                  label={`Coppie della fase ${n}`}
                  value={phase.pairMotion}
                  options={[{ value: 'ascending', label: 'Sale' }, { value: 'descending', label: 'Scende' }, { value: 'alternating', label: 'Alterna' }]}
                  onChange={(pairMotion) => onChange({ pairMotion })}
                />
              </Field>
            </div>
          ) : null}
          {phase.kind === 'custom' ? (
            <Field label="Passi della scala" hint="Riparte da ogni nota: 1 3 2 4 fa Do Mi Re Fa, Re Fa Mi Sol…">
              <input className="text-input" aria-label={`Pattern della fase ${n}`} value={phase.customText} onChange={(e) => onChange({ customText: e.target.value })} />
            </Field>
          ) : null}
        </fieldset>

        <fieldset className="block-group">
          <legend>Direzione e tempo</legend>
          <Field label="Direzione" group>
            <Segmented
              value={phase.direction}
              options={[{ value: 'up', label: 'Sale' }, { value: 'down', label: 'Scende' }, { value: 'updown', label: 'Sale e scende' }]}
              onChange={(direction) => onChange({ direction })}
            />
          </Field>
          <div className="row">
            <Field label="Note per movimento">
              <Select label={`Note per movimento della fase ${n}`} value={phase.notesPerBeat} options={([1, 2, 3, 4] as const).map((v) => ({ value: v, label: String(v) }))} onChange={(notesPerBeat) => onChange({ notesPerBeat })} />
            </Field>
            <Field label="Ripetizioni">
              <Select label={`Ripetizioni della fase ${n}`} value={phase.repeats} options={Array.from({ length: MAX_REPEATS }, (_, i) => ({ value: i + 1, label: `${i + 1}×` }))} onChange={(repeats) => onChange({ repeats })} />
            </Field>
          </div>
        </fieldset>
      </div>

      {issues.length > 0 ? (
        <ul className="issues">
          {issues.map((issue) => (
            <li key={issue.message} className={`issue issue-${issue.level}`} role={issue.level === 'error' ? 'alert' : undefined}>
              <span>{issue.message}</span>
              {issue.fix ? (
                <button type="button" className="btn" onClick={() => onChange(issue.fix?.change ?? {})}>{issue.fix.label}</button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Preview({ draft, selected, onSelect }: { readonly draft: Routine; readonly selected: number; readonly onSelect: (i: number) => void }) {
  const settings = useApp((s) => s.settings);
  const meter = meterOf(settings);
  const plan = useMemo(() => planRoutine(draft, meter), [draft, meter]);
  const bar = ticksPerBar(meter);
  const bars = plan.lengthTicks / bar;
  const seconds = (plan.lengthTicks / (bar / meter.beatsPerBar)) * (60 / settings.bpm);
  const current = plan.phases[selected];
  const layer = useMemo(() => current ? buildMarkerLayer({
    notes: current.notes, scale: current.scale, chord: null, nextChord: null, chords: [], chordIndex: 0, focus: 'all',
    profile: settings.avoidProfile, labelMode: 'degree', pinnedPc: null, secondScale: null, wholeNeck: false,
  }) : null, [current, settings.avoidProfile]);

  return (
    <section className="editor-preview" aria-label="Anteprima del percorso">
      <h3 className="editor-subtitle">Anteprima</h3>
      <p className="preview-total" data-testid="routine-total">
        {plan.lengthTicks === 0 ? 'Nessuna nota da suonare: correggi le fasi segnalate.' : `${bars} battute, circa ${Math.round(seconds)} s a ${settings.bpm} BPM, poi ricomincia.`}
      </p>
      <ol className="timeline-strip" aria-label="Sequenza delle fasi">
        {plan.phases.map((p, i) => (
          <li key={p.phase.id} style={{ flexGrow: Math.max(1, p.lengthTicks / bar) }}>
            <button type="button" className={`strip-seg ${i === selected ? 'is-selected' : ''} ${p.lengthTicks === 0 ? 'is-empty' : ''}`} onClick={() => onSelect(i)} aria-pressed={i === selected}>
              <strong>{i + 1}</strong>
              <span>{p.scale.tonicName} {p.label}</span>
              <span>{describeDirection(p.phase.direction)} · {p.lengthTicks / bar} batt.</span>
            </button>
          </li>
        ))}
      </ol>
      {current && layer ? (
        <>
          <div className="preview-board">
            <Fretboard markers={layer.markers} arrows={[]} active={null} trail={[]} onPick={() => undefined} />
          </div>
          <p className="preview-caption">
            Fase {selected + 1}: {current.scale.tonicName} {current.scale.definition.name}, {current.label}, tasti {current.lowFret}–{current.highFret}, {describeDirection(current.phase.direction)}
            {current.phase.repeats > 1 ? `, ${current.phase.repeats} volte` : ''}.
          </p>
          <p className="preview-notes" data-testid="preview-notes" aria-label="Note generate">
            {current.sequence.length === 0 ? '—' : current.sequence.map((note) => note.name).join(' ')}
          </p>
          {plan.phases.length > 1 ? (
            <p className="preview-caption">
              Transizione: {(() => {
                const next = plan.phases[(selected + 1) % plan.phases.length];
                const last = current.sequence[current.sequence.length - 1];
                const first = next?.sequence[0];
                if (!next || !last || !first) return '—';
                const jump = Math.abs(first.fret - last.fret);
                return `da ${last.name} (corda ${6 - last.string}, tasto ${last.fret}) a ${first.name} (corda ${6 - first.string}, tasto ${first.fret})${jump > 4 ? `: salto di ${jump} tasti, la fase successiva parte sul battere per darti tempo` : ''}.`;
              })()}
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function RoutineEditor({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const routine = useApp((s) => s.settings.routine);
  const update = useApp((s) => s.update);
  const setSelectedPhase = useApp((s) => s.setSelectedPhase);
  const [draft, setDraft] = useState<Routine>(routine);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setDraft(useApp.getState().settings.routine);
      setSelected(0);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const plan = useMemo(() => planRoutine(draft, { beatsPerBar: 4, beatUnit: 4 }), [draft]);
  const setPhases = (phases: readonly RoutinePhase[]) => setDraft({ ...draft, phases });
  const changePhase = (index: number, change: Partial<RoutinePhase>) =>
    setPhases(draft.phases.map((p, i) => (i === index ? { ...p, ...change } : p)));

  const addPhase = () => {
    if (draft.phases.length >= MAX_PHASES) return;
    const last = draft.phases[draft.phases.length - 1];
    // A new phase starts from the previous one, coming back the other way.
    const next: RoutinePhase = last
      ? { ...last, id: newPhaseId(), direction: last.direction === 'up' ? 'down' : 'up' }
      : defaultPhase(newPhaseId());
    setPhases([...draft.phases, next]);
    setSelected(draft.phases.length);
  };

  const apply = () => {
    update({ routine: draft, exerciseMode: 'routine', exerciseOn: true });
    setSelectedPhase(Math.min(selected, draft.phases.length - 1));
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className="editor-dialog"
      aria-labelledby="editor-title"
      data-testid="routine-editor"
      onCancel={(event) => {
        // Escape discards the draft, like "Annulla".
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className="editor-shell">
          <header className="editor-header">
            <h2 id="editor-title" className="editor-title">Editor avanzato degli esercizi</h2>
            <label className="field editor-name">
              <span className="field-label">Nome del percorso</span>
              <input className="text-input" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="field">
              <span className="field-label">Parti da un modello</span>
              <select
                className="select"
                value=""
                aria-label="Parti da un modello"
                onChange={(e) => {
                  const template = ROUTINE_TEMPLATES[Number(e.target.value)];
                  if (template) {
                    setDraft({ name: template.name, phases: template.phases.map((p) => ({ ...p, id: newPhaseId() })) });
                    setSelected(0);
                  }
                }}
              >
                <option value="" disabled>Scegli…</option>
                {ROUTINE_TEMPLATES.map((t, i) => <option key={t.name} value={i}>{t.name}</option>)}
              </select>
            </label>
            <div className="editor-actions">
              <button type="button" className="btn" onClick={onClose}>Annulla</button>
              <button type="button" className="btn btn-accent" data-testid="routine-apply" onClick={apply} disabled={plan.lengthTicks === 0}>Applica e chiudi</button>
            </div>
          </header>
          <div className="editor-body">
            <section className="editor-phases" aria-label="Fasi dell'esercizio">
              <h3 className="editor-subtitle">Fasi <span className="muted">({draft.phases.length} di {MAX_PHASES})</span></h3>
              <ol className="phase-list">
                {draft.phases.map((phase, i) => {
                  const resolved = plan.phases[i];
                  return (
                    <PhaseBlock
                      key={phase.id}
                      phase={phase}
                      index={i}
                      count={draft.phases.length}
                      selected={i === selected}
                      summary={resolved ? `${resolved.scale.tonicName} ${resolved.scale.definition.name} · ${resolved.label} · ${describeDirection(phase.direction)}` : ''}
                      issues={resolved?.issues ?? []}
                      onSelect={() => setSelected(i)}
                      onChange={(change) => changePhase(i, change)}
                      onMove={(delta) => {
                        setPhases(move(draft.phases, i, i + delta));
                        setSelected(i + delta);
                      }}
                      onDuplicate={() => {
                        const copy = { ...phase, id: newPhaseId() };
                        setPhases([...draft.phases.slice(0, i + 1), copy, ...draft.phases.slice(i + 1)]);
                        setSelected(i + 1);
                      }}
                      onRemove={() => {
                        setPhases(draft.phases.filter((_, j) => j !== i));
                        setSelected(Math.max(0, Math.min(selected, draft.phases.length - 2)));
                      }}
                    />
                  );
                })}
              </ol>
              <button type="button" className="btn add-phase" data-testid="add-phase" onClick={addPhase} disabled={draft.phases.length >= MAX_PHASES}>+ Aggiungi fase</button>
            </section>
            <Preview draft={draft} selected={Math.min(selected, draft.phases.length - 1)} onSelect={setSelected} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
