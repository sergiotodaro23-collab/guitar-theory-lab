import { useRef } from 'react';
import { engine } from '../app/engine';
import { BPM_MAX, BPM_MIN, METERS, meterOf, type AppMode, type LabelMode } from '../app/settings';
import { useApp, usePlayhead } from '../app/store';
import { Select, Segmented } from './controls';

const MODES: readonly { value: AppMode; label: string }[] = [
  { value: 'fretboard', label: 'Fretboard Lab' },
  { value: 'harmony', label: 'Harmony Lab' },
  { value: 'arpeggio', label: 'Arpeggios Lab' },
  { value: 'jam', label: 'Jam Studio' },
];

function BeatLights() {
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

function CurrentChord() {
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

export function Transport() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.update);
  const state = usePlayhead((p) => p.state);
  const taps = useRef<number[]>([]);

  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((t, i) => t - (taps.current[i] as number));
      const average = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      update({ bpm: Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(60000 / average))) });
    }
  };

  return (
    <header className="rack">
      <div className="rack-top">
        <h1 className="nameplate" data-testid="nameplate">
          <span className="nameplate-title">GUITAR THEORY LAB</span>
          <span className="nameplate-byline">v{__APP_VERSION__} — by Sergio Todaro</span>
        </h1>
        <nav aria-label="Modalità">
          <Segmented label="Modalità" value={settings.mode} options={MODES} onChange={(mode) => update(withModeLabels(settings.labelMode, mode))} />
        </nav>
      </div>
      <div className="rack-controls">
        <div className="transport-buttons">
          <button type="button" className="play" data-testid="play" aria-pressed={state === 'playing'} onClick={() => engine.toggle()}>
            {state === 'playing' ? 'Pausa' : state === 'paused' ? 'Riprendi' : 'Avvia'}
          </button>
          <button type="button" className="stop" data-testid="stop" disabled={state === 'stopped'} onClick={() => engine.stop()}>Ferma</button>
        </div>
        <div className="bpm">
          <button type="button" className="nudge" aria-label="Rallenta di 1 BPM" onClick={() => engine.nudgeBpm(-1)}>−</button>
          <label className="bpm-readout">
            <input
              data-testid="bpm"
              className="bpm-input"
              type="number"
              min={BPM_MIN}
              max={BPM_MAX}
              value={settings.bpm}
              aria-label="BPM"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= BPM_MIN && value <= BPM_MAX) update({ bpm: Math.round(value) });
              }}
            />
            <span className="bpm-unit">BPM</span>
          </label>
          <button type="button" className="nudge" aria-label="Accelera di 1 BPM" onClick={() => engine.nudgeBpm(1)}>+</button>
          <input className="range bpm-range" type="range" min={BPM_MIN} max={BPM_MAX} value={settings.bpm} aria-label="Regola il BPM" onChange={(event) => update({ bpm: Number(event.target.value) })} />
          <button type="button" className="tap" onClick={tap}>Tap</button>
        </div>
        <BeatLights />
        <CurrentChord />
        <div className="time-controls">
          <Select
            label="Metrica"
            testId="meter"
            value={settings.meterId}
            options={Object.keys(METERS).map((id) => ({ value: id, label: id }))}
            onChange={(meterId) => update({ meterId })}
          />
          <Select
            label="Suddivisione del click"
            value={settings.subdivision}
            options={[
              { value: 1 as const, label: 'Click: movimenti' },
              { value: 2 as const, label: 'Click: ottavi' },
              { value: 3 as const, label: 'Click: terzine' },
              { value: 4 as const, label: 'Click: sedicesimi' },
            ]}
            onChange={(subdivision) => update({ subdivision })}
          />
          <label className="swing">
            <span>Swing</span>
            <input className="range" type="range" min={0} max={0.5} step={0.01} value={settings.swing} aria-label="Swing" onChange={(event) => update({ swing: Number(event.target.value) })} />
          </label>
        </div>
      </div>
    </header>
  );
}
