import { useMemo, useState } from 'react';
import { STUDY_PRESETS } from '../app/builtins';
import { engine } from '../app/engine';
import { sanitizeSettings, type HarmonyFocus, type LabelMode, type PositionType, type Settings } from '../app/settings';
import { presetRepository, useApp, usePlayhead } from '../app/store';
import { CAGED_FORMS } from '../fretboard';
import { INTERVAL_NAMES, describeDirection, parseCustomPattern, positionLabel, type IntervalNumber } from '../exercises';
import { RoutineEditor } from './RoutineEditor';
import { AVOID_PROFILES, type AvoidProfile } from '../harmony';
import {
  COMP_PATTERNS, PROGRESSION_TEMPLATES, addChord, duplicateChord, instantiateTemplate, moveChord, removeChord, transposeProgression, updateChord,
  type CompPattern, type Progression, type ChordDuration,
} from '../jam';
import { CHORD_SUFFIXES, SCALES, SCALE_IDS, TONICS, parseChord, tryParseChord, buildScale, type ScaleId } from '../theory';
import { Field, Panel, Segmented, Select, Toggle, Volume } from './controls';

const tonicOptions = TONICS.map((t) => ({ value: t, label: t }));
const scaleOptions = SCALE_IDS.map((id) => ({ value: id, label: SCALES[id].name }));
const suffixOptions = CHORD_SUFFIXES.map((s) => ({ value: s, label: s === '' ? 'maggiore' : s }));

export function ScalePanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const scale = useMemo(() => buildScale(s.tonic, s.scaleId), [s.tonic, s.scaleId]);
  const heptatonic = scale.tones.length === 7;
  return (
    <Panel title="Scala e posizione">
      <div className="row">
        <Field label="Tonica"><Select testId="tonic" label="Tonica" value={s.tonic} options={tonicOptions} onChange={(tonic) => update({ tonic })} /></Field>
        <Field label="Scala"><Select testId="scale" label="Scala" value={s.scaleId} options={scaleOptions} onChange={(scaleId: ScaleId) => update({ scaleId })} /></Field>
      </div>
      <p className="spelling" data-testid="scale-spelling">{scale.tones.map((t) => t.name).join('  ')}</p>
      <Field label="Diteggiatura">
        <Segmented<PositionType>
          label="Diteggiatura"
          value={s.positionType === '3nps' && !heptatonic ? 'caged' : s.positionType}
          options={[
            { value: 'caged', label: 'CAGED' },
            { value: '3nps', label: '3NPS', disabled: !heptatonic },
            { value: 'neck', label: 'Tutta la tastiera' },
          ]}
          onChange={(positionType) => update({ positionType })}
        />
      </Field>
      {!heptatonic ? <p className="note">Il 3NPS richiede sette note: per questa scala si usa CAGED.</p> : null}
      {s.positionType === '3nps' && heptatonic ? (
        <Field label="Parti dal grado">
          <Segmented<number>
            label="Grado di partenza"
            value={s.npsStart}
            options={scale.tones.map((tone, i) => ({ value: i, label: tone.degree }))}
            onChange={(npsStart) => update({ npsStart })}
          />
        </Field>
      ) : (
        <Field label="Forma">
          <Segmented label="Forma CAGED" value={s.cagedForm} options={CAGED_FORMS.map((f) => ({ value: f, label: f }))} onChange={(cagedForm) => update({ cagedForm })} />
        </Field>
      )}
      <Field label="Sulle note">
        <Segmented<LabelMode>
          label="Etichette"
          value={s.labelMode}
          options={[
            { value: 'degree', label: 'Grado' },
            { value: 'note', label: 'Nome' },
            { value: 'function', label: 'Funzione' },
            { value: 'finger', label: 'Dito' },
            { value: 'none', label: 'Nulla' },
          ]}
          onChange={(labelMode) => update({ labelMode })}
        />
      </Field>
    </Panel>
  );
}

export function ExercisePanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const validCustom = parseCustomPattern(s.customText) !== null;
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <Panel title="Esercizio">
      <Toggle checked={s.exerciseOn} onChange={(exerciseOn) => update({ exerciseOn })}>Evidenzia le note a tempo</Toggle>
      <Field label="Struttura">
        <Segmented
          label="Struttura dell'esercizio"
          value={s.exerciseMode}
          options={[
            { value: 'single', label: 'Esercizio singolo' },
            { value: 'routine', label: 'Percorso a fasi' },
          ]}
          onChange={(exerciseMode) => update({ exerciseMode })}
        />
      </Field>
      <button type="button" className="btn btn-editor" data-testid="open-editor" onClick={() => setEditorOpen(true)}>Apri editor avanzato</button>
      <RoutineEditor open={editorOpen} onClose={() => setEditorOpen(false)} />
      {s.exerciseMode === 'routine' ? <RoutineSummary /> : <SingleExercise validCustom={validCustom} />}
    </Panel>
  );
}

