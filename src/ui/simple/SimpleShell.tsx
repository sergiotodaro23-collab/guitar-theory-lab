/**
 * Semplificata: a console. Header strip with identity and modes, a transport
 * module with an LCD and real knobs, the instrument bay with the neck at full
 * width, and a deck of tabbed modules beside a mixer. Every control is one of
 * the shared components or a real input; the musical state is the same store.
 */
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { engine } from '../../app/engine';
import { BPM_MAX, BPM_MIN, type AppMode } from '../../app/settings';
import { useApp, usePlayhead } from '../../app/store';
import { AppFooter } from '../AppFooter';
import { Board } from '../Board';
import {
  AppearanceToggle, BeatLights, BpmInput, ClickSelect, CurrentChord, MeterSelect, ModeNav, Nameplate, PlayControls, useTap,
} from '../Transport';
import { ArpeggioPanel, ChordsPanel, ExercisePanel, HarmonyPanel, JamPanels, LabelModeSelector, MixerShown, PresetsPanel, ScalePanel } from '../panels';
import { Fader, Knob, OutputMeter } from '../hardware';

function BarCounter() {
  const bar = usePlayhead((p) => p.bar);
  const beat = usePlayhead((p) => p.beat);
  const state = usePlayhead((p) => p.state);
  return (
    <span className="lcd-counter" aria-label="Battuta e movimento">
      {state === 'stopped' ? '--.-' : `${bar + 1}.${beat + 1}`}
    </span>
  );
}

function TransportModule() {
  const bpm = useApp((s) => s.settings.bpm);
  const swing = useApp((s) => s.settings.swing);
  const update = useApp((s) => s.update);
  const tap = useTap();
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <section className={`cs-transport ${moreOpen ? 'is-open' : ''}`} aria-label="Trasporto">
      <PlayControls />
      <div className="cs-lcd" data-testid="lcd">
        <div className="lcd-row lcd-main">
          <CurrentChord />
        </div>
        <div className="lcd-row lcd-sub">
          <BarCounter />
          <span className="lcd-bpm">
            <button type="button" className="lcd-nudge" aria-label="Rallenta di 1 BPM" onClick={() => engine.nudgeBpm(-1)}>−</button>
            <BpmInput />
            <button type="button" className="lcd-nudge" aria-label="Accelera di 1 BPM" onClick={() => engine.nudgeBpm(1)}>+</button>
          </span>
          <BeatLights />
        </div>
      </div>
      <button type="button" className="tap" onClick={tap}>Tap</button>
      {/* On a phone the transport is a bar at the bottom; tempo, swing and metre fold behind this button. */}
      <button type="button" className="cs-more" aria-expanded={moreOpen} aria-controls="cs-transport-extra" data-testid="time-more-toggle" onClick={() => setMoreOpen(!moreOpen)}>
        Tempo e metrica
      </button>
      <div className="cs-transport-extra" id="cs-transport-extra">
      <Knob label="Tempo" value={bpm} min={BPM_MIN} max={BPM_MAX} step={1} format={(v) => `${v} BPM`} onChange={(v) => update({ bpm: v })} testId="knob-bpm" />
      <Knob label="Swing" value={swing} min={0} max={0.5} step={0.01} format={(v) => `${Math.round(v * 200)}%`} onChange={(v) => update({ swing: v })} testId="knob-swing" />
      <div className="cs-time">
        <span className="cs-silk">Metrica</span>
        <MeterSelect />
        <span className="cs-silk">Click</span>
        <ClickSelect />
      </div>
      </div>
    </section>
  );
}

interface DeckTab {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

/** Modules per workspace: the one used most comes first. */
function tabsFor(mode: AppMode): readonly DeckTab[] {
  const scale: DeckTab = { id: 'scale', label: 'Scale', content: <ScalePanel showLabels={false} /> };
  const exercise: DeckTab = { id: 'exercise', label: 'Esercizio', content: <ExercisePanel /> };
  const presets: DeckTab = { id: 'presets', label: 'Preset', content: <PresetsPanel /> };
  switch (mode) {
    case 'fretboard':
      return [scale, { id: 'chords', label: 'Accordi', content: <ChordsPanel /> }, exercise, presets];
    case 'harmony':
      return [{ id: 'harmony', label: 'Progressione', content: <HarmonyPanel /> }, scale, exercise, presets];
    case 'arpeggio':
      return [{ id: 'arpeggio', label: 'Arpeggi', content: <ArpeggioPanel /> }, scale, presets];
    case 'jam':
      return [{ id: 'jam', label: 'Jam', content: <JamPanels /> }, scale, exercise, presets];
  }
}

function Deck() {
  const mode = useApp((s) => s.settings.mode);
  const tabs = useMemo(() => tabsFor(mode), [mode]);
  const [picked, setPicked] = useState<Partial<Record<AppMode, string>>>({});
  const active = tabs.find((t) => t.id === picked[mode]) ?? tabs[0];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (tab) setPicked({ ...picked, [mode]: tab.id });
    refs.current[next]?.focus();
  };
  return (
    <section className="cs-deck" aria-label="Moduli">
      <div className="cs-tabs" role="tablist" aria-label="Moduli" aria-orientation="vertical">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`cs-tab-${tab.id}`}
            aria-selected={tab.id === active?.id}
            aria-controls="cs-module"
            tabIndex={tab.id === active?.id ? 0 : -1}
            className="cs-tab"
            onClick={() => setPicked({ ...picked, [mode]: tab.id })}
            onKeyDown={(e) => onKey(e, i)}
          >
            <span className="cs-tab-led" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>
      <div className="cs-module" id="cs-module" role="tabpanel" aria-labelledby={`cs-tab-${active?.id}`} data-tab={active?.id}>
        {active?.content}
      </div>
    </section>
  );
}

function Mixer() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  return (
    <section className="cs-mixer" aria-label="Mixer">
      <h2 className="cs-silk cs-mixer-title">Mixer</h2>
      <div className="cs-faders">
        <Fader label="Click" value={s.volClick} onChange={(volClick) => update({ volClick })} testId="fader-click" />
        <Fader label="Note" value={s.volNotes} onChange={(volNotes) => update({ volNotes })} testId="fader-notes" />
        <Fader label="Accordi" value={s.volComp} onChange={(volComp) => update({ volComp })} testId="fader-comp" />
        <OutputMeter />
      </div>
    </section>
  );
}

export function SimpleShell({ studioAllowed }: { readonly studioAllowed: boolean }) {
  return (
    <MixerShown.Provider value>
      <div className="cs-chassis" data-testid="simple-shell">
      <header className="cs-header">
        <Nameplate />
        <ModeNav />
        <AppearanceToggle studioAllowed={studioAllowed} current="simple" />
      </header>
      <TransportModule />
      <main className="cs-main">
        <section className="cs-bay" aria-label="Strumento">
          <div className="cs-bay-toolbar">
            <LabelModeSelector />
          </div>
          <Board />
        </section>
        <div className="cs-lower">
          <Deck />
          <Mixer />
        </div>
        <AppFooter />
      </main>
    </div>
      </MixerShown.Provider>
  );
}
