import { createContext, useContext, useMemo, useState } from 'react';
import { STUDY_PRESETS } from '../app/builtins';
import { TUNINGS } from '../pitch';
import { BASS_TIMBRES, COMP_TIMBRES, DRUM_KIT_SOUNDS, type BassTimbre, type CompTimbre, type DrumKitSound } from '../audio/instruments';
import { engine } from '../app/engine';
import { genreSettings, sanitizeSettings, sanitizeTuning, tuningOf, type HarmonyFocus, type LabelMode, type PositionType, type Settings } from '../app/settings';
import { presetRepository, useApp, usePlayhead } from '../app/store';
import { CAGED_FORMS } from '../fretboard';
import { INTERVAL_NAMES, describeDirection, parseCustomPattern, positionLabel, type IntervalNumber } from '../exercises';
import { AVOID_PROFILES, HOME_MODES, chordOrigin, guideTones, type AvoidProfile } from '../harmony';
import {
  COMP_PATTERNS, GENRES, PROGRESSION_TEMPLATES, addChord, genreOf, duplicateChord, instantiateTemplate, moveChord, removeChord, transposeProgression, updateChord, withChord,
  type CompPattern, type Progression, type ChordDuration,
} from '../jam';
import { CHORD_SUFFIXES, INVERSION_NAMES, SCALES, SCALE_IDS, TONICS, parseChord, tryParseChord, buildScale, compareScales, withBass, parseNote, pitchClass, type Chord, type Scale, type ScaleId } from '../theory';
import { MAX_CHORDS, addChordLayer, moveChordLayer, resolveChordLayer, type ChordLayer } from '../app/chordLayers';
import { voicingKey } from '../fretboard';
import { ChordDiagram } from '../viz/ChordDiagram';
import { LAYER_COLORS, LAYER_COLOR_NAMES, MAX_EXTRA_SCALES, MAX_SCALES, addLayer, isCrowded, moveLayer, type LayerColor, type ScaleLayer } from '../app/scaleLayers';
import { Field, Panel, Segmented, Select, Toggle, Volume } from './controls';
import { ArpShapeControls } from './ArpShapePanel';

export const tonicOptions = TONICS.map((t) => ({ value: t, label: t }));
export const scaleOptions = SCALE_IDS.map((id) => ({ value: id, label: SCALES[id].name }));
const suffixOptions = CHORD_SUFFIXES.map((s) => ({ value: s, label: s === '' ? 'maggiore' : s }));

