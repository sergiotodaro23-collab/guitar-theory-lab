import { useRef } from 'react';
import { engine } from '../app/engine';
import { BPM_MAX, BPM_MIN, METERS, meterOf, type AppMode, type Appearance, type LabelMode } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { Select, Segmented } from './controls';

const MODES: readonly { value: AppMode; label: string }[] = [
  { value: 'fretboard', label: 'Fretboard Lab' },
  { value: 'harmony', label: 'Harmony Lab' },
  { value: 'arpeggio', label: 'Arpeggios Lab' },
  { value: 'jam', label: 'Jam Studio' },
];

export function BeatLights() {
  const settings = useApp((s) => s.settings);
  const beat = usePlayhead((p) => p.beat);
  const state = usePlayhead((p) => p.state);
  const heard = usePlayhead((p) => p.beatsPerBar);
  // While playing, the lights follow the meter being heard, which changes at the bar line.
  const count = state === 'stopped' ? meterOf(settings).beatsPerBar : heard;
  return (
    <div className="beat-lights" role="img" aria-label={state === 'stopped' ? 'Metronomo fermo' : `Movimento ${beat + 1} di ${count}`} data-testid="beat-lights" data-beat={beat} data-state={state}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`beat-light ${state !== 'stopped' && i === beat ? 'is-on' : ''} ${i === 0 ? 'is-first' : ''}`} />
      ))}
    </div>
  );
}

export function CurrentChord() {
  const settings = useApp((s) => s.settings);
  const chordIndex = usePlayhead((p) => p.chordIndex);
  const selected = useApp((s) => s.selectedChord);
  if (settings.mode === 'fretboard') {
    return (
      <div className="now-playing">
        <span className="now-chord now-chord-text" data-testid="current-chord">{settings.chordLayers[settings.activeChord]?.symbol || 'Solo scala'}</span>
      </div>
    );
  }
  if (settings.mode === 'arpeggio' && settings.arpSource === 'chord') {
    return (
      <div className="now-playing">
        <span className="now-chord" data-testid="current-chord">{settings.arpSymbol || 'Nessun accordo'}</span>
      </div>
    );
  }
  const chords = settings.progression.chords;
  const index = chordIndex ?? selected;
  const current = chords[index];
  const next = chords.length > 1 ? chords[(index + 1) % chords.length] : undefined;
  return (
    <div className="now-playing" aria-live="off">
      <span className="now-chord" data-testid="current-chord">{current?.symbol ?? 'Nessun accordo'}</span>
      {next ? <span className="next-chord">poi {next.symbol}</span> : null}
    </div>
  );
}

/** Harmony modes are about chord functions; the scale lab is about degrees. */
function withModeLabels(labelMode: LabelMode, mode: AppMode): { mode: AppMode; labelMode: LabelMode } {
  if (mode === 'fretboard' && labelMode === 'function') return { mode, labelMode: 'degree' };
  if (mode !== 'fretboard' && labelMode === 'degree') return { mode, labelMode: 'function' };
  return { mode, labelMode };
}

export function Nameplate() {
  return (
    <h1 className="nameplate" data-testid="nameplate">
      <span className="nameplate-title">GUITAR THEORY LAB</span>
      <span className="nameplate-byline">v{__APP_VERSION__} — by Sergio Todaro</span>
    </h1>
  );
}

/** The look toggle. Studio is disabled, not hidden, where the screen cannot hold it. */
export function AppearanceToggle({ studioAllowed, current }: { readonly studioAllowed: boolean; readonly current: Appearance }) {
  const update = useApp((s) => s.update);
  return (
    <div className="appearance" role="group" aria-label="Aspetto" data-testid="appearance">
      <span className="appearance-label">Aspetto</span>
      <Segmented
        label="Aspetto dell'interfaccia"
        value={current}
        options={[
          { value: 'simple', label: 'Semplificata' },
          { value: 'studio', label: 'Studio', disabled: !studioAllowed },
        ]}
        onChange={(value) => update({ look: value })}
      />
      {!studioAllowed ? <span className="appearance-note">Studio richiede uno schermo più grande</span> : null}
    </div>
  );
}

export function ModeNav() {
  const mode = useApp((s) => s.settings.mode);
  const labelMode = useApp((s) => s.settings.labelMode);
  const update = useApp((s) => s.update);
  return (
    <nav aria-label="Modalità" className="mode-nav">
      <Segmented label="Modalità" value={mode} options={MODES} onChange={(next) => update(withModeLabels(labelMode, next))} />
    </nav>
  );
}

export function PlayControls() {
  const state = usePlayhead((p) => p.state);
  return (
    <div className="transport-buttons">
      <button type="button" className="play" data-testid="play" aria-pressed={state === 'playing'} onClick={() => engine.toggle()}>
        {state === 'playing' ? 'Pausa' : state === 'paused' ? 'Riprendi' : 'Avvia'}
      </button>
      <button type="button" className="stop" data-testid="stop" disabled={state === 'stopped'} onClick={() => engine.stop()}>Ferma</button>
    </div>
  );
}

/** Tap tempo: the average of the last taps within 2.5 s. */
export function useTap(): () => void {
  const update = useApp((s) => s.update);
  const taps = useRef<number[]>([]);
  return () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - (taps.current[i] as number));
      const average = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      update({ bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / average))) });
    }
  };
}

export function BpmInput() {
  const bpm = useApp((s) => s.settings.bpm);
  const update = useApp((s) => s.update);
  return (
    <label className="bpm-readout">
      <input
        data-testid="bpm"
        className="bpm-input"
        type="number"
        min={BPM_MIN}
        max={BPM_MAX}
        value={bpm}
        aria-label="BPM"
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= BPM_MIN && value <= BPM_MAX) update({ bpm: Math.round(value) });
        }}
      />
      <span className="bpm-unit">BPM</span>
    </label>
  );
}

export function MeterSelect() {
  const meterId = useApp((s) => s.settings.meterId);
  const update = useApp((s) => s.update);
  return <Select label="Metrica" testId="meter" value={meterId} options={Object.keys(METERS).map((id) => ({ value: id, label: id }))} onChange={(value) => update({ meterId: value })} />;
}

export function ClickSelect() {
  const subdivision = useApp((s) => s.settings.subdivision);
  const update = useApp((s) => s.update);
  return (
    <Select
      label="Suddivisione del click"
      value={subdivision}
      options={[
        { value: 1 as const, label: 'Click: movimenti' },
        { value: 2 as const, label: 'Click: ottavi' },
        { value: 3 as const, label: 'Click: terzine' },
        { value: 4 as const, label: 'Click: sedicesimi' },
      ]}
      onChange={(value) => update({ subdivision: value })}
    />
  );
}
