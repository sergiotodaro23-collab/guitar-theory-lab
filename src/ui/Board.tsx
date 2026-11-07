import { useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { engine } from '../app/engine';
import { arpeggioPlanOf, boardContext } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { AVOID_PROFILES, chordOrigin, classifyTone, functionsAcross } from '../harmony';
import { parsedChords } from '../jam';
import { buildScale, chromaticName, mod, tryParseChord, type Chord, type Scale } from '../theory';
import { resolveChordLayer } from '../app/chordLayers';
import { Fretboard, type LayerStyle } from '../viz/Fretboard';
import { legendEntries, type LegendEntry } from '../viz/legend';
import { useLive } from '../audio/liveInput';
import { livePositions, noteOf } from '../pitch';
import type { FretPosition } from '../fretboard';
import { PIP_PLACES, visibleLayers, type ScaleLayer } from '../app/scaleLayers';
import { MAX_VISIBLE_OVERLAYS, defaultScaleFor, viewForChord, viewNotes, viewOverlays, viewScale } from '../app/chordViews';
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

/** Colour, opacity and readable name of every overlay, by list position. */
export function layerStylesOf(layers: readonly ScaleLayer[]): readonly LayerStyle[] {
  return layers.map((layer) => {
    const scale = buildScale(layer.tonic, layer.scaleId);
    return { color: layer.color, opacity: layer.opacity, name: `${scale.tonicName} ${scale.definition.name}` };
  });
}

/** An overlay as the legend lists it: colour, name, and which corner its pip takes. */
interface LegendOverlay {
  readonly id: string;
  readonly color: string;
  readonly name: string;
  readonly pip: number;
}

/** Only what is drawn: the entries come from the markers on the neck, with shapes as well as colours. */
function Legend({ entries, overlays }: { readonly entries: readonly LegendEntry[]; readonly overlays: readonly LegendOverlay[] }) {
  return (
    <ul className="legend" aria-label="Legenda" data-testid="legend">
      {entries.map((entry) => (
        <li key={entry.kind} className={`legend-item legend-${entry.kind}`} data-kind={entry.kind}>
          <span className="legend-swatch" aria-hidden="true" />
          {entry.label}
        </li>
      ))}
      {overlays.map((o) => (
        <li key={o.id} className={`legend-item legend-layer layer-${o.color}`} data-testid="legend-layer">
          <svg className="legend-pip" viewBox="0 0 20 20" aria-hidden="true">
            <circle className="legend-pip-ring" cx="10" cy="10" r="6.5" />
            <circle className={`pip layer-${o.color}`} cx={10 + (PIP_DIRS[o.pip]?.[0] ?? 1) * 5.5} cy={10 + (PIP_DIRS[o.pip]?.[1] ?? -1) * 5.5} r="3.2" />
          </svg>
          {o.name} <span className="muted">(punto {PIP_PLACES[o.pip]})</span>
        </li>
      ))}
    </ul>
  );
}

const PIP_DIRS: readonly (readonly [number, number])[] = [[1, -1], [1, 1], [-1, 1], [-1, -1]];

/**
 * The neck with its legend and note inspector. A layout that keeps the legend
 * elsewhere (Studio's note under the phone) passes the element to render it into.
 */
export function Board({ legendHost = null, boardImage = null }: { readonly legendHost?: HTMLElement | null; readonly boardImage?: string | null } = {}) {
  const settings = useApp((s) => s.settings);
  const pinnedPc = useApp((s) => s.pinnedPc);
  const setPinned = useApp((s) => s.setPinned);
  const note = usePlayhead((p) => p.note);
  const trail = usePlayhead((p) => p.trail);
  const { chords, chord, nextChord, chordIndex, voicing } = useHarmonyContext();

  const playheadPhase = usePlayhead((p) => p.phase);
  const selectedPhase = useApp((s) => s.selectedPhase);
  const phaseIndex = playheadPhase ?? selectedPhase;
  // The playing (or chosen) chord's own view, when it has one (D-26).
  const view = useMemo(() => {
    const onProgression = settings.mode === 'harmony' || settings.mode === 'jam' || (settings.mode === 'arpeggio' && settings.arpSource === 'progression');
    return settings.chordViewsOn && onProgression
      ? viewForChord(settings.chordViews, settings.progression.chords.map((c) => c.id), chordIndex)
      : null;
  }, [settings.mode, settings.arpSource, settings.chordViewsOn, settings.chordViews, settings.progression, chordIndex]);
  const context = useMemo(() => {
    // Arpeggios Lab draws the chord tones of the hand position, over the current scale's spelling.
    if (settings.mode === 'arpeggio') {
      const plan = arpeggioPlanOf(chord, settings);
      return { ...boardContext(settings, null), notes: plan?.notes ?? [], wholeNeck: false, exact: plan?.route ?? false, fingers: plan?.fingers ?? null };
    }
    if (view && chord) return { scale: viewScale(view), notes: viewNotes(view, chord), wholeNeck: view.positionType === 'neck' };
    // No view: with "scale from the analysis", the chord's own scale in its context (D-30).
    if (chord && settings.contextScales && (settings.mode === 'harmony' || settings.mode === 'jam')) {
      const own = chordOrigin(chord, settings.harmonyKey, settings.harmonyMode).scale ?? { tonic: chord.rootName, scaleId: defaultScaleFor(chord) };
      return boardContext({ ...settings, tonic: own.tonic, scaleId: own.scaleId }, phaseIndex);
    }
    return boardContext(settings, phaseIndex);
  }, [settings, phaseIndex, chord, view]);
  const { scale } = context;
  // Overlays: the chord view's (first four visible), else the general extra scales.
  const shownOverlays = useMemo((): readonly (LegendOverlay & { readonly scale: Scale; readonly wholeNeck: boolean; readonly opacity: number; readonly index: number })[] => {
    if (view) {
      return viewOverlays(view).filter((o) => o.visible).slice(0, MAX_VISIBLE_OVERLAYS)
        .map((o, i) => ({ id: o.id, color: o.color, name: o.name, pip: i, index: i, scale: o.scale, wholeNeck: o.wholeNeck, opacity: o.opacity }));
    }
    const styles = layerStylesOf(settings.scaleLayers);
    return visibleLayers(settings.scaleLayers).map((shown) => ({
      id: shown.layer.id, color: shown.layer.color, name: styles[shown.index]?.name ?? '', pip: shown.index, index: shown.index,
      scale: shown.scale, wholeNeck: shown.layer.region === 'neck', opacity: shown.layer.opacity,
    }));
  }, [view, settings.scaleLayers]);
  const overlays = useMemo(() => shownOverlays.map((o) => ({ scale: o.scale, index: o.index, wholeNeck: o.wholeNeck })), [shownOverlays]);
  const layerStyles = useMemo(() => {
    if (!view) return layerStylesOf(settings.scaleLayers);
    return shownOverlays.map((o) => ({ color: o.color as LayerStyle['color'], opacity: o.opacity, name: o.name }));
  }, [view, settings.scaleLayers, shownOverlays]);

  const layer = useMemo(() => buildMarkerLayer({
    notes: context.notes,
    scale,
    chord,
    nextChord,
    chords,
    chordIndex,
    focus: view && settings.mode !== 'arpeggio' ? view.focus : settings.mode === 'harmony' || settings.mode === 'jam' ? settings.focus : 'all',
    profile: settings.avoidProfile,
    labelMode: settings.labelMode,
    pinnedPc,
    overlays,
    voicing,
    wholeNeck: context.wholeNeck,
    exact: 'exact' in context ? context.exact : false,
    fingers: 'fingers' in context ? context.fingers : null,
  }), [settings, context, scale, chord, nextChord, chords, chordIndex, pinnedPc, overlays, voicing, view]);

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

  // Detected pitch: every place it can be played, the likely one from what the board shows.
  const livePitch = useLive((l) => l.pitch);
  const liveOn = useLive((l) => l.state === 'on') && settings.liveOnBoard;
  const lastLive = useRef<{ all: readonly FretPosition[]; likely: FretPosition | null }>({ all: [], likely: null });
  const live = useMemo(() => {
    if (!liveOn) return null;
    if (livePitch) {
      const midi = noteOf(livePitch.frequency, settings.tunerA4).midi;
      const where = livePositions(midi, layer.markers, lastLive.current.likely);
      lastLive.current = { all: where.all, likely: where.likely };
      // Loudness sets the opacity; RMS 0.15 is a firm pick.
      return { ...lastLive.current, intensity: Math.min(1, 0.35 + livePitch.rms / 0.15) };
    }
    // Silence: keep the last places, faded out by the CSS transition.
    return { ...lastLive.current, intensity: 0 };
  }, [liveOn, livePitch, layer.markers, settings.tunerA4]);
  const shownMarkers = useMemo(() => (showAids ? layer.markers : []), [showAids, layer.markers]);
  // The played-note entry stays while an exercise can play: it must not blink with each note (D-24).
  const played = active !== null || settings.exerciseOn || settings.mode === 'arpeggio';
  // While the input is on, the legend keeps both live entries: notes coming and going never resize it.
  const liveLikely = live !== null;
  const liveOthers = live !== null;
  const entries = useMemo(
    () => legendEntries(shownMarkers, { played, live: { likely: liveLikely, others: liveOthers } }),
    [shownMarkers, played, liveLikely, liveOthers],
  );
  const legend = showAids
    ? <Legend entries={entries} overlays={shownOverlays} />
    : <p className="aids-off">Aiuti nascosti: suona a orecchio, l’accordo resta in alto.</p>;

  return (
    <section className="board-section" aria-label="Tastiera">
      {legendHost ? createPortal(legend, legendHost) : null}
      <Fretboard
        markers={shownMarkers}
        arrows={showAids ? layer.arrows : []}
        active={active}
        trail={showAids ? trail : []}
        layerStyles={layerStyles}
        boardImage={boardImage}
        live={live}
        onPick={onPick}
      />
      <div className="board-foot">
        {legendHost ? null : legend}
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
