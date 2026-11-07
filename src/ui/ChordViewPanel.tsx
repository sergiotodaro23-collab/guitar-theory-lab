/**
 * "Vista per accordo" (P1-14, D-26): give each chord of the progression its
 * own picture of the neck. The same panel serves Harmony Lab, Arpeggios Lab
 * and Jam Studio, over the one `chordViews` map keyed by chord id.
 */
import { useState } from 'react';
import { engine } from '../app/engine';
import {
  MAX_ARPEGGIO_LAYERS, MAX_VISIBLE_OVERLAYS, addArpeggio, copyView, defaultScaleFor, defaultView, visibleOverlayCount,
  clampRange, type ChordView, type ViewPosition, type ViewShow,
} from '../app/chordViews';
import { LAYER_COLORS, LAYER_COLOR_NAMES, MAX_EXTRA_SCALES, MAX_SCALES, addLayer, type LayerColor } from '../app/scaleLayers';

import { useApp, usePlayhead } from '../app/store';
import { CAGED_FORMS, DEFAULT_FRETS, type CagedForm } from '../fretboard';
import { SCALES, tryParseChord, type ScaleId } from '../theory';
import { Field, Panel, Segmented, Select, Toggle } from './controls';
import { FOCUS_OPTIONS, scaleOptions, tonicOptions } from './panels';

type ShapeChoice = CagedForm | '3nps' | 'neck' | 'range';
const SHAPES: readonly { value: ShapeChoice; label: string }[] = [
  ...CAGED_FORMS.map((f) => ({ value: f, label: f })),
  { value: '3nps', label: '3NPS' },
  { value: 'range', label: 'Tasti' },
  { value: 'neck', label: 'Tutta' },
];
const shapeOf = (v: ChordView): ShapeChoice => (v.positionType === 'caged' ? v.cagedForm : v.positionType);
const shapeChange = (choice: ShapeChoice): Partial<ChordView> =>
  choice === '3nps' || choice === 'neck' || choice === 'range' ? { positionType: choice as ViewPosition } : { positionType: 'caged', cagedForm: choice };
const FRET_OPTIONS = Array.from({ length: DEFAULT_FRETS + 1 }, (_, f) => ({ value: f, label: String(f) }));
const COLOR_OPTIONS = LAYER_COLORS.map((c) => ({ value: c, label: LAYER_COLOR_NAMES[c] }));

