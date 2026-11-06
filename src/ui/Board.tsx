import { useCallback, useMemo } from 'react';
import { engine } from '../app/engine';
import { boardContext } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { AVOID_PROFILES, classifyTone, functionsAcross } from '../harmony';
import { parsedChords } from '../jam';
import { buildScale, chromaticName, mod, tryParseChord, type Chord, type Scale } from '../theory';
import { Fretboard } from '../viz/Fretboard';
import { buildMarkerLayer, type Marker } from '../viz/markers';

export function useHarmonyContext() {
  const settings = useApp((s) => s.settings);
  const selected = useApp((s) => s.selectedChord);
  const playheadChord = usePlayhead((p) => p.chordIndex);
  return useMemo(() => {
    if (settings.mode === 'fretboard') {
      const overlay = settings.overlayChord ? tryParseChord(settings.overlayChord) : null;
      return { chords: overlay ? [overlay] : [], chord: overlay, nextChord: null as Chord | null, chordIndex: 0 };
    }
    const chords = parsedChords(settings.progression);
    const chordIndex = Math.min(playheadChord ?? selected, Math.max(0, chords.length - 1));
    const chord = chords[chordIndex] ?? null;
    const nextChord = chords.length > 1 ? chords[(chordIndex + 1) % chords.length] ?? null : null;
    return { chords, chord, nextChord, chordIndex };
  }, [settings.mode, settings.overlayChord, settings.progression, playheadChord, selected]);
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

function Legend({ withChord }: { readonly withChord: boolean }) {
  const items = withChord ? LEGEND_CHORD : LEGEND_SCALE;
  return (
    <ul className="legend" aria-label="Legenda">
      {items.map((item) => (
        <li key={item.label} className={`legend-item role-${item.role} ${'guide' in item && item.guide ? 'is-guide' : ''}`}>
          <span className="legend-swatch" aria-hidden="true" />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function Board() {
  const settings = useApp((s) => s.settings);
  const pinnedPc = useApp((s) => s.pinnedPc);
  const setPinned = useApp((s) => s.setPinned);
  const note = usePlayhead((p) => p.note);
  const trail = usePlayhead((p) => p.trail);
  const { chords, chord, nextChord, chordIndex } = useHarmonyContext();

  const playheadPhase = usePlayhead((p) => p.phase);
  const selectedPhase = useApp((s) => s.selectedPhase);
  const phaseIndex = playheadPhase ?? selectedPhase;
  const context = useMemo(() => boardContext(settings, phaseIndex), [settings, phaseIndex]);
  const { scale } = context;
  const secondScale = useMemo(
    () => (settings.secondScaleOn ? buildScale(settings.secondTonic, settings.secondScaleId) : null),
    [settings.secondScaleOn, settings.secondTonic, settings.secondScaleId],
  );

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
    secondScale,
    wholeNeck: context.wholeNeck,
  }), [settings, context, scale, chord, nextChord, chords, chordIndex, pinnedPc, secondScale]);

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
        onPick={onPick}
      />
      <div className="board-foot">
        {showAids ? <Legend withChord={chord !== null} /> : <p className="aids-off">Aiuti nascosti: suona a orecchio, l’accordo resta in alto.</p>}
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
