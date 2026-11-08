/**
 * Studio: the instrument on a workbench. Composition from the owner's
 * reference A — mixer on the left, transport on top, the maple neck in the
 * middle, three paper notes under it, the tutor's phone on the right with the
 * legend on a note beneath. Materials are rendered bitmaps (tools/studio-assets);
 * every control is a shared component or a real input over the same store.
 */
import { useState, type ReactNode } from 'react';
import { engine } from '../../app/engine';
import { BPM_MAX, BPM_MIN, type AppMode } from '../../app/settings';
import { useApp, usePlayhead } from '../../app/store';
import { AccentGrid } from '../AccentGrid';
import { AppFooter } from '../AppFooter';
import { DrumPanel } from '../DrumMachine';
import { ArrangementPanel } from '../ArrangementPanel';
import { BackingPanel } from '../BackingPanel';
import { ChordViewPanel } from '../ChordViewPanel';
import { InputPanels } from '../LivePanels';
import { Board } from '../Board';
import { Knob } from '../hardware';
import {
  AppearanceToggle, BeatLights, BpmInput, ClickSelect, CurrentChord, MeterSelect, ModeNav, Nameplate, PlayControls, useTap,
} from '../Transport';
import { ArpeggioPanel, ChordsPanel, ExercisePanel, HarmonyPanel, JamPanels, LabelModeSelector, MixerShown, PresetsPanel, ScalePanel } from '../panels';
import { TutorPhone } from './TutorPhone';
import maple from './assets/maple.webp';
import { MixerDevice } from './v57/MixerDevice';

function Screws() {
  return (
    <>
      <span className="ws-screw ws-screw-tl" aria-hidden="true" />
      <span className="ws-screw ws-screw-tr" aria-hidden="true" />
      <span className="ws-screw ws-screw-bl" aria-hidden="true" />
      <span className="ws-screw ws-screw-br" aria-hidden="true" />
    </>
  );
}

function BarCounter() {
  const bar = usePlayhead((p) => p.bar);
  const beat = usePlayhead((p) => p.beat);
  const state = usePlayhead((p) => p.state);
  return <span className="lcd-counter" aria-label="Battuta e movimento">{state === 'stopped' ? '--.-' : `${bar + 1}.${beat + 1}`}</span>;
}

function TransportPlate() {
  const bpm = useApp((s) => s.settings.bpm);
  const swing = useApp((s) => s.settings.swing);
  const update = useApp((s) => s.update);
  const tap = useTap();
  return (
    <section className="ws-plate ws-transport" aria-label="Trasporto">
      <Screws />
      <PlayControls />
      <div className="ws-lcd" data-testid="lcd">
        <div className="lcd-row lcd-main"><CurrentChord /></div>
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
      <Knob label="Tempo" value={bpm} min={BPM_MIN} max={BPM_MAX} step={1} format={(v) => `${v} BPM`} onChange={(v) => update({ bpm: v })} testId="knob-bpm" className="knob-tempo" />
      <Knob label="Swing" value={swing} min={0} max={0.5} step={0.01} format={(v) => `${Math.round(v * 200)}%`} onChange={(v) => update({ swing: v })} testId="knob-swing" />
      <div className="ws-time">
        <span className="ws-engraved">Metrica</span>
        <MeterSelect />
        <span className="ws-engraved">Click</span>
        <ClickSelect />
      </div>
      <AccentGrid />
    </section>
  );
}

/** A sheet of paper held by tape or a pin; the user can open it wide when a panel needs room. */
function Note({ id, fastener, wide = false, full = false, children }: { readonly id: string; readonly fastener: 'tape' | 'pin'; readonly wide?: boolean; readonly full?: boolean; readonly children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`ws-note ws-${fastener} ${wide ? 'is-wide' : ''} ${full ? 'is-full' : ''} ${expanded ? 'is-expanded' : ''}`} data-testid={`note-${id}`}>
      <span className="ws-fastener" aria-hidden="true" />
      <button type="button" className="ws-note-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? 'Riduci' : 'Espandi'}
      </button>
      <div className="ws-note-body">{children}</div>
    </div>
  );
}

/** Three notes under the neck, chosen by workspace: the one used most comes first. */
function Notes({ mode }: { readonly mode: AppMode }) {
  const scale = <Note id="scale" fastener="tape" key="scale"><ScalePanel showLabels={false} /></Note>;
  const exercise = <Note id="exercise" fastener="pin" key="exercise"><ExercisePanel /></Note>;
  const views = <Note id="views" fastener="tape" key="views"><ChordViewPanel /></Note>;
  const notes = (() => {
    switch (mode) {
      case 'fretboard':
        return [scale, <Note id="chords" fastener="pin" key="chords"><ChordsPanel /></Note>, exercise];
      case 'harmony':
        return [<Note id="harmony" fastener="tape" key="harmony"><HarmonyPanel /></Note>, views, scale, exercise];
      case 'arpeggio':
        return [<Note id="arpeggio" fastener="pin" wide key="arpeggio"><ArpeggioPanel /></Note>, scale, views];
      case 'jam':
        return [<Note id="jam" fastener="tape" key="jam"><JamPanels /></Note>, views, scale, exercise, <Note id="drums" fastener="pin" full key="drums"><DrumPanel /></Note>, <Note id="song" fastener="tape" full key="song"><ArrangementPanel /></Note>, <Note id="backing" fastener="pin" key="backing"><BackingPanel /></Note>];
    }
  })();
  return <div className="ws-notes" data-mode={mode}>{notes}</div>;
}

export function StudioShell({ studioAllowed }: { readonly studioAllowed: boolean }) {
  const mode = useApp((s) => s.settings.mode);
  const [legendHost, setLegendHost] = useState<HTMLElement | null>(null);
  return (
    <MixerShown.Provider value>
      <div className="ws-bench" data-testid="studio">
      <div className="ws-rig">
        <header className="ws-head">
          <div className="ws-sticker"><Nameplate /></div>
          <ModeNav />
          <AppearanceToggle studioAllowed={studioAllowed} current="studio" />
        </header>
        <TransportPlate />
        <main className="ws-plate ws-neck" aria-label="Strumento">
          <Screws />
          <div className="ws-neck-toolbar"><LabelModeSelector /></div>
          <Board legendHost={legendHost} boardImage={maple} />
        </main>
        {/*
          On a desktop window the head, transport and neck stay put; these two
          columns scroll on their own (D-24). In smaller windows they dissolve
          into the page grid (display: contents) and the page scrolls.
        */}
        <div className="ws-scroll" data-testid="scroll-panels">
          <Notes mode={mode} />
          <MixerDevice />
          <section className="ws-plate ws-drawer" aria-label="Preset">
            <Screws />
            <PresetsPanel />
          </section>
          <AppFooter />
        </div>
        <div className="ws-right" data-testid="scroll-side">
          <aside className="ws-side">
            <TutorPhone />
          </aside>
          <aside className="ws-aside">
            <div className="ws-note ws-legend-note ws-tape" data-testid="note-legend">
              <span className="ws-fastener" aria-hidden="true" />
              <h2 className="ws-hand">Legenda</h2>
              <div ref={setLegendHost} />
            </div>
            <section className="ws-plate ws-input" aria-label="Ingresso chitarra">
              <Screws />
              <InputPanels />
            </section>
          </aside>
        </div>
      </div>
    </div>
      </MixerShown.Provider>
  );
}