function LayerItem({ layer, index, count, main }: {
  readonly layer: ScaleLayer;
  readonly index: number;
  readonly count: number;
  readonly main: Scale;
}) {
  const layers = useApp((state) => state.settings.scaleLayers);
  const update = useApp((state) => state.update);
  const [open, setOpen] = useState(false);
  const scale = useMemo(() => buildScale(layer.tonic, layer.scaleId), [layer.tonic, layer.scaleId]);
  const comparison = useMemo(() => compareScales(main, scale), [main, scale]);
  const n = index + 2;
  const change = (patch: Partial<ScaleLayer>) => update({ scaleLayers: layers.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const bodyId = `layer-body-${layer.id}`;
  return (
    <li className={`layer-item layer-${layer.color} ${layer.visible ? '' : 'is-hidden'}`} data-testid="scale-layer">
      <div className="layer-head">
        <span className="layer-swatch" aria-hidden="true">{n}</span>
        <button type="button" className="layer-name" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
          {scale.tonicName} {scale.definition.name}
        </button>
        <button type="button" className="icon-btn" aria-pressed={layer.visible} aria-label={`${layer.visible ? 'Nascondi' : 'Mostra'} la scala ${n}`} onClick={() => change({ visible: !layer.visible })}>
          {layer.visible ? '◉' : '○'}
        </button>
        <button type="button" className="icon-btn" aria-label={`Sposta la scala ${n} in alto`} disabled={index === 0} onClick={() => update({ scaleLayers: moveLayer(layers, index, index - 1) })}>↑</button>
        <button type="button" className="icon-btn" aria-label={`Sposta la scala ${n} in basso`} disabled={index === count - 1} onClick={() => update({ scaleLayers: moveLayer(layers, index, index + 1) })}>↓</button>
        <button type="button" className="icon-btn" aria-label={`Rimuovi la scala ${n}`} onClick={() => update({ scaleLayers: layers.filter((_, i) => i !== index) })}>✕</button>
      </div>
      {open ? (
        <div className="layer-body" id={bodyId}>
          <div className="row">
            <Field label="Tonica"><Select label={`Tonica della scala ${n}`} value={layer.tonic} options={tonicOptions} onChange={(tonic) => change({ tonic })} /></Field>
            <Field label="Scala"><Select label={`Tipo della scala ${n}`} value={layer.scaleId} options={scaleOptions} onChange={(scaleId: ScaleId) => change({ scaleId })} /></Field>
          </div>
          <p className="spelling small">{scale.tones.map((t) => t.name).join('  ')}</p>
          <Field label="Dove">
            <Segmented
              label={`Zona della scala ${n}`}
              value={layer.region}
              options={[{ value: 'position', label: 'Nella posizione' }, { value: 'neck', label: 'Tutta la tastiera' }]}
              onChange={(region) => change({ region })}
            />
          </Field>
          <div className="row">
            <Field label="Colore">
              <Select<LayerColor> label={`Colore della scala ${n}`} value={layer.color} options={LAYER_COLORS.map((c) => ({ value: c, label: LAYER_COLOR_NAMES[c] }))} onChange={(color) => change({ color })} />
            </Field>
            <Field label={`Opacità ${Math.round(layer.opacity * 100)}%`}>
              <input className="range" type="range" min={0.25} max={1} step={0.05} value={layer.opacity} aria-label={`Opacità della scala ${n}`} onChange={(e) => change({ opacity: Number(e.target.value) })} />
            </Field>
          </div>
          <dl className="comparison" data-testid="scale-comparison">
            <dt>In comune con {main.tonicName} {main.definition.name}</dt>
            <dd>{comparison.common.join(' ') || '—'}</dd>
            <dt>Solo nella principale</dt>
            <dd>{comparison.onlyFirst.join(' ') || '—'}</dd>
            <dt>Solo in questa</dt>
            <dd>{comparison.onlySecond.join(' ') || '—'}</dd>
          </dl>
        </div>
      ) : null}
    </li>
  );
}

function ScaleLayersSection() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const main = useMemo(() => buildScale(s.tonic, s.scaleId), [s.tonic, s.scaleId]);
  const layers = s.scaleLayers;
  const full = layers.length >= MAX_EXTRA_SCALES;
  return (
    <section className="layers" aria-label="Altre scale">
      <h3 className="panel-subtitle">Altre scale <span className="muted">({layers.length + 1} di {MAX_SCALES})</span></h3>
      {layers.length > 0 ? (
        <ol className="layer-list">
          {layers.map((layer, i) => <LayerItem key={layer.id} layer={layer} index={i} count={layers.length} main={main} />)}
        </ol>
      ) : null}
      {isCrowded(layers) ? (
        <p className="note" role="status">Più di due scale visibili: ogni scala ha il suo punto attorno alla nota. Abbassa l’opacità o nascondi quelle che non stai confrontando.</p>
      ) : null}
      <button type="button" className="btn" data-testid="add-scale" disabled={full} onClick={() => update({ scaleLayers: addLayer(layers, s) })}>
        + Aggiungi scala
      </button>
      {full ? <p className="field-hint">Massimo {MAX_SCALES} scale, principale compresa.</p> : null}
    </section>
  );
}

/** How notes are labelled on the neck. Shared: Simple shows it in the scale panel, Studio above the neck. */
export function LabelModeSelector() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  return (
    <Field label="Sulle note">
      <Segmented<LabelMode>
        label="Etichette"
        value={s.labelMode}
        options={[
          { value: 'degree', label: 'Grado' },
          { value: 'note', label: 'Nome' },
          { value: 'function', label: 'Funzione' },
          { value: 'interval', label: 'Intervallo' },
          { value: 'finger', label: 'Dito' },
          { value: 'none', label: 'Nulla' },
        ]}
        onChange={(labelMode) => update({ labelMode })}
      />
    </Field>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const midiName = (m: number) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
const OPEN_OPTIONS = Array.from({ length: 76 - 23 + 1 }, (_, i) => ({ value: 23 + i, label: midiName(23 + i) }));

/** Preset tunings and "custom", for every tuning selector of the neck. */
export const neckTuningOptions = [...TUNINGS.map((t) => ({ value: t.id, label: t.name })), { value: 'custom', label: 'Personalizzata' }];
/** Choosing a tuning: a preset also sets the tuner; "custom" starts from the strings in use. */
export const neckTuningChange = (neckTuning: string, strings: readonly number[]): Partial<Settings> => (neckTuning === 'custom'
  ? { neckTuning, customTuning: [...strings] }
  : { neckTuning, tunerTuning: neckTuning });

/** Tuning of the neck (P1-05, D-36): presets, or six open strings of your own. */
export function TuningField() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const strings = tuningOf(s);
  const standard = s.neckTuning === 'standard';
  return (
    <div className="tuning-field" data-testid="tuning-field">
      <Field label="Accordatura" hint={standard ? undefined : 'CAGED e 3NPS sono pensate per l’accordatura standard: qui restano suonabili ma non sono le forme classiche. Tasti e Tutta la tastiera sono esatti.'}>
        <Select<string>
          label="Accordatura della tastiera" testId="neck-tuning" value={s.neckTuning}
          options={neckTuningOptions}
          onChange={(neckTuning) => update(neckTuningChange(neckTuning, strings))}
        />
      </Field>
      {s.neckTuning === 'custom' ? (
        <div className="row tuning-strings" role="group" aria-label="Corde a vuoto, dalla sesta alla prima">
          {strings.map((midi, i) => (
            <Select<number>
              key={i} label={`Corda ${6 - i} a vuoto`} testId={`tuning-string-${6 - i}`} value={midi} options={OPEN_OPTIONS}
              onChange={(v) => {
                const next = strings.map((m, k) => (k === i ? v : m));
                const clean = sanitizeTuning(next);
                if (clean) update({ customTuning: clean });
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ScalePanel({ showLabels = true }: { readonly showLabels?: boolean }) {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const scale = useMemo(() => buildScale(s.tonic, s.scaleId), [s.tonic, s.scaleId]);
  const heptatonic = scale.tones.length === 7;
  return (
    <Panel title="Scala e posizione">
      <h3 className="panel-subtitle">Scala principale</h3>
      <div className="row">
        <Field label="Tonica"><Select testId="tonic" label="Tonica" value={s.tonic} options={tonicOptions} onChange={(tonic) => update({ tonic })} /></Field>
        <Field label="Scala"><Select testId="scale" label="Scala" value={s.scaleId} options={scaleOptions} onChange={(scaleId: ScaleId) => update({ scaleId })} /></Field>
      </div>
      <p className="spelling" data-testid="scale-spelling">{scale.tones.map((t) => t.name).join('  ')}</p>
      <TuningField />
      {s.mode === 'arpeggio' ? null : (
        <>
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
        </>
      )}
      <ScaleLayersSection />
      {showLabels ? <LabelModeSelector /> : null}
    </Panel>
  );
}

export function ExercisePanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const validCustom = parseCustomPattern(s.customText) !== null;
  const setEditorOpen = useApp((state) => state.setEditorOpen);
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
                <strong>{i + 1}</strong> {phase.kind === 'arpeggio' ? `Arpeggio ${phase.chord} · ` : ''}{scale.tonicName} {scale.definition.name}, {positionLabel(phase.position, scale)}{phase.octave ? ' alta' : ''}, {describeDirection(phase.direction)}{phase.repeats > 1 ? ` ×${phase.repeats}` : ''}
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

const QUALITY_OPTIONS = CHORD_SUFFIXES.map((suffix) => ({ value: suffix, label: suffix === '' ? 'maggiore' : suffix }));

function bassOptions(chord: Chord) {
  const tones = chord.tones.map((t, i) => {
    const inversion = i === 0 ? 0 : withBass(chord, t.name).bass?.inversion ?? null;
    const name = inversion !== null ? INVERSION_NAMES[inversion] : `basso sul ${t.degree}`;
    return { value: i === 0 ? '' : t.name, label: `${t.name} — ${name} (${t.degree})` };
  });
  const used = new Set(chord.tones.map((t) => t.pc));
  const foreign = TONICS.filter((n) => !used.has(pitchClass(parseNote(n)))).map((n) => ({ value: n, label: `${n} — basso esterno` }));
  return [...tones, ...foreign];
}

function ChordEditor({ index }: { readonly index: number }) {
  const layers = useApp((state) => state.settings.chordLayers);
  const update = useApp((state) => state.update);
  const layer = layers[index];
  const tuning = useApp((state) => tuningOf(state.settings));
  const resolved = useMemo(() => (layer ? resolveChordLayer(layer, tuning) : null), [layer, tuning]);
  if (!layer || !resolved) return null;
  const { chord, voicings, shape } = resolved;
  const change = (patch: Partial<ChordLayer>) => update({ chordLayers: layers.map((l, i) => (i === index ? { ...l, ...patch } : l)) });
  const rebuild = (root: string, suffix: string, bass: string | null) => {
    const base = tryParseChord(`${root}${suffix}`);
    if (!base) return;
    change({ symbol: withBass(base, bass).symbol, voicing: null });
  };
  const invalid = chord === null;
  return (
    <div className="chord-editor" data-testid="chord-editor">
      <Field label="Simbolo" hint={invalid ? 'Accordo non riconosciuto. Prova Cmaj7, Dm9, G13, F#m7b5, C/E.' : 'Scrivi un simbolo o costruiscilo qui sotto.'}>
        <input className={`text-input ${invalid ? 'is-invalid' : ''}`} data-testid="chord-symbol" value={layer.symbol} placeholder="Cmaj7" aria-invalid={invalid} onChange={(e) => change({ symbol: e.target.value, voicing: null })} />
      </Field>
      {chord ? (
        <>
          <div className="row">
            <Field label="Fondamentale"><Select label="Fondamentale" value={chord.rootName} options={tonicOptions.some((o) => o.value === chord.rootName) ? tonicOptions : [...tonicOptions, { value: chord.rootName, label: chord.rootName }]} onChange={(root) => rebuild(root, chord.suffix, chord.bass?.name ?? null)} /></Field>
            <Field label="Qualità"><Select label="Qualità" testId="chord-quality" value={chord.suffix} options={QUALITY_OPTIONS} onChange={(suffix) => rebuild(chord.rootName, suffix, chord.bass?.name ?? null)} /></Field>
          </div>
          <Field label="Basso">
            <Select label="Basso" testId="chord-bass" value={chord.bass?.name ?? ''} options={bassOptions(chord)} onChange={(bass) => rebuild(chord.rootName, chord.suffix, bass || null)} />
          </Field>
          <p className="spelling" data-testid="chord-spelling">
            {chord.tones.map((t) => `${t.name} (${t.degree})`).join('  ')}
            {chord.bass ? <span className="muted"> · basso {chord.bass.name}{chord.bass.inversion !== null ? `, ${INVERSION_NAMES[chord.bass.inversion]}` : ', nota esterna all’accordo'}</span> : null}
          </p>
          <div className="field" role="group" aria-labelledby={`voicing-label-${layer.id}`}>
            <span className="field-label" id={`voicing-label-${layer.id}`}>Forma sulla tastiera ({voicings.length} trovate)</span>
            <div className="voicing-picker">
              <button type="button" className="icon-btn" aria-label="Forma precedente" disabled={layer.voicing === null} onClick={() => change({ voicing: layer.voicing === null || layer.voicing === 0 ? null : layer.voicing - 1 })}>‹</button>
              <Select<number>
                label="Forma"
                testId="chord-voicing"
                value={layer.voicing ?? -1}
                options={[{ value: -1, label: 'Nessuna: solo funzioni' }, ...voicings.map((v, i) => ({ value: i, label: `${i + 1} · tasto ${v.baseFret} · ${voicingKey(v)}` }))]}
                onChange={(v) => change({ voicing: v < 0 ? null : v })}
              />
              <button type="button" className="icon-btn" aria-label="Forma successiva" disabled={voicings.length === 0 || layer.voicing === voicings.length - 1} onClick={() => change({ voicing: layer.voicing === null ? 0 : layer.voicing + 1 })}>›</button>
            </div>
          </div>
          {shape ? <p className="field-hint">Dal basso: {shape.degrees.join(' · ')}</p> : null}
        </>
      ) : null}
    </div>
  );
}

export function ChordsPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const layers = s.chordLayers;
  const tuning = useApp((state) => tuningOf(state.settings));
  const resolved = useMemo(() => layers.map((l) => resolveChordLayer(l, tuning)), [layers, tuning]);
  const scale = useMemo(() => buildScale(s.tonic, s.scaleId), [s.tonic, s.scaleId]);
  const full = layers.length >= MAX_CHORDS;
  const setActive = (activeChord: number) => update({ activeChord });
  const remove = (index: number) => {
    const chordLayers = layers.filter((_, i) => i !== index);
    update({ chordLayers, activeChord: Math.max(0, Math.min(s.activeChord > index ? s.activeChord - 1 : s.activeChord, chordLayers.length - 1)) });
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    update({ chordLayers: moveChordLayer(layers, index, target), activeChord: s.activeChord === index ? target : s.activeChord === target ? index : s.activeChord });
  };
  const playable = resolved.filter((r) => r.chord && r.layer.visible);
  return (
    <Panel title="Accordi">
      {layers.length === 0 ? <p className="field-hint">Nessun accordo: la tastiera mostra solo la scala.</p> : (
        <ol className="chord-list">
          {resolved.map((r, i) => (
            <li key={r.layer.id} className={`chord-item ${i === s.activeChord ? 'is-active' : ''} ${r.layer.visible ? '' : 'is-hidden'}`} data-testid="chord-layer">
              <button type="button" className="chord-pick" aria-pressed={i === s.activeChord} onClick={() => setActive(i)}>
                <span className="chord-role">{i === 0 ? 'Principale' : `Accordo ${i + 1}`}</span>
                <strong className={r.chord ? '' : 'is-invalid-text'}>{r.layer.symbol || '—'}</strong>
              </button>
              <button type="button" className="icon-btn" aria-pressed={r.layer.visible} aria-label={`${r.layer.visible ? 'Nascondi' : 'Mostra'} l’accordo ${i + 1}`} onClick={() => update({ chordLayers: layers.map((l, j) => (j === i ? { ...l, visible: !l.visible } : l)) })}>{r.layer.visible ? '◉' : '○'}</button>
              <button type="button" className="icon-btn" aria-label={`Sposta l’accordo ${i + 1} in alto`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" className="icon-btn" aria-label={`Sposta l’accordo ${i + 1} in basso`} disabled={i === layers.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" className="icon-btn" aria-label={`Rimuovi l’accordo ${i + 1}`} onClick={() => remove(i)}>✕</button>
            </li>
          ))}
        </ol>
      )}
      {layers.length > 0 ? <ChordEditor index={Math.min(s.activeChord, layers.length - 1)} /> : null}
      <button type="button" className="btn" data-testid="add-chord" disabled={full} onClick={() => update({ chordLayers: addChordLayer(layers, scale), activeChord: layers.length })}>+ Aggiungi accordo</button>
      {full ? <p className="field-hint">Massimo {MAX_CHORDS} accordi.</p> : null}
      {playable.length > 0 ? (
        <div className="diagram-strip" aria-label="Accordi visibili">
          {resolved.map((r, i) => {
            if (!r.chord || !r.layer.visible) return null;
            const shape = r.shape ?? r.voicings[0];
            return (
              <button type="button" key={r.layer.id} className={`diagram-card ${i === s.activeChord ? 'is-active' : ''}`} aria-pressed={i === s.activeChord} onClick={() => setActive(i)}>
                <span className="diagram-symbol">{r.layer.symbol}</span>
                {shape ? <ChordDiagram voicing={shape} label={`${r.layer.symbol}: ${voicingKey(shape)}`} /> : <span className="muted">Nessuna forma</span>}
              </button>
            );
          })}
        </div>
      ) : null}
      {playable.length > 1 ? (
        <button
          type="button"
          className="btn"
          data-testid="chords-to-progression"
          onClick={() => update({
            progression: { name: 'Dai miei accordi', chords: playable.map((r) => withChord(r.chord?.symbol ?? r.layer.symbol)) },
            mode: 'harmony',
            labelMode: s.labelMode === 'degree' ? 'function' : s.labelMode,
          })}
        >
          Usa come progressione in Harmony Lab
        </button>
      ) : null}
      <AudioMix showComp={false} />
    </Panel>
  );
}

/** True inside a layout that has its own mixer: the panels then leave their level sliders out. */
export const MixerShown = createContext(false);

function AudioMix({ showComp }: { readonly showComp: boolean }) {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const mixerShown = useContext(MixerShown);
  if (mixerShown) return null;
  return (
    <div className="row audio-mix">
      <Volume label="Click" value={s.volClick} onChange={(volClick) => update({ volClick })} />
      <Volume label="Note" value={s.volNotes} onChange={(volNotes) => update({ volNotes })} />
      {showComp ? <Volume label="Accordi" value={s.volComp} onChange={(volComp) => update({ volComp })} /> : null}
    </div>
  );
}

const ARP_START_NAMES = ['Fondamentale', 'Terza', 'Quinta', 'Settima', 'Nona', 'Undicesima'];

export function ArpeggioPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const chord = tryParseChord(s.arpSymbol);
  const progression = s.arpSource === 'progression';
  const invalid = !progression && chord === null;
  const customValid = parseCustomPattern(s.arpCustomText) !== null;
  const toneCount = progression ? 4 : chord?.tones.length ?? 4;
  const quick = s.chordLayers.map((l) => l.symbol).filter((symbol, i, all) => tryParseChord(symbol) && all.indexOf(symbol) === i);
  return (
    <Panel title="Arpeggi" className="panel-arpeggio">
      <Field label="Su cosa">
        <Segmented
          label="Sorgente degli arpeggi"
          value={s.arpSource}
          options={[{ value: 'chord', label: 'Un accordo' }, { value: 'progression', label: 'La progressione' }]}
          onChange={(arpSource) => update({ arpSource })}
        />
      </Field>
      {progression ? (
        <>
          <ChordStrip />
          <p className="field-hint">È la stessa progressione di Harmony Lab: modificala lì.</p>
          <Field label="Al cambio di accordo">
            <Segmented
              label="Collegamento tra arpeggi"
              value={s.arpLink}
              options={[{ value: 'connect', label: 'Collega (nota più vicina)' }, { value: 'target', label: 'Arriva su un grado' }, { value: 'restart', label: 'Riparti dal grado scelto' }]}
              onChange={(arpLink) => update({ arpLink })}
            />
          </Field>
          {s.arpLink === 'target' ? (
            <Field label="Sul battere del cambio" hint="Ogni accordo entra sul grado scelto, il più vicino all’ultima nota: il target sul primo movimento.">
              <Select<number>
                label="Grado di arrivo al cambio di accordo"
                testId="arp-target"
                value={s.arpTarget}
                options={ARP_START_NAMES.slice(0, 4).map((label, i) => ({ value: i, label }))}
                onChange={(arpTarget) => update({ arpTarget })}
              />
            </Field>
          ) : null}
          {s.arpLink === 'connect' ? <p className="field-hint">La linea non salta: ogni accordo parte dalla sua nota più vicina all’ultima suonata, poi prosegue e cambia verso ai bordi della posizione.</p> : null}
          <Toggle checked={s.compOn} onChange={(compOn) => update({ compOn })}>Suona gli accordi</Toggle>
        </>
      ) : (
        <>
          <Field label="Accordo" hint={invalid ? 'Accordo non riconosciuto. Prova Cmaj7, Dm7, G7, Am7b5, C/E.' : undefined}>
            <input className={`text-input ${invalid ? 'is-invalid' : ''}`} data-testid="arp-symbol" value={s.arpSymbol} aria-invalid={invalid} onChange={(e) => update({ arpSymbol: e.target.value })} />
          </Field>
          {quick.length > 0 ? (
            <div className="quick-chords" role="group" aria-label="Accordi da Fretboard Lab">
              {quick.map((symbol) => (
                <button type="button" key={symbol} className="chord-chip small" aria-pressed={symbol === s.arpSymbol} onClick={() => update({ arpSymbol: symbol })}>{symbol}</button>
              ))}
            </div>
          ) : null}
          {chord ? (
            <p className="spelling" data-testid="arp-spelling">
              {chord.tones.map((t) => `${t.name} (${t.degree})`).join('  ')}
              <span className="muted"> · guide tones: {guideTones(chord).map((t) => t.name).join(' ')}</span>
            </p>
          ) : null}
        </>
      )}
      <ArpShapeControls />
      <div className="row">
        <Field label="Parti da">
          <Select<number>
            label="Grado di partenza"
            testId="arp-start"
            value={Math.min(s.arpStart, toneCount - 1)}
            options={ARP_START_NAMES.slice(0, toneCount).map((label, i) => ({ value: i, label: i === 0 ? label : `${label} (${i}° rivolto)` }))}
            onChange={(arpStart) => update({ arpStart })}
          />
        </Field>
        <Field label="Direzione">
          <Select
            label="Direzione dell'arpeggio"
            value={s.arpDirection}
            options={[
              { value: 'up' as const, label: 'Sale' },
              { value: 'down' as const, label: 'Scende' },
              { value: 'updown' as const, label: 'Sale e scende' },
              { value: 'downup' as const, label: 'Scende e sale' },
            ]}
            onChange={(arpDirection) => update({ arpDirection })}
          />
        </Field>
        <Field label="Note per movimento">
          <Select label="Note per movimento negli arpeggi" value={s.arpNotesPerBeat} options={([1, 2, 3, 4] as const).map((v) => ({ value: v, label: String(v) }))} onChange={(arpNotesPerBeat) => update({ arpNotesPerBeat })} />
        </Field>
      </div>
      <Toggle checked={s.arpCustomOn} onChange={(arpCustomOn) => update({ arpCustomOn })}>Pattern personalizzato</Toggle>
      {s.arpCustomOn ? (
        <Field label="Passi sulle note dell’accordo" hint={customValid ? (progression && s.arpLink === 'connect' ? 'Con “Collega” il pattern si applica solo ripartendo a ogni accordo.' : '1 3 2 4 su Cmaj7 fa Do Sol Mi Si, Mi Si Sol Do…') : 'Scrivi numeri da 1 a 24 separati da spazi.'}>
          <input className={`text-input ${customValid ? '' : 'is-invalid'}`} data-testid="arp-pattern" value={s.arpCustomText} aria-invalid={!customValid} onChange={(e) => update({ arpCustomText: e.target.value })} />
        </Field>
      ) : null}
    </Panel>
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
    <>
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
    {/* Reserved line: the hint swaps text, the strip never moves. */}
    <p className="field-hint chord-strip-hint" data-testid="chord-strip-hint">
      {locked
        ? s.mode === 'jam'
          ? 'In riproduzione la progressione avanza da sola. Ferma per scegliere da quale accordo partire.'
          : 'In automatico gli accordi seguono la progressione. Per sceglierli mentre suona, passa a Cambio accordi: Manuale.'
        : auto ? 'Scegli l’accordo da cui partire.' : 'Scegli l’accordo: entra al prossimo movimento o battuta.'}
    </p>
    </>
  );
}

export const FOCUS_OPTIONS: readonly { value: HarmonyFocus; label: string; help: string }[] = [
  { value: 'all', label: 'Tutte le funzioni', help: 'Ogni nota porta la sua funzione sull’accordo corrente.' },
  { value: 'guide', label: 'Guide tones', help: 'Terze e settime, con le frecce verso il prossimo accordo.' },
  { value: 'common', label: 'Note comuni', help: 'Le note che restano ferme nel cambio, con le due funzioni.' },
  { value: 'resolution', label: 'Risoluzione', help: 'Tensioni e guide tones con la nota su cui risolvono.' },
  { value: 'targeting', label: 'Chord-tone target', help: 'Un bersaglio per accordo, il più vicino al precedente. Il tratteggio è il prossimo.' },
];

const ORIGIN_LABELS = { diatonic: 'Diatonico', secondary: 'Dominante secondaria', borrowed: 'Prestito modale', chromatic: 'Cromatico' } as const;

/** Modal interchange at a glance (P1-11b, D-30): each chord's numeral, origin and scale. */
export function HarmonyAnalysis() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const rows = s.progression.chords.map((entry) => {
    const chord = tryParseChord(entry.symbol);
    return { entry, origin: chord ? chordOrigin(chord, s.harmonyKey, s.harmonyMode) : null };
  });
  return (
    <div className="harmony-analysis" data-testid="harmony-analysis">
      <div className="row">
        <Field label="Analisi in">
          <Select label="Tonica dell’analisi" testId="analysis-key" value={s.harmonyKey} options={tonicOptions} onChange={(harmonyKey) => update({ harmonyKey })} />
        </Field>
        <Field label="Modo di casa">
          <Select<ScaleId> label="Modo di casa dell’analisi" testId="analysis-mode" value={s.harmonyMode} options={HOME_MODES.map((m) => ({ value: m, label: SCALES[m].name }))} onChange={(harmonyMode) => update({ harmonyMode })} />
        </Field>
      </div>
      <ol className="analysis-list">
        {rows.map(({ entry, origin }, i) => (
          <li key={entry.id} className={`analysis-row origin-${origin?.kind ?? 'none'}`} data-testid={`analysis-${i}`} data-kind={origin?.kind ?? ''}>
            <strong className="analysis-symbol">{entry.symbol}</strong>
            <span className="analysis-numeral">{origin?.numeral ?? '—'}</span>
            <span className="analysis-kind">{origin ? ORIGIN_LABELS[origin.kind] : 'Accordo non riconosciuto'}</span>
            <span className="analysis-text muted">{origin?.text}</span>
          </li>
        ))}
      </ol>
      <Toggle checked={s.contextScales} onChange={(contextScales) => update({ contextScales })}>
        Scala di ogni accordo dall’analisi (tensioni e avoid seguono l’accordo)
      </Toggle>
    </div>
  );
}

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
            if (template) update({ progression: instantiateTemplate(template, key), harmonyKey: key, harmonyMode: template.mode ?? 'ionian' });
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
        <HarmonyAnalysis />
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
      <Panel title="Band">
        <Field label="Genere" hint={`Imposta batteria, basso, ritmo degli accordi e swing. Tempo tipico: ${genreOf(s.jamGenre).bpm} BPM.`}>
          <Select label="Genere" testId="jam-genre" value={s.jamGenre} options={GENRES.map((g) => ({ value: g.id, label: g.label }))} onChange={(id) => update(genreSettings(id))} />
        </Field>
        <button type="button" className="btn" disabled={s.bpm === genreOf(s.jamGenre).bpm} onClick={() => update({ bpm: genreOf(s.jamGenre).bpm })}>
          Usa {genreOf(s.jamGenre).bpm} BPM
        </button>
        <div className="row" data-testid="jam-sounds">
          <Field label="Batteria">
            <Select<DrumKitSound> label="Suono della batteria" testId="drum-sound" value={s.drumSound} options={(Object.keys(DRUM_KIT_SOUNDS) as DrumKitSound[]).map((k) => ({ value: k, label: DRUM_KIT_SOUNDS[k] }))} onChange={(drumSound) => update({ drumSound })} />
          </Field>
          <Field label="Basso">
            <Select<BassTimbre> label="Suono del basso" testId="bass-timbre" value={s.bassTimbre} options={(Object.keys(BASS_TIMBRES) as BassTimbre[]).map((k) => ({ value: k, label: BASS_TIMBRES[k] }))} onChange={(bassTimbre) => update({ bassTimbre })} />
          </Field>
          <Field label="Accordi">
            <Select<CompTimbre> label="Suono degli accordi" testId="comp-timbre" value={s.compTimbre} options={(Object.keys(COMP_TIMBRES) as CompTimbre[]).map((k) => ({ value: k, label: COMP_TIMBRES[k] }))} onChange={(compTimbre) => update({ compTimbre })} />
          </Field>
        </div>
        <Toggle checked={s.bassOn} onChange={(bassOn) => update({ bassOn })}>Suona il basso</Toggle>
        <Field label="Linea di basso">
          <Select<number>
            label="Linea di basso"
            testId="bass-pattern"
            value={s.bassPattern}
            options={genreOf(s.jamGenre).bass.map((b, i) => ({ value: i, label: b.name }))}
            onChange={(bassPattern) => update({ bassPattern })}
          />
        </Field>
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
        <p className="field-hint">Per sovrapporre altre scale usa “+ Aggiungi scala” nel pannello Scala.</p>
      </Panel>
    </>
  );
}

/** What a saved study preset keeps: everything except the mixer and mode-free UI state. */
/** Mixer levels and the visual theme belong to the person, not to a study preset. */
const MIXER_KEYS = new Set(['volClick', 'volNotes', 'volComp', 'muteClick', 'muteNotes', 'muteComp', 'volDrums', 'muteDrums', 'volBass', 'muteBass', 'inputDeviceId', 'inputGain', 'monitorVol', 'tunerA4', 'tunerTuning', 'liveOnBoard', 'inputChannel', 'backing', 'liveSensitivity', 'liveProfiles', 'liveProfileId', 'volMaster', 'rig', 'look', 'tutorMode', 'tutorMinimized']);
const pickStudy = (s: Settings): Partial<Settings> =>
  Object.fromEntries(Object.entries(s).filter(([key]) => !MIXER_KEYS.has(key))) as Partial<Settings>;

type SavedPreset = ReturnType<typeof presetRepository.list>[number];

/** Built-in and saved study presets, as select options ('__' is the prompt). */
export const presetLoadOptions = (saved: readonly SavedPreset[]) => [
  { value: '__', label: 'Scegli…' },
  ...STUDY_PRESETS.map((p) => ({ value: p.id, label: p.name })),
  ...saved.map((p) => ({ value: p.id, label: `Tuo: ${p.name}` })),
];

/** Loads a preset over the current settings (mixer and look stay); returns its name, or null. */
export function loadStudyPreset(id: string, saved: readonly SavedPreset[]): string | null {
  const builtin = STUDY_PRESETS.find((p) => p.id === id);
  const own = saved.find((p) => p.id === id);
  const data = builtin?.data ?? own?.data;
  if (!data) return null;
  const { settings, update } = useApp.getState();
  update(sanitizeSettings({ ...settings, ...(data as object) }));
  return builtin?.name ?? own?.name ?? null;
}

export function PresetsPanel() {
  const settings = useApp((state) => state.settings);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(() => presetRepository.list('study'));

  return (
    <Panel title="Preset di studio">
      <Field label="Carica">
        <Select
          label="Carica un preset"
          testId="preset-load"
          value="__"
          options={presetLoadOptions(saved)}
          onChange={(id) => {
            const label = loadStudyPreset(id, saved);
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
