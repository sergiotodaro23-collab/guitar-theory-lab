/**
 * The notebook: tabbed pages chosen by the laboratory (the existing panels,
 * unchanged) and the device drawer that rises from its bottom edge. The page
 * and its scroll position stay put while a device is open.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useApp } from '../../../app/store';
import { ArrangementPanel } from '../../ArrangementPanel';
import { BackingPanel } from '../../BackingPanel';
import { ChordViewPanel } from '../../ChordViewPanel';
import { DrumPanel } from '../../DrumMachine';
import { InputPanels } from '../../LivePanels';
import { ArpeggioPanel, ChordsPanel, ExercisePanel, HarmonyPanel, JamPanels, ScalePanel } from '../../panels';
import { TutorPhone } from '../TutorPhone';
import { DeviceDrawer } from './DeviceDrawer';
import { TUNER, TunerDevice } from './devices';
import { MIXER_CANVAS, MixerDevice } from './MixerDevice';
import { NextFretboard } from './NextFretboard';
import { DetailsPage, VoiceLeadingPage } from '../v6/DetailsPage';
import { DEVICES } from './Rail';
import { activeTab, compactLevel, fitScale, tabKeyTarget, tabsFor, type TabId } from './layout';
import { useStudioUi, type DeviceId } from './uiStore';

const CANVAS: Record<DeviceId, { w: number; h: number }> = {
  mixer: MIXER_CANVAS,
  tuner: TUNER.canvas,
};

function LegendPage({ onLegendHost }: { readonly onLegendHost: (el: HTMLElement | null) => void }) {
  const mode = useApp((s) => s.settings.mode);
  return (
    <>
      <section className="v57-sc v57-sc-wide" aria-label="Legenda">
        <h4 className="v57-sh">Legenda · solo ciò che è sulla tastiera ora</h4>
        <div ref={onLegendHost} className="v57-legend" data-testid="notebook-legend" />
        <p className="v57-note">Le voci compaiono e scompaiono con ciò che la tastiera disegna: forme e colori, mai solo il colore. Le preferenze di visualizzazione sono nel menu Visualizzazione sopra la tastiera.</p>
      </section>
      <section className="v57-sc v57-sc-tutor" aria-label="Tutor">
        <TutorPhone />
      </section>
      {/* Outside the scale lab, the scale and its overlays are what the neck shows under the chords: they are set here. */}
      {mode === 'jam' ? <JamPanels part="aids" /> : null}
      {mode !== 'fretboard' ? <ScalePanel showLabels={false} /> : null}
    </>
  );
}

function page(id: TabId, onLegendHost: (el: HTMLElement | null) => void): ReactNode {
  switch (id) {
    case 'scale': return <ScalePanel showLabels={false} />;
    case 'chords': return <ChordsPanel />;
    case 'exercise': return <ExercisePanel />;
    case 'legend': return <LegendPage onLegendHost={onLegendHost} />;
    case 'next': return <NextFretboard />;
    case 'details': return <DetailsPage />;
    case 'harmony': return <HarmonyPanel part="progression" />;
    case 'views': return <ChordViewPanel />;
    case 'voice': return <VoiceLeadingPage />;
    case 'analysis': return <HarmonyPanel part="analysis" />;
    case 'arpeggio': return <ArpeggioPanel part="shape" />;
    case 'arpex': return <ArpeggioPanel part="practice" />;
    case 'jam': return <JamPanels part="progression" />;
    case 'song': return <ArrangementPanel />;
    case 'drums': return <DrumPanel />;
    case 'band': return <JamPanels part="band" />;
    case 'backing': return <BackingPanel />;
    case 'input': return <InputPanels />;
  }
}

export function Notebook({ onLegendHost }: { readonly onLegendHost: (el: HTMLElement | null) => void }) {
  const mode = useApp((s) => s.settings.mode);
  const ui = useStudioUi();
  const tabs = tabsFor(mode);
  const active = activeTab(mode, ui.pickedTab);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // The legend lives on its page: when the page is not shown there is no host.
  useEffect(() => { if (active.id !== 'legend') onLegendHost(null); }, [active.id, onLegendHost]);

  const onKey = (event: KeyboardEvent, index: number) => {
    const next = tabKeyTarget(event.key, index, tabs.length);
    if (next === null) return;
    event.preventDefault();
    const tab = tabs[next];
    if (tab) ui.pickTab(mode, tab.id);
    refs.current[next]?.focus();
  };

  return (
    <section className="v57-nb" aria-label="Taccuino" data-testid="notebook">
      <div className="v57-tabs" role="tablist" aria-label="Schede del taccuino" data-count={tabs.length}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`v57-tab-${tab.id}`}
            className="v57-tab"
            aria-selected={tab.id === active.id}
            aria-controls="v57-page"
            tabIndex={tab.id === active.id ? 0 : -1}
            style={{ ['--tc' as string]: tab.color }}
            data-testid={`tab-${tab.id}`}
            onClick={() => ui.pickTab(mode, tab.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="v57-pg v57-page" id="v57-page" role="tabpanel" aria-labelledby={`v57-tab-${active.id}`} tabIndex={0}
        style={{ ['--tc' as string]: active.color }} data-tab={active.id} data-testid="notebook-page" key={`${mode}-${active.id}`}>
        {page(active.id, onLegendHost)}
      </div>
    </section>
  );
}

/** Frame of the drawer panel (plate border and padding) around the device, in CSS px. */
const BAY_FRAME = 56;

/**
 * The device drawer (mixer, tuner) covers the whole notebook zone: full width
 * of the work column, from the divider down. The neck above never changes size; the
 * notebook's page and tab stay as they are underneath.
 */
export function DeviceBay() {
  const ui = useStudioUi();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 400 });
  useEffect(() => {
    const el = box.current?.parentElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height }); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const device = ui.device;
  const canvas = device ? CANVAS[device] : CANVAS.mixer;
  const fit = (c: { w: number; h: number }) => fitScale(c.w, c.h, size.w - BAY_FRAME, size.h - BAY_FRAME, true);
  // The rig takes whichever arrangement shows its controls larger.
  const scale = fit(canvas);
  const label = DEVICES.find((d) => d.id === device)?.label ?? '';
  return (
    <div ref={box} className="v57-bay">
      <DeviceDrawer device={device} label={label} onClose={ui.closeDevice} returnFocusTo={ui.launcher} compactLevel={compactLevel(size.h)}>
        {device === 'mixer' ? <MixerDevice scale={scale} /> : null}
        {device === 'tuner' ? <TunerDevice scale={scale} /> : null}
      </DeviceDrawer>
    </div>
  );
}