export function ChordViewPanel() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const selected = useApp((state) => state.selectedChord);
  const playing = usePlayhead((p) => p.chordIndex);
  const transport = usePlayhead((p) => p.state);
  const chords = s.progression.chords;
  const [pick, setPick] = useState<number | null>(null);
  const index = Math.min(pick ?? playing ?? selected, Math.max(0, chords.length - 1));
  const entry = chords[index];
  const chord = entry ? tryParseChord(entry.symbol) : null;
  const view = entry ? s.chordViews[entry.id] ?? null : null;

  const setView = (next: ChordView | null) => {
    if (!entry) return;
    const views = { ...s.chordViews };
    if (next) views[entry.id] = next;
    else delete views[entry.id];
    update({ chordViews: views });
  };
  const change = (patch: Partial<ChordView>) => view && setView({ ...view, ...patch });
  const choose = (i: number) => {
    setPick(i);
    // Stopped: show the chord being edited. Playing: the progression keeps the board.
    if (transport === 'stopped') engine.setChord(i);
  };
  const others = chords.flatMap((c, i) => (i !== index && s.chordViews[c.id] ? [{ value: c.id, label: `${i + 1}. ${c.symbol}` }] : []));
  const overlayRoom = view ? visibleOverlayCount(view) < MAX_VISIBLE_OVERLAYS : false;

  if (chords.length === 0) {
    return <Panel title="Vista per accordo"><p className="field-hint">Aggiungi accordi alla progressione per dare a ognuno la sua vista.</p></Panel>;
  }
  return (
    <Panel title="Vista per accordo" className="chord-view-panel">
      <Toggle checked={s.chordViewsOn} onChange={(chordViewsOn) => update({ chordViewsOn })}>Cambia la tastiera con l’accordo</Toggle>
      {s.mode !== 'arpeggio' ? (
        <Toggle checked={s.exerciseFollowsView} onChange={(exerciseFollowsView) => update({ exerciseFollowsView })}>
          L’esercizio segue la vista di ogni accordo
        </Toggle>
      ) : null}
      {s.mode === 'arpeggio' && s.arpSource === 'chord' ? (
        <p className="field-hint">In Arpeggios Lab le viste valgono quando gli arpeggi seguono la progressione.</p>
      ) : null}
      <ol className="chord-view-chips" aria-label="Accordo da configurare">
        {chords.map((c, i) => (
          <li key={c.id}>
            <button
              type="button"
              className={`chord-chip small ${s.chordViews[c.id] ? 'has-view' : ''}`}
              aria-pressed={i === index}
              data-testid={`view-chip-${i}`}
              onClick={() => choose(i)}
            >
              {c.symbol}
              <span className="view-mark">{s.chordViews[c.id] ? ' · vista' : ''}</span>
            </button>
          </li>
        ))}
      </ol>
      {!view ? (
        <div className="row chord-view-empty">
          <p className="field-hint">{entry?.symbol} usa la vista generale (scala e forma del pannello Scala).</p>
          <button type="button" className="btn btn-accent" data-testid="view-customize" disabled={!chord} onClick={() => chord && setView(defaultView(chord))}>
            Personalizza {entry?.symbol}
          </button>
          {others.length > 0 ? (
            <Field label="Oppure copia la vista di">
              <Select<string>
                label="Copia la vista di"
                value=""
                options={[{ value: '', label: 'Scegli…' }, ...others]}
                onChange={(id) => { const source = s.chordViews[id]; if (source) setView(copyView(source)); }}
              />
            </Field>
          ) : null}
        </div>
      ) : (
        <div className="chord-view-editor" data-testid="view-editor">
          <Field label="Sulla tastiera" group>
            <Segmented<ViewShow>
              label="Cosa mostrare"
              value={view.show}
              options={[{ value: 'arpeggio', label: 'Solo arpeggio' }, { value: 'scale', label: 'Scala con funzioni' }]}
              onChange={(show) => change({ show })}
            />
          </Field>
          <div className="row">
            <Field label="Tonica"><Select label="Tonica della vista" testId="view-tonic" value={view.tonic} options={tonicOptions} onChange={(tonic) => change({ tonic })} /></Field>
            <Field label="Scala" hint={chord ? `Di solito su ${chord.symbol}: ${chord.rootName} ${SCALES[defaultScaleFor(chord)].name}.` : undefined}>
              <Select label="Scala della vista" testId="view-scale" value={view.scaleId} options={scaleOptions} onChange={(scaleId: ScaleId) => change({ scaleId })} />
            </Field>
          </div>
          <Field label="Forma" group>
            <Segmented<ShapeChoice> label="Forma della vista" value={shapeOf(view)} options={SHAPES} onChange={(choice) => change(shapeChange(choice))} />
          </Field>
          {view.positionType === 'range' ? (
            <div className="row" data-testid="view-range">
              <Field label="Dal tasto">
                <Select<number> label="Primo tasto della vista" testId="view-range-low" value={view.rangeLow} options={FRET_OPTIONS} onChange={(low) => change(clampRange(low, Math.max(low, view.rangeHigh)))} />
              </Field>
              <Field label="Al tasto" hint="Al massimo dodici tasti: oltre, scegli Tutta.">
                <Select<number> label="Ultimo tasto della vista" testId="view-range-high" value={view.rangeHigh} options={FRET_OPTIONS} onChange={(high) => change(clampRange(Math.min(high, view.rangeLow), high))} />
              </Field>
            </div>
          ) : null}
          <Field label="Cosa evidenziare" hint={FOCUS_OPTIONS.find((f) => f.value === view.focus)?.help}>
            <Select label="Focus della vista" testId="view-focus" value={view.focus} options={FOCUS_OPTIONS} onChange={(focus) => change({ focus })} />
          </Field>

          <h3 className="panel-subtitle">Altre scale <span className="muted">({view.layers.length + 1} di {MAX_SCALES})</span></h3>
          <ol className="layer-list">
            {view.layers.map((layer, i) => (
              <li key={layer.id} className={`layer-item layer-${layer.color}`}>
                <div className="row">
                  <Select label={`Tonica della scala aggiunta ${i + 1}`} value={layer.tonic} options={tonicOptions} onChange={(tonic) => change({ layers: view.layers.map((l) => (l.id === layer.id ? { ...l, tonic } : l)) })} />
                  <Select label={`Tipo della scala aggiunta ${i + 1}`} value={layer.scaleId} options={scaleOptions} onChange={(scaleId: ScaleId) => change({ layers: view.layers.map((l) => (l.id === layer.id ? { ...l, scaleId } : l)) })} />
                  <Select<LayerColor> label={`Colore della scala aggiunta ${i + 1}`} value={layer.color} options={COLOR_OPTIONS} onChange={(color) => change({ layers: view.layers.map((l) => (l.id === layer.id ? { ...l, color } : l)) })} />
                  <ShowToggle name={`la scala aggiunta ${i + 1}`} visible={layer.visible} room={overlayRoom} onChange={(visible) => change({ layers: view.layers.map((l) => (l.id === layer.id ? { ...l, visible } : l)) })} />
                  <button type="button" className="icon-btn" aria-label={`Rimuovi la scala aggiunta ${i + 1}`} onClick={() => change({ layers: view.layers.filter((l) => l.id !== layer.id) })}>✕</button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn" data-testid="view-add-scale" disabled={view.layers.length >= MAX_EXTRA_SCALES}
            onClick={() => {
              const layers = addLayer(view.layers, { tonic: view.tonic, scaleId: view.scaleId });
              const added = layers.at(-1);
              change({ layers: added && !overlayRoom ? layers.map((l) => (l.id === added.id ? { ...l, visible: false } : l)) : layers });
            }}>
            + Aggiungi scala
          </button>

          <h3 className="panel-subtitle">Arpeggi sovrapposti <span className="muted">({view.arpeggios.length} di {MAX_ARPEGGIO_LAYERS})</span></h3>
          <ol className="layer-list">
            {view.arpeggios.map((arp, i) => (
              <li key={arp.id} className={`layer-item layer-${arp.color}`}>
                <div className="row">
                  <ArpeggioSymbol
                    value={arp.symbol}
                    index={i}
                    onCommit={(symbol) => change({ arpeggios: view.arpeggios.map((a) => (a.id === arp.id ? { ...a, symbol } : a)) })}
                  />
                  <Select<LayerColor> label={`Colore dell’arpeggio ${i + 1}`} testId={`view-arp-color-${i}`} value={arp.color} options={COLOR_OPTIONS} onChange={(color) => change({ arpeggios: view.arpeggios.map((a) => (a.id === arp.id ? { ...a, color } : a)) })} />
                  <ShowToggle name={`l’arpeggio ${i + 1}`} visible={arp.visible} room={overlayRoom} onChange={(visible) => change({ arpeggios: view.arpeggios.map((a) => (a.id === arp.id ? { ...a, visible } : a)) })} />
                  <button type="button" className="icon-btn" aria-label={`Rimuovi l’arpeggio ${i + 1}`} onClick={() => change({ arpeggios: view.arpeggios.filter((a) => a.id !== arp.id) })}>✕</button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn" data-testid="view-add-arpeggio" disabled={view.arpeggios.length >= MAX_ARPEGGIO_LAYERS}
            onClick={() => change(addArpeggio(view, chords[(index + 1) % chords.length]?.symbol ?? entry?.symbol ?? 'C'))}>
            + Aggiungi arpeggio
          </button>
          <p className="field-hint">Al massimo {MAX_VISIBLE_OVERLAYS} sovrapposizioni visibili insieme: ognuna prende un angolo della nota.</p>
          <button type="button" className="btn" data-testid="view-reset" onClick={() => setView(null)}>Torna alla vista generale</button>
        </div>
      )}
    </Panel>
  );
}

function ShowToggle({ visible, room, onChange, name }: { readonly visible: boolean; readonly room: boolean; readonly onChange: (v: boolean) => void; readonly name: string }) {
  return (
    <label className="toggle" title={!visible && !room ? `Già ${MAX_VISIBLE_OVERLAYS} sovrapposizioni visibili` : undefined}>
      <input type="checkbox" aria-label={`Mostra ${name}`} checked={visible} disabled={!visible && !room} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden="true" />
      Mostra
    </label>
  );
}

/** Chord symbol for an overlay, kept only when the engine can read it. */
function ArpeggioSymbol({ value, index, onCommit }: { readonly value: string; readonly index: number; readonly onCommit: (s: string) => void }) {
  const [text, setText] = useState(value);
  const valid = tryParseChord(text) !== null;
  return (
    <input
      className={`text-input ${valid ? '' : 'is-invalid'}`}
      aria-label={`Accordo dell’arpeggio ${index + 1}`}
      aria-invalid={!valid}
      data-testid={`view-arp-${index}`}
      value={text}
      onChange={(e) => { setText(e.target.value); if (tryParseChord(e.target.value)) onCommit(e.target.value.trim()); }}
    />
  );
}