function RoutineSummary() {
  const routine = useApp((state) => state.settings.routine);
  const selectedPhase = useApp((state) => state.selectedPhase);
  const setSelectedPhase = useApp((state) => state.setSelectedPhase);
  const playing = usePlayhead((p) => p.phase);
  const current = playing ?? selectedPhase;
  return (
    <div className="routine-summary" data-testid="routine-summary">
      <p className="routine-name">{routine.name}</p>
      <ol className="routine-phases">
        {routine.phases.map((phase, i) => {
          const scale = buildScale(phase.tonic, phase.scaleId);
          return (
            <li key={phase.id}>
              <button type="button" className={`routine-phase ${i === current ? 'is-current' : ''}`} aria-pressed={i === current} onClick={() => setSelectedPhase(i)}>
                <strong>{i + 1}</strong> {scale.tonicName} {scale.definition.name}, {positionLabel(phase.position, scale)}{phase.octave ? ' alta' : ''}, {describeDirection(phase.direction)}{phase.repeats > 1 ? ` ×${phase.repeats}` : ''}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SingleExercise({ validCustom }: { readonly validCustom: boolean }) {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  return (
    <>
      <Field label="Tipo">
        <Segmented
          label="Tipo di esercizio"
          value={s.exerciseKind}
          options={[
            { value: 'interval', label: 'Intervalli' },
            { value: 'scale', label: 'Scala' },
            { value: 'custom', label: 'Sequenza' },
          ]}
          onChange={(exerciseKind) => update({ exerciseKind })}
        />
      </Field>
      {s.exerciseKind === 'interval' ? (
        <>
          <Field label="Intervallo">
            <Select<IntervalNumber>
              testId="interval"
              label="Intervallo"
              value={s.interval}
              options={([2, 3, 4, 5, 6, 7, 8] as const).map((n) => ({ value: n, label: INTERVAL_NAMES[n] }))}
              onChange={(interval) => update({ interval })}
            />
          </Field>
          <Field label="Ogni coppia">
            <Segmented
              label="Direzione della coppia"
              value={s.pairMotion}
              options={[
                { value: 'ascending', label: 'Sale' },
                { value: 'descending', label: 'Scende' },
                { value: 'alternating', label: 'Alterna' },
              ]}
              onChange={(pairMotion) => update({ pairMotion })}
            />
          </Field>
        </>
      ) : null}
      {s.exerciseKind === 'custom' ? (
        <Field label="Passi della scala" hint={validCustom ? 'La sequenza riparte da ogni nota: 1 3 2 4 fa Do Mi Re Fa, Re Fa Mi Sol…' : 'Scrivi numeri da 1 a 24 separati da spazi, per esempio 1 3 2 4.'}>
          <input className={`text-input ${validCustom ? '' : 'is-invalid'}`} data-testid="custom-pattern" value={s.customText} aria-invalid={!validCustom} onChange={(event) => update({ customText: event.target.value })} />
        </Field>
      ) : null}
      <div className="row">
        <Field label="Percorso">
          <Select
            label="Percorso"
            value={s.direction}
            options={[
              { value: 'updown', label: 'Sali e scendi' },
              { value: 'up', label: 'Solo a salire' },
              { value: 'down', label: 'Solo a scendere' },
            ]}
            onChange={(direction) => update({ direction })}
          />
        </Field>
        <Field label="Note per movimento">
          <Select
            label="Note per movimento"
            value={s.notesPerBeat}
            options={[
              { value: 1 as const, label: '1' },
              { value: 2 as const, label: '2' },
              { value: 3 as const, label: '3' },
              { value: 4 as const, label: '4' },
            ]}
            onChange={(notesPerBeat) => update({ notesPerBeat })}
          />
        </Field>
      </div>
    </>
  );
}

export function OverlayPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const chord = s.overlayChord ? tryParseChord(s.overlayChord) : null;
  const invalid = s.overlayChord !== '' && chord === null;
  return (
    <Panel title="Accordo sovrapposto">
      <Field label="Accordo" hint={invalid ? 'Accordo non riconosciuto. Prova Cmaj7, Dm9, G13, F#m7b5.' : 'Lascia vuoto per vedere solo la scala.'}>
        <input className={`text-input ${invalid ? 'is-invalid' : ''}`} data-testid="overlay-chord" value={s.overlayChord} placeholder="Cmaj7" aria-invalid={invalid} onChange={(event) => update({ overlayChord: event.target.value })} />
      </Field>
      {chord ? <p className="spelling" data-testid="overlay-spelling">{chord.tones.map((t) => `${t.name} (${t.degree})`).join('  ')}</p> : null}
      <AudioMix showComp={false} />
    </Panel>
  );
}

function AudioMix({ showComp }: { readonly showComp: boolean }) {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  return (
    <div className="row">
      <Volume label="Click" value={s.volClick} onChange={(volClick) => update({ volClick })} />
      <Volume label="Note" value={s.volNotes} onChange={(volNotes) => update({ volNotes })} />
      {showComp ? <Volume label="Accordi" value={s.volComp} onChange={(volComp) => update({ volComp })} /> : null}
    </div>
  );
}

export function ChordStrip() {
  const s = useApp((state) => state.settings);
  const selected = useApp((state) => state.selectedChord);
  const playhead = usePlayhead((p) => p.chordIndex);
  const transport = usePlayhead((p) => p.state);
  const auto = s.mode === 'jam' || s.changeMode === 'auto';
  const locked = auto && transport === 'playing';
  const current = playhead ?? selected;
  return (
    <ol className="chord-strip" data-testid="chord-strip">
      {s.progression.chords.map((chord, i) => (
        <li key={chord.id}>
          <button
            type="button"
            className={`chord-chip ${i === current ? 'is-current' : ''}`}
            data-testid={`chip-${i}`}
            aria-current={i === current ? 'true' : undefined}
            disabled={locked}
            onClick={() => engine.setChord(i)}
          >
            {chord.symbol}
            <span className="chip-length">{chord.duration.value} {chord.duration.unit === 'bars' ? 'batt.' : 'mov.'}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

const FOCUS_OPTIONS: readonly { value: HarmonyFocus; label: string; help: string }[] = [
  { value: 'all', label: 'Tutte le funzioni', help: 'Ogni nota porta la sua funzione sull’accordo corrente.' },
  { value: 'guide', label: 'Guide tones', help: 'Terze e settime, con le frecce verso il prossimo accordo.' },
  { value: 'common', label: 'Note comuni', help: 'Le note che restano ferme nel cambio, con le due funzioni.' },
  { value: 'resolution', label: 'Risoluzione', help: 'Tensioni e guide tones con la nota su cui risolvono.' },
  { value: 'targeting', label: 'Chord-tone target', help: 'Un bersaglio per accordo, il più vicino al precedente. Il tratteggio è il prossimo.' },
];

export function ProgressionLoader() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const [key, setKey] = useState('C');
  return (
    <div className="row">
      <Field label="Progressione">
        <Select
          label="Carica progressione"
          testId="template"
          value="__"
          options={[{ value: '__', label: 'Scegli…' }, ...PROGRESSION_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))]}
          onChange={(id) => {
            const template = PROGRESSION_TEMPLATES.find((t) => t.id === id);
            if (template) update({ progression: instantiateTemplate(template, key) });
          }}
        />
      </Field>
      <Field label="In tonalità"><Select label="Tonalità" value={key} options={tonicOptions} onChange={setKey} /></Field>
      <Field label="Battute per accordo">
        <Select
          label="Battute per accordo"
          testId="bars-per-chord"
          value="__"
          options={[{ value: '__', label: 'Imposta…' }, ...[1, 2, 4].map((n) => ({ value: String(n), label: String(n) }))]}
          onChange={(value) => {
            const duration: ChordDuration = { value: Number(value), unit: 'bars' };
            update({ progression: { ...s.progression, chords: s.progression.chords.map((c) => ({ ...c, duration })) } });
          }}
        />
      </Field>
    </div>
  );
}

export function HarmonyPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const help = FOCUS_OPTIONS.find((f) => f.value === s.focus)?.help;
  return (
    <>
      <Panel title="Cambio di contesto armonico" className="panel-wide">
        <ChordStrip />
        <ProgressionLoader />
        <div className="row">
          <Field label="Cambio accordi">
            <Segmented
              label="Cambio accordi"
              value={s.changeMode}
              options={[{ value: 'auto', label: 'Automatico' }, { value: 'manual', label: 'Manuale' }]}
              onChange={(changeMode) => update({ changeMode })}
            />
          </Field>
          {s.changeMode === 'manual' ? (
            <>
              <Field label="Il cambio arriva">
                <Segmented
                  label="Quantizzazione"
                  value={s.quantize}
                  options={[{ value: 'beat', label: 'Al movimento' }, { value: 'bar', label: 'Alla battuta' }]}
                  onChange={(quantize) => update({ quantize })}
                />
              </Field>
              <div className="manual-buttons">
                <button type="button" className="btn" data-testid="prev-chord" onClick={() => engine.changeChord(-1)}>Accordo precedente</button>
                <button type="button" className="btn btn-accent" data-testid="next-chord" onClick={() => engine.changeChord(1)}>Accordo successivo</button>
              </div>
            </>
          ) : null}
        </div>
        <Field label="Cosa guardare" hint={help}>
          <Segmented label="Focus" value={s.focus} options={FOCUS_OPTIONS} onChange={(focus) => update({ focus })} />
        </Field>
        <div className="row">
          <Field label="Avoid notes" hint={AVOID_PROFILES[s.avoidProfile].description}>
            <Select<AvoidProfile>
              label="Profilo avoid"
              testId="profile"
              value={s.avoidProfile}
              options={(Object.keys(AVOID_PROFILES) as AvoidProfile[]).map((id) => ({ value: id, label: AVOID_PROFILES[id].name }))}
              onChange={(avoidProfile) => update({ avoidProfile })}
            />
          </Field>
        </div>
        <div className="row">
          <Toggle checked={s.compOn} onChange={(compOn) => update({ compOn })}>Suona gli accordi</Toggle>
          <AudioMix showComp />
        </div>
      </Panel>
    </>
  );
}

function ChordRow({ index, progression, onChange }: { readonly index: number; readonly progression: Progression; readonly onChange: (p: Progression) => void }) {
  const entry = progression.chords[index];
  if (!entry) return null;
  const chord = parseChord(entry.symbol);
  const setSymbol = (root: string, suffix: string) => onChange(updateChord(progression, index, { symbol: `${root}${suffix}` }));
  return (
    <li className="builder-row" data-testid={`builder-row-${index}`}>
      <Select label={`Nota base accordo ${index + 1}`} testId={`root-${index}`} value={chord.rootName} options={tonicOptions.some((o) => o.value === chord.rootName) ? tonicOptions : [...tonicOptions, { value: chord.rootName, label: chord.rootName }]} onChange={(root) => setSymbol(root, chord.suffix)} />
      <Select label={`Qualità accordo ${index + 1}`} testId={`quality-${index}`} value={chord.suffix} options={suffixOptions} onChange={(suffix) => setSymbol(chord.rootName, suffix)} />
      <input
        className="text-input duration-input"
        type="number"
        min={1}
        max={32}
        aria-label={`Durata accordo ${index + 1}`}
        value={entry.duration.value}
        onChange={(event) => {
          const value = Math.round(Number(event.target.value));
          if (value >= 1 && value <= 32) onChange(updateChord(progression, index, { duration: { ...entry.duration, value } }));
        }}
      />
      <Select
        label={`Unità di durata accordo ${index + 1}`}
        value={entry.duration.unit}
        options={[{ value: 'bars' as const, label: 'battute' }, { value: 'beats' as const, label: 'movimenti' }]}
        onChange={(unit) => onChange(updateChord(progression, index, { duration: { ...entry.duration, unit } }))}
      />
      <div className="row-actions">
        <button type="button" className="icon-btn" aria-label={`Sposta accordo ${index + 1} prima`} disabled={index === 0} onClick={() => onChange(moveChord(progression, index, -1))}>↑</button>
        <button type="button" className="icon-btn" aria-label={`Sposta accordo ${index + 1} dopo`} disabled={index === progression.chords.length - 1} onClick={() => onChange(moveChord(progression, index, 1))}>↓</button>
        <button type="button" className="icon-btn" aria-label={`Duplica accordo ${index + 1}`} data-testid={`dup-${index}`} onClick={() => onChange(duplicateChord(progression, index))}>⧉</button>
        <button type="button" className="icon-btn" aria-label={`Rimuovi accordo ${index + 1}`} data-testid={`del-${index}`} disabled={progression.chords.length === 1} onClick={() => onChange(removeChord(progression, index))}>×</button>
      </div>
    </li>
  );
}

export function JamPanels() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const onChange = (progression: Progression) => update({ progression });
  return (
    <>
      <Panel title="Progressione" className="panel-wide">
        <ChordStrip />
        <ProgressionLoader />
        <ol className="builder" data-testid="builder">
          {s.progression.chords.map((chord, index) => (
            <ChordRow key={chord.id} index={index} progression={s.progression} onChange={onChange} />
          ))}
        </ol>
        <div className="row builder-actions">
          <button type="button" className="btn" data-testid="add-chord" onClick={() => onChange(addChord(s.progression, 'C7'))}>Aggiungi accordo</button>
          <button type="button" className="btn" data-testid="transpose-down" onClick={() => onChange(transposeProgression(s.progression, -1))}>Trasponi −1</button>
          <button type="button" className="btn" data-testid="transpose-up" onClick={() => onChange(transposeProgression(s.progression, 1))}>Trasponi +1</button>
          <Toggle checked={s.loop} onChange={(loop) => update({ loop })}>Ripeti in loop</Toggle>
        </div>
      </Panel>
      <Panel title="Accompagnamento">
        <Toggle checked={s.compOn} onChange={(compOn) => update({ compOn })}>Suona gli accordi</Toggle>
        <Field label="Ritmo">
          <Select<CompPattern>
            label="Ritmo"
            testId="comp-pattern"
            value={s.compPattern}
            options={(Object.keys(COMP_PATTERNS) as CompPattern[]).map((id) => ({ value: id, label: COMP_PATTERNS[id] }))}
            onChange={(compPattern) => update({ compPattern })}
          />
        </Field>
        <AudioMix showComp />
      </Panel>
      <Panel title="Aiuti sulla tastiera">
        <Toggle checked={s.showAids} onChange={(showAids) => update({ showAids })}>Mostra gli aiuti visivi</Toggle>
        <Field label="Cosa guardare" hint={FOCUS_OPTIONS.find((f) => f.value === s.focus)?.help}>
          <Select label="Focus" value={s.focus} options={FOCUS_OPTIONS} onChange={(focus) => update({ focus })} />
        </Field>
        <Toggle checked={s.secondScaleOn} onChange={(secondScaleOn) => update({ secondScaleOn })}>Sovrapponi una seconda scala</Toggle>
        {s.secondScaleOn ? (
          <div className="row">
            <Field label="Tonica"><Select label="Tonica seconda scala" value={s.secondTonic} options={tonicOptions} onChange={(secondTonic) => update({ secondTonic })} /></Field>
            <Field label="Scala"><Select label="Seconda scala" value={s.secondScaleId} options={scaleOptions} onChange={(secondScaleId: ScaleId) => update({ secondScaleId })} /></Field>
          </div>
        ) : null}
      </Panel>
    </>
  );
}

/** What a saved study preset keeps: everything except the mixer and mode-free UI state. */
const MIXER_KEYS = new Set(['volClick', 'volNotes', 'volComp']);
const pickStudy = (s: Settings): Partial<Settings> =>
  Object.fromEntries(Object.entries(s).filter(([key]) => !MIXER_KEYS.has(key))) as Partial<Settings>;

export function PresetsPanel() {
  const settings = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(() => presetRepository.list('study'));

  const applyPreset = (data: unknown) => update(sanitizeSettings({ ...settings, ...(data as object) }));

  return (
    <Panel title="Preset di studio">
      <Field label="Carica">
        <Select
          label="Carica un preset"
          testId="preset-load"
          value="__"
          options={[
            { value: '__', label: 'Scegli…' },
            ...STUDY_PRESETS.map((p) => ({ value: p.id, label: p.name })),
            ...saved.map((p) => ({ value: p.id, label: `Tuo: ${p.name}` })),
          ]}
          onChange={(id) => {
            const builtin = STUDY_PRESETS.find((p) => p.id === id);
            const own = saved.find((p) => p.id === id);
            if (builtin) applyPreset(builtin.data);
            if (own) applyPreset(own.data);
            const label = builtin?.name ?? own?.name;
            if (label) setMessage(`Caricato: ${label}`);
          }}
        />
      </Field>
      <form
        className="row save-row"
        onSubmit={(event) => {
          event.preventDefault();
          const result = presetRepository.save(name, 'study', pickStudy(settings));
          if (result.ok) {
            setMessage(`Salvato: ${result.preset.name}`);
            setName('');
            setSaved(presetRepository.list('study'));
          } else {
            setMessage(result.error);
          }
        }}
      >
        <Field label="Nome"><input className="text-input" data-testid="preset-name" value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <button type="submit" className="btn" data-testid="preset-save">Salva preset</button>
      </form>
      {saved.length > 0 ? (
        <ul className="saved-list" data-testid="saved-list">
          {saved.map((preset) => (
            <li key={preset.id}>
              <span>{preset.name}</span>
              <button type="button" className="link" aria-label={`Elimina ${preset.name}`} onClick={() => {
                presetRepository.remove(preset.id);
                setSaved(presetRepository.list('study'));
                setMessage(`Eliminato: ${preset.name}`);
              }}>Elimina</button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="status" role="status" data-testid="preset-status">{message}</p>
    </Panel>
  );
}
