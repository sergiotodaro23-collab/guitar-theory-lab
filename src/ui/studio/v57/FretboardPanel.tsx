/**
 * The fretboard panel: its toolbar (visualisation, labels, tuning) and the
 * production neck — six strings, frets 0–24, markers from the engine. The
 * visualisation preferences only change how things are drawn.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { tuningOf } from '../../../app/settings';
import { useApp } from '../../../app/store';
import { Board } from '../../Board';
import { LabelModeSelector, neckTuningChange, neckTuningOptions } from '../../panels';
import { Select } from '../../controls';
import { useStudioUi } from './uiStore';
import type { VizPrefs } from './layout';

function Pill({ on, label, onClick, testId }: { readonly on: boolean; readonly label: string; readonly onClick: () => void; readonly testId?: string }) {
  return (
    <button type="button" className="v57-pill" aria-pressed={on} data-on={on ? '1' : '0'} data-testid={testId} onClick={onClick}>
      <i aria-hidden="true" />{label}
    </button>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { readonly value: T; readonly options: readonly (readonly [T, string])[]; readonly onChange: (v: T) => void; readonly label: string }) {
  return (
    <div className="v57-row" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" className="v57-segbtn" aria-checked={value === v} data-on={value === v ? '1' : '0'} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

function VizPopover() {
  const ui = useStudioUi();
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const pop = useRef<HTMLDivElement>(null);
  const { viz, setViz } = ui;
  useEffect(() => {
    pop.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') ui.setVizOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key: keyof Pick<VizPrefs, 'showTargets' | 'showPlayback' | 'showArrows' | 'showOverlays'>) => setViz({ [key]: !viz[key] });
  return (
    <>
      <button type="button" className="v57-scrim" aria-label="Chiudi visualizzazione" tabIndex={-1} onClick={() => ui.setVizOpen(false)} />
      <div className="v57-pop" role="dialog" aria-label="Visualizzazione della tastiera" ref={pop} data-testid="viz-popover">
        <h4>Mostra sulla tastiera</h4>
        <div className="v57-row">
          <Pill on={viz.showTargets} label="Note target" onClick={() => toggle('showTargets')} testId="viz-targets" />
          <Pill on={viz.showPlayback} label="Riproduzione" onClick={() => toggle('showPlayback')} testId="viz-playback" />
          <Pill on={viz.showArrows} label="Frecce di risoluzione" onClick={() => toggle('showArrows')} testId="viz-arrows" />
          <Pill on={viz.showOverlays} label="Scale sovrapposte" onClick={() => toggle('showOverlays')} testId="viz-overlays" />
          <Pill on={s.liveOnBoard} label="Nota rilevata" onClick={() => update({ liveOnBoard: !s.liveOnBoard })} testId="viz-detected" />
          {s.mode === 'jam' ? <Pill on={s.showAids} label="Aiuti visivi" onClick={() => update({ showAids: !s.showAids })} /> : null}
        </div>
        <h4>Scale sovrapposte sulla nota</h4>
        <Seg label="Segno delle scale sovrapposte" value={viz.layerMarks} options={[['bars', 'Barrette sotto la nota'], ['dots', 'Puntini agli angoli']]} onChange={(layerMarks) => setViz({ layerMarks })} />
        <h4>Evidenziazione animata</h4>
        <Seg label="Evidenziazione della nota suonata e rilevata" value={viz.anim} options={[['pulse', 'Pulsazione'], ['glow', 'Bagliore'], ['static', 'Statica']]} onChange={(anim) => setViz({ anim })} />
        <p>Preferenze di sola visualizzazione: non cambiano scala, accordi, progressione o esercizio. «Nota rilevata» è l’impostazione dell’ingresso chitarra, condivisa con la Semplificata.</p>
      </div>
    </>
  );
}

function Toolbar() {
  const s = useApp((state) => state.settings);
  const update = useApp((state) => state.update);
  const vizOpen = useStudioUi((u) => u.vizOpen);
  const setVizOpen = useStudioUi((u) => u.setVizOpen);
  const vizKey = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !vizOpen) vizKey.current?.focus({ preventScroll: true });
    wasOpen.current = vizOpen;
  }, [vizOpen]);
  return (
    <div className="v57-fbtool">
      <button type="button" ref={vizKey} className="v57-vzbtn" aria-haspopup="dialog" aria-expanded={vizOpen} data-testid="viz-toggle" onClick={() => setVizOpen(!vizOpen)}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Visualizzazione
      </button>
      <span className="v57-labels"><LabelModeSelector /></span>
      <span className="v57-flex" />
      <span className="v57-silk" aria-hidden="true">Accordatura</span>
      <span className="v57-lsel">
        <Select<string> label="Accordatura del manico" value={s.neckTuning} options={neckTuningOptions} onChange={(neckTuning) => update(neckTuningChange(neckTuning, tuningOf(s)))} />
      </span>
      {vizOpen ? <VizPopover /> : null}
    </div>
  );
}

export function FretboardPanel({ height, legendHost }: { readonly height: number; readonly legendHost: HTMLElement | null }) {
  const viz = useStudioUi((u) => u.viz);
  const [inspectorHost, setInspectorHost] = useState<HTMLElement | null>(null);
  const style = { height } as CSSProperties;
  return (
    <section
      className="v57-plate v57-fbpanel"
      aria-label="Tastiera"
      style={style}
      data-anim={viz.anim}
      data-targets={viz.showTargets ? '1' : '0'}
      data-playback={viz.showPlayback ? '1' : '0'}
      data-arrows={viz.showArrows ? '1' : '0'}
      data-overlays={viz.showOverlays ? '1' : '0'}
      data-testid="fretboard-panel"
    >
      <Toolbar />
      <div className="v57-board">
        <Board foot="external" legendHost={legendHost} inspectorHost={inspectorHost} layerMarks={viz.layerMarks} />
        <div className="v57-inspector" ref={setInspectorHost} />
      </div>
    </section>
  );
}
