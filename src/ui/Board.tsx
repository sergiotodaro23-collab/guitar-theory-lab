import { useCallback, useMemo } from 'react';
import { engine } from '../app/engine';
import { arpeggioBoardNotes, boardContext } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { AVOID_PROFILES, classifyTone, functionsAcross } from '../harmony';
import { parsedChords } from '../jam';
import { buildScale, chromaticName, mod, tryParseChord, type Chord, type Scale } from '../theory';
import { resolveChordLayer } from '../app/chordLayers';
import { Fretboard, type LayerStyle } from '../viz/Fretboard';
import { PIP_PLACES, visibleLayers, type ScaleLayer } from '../app/scaleLayers';
import { buildMarkerLayer, type Marker } from '../viz/markers';

export function useHarmonyContext() {
  const settings = useApp((s) => s.settings);
  const selected = useApp((s) => s.selectedChord);
  const playheadChord = usePlayhead((p) => p.chordIndex);
  return useMemo(() => {
    if (settings.mode === 'fretboard') {
      // Only the active chord is drawn; the visible ones feed the note inspector.
      const resolved = settings.chordLayers.map(resolveChordLayer);
      const active = resolved[settings.activeChord];
      const shown = resolved.filter((r, i) => r.chord && (r.layer.visible || i === settings.activeChord));
      const chord = active?.chord ?? null;
      return {
        chords: shown.flatMap((r) => (r.chord ? [r.chord] : [])),
        chord,
        nextChord: null as Chord | null,
        chordIndex: Math.max(0, shown.findIndex((r) => r === active)),
        voicing: active?.shape?.notes ?? null,
      };
    }
    if (settings.mode === 'arpeggio' && settings.arpSource === 'chord') {
      const chord = tryParseChord(settings.arpSymbol);
      return { chords: chord ? [chord] : [], chord, nextChord: null as Chord | null, chordIndex: 0, voicing: null };
    }
    const chords = parsedChords(settings.progression);
    const chordIndex = Math.min(playheadChord ?? selected, Math.max(0, chords.length - 1));
    const chord = chords[chordIndex] ?? null;
    const nextChord = chords.length > 1 ? chords[(chordIndex + 1) % chords.length] ?? null : null;
    return { chords, chord, nextChord, chordIndex, voicing: null };
  }, [settings.mode, settings.chordLayers, settings.activeChord, settings.progression, settings.arpSource, settings.arpSymbol, playheadChord, selected]);
}

const LEGEND_CHORD: readonly { role: string; label: string; guide?: boolean }[] = [
  { role: 'chord-tone', label: 'Guide tone', guide: true },
  { role: 'chord-tone', label: 'Chord tone' },
  { role: 'tension', label: 'Tensione' },
  { role: 'avoid', label: 'Avoid contestuale' },
  { role: 'outside', label: 'Esterna' },
];
const LEGEND_SCALE = [
  { role: 'root', label: 'Tonica' },
  { role: 'scale', label: 'Scala' },
];

/** Colour, opacity and readable name of every overlay, by list position. */
export function layerStylesOf(layers: readonly ScaleLayer[]): readonly LayerStyle[] {
  return layers.map((layer) => {
    const scale = buildScale(layer.tonic, layer.scaleId);
    return { color: layer.color, opacity: layer.opacity, name: `${scale.tonicName} ${scale.definition.name}` };
  });
}

function Legend({ withChord, layers }: { readonly withChord: boolean; readonly layers: readonly ScaleLayer[] }) {
  const items = withChord ? LEGEND_CHORD : LEGEND_SCALE;
  const styles = layerStylesOf(layers);
  return (
    <ul className="legend" aria-label="Legenda" data-testid="legend">
      {items.map((item) => (
        <li key={item.label} className={`legend-item role-${item.role} ${'guide' in item && item.guide ? 'is-guide' : ''}`}>
          <span className="legend-swatch" aria-hidden="true" />
          {item.label}
        </li>
      ))}
      {layers.map((layer, i) => (layer.visible ? (
        <li key={layer.id} className={`legend-item legend-layer layer-${layer.color}`} data-testid="legend-layer">
          <svg className="legend-pip" viewBox="0 0 20 20" aria-hidden="true">
            <circle className="legend-pip-ring" cx="10" cy="10" r="6.5" />
            <circle className={`pip layer-${layer.color}`} cx={10 + (PIP_DIRS[i]?.[0] ?? 1) * 5.5} cy={10 + (PIP_DIRS[i]?.[1] ?? -1) * 5.5} r="3.2" />
          </svg>
          {styles[i]?.name} <span className="muted">(punto {PIP_PLACES[i]})</span>
        </li>
      ) : null))}
    </ul>
  );
}

const PIP_DIRS: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

