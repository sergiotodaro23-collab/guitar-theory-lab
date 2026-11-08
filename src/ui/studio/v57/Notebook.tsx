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
import { IFACE, InterfaceDevice, TUNER, TunerDevice } from './devices';
import { RIG_LAYOUTS, RigDevice, type RigLayout } from './rig';
import { MIXER_CANVAS, MixerDevice } from './MixerDevice';
import { NextFretboard } from './NextFretboard';
import { DEVICES } from './Rail';
import { activeTab, compactLevel, fitScale, tabKeyTarget, tabsFor, type TabId } from './layout';
import { useStudioUi, type DeviceId } from './uiStore';

const CANVAS: Record<DeviceId, { w: number; h: number }> = {
  mixer: MIXER_CANVAS,
  amp: RIG_LAYOUTS.stack,
  tuner: TUNER.canvas,
  iface: IFACE.canvas,
};

function LegendPage({ onLegendHost }: { readonly onLegendHost: (el: HTMLElement | null) => void }) {
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
    case 'harmony': return <HarmonyPanel />;
    case 'views': return <ChordViewPanel />;
    case 'arpeggio': return <ArpeggioPanel />;
    case 'jam': return <JamPanels />;
    case 'song': return <><ArrangementPanel /><BackingPanel /></>;
    case 'drums': return <DrumPanel />;
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
 * The device drawer covers the whole notebook zone: full width right of the
 * rail, from the divider down. The neck above never changes size; the
 * notebook's page and tab stay as they are underneath.
 */
export function DeviceBay() {
  const mode = useApp((s) => s.settings.mode);
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
  const rigLayout: RigLayout = fit(RIG_LAYOUTS.row) > fit(RIG_LAYOUTS.stack) ? 'row' : 'stack';
  const scale = device === 'amp' ? fit(RIG_LAYOUTS[rigLayout]) : fit(canvas);
  const label = DEVICES.find((d) => d.id === device)?.label ?? '';
  const openInputTab = () => { ui.pickTab(mode, 'input'); ui.closeDevice(); };
  return (
    <div ref={box} className="v57-bay">
      <DeviceDrawer device={device} label={label} onClose={ui.closeDevice} returnFocusTo={ui.launcher} compactLevel={compactLevel(size.h)}>
        {device === 'mixer' ? <MixerDevice scale={scale} /> : null}
        {device === 'amp' ? <RigDevice scale={scale} layout={rigLayout} /> : null}
        {device === 'tuner' ? <TunerDevice scale={scale} /> : null}
        {device === 'iface' ? <InterfaceDevice scale={scale} onOpenPanel={openInputTab} /> : null}
      </DeviceDrawer>
    </div>
  );
}