export function Board() {
  const settings = useApp((s) => s.settings);
  const pinnedPc = useApp((s) => s.pinnedPc);
  const setPinned = useApp((s) => s.setPinned);
  const note = usePlayhead((p) => p.note);
  const trail = usePlayhead((p) => p.trail);
  const { chords, chord, nextChord, chordIndex, voicing } = useHarmonyContext();

  const playheadPhase = usePlayhead((p) => p.phase);
  const selectedPhase = useApp((s) => s.selectedPhase);
  const phaseIndex = playheadPhase ?? selectedPhase;
  const context = useMemo(() => (settings.mode === 'arpeggio'
    // Arpeggios Lab draws the chord tones of the hand position, over the current scale's spelling.
    ? { ...boardContext(settings, null), notes: arpeggioBoardNotes(chord, settings), wholeNeck: false }
    : boardContext(settings, phaseIndex)), [settings, phaseIndex, chord]);
  const { scale } = context;
  const overlays = useMemo(
    () => visibleLayers(settings.scaleLayers).map((shown) => ({ scale: shown.scale, index: shown.index, wholeNeck: shown.layer.region === 'neck' })),
    [settings.scaleLayers],
  );
  const layerStyles = useMemo(() => layerStylesOf(settings.scaleLayers), [settings.scaleLayers]);

  const layer = useMemo(() => buildMarkerLayer({
    notes: context.notes,
    scale,
    chord,
    nextChord,
    chords,
    chordIndex,
    focus: settings.mode === 'harmony' ? settings.focus : settings.mode === 'jam' ? settings.focus : 'all',
    profile: settings.avoidProfile,
    labelMode: settings.labelMode,
    pinnedPc,
    overlays,
    voicing,
    wholeNeck: context.wholeNeck,
  }), [settings, context, scale, chord, nextChord, chords, chordIndex, pinnedPc, overlays, voicing]);

  const onPick = useCallback((marker: Marker) => {
    setPinned(useApp.getState().pinnedPc === marker.pc ? null : marker.pc);
    engine.previewNote(marker.midi);
  }, [setPinned]);

  const showAids = settings.mode !== 'jam' || settings.showAids;
  const scalePcs = new Set(scale.tones.map((t) => t.pc));
  const active = note ? (() => {
    const pc = mod(note.midi, 12);
    const label = chord
      ? classifyTone(pc, chord, { profile: settings.avoidProfile, scalePcs }).degree
      : scale.tones.find((t) => t.pc === pc)?.[settings.labelMode === 'note' ? 'name' : 'degree'] ?? '';
    return { string: note.string, fret: note.fret, label };
  })() : null;

  return (
    <section className="board-section" aria-label="Tastiera">
      <Fretboard
        markers={showAids ? layer.markers : []}
        arrows={showAids ? layer.arrows : []}
        active={active}
        trail={showAids ? trail : []}
        layerStyles={layerStyles}
        onPick={onPick}
      />
      <div className="board-foot">
        {showAids ? <Legend withChord={chord !== null} layers={settings.scaleLayers} /> : <p className="aids-off">Aiuti nascosti: suona a orecchio, l’accordo resta in alto.</p>}
        <NoteInspector chords={chords} chordIndex={chordIndex} scale={scale} />
      </div>
    </section>
  );
}

function NoteInspector({ chords, chordIndex, scale }: { readonly chords: readonly Chord[]; readonly chordIndex: number; readonly scale: Scale }) {
  const settings = useApp((s) => s.settings);
  const pinnedPc = useApp((s) => s.pinnedPc);
  const setPinned = useApp((s) => s.setPinned);
  if (pinnedPc === null) {
    return <p className="inspector-empty">Tocca una nota per ascoltarla e vedere cosa diventa su ogni accordo.</p>;
  }
  const scalePcs = new Set(scale.tones.map((t) => t.pc));
  const entries = functionsAcross(pinnedPc, chords, { profile: settings.avoidProfile, scalePcs });
  const name = scale.tones.find((t) => t.pc === pinnedPc)?.name ?? chromaticName(pinnedPc, true);
  const profile = AVOID_PROFILES[settings.avoidProfile];
  const contextual = entries.find((e, i) => i === chordIndex && e.fn.reason);
  return (
    <div className="inspector" data-testid="inspector">
      <div className="inspector-head">
        <strong className="inspector-note">{name}</strong>
        <button type="button" className="link" onClick={() => setPinned(null)}>Chiudi</button>
      </div>
      {entries.length === 0 ? <p className="inspector-empty">Aggiungi un accordo per vedere la funzione di questa nota.</p> : (
        <ul className="fn-list">
          {entries.map((entry, i) => (
            <li key={`${entry.symbol}-${i}`} className={`fn-item role-${entry.fn.role} ${i === chordIndex ? 'is-current' : ''}`}>
              <span className="fn-degree">{entry.fn.degree}</span>
              <span className="fn-chord">{entry.symbol}</span>
            </li>
          ))}
        </ul>
      )}
      {contextual ? <p className="inspector-reason">{contextual.fn.reason} <span className="muted">Profilo: {profile.name}.</span></p> : null}
    </div>
  );
}
